#!/usr/bin/env python3
"""Pošlje obvestila članom prek zaledja strani (POST /api/obvesti).

Teče v GitHub Actions (.github/workflows/obvesti.yml), lahko pa tudi doma:

    python3 zaledje/obvesti.py vlogi <prejšnji_commit>   # novi vlogi v stran/vlogi.json od tistega commita
    python3 zaledje/obvesti.py izdaja                     # izdaja iz dogodka release (GITHUB_EVENT_PATH)
    python3 zaledje/obvesti.py vrsta                      # le pošlje, kar čaka v vrsti (dnevna meja)

Okolje: OBVESTI_SECRET (skrivnost, ista kot v Cloudflare Pages), STRAN_URL
(privzeto https://wayfarestudio.pages.dev). Nov vlog je tisti, ki ima v HEAD
oznako youtube, v prejšnjem commitu pa je ni imel (ali ga ni bilo). Pred
klicem počaka, da je film na objavljeni strani (Cloudflare objavi v minuti),
največ pet minut. Zaledje vsak ključ pošlje največ enkrat, zato ponoven
klic ne podvaja pošte.
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

TU = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(TU)
STRAN_URL = (os.environ.get("STRAN_URL") or "https://wayfarestudio.pages.dev").rstrip("/")
CAKANJE_S = 300
KORAK_S = 15


def vlogi_iz(besedilo):
    return {v["oznaka"]: v for v in json.loads(besedilo)["vlogi"]}


def novi_vlogi(prejsnji_commit):
    zdaj = vlogi_iz(open(os.path.join(REPO, "stran", "vlogi.json"), encoding="utf-8").read())
    prej = {}
    if prejsnji_commit and not set(prejsnji_commit) <= {"0"}:
        try:
            prej = vlogi_iz(subprocess.check_output(["git", "show", f"{prejsnji_commit}:stran/vlogi.json"], cwd=REPO, text=True))
        except subprocess.CalledProcessError:
            print(f"prejšnji commit {prejsnji_commit} nima vlogi.json; brez primerjave ne pošljem nič")
            return []
    else:
        print("brez prejšnjega commita (nova veja): ne pošljem nič")
        return []
    novi = [v for o, v in zdaj.items() if v.get("youtube") and not prej.get(o, {}).get("youtube")]
    return novi


def trajanje(sekunde):
    s = int(round(sekunde))
    return f"{s // 60}:{s % 60:02d}"


def postavka_vloga(v):
    o = v["oznaka"]
    return {
        "vrsta": "vlog",
        "kljuc": f"vlog:{o}",
        "naslov": {"sl": v["naslov"]["sl"], "en": v["naslov"]["en"]},
        "besedilo": {
            "sl": f"{v['kraj']['sl']} · {trajanje(v['trajanje'])}. Nov film je na strani.",
            "en": f"{v['kraj']['en']} · {trajanje(v['trajanje'])}. A new film is up on the site.",
        },
        "url": {"sl": f"{STRAN_URL}/sl/vlogi/#{o}", "en": f"{STRAN_URL}/vlogi/#{o}"},
    }


def postavka_izdaje():
    pot = os.environ.get("GITHUB_EVENT_PATH")
    if not pot:
        raise SystemExit("GITHUB_EVENT_PATH manjka: ukaz izdaja teče le ob dogodku release")
    izdaja = json.load(open(pot, encoding="utf-8")).get("release") or {}
    if izdaja.get("draft") or izdaja.get("prerelease"):
        print("osnutek ali predizdaja: ne pošljem nič")
        return None
    oznaka = izdaja.get("tag_name") or ""
    ime = izdaja.get("name") or f"Wayfare Studio {oznaka}"
    opombe = (izdaja.get("body") or "").strip()
    if len(opombe) > 1500:
        opombe = opombe[:1500].rsplit("\n", 1)[0] + "\n…"
    povezava = izdaja.get("html_url") or ""
    besedilo_sl = "Nova različica aplikacije je na voljo za prenos."
    besedilo_en = "A new version of the app is ready to download."
    if opombe:
        besedilo_sl += "\n\n" + opombe
        besedilo_en += "\n\n" + opombe
    if povezava:
        besedilo_sl += f"\n\nVse spremembe: {povezava}"
        besedilo_en += f"\n\nAll changes: {povezava}"
    return {
        "vrsta": "izdaja",
        "kljuc": f"izdaja:{oznaka}",
        "naslov": {"sl": ime, "en": ime},
        "besedilo": {"sl": besedilo_sl, "en": besedilo_en},
        "url": {"sl": f"{STRAN_URL}/sl/#prenos", "en": f"{STRAN_URL}/#prenos"},
    }


# Cloudflare zavrne privzeti User-Agent Pythona (Python-urllib) z Error 1010
# (403), zato se skript predstavi z lastnim imenom.
GLAVE = {"User-Agent": "wayfare-obvesti/1.0 (+https://github.com/vidzadnikar/wayfare-web)"}


def pocakaj_na_strani(oznake):
    """Počaka, da so vsi novi vlogi na objavljeni strani Vlogi."""
    konec = time.time() + CAKANJE_S
    manjkajo = set(oznake)
    while manjkajo and time.time() < konec:
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{STRAN_URL}/vlogi/", headers=GLAVE), timeout=20) as odg:
                html = odg.read().decode("utf-8", "replace")
            manjkajo = {o for o in manjkajo if f'data-vlog="{o}"' not in html}
        except (urllib.error.URLError, OSError) as e:
            print(f"stran še ni dosegljiva: {e}")
        if manjkajo:
            print(f"čakam na objavo: {', '.join(sorted(manjkajo))}")
            time.sleep(KORAK_S)
    if manjkajo:
        print(f"po {CAKANJE_S} s še ni na strani: {', '.join(sorted(manjkajo))}; pošljem vseeno (povezave delajo, ko Cloudflare objavi)")


def poslji(postavke):
    skrivnost = os.environ.get("OBVESTI_SECRET")
    if not skrivnost:
        raise SystemExit("OBVESTI_SECRET manjka")
    telo = json.dumps({"postavke": postavke}).encode()
    zahteva = urllib.request.Request(
        f"{STRAN_URL}/api/obvesti", data=telo, method="POST",
        headers={**GLAVE, "Authorization": f"Bearer {skrivnost}", "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(zahteva, timeout=120) as odg:
            rezultat = json.loads(odg.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"zaledje je vrnilo {e.code}: {e.read().decode(errors='replace')[:500]}")
    for o in rezultat.get("obvestila", []):
        print(f"{o['kljuc']}: {o['stanje']}" + (f", {o['prejemnikov']} prejemnikov" if "prejemnikov" in o else ""))
    print(f"poslanih zdaj: {rezultat.get('poslanih', 0)}, čaka: {rezultat.get('caka', 0)}"
          + (f", napaka: {rezultat['napaka']}" if rezultat.get("napaka") else ""))
    if rezultat.get("napaka"):
        raise SystemExit(1)


def main():
    ukaz = sys.argv[1] if len(sys.argv) > 1 else ""
    if ukaz == "vlogi":
        novi = novi_vlogi(sys.argv[2] if len(sys.argv) > 2 else "")
        if not novi:
            print("ni novih vlogov")
            poslji([])
            return
        print("novi vlogi:", ", ".join(v["oznaka"] for v in novi))
        pocakaj_na_strani([v["oznaka"] for v in novi])
        poslji([postavka_vloga(v) for v in novi])
    elif ukaz == "izdaja":
        p = postavka_izdaje()
        poslji([p] if p else [])
    elif ukaz == "vrsta":
        poslji([])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
