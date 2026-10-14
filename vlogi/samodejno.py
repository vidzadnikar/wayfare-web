"""Doda na stran vloge z YouTuba, ki čakajo v nadzoru, in pošlje obvestilo.

Teče v GitHub Actions (.github/workflows/youtube.yml), ko /api/samodejno
pove, da kaj čaka: vlog, ki ga je admin vnesel v nadzoru (povezava YouTube),
ali javni video s kanala. Za vsakega:

  1. prebere dolžino in datum objave s strani videa na YouTubu,
  2. prenese naslovnico (maxresdefault.jpg) v stran/media/vlogi/<oznaka>.jpg,
  3. doda vlog v stran/vlogi.json (z "samodejno": true, da ga zberi.py
     ohrani) in kraj na globus (koordinate iz nadzora ali OpenStreetMap),

nato zgradi stran (stran/zgradi.py), naredi commit in push (Cloudflare Pages
objavi) in pokliče zaledje/obvesti.py, ki počaka na objavo in pošlje
obvestilo članom. Stanje vsakega vloga sporoča nazaj na /api/samodejno.

Potrebuje OBVESTI_SECRET; STRAN_URL po želji (privzeto wayfarestudio.pages.dev).
Brez predogleda za kazalec (zanka): ta nastane le doma z zberi.py iz filma.
"""

import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
JSON = KOREN / "stran" / "vlogi.json"
MEDIA = KOREN / "stran" / "media" / "vlogi"
STRAN_URL = (os.environ.get("STRAN_URL") or "https://wayfarestudio.pages.dev").rstrip("/")
UA = "wayfare-obvesti/1.0 (+https://github.com/vidzadnikar/wayfare-web)"
BRSKALNIK = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def zahteva(url, *, metoda="GET", telo=None, glave=None, cas=30):
    g = {"User-Agent": UA, **(glave or {})}
    podatki = None
    if telo is not None:
        podatki = json.dumps(telo).encode()
        g["Content-Type"] = "application/json"
    with urllib.request.urlopen(urllib.request.Request(url, data=podatki, method=metoda, headers=g), timeout=cas) as odg:
        return odg.read()


def api(metoda, telo=None):
    skrivnost = os.environ.get("OBVESTI_SECRET")
    if not skrivnost:
        raise SystemExit("OBVESTI_SECRET manjka")
    return json.loads(zahteva(f"{STRAN_URL}/api/samodejno", metoda=metoda, telo=telo,
                              glave={"Authorization": f"Bearer {skrivnost}", "Accept": "application/json"}))


def sporoci(vid, stanje, **kaj):
    try:
        api("POST", {"id": vid, "stanje": stanje, **kaj})
    except Exception as e:  # sporočilo ni nujno za objavo
        print(f"  {vid}: stanja {stanje} ni bilo mogoče sporočiti ({e})")


def podatki_videa(vid):
    """Dolžina (s) in datum objave s strani videa; ob napaki (0, None)."""
    try:
        html = zahteva(f"https://www.youtube.com/watch?v={vid}&hl=en", glave={"User-Agent": BRSKALNIK, "Accept-Language": "en"}).decode("utf-8", "replace")
    except Exception as e:
        print(f"  {vid}: strani videa ni bilo mogoče prebrati ({e})")
        return 0, None
    dolzina = re.search(r'"lengthSeconds":"(\d+)"', html)
    objava = re.search(r'"(?:publishDate|uploadDate)":"(\d{4}-\d{2}-\d{2})', html)
    return (int(dolzina[1]) if dolzina else 0), (objava[1] if objava else None)


def naslovnica(vid, cilj):
    for ime in ("maxresdefault", "sddefault", "hqdefault"):
        try:
            slika = zahteva(f"https://i.ytimg.com/vi/{vid}/{ime}.jpg", cas=30)
        except urllib.error.HTTPError:
            continue
        if len(slika) > 2000:  # YouTube vrne majhno sivo sliko, kadar velike ni
            cilj.write_bytes(slika)
            return ime
    raise RuntimeError("YouTube še nima naslovnice")


def brez_sumnikov(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def nova_oznaka(r, zasedene):
    """rim-2, budimpesta-2-3, madrid-recap … iz kraja in naslova."""
    kraj = re.sub(r"[^a-z0-9]+", "-", brez_sumnikov(r["kraj_sl"].split(",")[0])).strip("-") or "vlog"
    en = r["naslov_en"]
    if m := re.search(r"Days? (\d+)(?:[–-](\d+))?", en):
        pripona = f"-{m[1]}" + (f"-{m[2]}" if m[2] else "")
    elif "Recap" in en:
        pripona = "-recap"
    else:
        pripona = "-" + r["id"][:6].lower().replace("_", "")
    oznaka = f"{kraj}{pripona}"
    n = 2
    while oznaka in zasedene:
        oznaka = f"{kraj}{pripona}-{n}"
        n += 1
    return oznaka


def koordinate(kraj_en):
    """Kraj, ki ga nadzor ne pozna: OpenStreetMap Nominatim (en klic)."""
    try:
        odg = json.loads(zahteva("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"format": "json", "limit": 1, "q": kraj_en})))
        if odg:
            return round(float(odg[0]["lon"]), 3), round(float(odg[0]["lat"]), 3)
    except Exception as e:
        print(f"  koordinat za {kraj_en} ni bilo mogoče dobiti ({e})")
    return None, None


def git(*args):
    return subprocess.run(["git", *args], cwd=KOREN, check=True, capture_output=True, text=True).stdout.strip()


def main():
    cakajo = api("GET")["cakajo"]
    if not cakajo:
        print("nič ne čaka")
        return 0
    podatki = json.load(open(JSON, encoding="utf-8"))
    vlogi, kraji = podatki["vlogi"], podatki.setdefault("kraji", [])
    po_youtube = {v["youtube"]: v["oznaka"] for v in vlogi if v.get("youtube")}
    zasedene = {v["oznaka"] for v in vlogi}
    dodani = []
    for r in cakajo:
        vid = r["id"]
        print(f"{vid}: {r['naslov_sl']}")
        sporoci(vid, "v_delu")
        try:
            if vid in po_youtube:
                print(f"  že na strani kot {po_youtube[vid]}")
                sporoci(vid, "dodan", oznaka=po_youtube[vid])
                continue
            dolzina, objava = podatki_videa(vid)
            oznaka = nova_oznaka(r, zasedene)
            print(f"  oznaka {oznaka}, naslovnica {naslovnica(vid, MEDIA / f'{oznaka}.jpg')}, {dolzina} s")
            if not any(k["kljuc"] == r["kraj_en"] for k in kraji):
                lon, lat = (r["lon"], r["lat"]) if r.get("lon") is not None else koordinate(r["kraj_en"])
                if lon is not None:
                    kraji.append({"kljuc": r["kraj_en"], "lon": lon, "lat": lat})
            zapis = {
                "oznaka": oznaka, "naslov": {"en": r["naslov_en"], "sl": r["naslov_sl"]},
                "kraj": {"en": r["kraj_en"], "sl": r["kraj_sl"]},
                "datum": r.get("datum") or objava or date.today().isoformat(), "datum_do": None,
                "trajanje": dolzina, "sirina": 1920, "visina": 1080, "posnetkov": None, "poglavja": [],
                "jezik": "sl", "youtube": vid, "samodejno": True,
            }
            # najnovejši prvi: pred prvi vlog s starejšim datumom
            mesto = next((i for i, v in enumerate(vlogi) if v["datum"] < zapis["datum"]), len(vlogi))
            vlogi.insert(mesto, zapis)
            zasedene.add(oznaka)
            dodani.append((r, oznaka))
        except Exception as e:
            print(f"  napaka: {e}")
            sporoci(vid, "napaka", napaka=str(e))
    if not dodani:
        return 0

    JSON.write_text(json.dumps(podatki, ensure_ascii=False, indent=1), encoding="utf-8")
    pred = git("rev-parse", "HEAD")
    try:
        subprocess.run([sys.executable, "zgradi.py"], cwd=KOREN / "stran", check=True)
        git("add", "stran", "objava")
        naslovi = ", ".join(r["naslov_sl"] for r, _ in dodani)
        git("commit", "-m", f"Vlogi: {naslovi} (samodejno z YouTuba)")
        git("push", "origin", "HEAD:main")
    except subprocess.CalledProcessError as e:
        napaka = (e.stderr or e.stdout or str(e))[-400:] if hasattr(e, "stderr") else str(e)
        for r, _ in dodani:
            sporoci(r["id"], "napaka", napaka=f"gradnja ali objava ni uspela: {napaka}")
        raise
    for r, oznaka in dodani:
        sporoci(r["id"], "dodan", oznaka=oznaka)
    print(f"objavljeno: {', '.join(o for _, o in dodani)}")
    # obvestilo članom: počaka, da Cloudflare objavi, nato pošlje (ali zadrži, če je tako nastavljeno)
    return subprocess.run([sys.executable, str(KOREN / "zaledje" / "obvesti.py"), "vlogi", pred], cwd=KOREN).returncode


if __name__ == "__main__":
    sys.exit(main())
