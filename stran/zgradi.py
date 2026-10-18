"""Zgradi obe jezikovni različici strani iz predlog in besedila.json.

    python3 zgradi.py                # zgradi strani in mapo ../objava
    python3 zgradi.py --brez-objave  # samo strani (hitro, med delom)

Strani:
    predloga.html        → index.html (angleščina, koren) in sl/index.html
    predloga-vlogi.html  → vlogi/index.html in sl/vlogi/index.html
    predloga-zasebnost.html → zasebnost/index.html in sl/zasebnost/index.html
    predloga-ogled.html  → vlogi/<oznaka>/index.html in sl/vlogi/<oznaka>/index.html (vsak vlog)

Besedila so v besedila.json; ključ {{x}} v predlogi se zamenja z vrednostjo.
Vrednosti so zaupanja vredno besedilo z dovoljeno oznako (<em>, <br>).
Skupni deli (glava, noga, obvestilo ob prenosu, okno za prijavo) so v deli/ in
se vstavijo v vsako stran, da je glava povsod ista. Zavihek Vlogi bere vlogi.json, ki ga
naredi ../vlogi/zberi.py. Stran 404 (predloga-404.html) ima absolutne poti,
ker jo strežnik pošlje na poljubnem naslovu.

Objava: mapa ../objava je stran, kot gre na Cloudflare Pages (izhodna mapa
`objava`, brez ukaza za gradnjo). Vlogi igrajo z YouTuba, paket za prenos je
na GitHub Releases; oboje je za gostovanje strani preveliko (25 MB na datoteko).
"""

import base64
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urljoin

TU = os.path.dirname(os.path.abspath(__file__))

# Vsaka stran ima predlogo in izhod za oba jezika. Poti do korena, do domače
# strani istega jezika in do iste strani v drugem jeziku se izračunajo iz
# izhodnih poti, zato predloge ne poznajo svoje globine.
STRANI = {
    "dom":   dict(predloga="predloga.html", izhod={"en": "index.html", "sl": "sl/index.html"}),
    "vlogi": dict(predloga="predloga-vlogi.html", izhod={"en": "vlogi/index.html", "sl": "sl/vlogi/index.html"}),
    "zasebnost": dict(predloga="predloga-zasebnost.html", izhod={"en": "zasebnost/index.html", "sl": "sl/zasebnost/index.html"}),
    "napaka": dict(predloga="predloga-404.html", izhod={"en": "404.html", "sl": "sl/404.html"}),
}

# 24 sličic surovih posnetkov v časovnem zaporedju; poletijo v sled V1 časovnice
_VSE = [f"t{n:02d}" for n in range(1, 45) if n != 36]  # t36 je pokončen
SLICICE = [_VSE[round(i * (len(_VSE) - 1) / 23)] for i in range(24)]
V1_LEVO, V1_DESNO, V1_ZGORAJ, V1_VISINA = 7.4, 98.9, 78.4, 4.7

# Ukaz za namestitev skilla vlog v Claude Code (skills CLI, npx skills).
# Skill je javno na https://github.com/vidzadnikar/wayfare-skills (MIT).
# Deli ukaza se prelomijo le med seboj, nikoli med zastavico in njeno vrednostjo.
SKILL_UKAZ = ["npx skills add", "vidzadnikar/wayfare-skills", "--skill vlog", "-g", "-a claude-code"]

# Mesta v traku med herojem in aplikacijo, v domačem jeziku (enako v obeh
# različicah strani). Isti kraji so v videu v ozadju heroja.
MESTA = ["Lisboa", "Paris", "Praha", "Venezia", "Ljubljana", "Amsterdam", "Roma", "Barcelona", "Wien", "Madrid", "Milano"]
HERO_VIDEO = "hero-mesta"  # media/<ime>-1080.mp4, <ime>-720.mp4, <ime>-pokoncno.mp4 (telefon), <ime>.jpg

# Naslov objavljene strani: iz njega so absolutne povezave za deljenje (og:image,
# og:url), canonical, hreflang in zemljevid strani. WAYFARE_STRAN_URL ga zamenja.
STRAN_URL = os.environ.get("WAYFARE_STRAN_URL", "https://wayfarestudio.pages.dev").rstrip("/")


# Razglednice ob cilju: sličice iz posnetkov v videu heroja (media/razglednice/)
RAZGLEDNICE = ["lisboa", "roma", "praha", "venezia", "paris", "ljubljana", "malta"]
IMENA = {"lisboa": "Lisboa", "roma": "Roma", "praha": "Praha", "venezia": "Venezia", "paris": "Paris", "ljubljana": "Ljubljana",
         "malta": "Malta"}   # malta: slika iz Higgsfield (Soul Cinema), 13. 10. 2026


def razglednice():
    return "\n      ".join(
        f'<figure class="razglednica" data-razglednica><div class="razglednica-list">'
        f'<img src="{{{{koren}}}}media/razglednice/{m}.webp" alt="" width="960" height="720" loading="lazy">'
        f'<figcaption>{IMENA[m]}</figcaption></div></figure>'
        for m in RAZGLEDNICE
    )


def trak(mesta):
    """Vrstica imen za neskončni trak; vsebina je podvojena, da se zanka ne vidi."""
    deli = []
    for i, m in enumerate(mesta):
        slog = "mesto mesto-obris" if i % 2 else "mesto"
        deli.append(f'<span class="{slog}">{m}</span><span class="mesto-pika"></span>')
    return "".join(deli) * 2


# Vlogi igrajo z YouTuba, kadar ima vlog v vlogi.json polje "youtube" (oznaka
# videa; video je lahko Neobjavljen). Tak vlog na strani nima datotek -1080.mp4
# in -720.mp4, naslovnica in zanka za kazalec ostaneta na strani. Vdelava brez
# piškotkov; z enablejsapi gumbi poglavij ukazujejo predvajalniku (vlogi.js).
YOUTUBE = "https://www.youtube-nocookie.com"


def youtube_okvir(oznaka):
    return f"{YOUTUBE}/embed/{oznaka}?enablejsapi=1&rel=0&playsinline=1"


# Varnostna politika (CSP). Vse je z lastnega strežnika; vgrajeni skripti (razred
# "js" s preusmeritvijo in importmap) sta dovoljeni le z zgoščeno vrednostjo, zato
# vrinjena tuja skripta ne bi tekla. Slogi v atributih (mesta kosov) ostanejo.
# Obrazca za prijavo (form-action) gresta na lastno zaledje (/api/…), slika
# profila prijavljenega člana pride z Googlovega strežnika slik.
# frame-ancestors in upgrade-insecure-requests sta le v glavah strežnika (_headers).
# Okvir YouTuba je dovoljen le, kjer je potreben: v glavi strani Vlogi in v glavah
# strežnika, ki veljajo za vse strani (druge strani ga v svoji glavi prepovejo).
def csp(zgoscene, okvirji=False):
    skripte = " ".join(f"'sha256-{z}'" for z in sorted(zgoscene))
    okvir = YOUTUBE if okvirji else "'none'"
    return ("default-src 'self'; "
            f"script-src 'self' 'wasm-unsafe-eval' {skripte}; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com; "
            "media-src 'self'; font-src 'self'; connect-src 'self' blob:; object-src 'none'; base-uri 'self'; "
            f"form-action 'self'; frame-src {okvir}; worker-src 'none'; manifest-src 'self'")


def zgoscene_skript(html_):
    return {base64.b64encode(hashlib.sha256(m.encode()).digest()).decode()
            for m in re.findall(r"<script(?: type=\"importmap\")?>(.*?)</script>", html_, re.S)}


# Paket za prenos: najnovejši prenos/Wayfare-Studio-<različica>.dmg (zgradi ga
# ../paket/zgradi_paket.py) pove ime, velikost in različico. Sam paket je za
# gostovanje strani prevelik, zato gumb Prenos kaže na GitHub Releases
# repozitorija strani: izdaja z oznako v<različica> in paketom kot prilogo.
# WAYFARE_PRENOS_URL nadomesti naslov s poljubnim drugim.
PRENOS_URL = "https://github.com/vidzadnikar/wayfare-web/releases/download/v{razlicica}/{ime}"
# Paket za Windows: namestitveni program iz GitHub Actions (zasebni repozitorij
# wayfare), prilozen isti izdaji. Velikost pride iz kopije v prenos/, ce je tam.
PRENOS_WINDOWS = "Wayfare-Studio-Setup-{razlicica}.exe"
PRENOS_ANDROID = "Wayfare-Studio-{razlicica}.apk"


def prenos():
    """Podatki za gumbe Prenos. Doma iz paketa v prenos/ (in zapis v
    prenos.json); kjer paketa ni (GitHub Actions, vlogi/samodejno.py), iz
    zadnjega zapisa prenos.json."""
    zapis = Path(TU, "prenos.json")
    paketi = sorted(Path(TU, "prenos").glob("Wayfare-Studio-*.dmg"), key=lambda p: p.stat().st_mtime)
    if not paketi:
        if zapis.is_file():
            return json.load(open(zapis, encoding="utf-8"))
        raise SystemExit("V prenos/ ni paketa. Najprej zaženi ../paket/zgradi_paket.py.")
    podatki = prenos_iz_paketa(paketi)
    zapis.write_text(json.dumps(podatki, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return podatki


def prenos_iz_paketa(paketi):
    dmg = paketi[-1]
    razlicica = re.search(r"Studio-(.+)\.dmg$", dmg.name)[1]
    windows = PRENOS_WINDOWS.format(razlicica=razlicica)
    exe = Path(TU, "prenos", windows)
    return {
        "url": os.environ.get("WAYFARE_PRENOS_URL") or PRENOS_URL.format(razlicica=razlicica, ime=dmg.name),
        "prenos_ime": dmg.name,
        "prenos_velikost": f"{round(dmg.stat().st_size / 1e6)} MB",
        "razlicica": razlicica,
        "prenos_windows_href": PRENOS_URL.format(razlicica=razlicica, ime=windows),
        "prenos_windows_ime": windows,
        "prenos_windows_velikost": f" · {round(exe.stat().st_size / 1e6)} MB" if exe.is_file() else "",
        "prenos_android_href": PRENOS_URL.format(razlicica=razlicica, ime=PRENOS_ANDROID.format(razlicica=razlicica)),
        "prenos_android_ime": PRENOS_ANDROID.format(razlicica=razlicica),
        "prenos_android_velikost": (f" · {round(apk.stat().st_size / 1e6)} MB"
                                    if (apk := Path(TU, "prenos", PRENOS_ANDROID.format(razlicica=razlicica))).is_file() else ""),
    }


# Namestitev kot vtičnik Claude Code (brez Node.js): ukaza v pogovoru Claude Code.
# Deli se prelomijo le med seboj, kot pri SKILL_UKAZ.
PLUGIN_UKAZI = [["/plugin marketplace add", "vidzadnikar/wayfare-skills"],
                ["/plugin install", "wayfare@wayfare"]]

GUMB_KOPIRAJ = (
    '<button class="kopiraj" type="button" aria-label="{{claude_kopiraj_oznaka}}" '
    'aria-describedby="{id}" data-kopiraj data-za="{id}" data-kopirano="{{claude_kopirano}}">'
    '<svg class="kopiraj-ikona" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>'
    '<path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>'
    '<svg class="kopiraj-kljukica" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>'
    '</button>'
)


def deli_ukaza(deli):
    # <wbr> za poševnico sredi besede: na najožjih zaslonih sme tam prelomiti
    deli = [re.sub(r"(?<=[\w-])/", "/<wbr>", d) for d in deli]
    return " ".join(f'<span class="cel">{d}</span>' for d in deli)


# Slovenski obiskovalci pridejo na slovensko različico iste strani; izbira
# jezika se zapomni. Cilj je relativen, zato velja na vsaki globini.
def preusmeritev(url_sl):
    return ('try{var j=localStorage.getItem("wayfare-jezik");'
            'if(!j&&/^sl\\b/i.test(navigator.language||""))j="sl";'
            f'if(j==="sl")location.replace("{url_sl}"+location.hash);}}catch(e){{}}')


def oblak():
    sirina = (V1_DESNO - V1_LEVO) / len(SLICICE)
    vrstice = []
    for i, ime in enumerate(SLICICE):
        levo = V1_LEVO + i * sirina
        vrstice.append(
            f'<span class="sl" style="left:{levo:.3f}%;top:{V1_ZGORAJ}%;width:{sirina:.4f}%;height:{V1_VISINA}%">'
            f'<img src="{{{{koren}}}}media/posnetki/{ime}.jpg" alt="" loading="lazy"></span>'
        )
    return "\n            ".join(vrstice)


# ---------------------------------------------------------------- poti strani

def relmapa(od, do, koren=""):
    """Relativna pot od mape datoteke `od` do mape datoteke `do`, s poševnico.

    Ista mapa vrne `koren` ("" za sredstva, da ostanejo poti kot media/…;
    "./" za povezave na stran)."""
    r = os.path.relpath(os.path.dirname(do) or ".", os.path.dirname(od) or ".")
    return koren if r == "." else r + "/"


def poti(stran, jezik):
    """Poti, ki jih predloga potrebuje na tej strani v tem jeziku.

    Stran 404 strežnik pošlje na poljubnem naslovu, zato so njene poti
    absolutne (od korena strani), ne relativne."""
    ta = STRANI[stran]["izhod"][jezik]
    drug = "sl" if jezik == "en" else "en"
    dom = STRANI["dom"]["izhod"][jezik]
    en, sl = STRANI[stran]["izhod"]["en"], STRANI[stran]["izhod"]["sl"]
    vlogi = STRANI["vlogi"]["izhod"][jezik]
    zasebnost = STRANI["zasebnost"]["izhod"][jezik]
    if stran == "napaka":
        absolutna = lambda do: "/" + do.removesuffix("index.html")
        koren, pot_dom = "/", absolutna(dom)
        url_en, url_sl, pot_vlogi, pot_zasebnost = absolutna(en), absolutna(sl), absolutna(vlogi), absolutna(zasebnost)
    else:
        koren, pot_dom = relmapa(ta, "index.html"), relmapa(ta, dom)
        url_en, url_sl = relmapa(ta, en, "./"), relmapa(ta, sl, "./")
        pot_vlogi, pot_zasebnost = relmapa(ta, vlogi, "./"), relmapa(ta, zasebnost, "./")
    return {
        "lang": jezik,
        "koren": koren,
        "dom": pot_dom,
        "url_en": url_en,
        "url_sl": url_sl,
        "pot_vlogi": pot_vlogi,
        "pot_zasebnost": pot_zasebnost,
        "en_aktiven": 'aria-current="page"' if jezik == "en" else "",
        "sl_aktiven": 'aria-current="page"' if jezik == "sl" else "",
        "vlogi_aktiven": ' aria-current="page"' if stran == "vlogi" or stran.startswith("ogled:") else "",
        "zasebnost_aktiven": ' aria-current="page"' if stran == "zasebnost" else "",
        "_drug": drug,
        "_ta": ta,
    }


# ---------------------------------------------------------------- vlogi

OBLIKE = {
    "sl": {"film": ("film", "filma", "filmi", "filmov"),
           "potovanje": ("potovanje", "potovanji", "potovanja", "potovanj")},
    "en": {"film": ("film", "films"), "potovanje": ("trip", "trips")},
}


def mnozina(n, jezik, kaj):
    """Števnik z besedo: slovenščina ima ednino, dvojino in dve množini."""
    o = OBLIKE[jezik][kaj]
    if jezik == "en":
        return f"{n} {o[0] if n == 1 else o[1]}"
    r = n % 100
    return f"{n} {o[0] if r == 1 else o[1] if r == 2 else o[2] if r in (3, 4) else o[3]}"


def cas(sekunde):
    s = int(round(sekunde))
    return f"{s // 60}:{s % 60:02d}"


def vsi_vlogi():
    p = Path(TU, "vlogi.json")
    if not p.is_file():
        raise SystemExit("Ni vlogi.json. Najprej zaženi ../vlogi/zberi.py --slike.")
    return json.load(open(p, encoding="utf-8"))["vlogi"]


def vlogi_podatki():
    """Vlogi na strani: le tisti z oznako youtube. Vlog brez nje še ni objavljen
    (14. 10. 2026 Rifnik in Budimpešta), zato ga ni nikjer: ne v zavihku Vlogi,
    ne na domači strani, ne na globusu. Ko dobi oznako (vlogi/zberi.py ali
    vlogi.json), se ob naslednji gradnji pokaže sam, GitHub Action pa pošlje
    obvestilo članom."""
    return [v for v in vsi_vlogi() if v.get("youtube")]


def kraji_podatki():
    """Kraji s koordinatami za globus (KRAJI v ../vlogi/zberi.py)."""
    return json.load(open(Path(TU, "vlogi.json"), encoding="utf-8")).get("kraji", [])


MESECI = {"sl": ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"],
          "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]}


def obdobje(od, do, jezik):
    """Obdobje med dvema dnevoma, kratko: 9.–11. okt 2026, 5. sep 2026, 26. dec 2025 – 5. sep 2026."""
    l1, m1, d1 = map(int, od.split("-"))
    l2, m2, d2 = map(int, do.split("-"))
    M = MESECI[jezik]
    pika = "." if jezik == "sl" else ""
    if od == do:
        return f"{d1}{pika} {M[m1 - 1]} {l1}"
    if (l1, m1) == (l2, m2):
        return f"{d1}{pika}–{d2}{pika} {M[m1 - 1]} {l1}"
    return f"{d1}{pika} {M[m1 - 1]} – {d2}{pika} {M[m2 - 1]} {l2}"


def zemljevid_dom(jezik, b, p):
    """Globus na domači strani: kraji s koordinatami, za vsakega opis (število filmov,
    obdobje) in kartice filmov od tam, že zgrajene v HTML; vrstni red kot vlogi
    (najnovejše potovanje prvo). Skript bere JSON s strani, zemljevid.js."""
    vlogi = vlogi_podatki()
    media = p["koren"] + "media/vlogi/"
    seznam = []
    for k in kraji_podatki():
        filmi = [v for v in vlogi if v["kraj"]["en"] == k["kljuc"]]
        if not filmi:
            continue
        od = min(v["datum"] for v in filmi)
        do = max(v.get("datum_do") or v["datum"] for v in filmi)
        kartice = "".join(kartica_html(v, opis_vloga(v, jezik, media), pot_ogleda(p, v["oznaka"], jezik), izberi=False) for v in filmi)
        seznam.append(dict(ime=filmi[0]["kraj"][jezik].split(",")[0].strip(), lon=k["lon"], lat=k["lat"], stran=k.get("stran"),
                           od=od, opis=f"{mnozina(len(filmi), jezik, 'film')} · {obdobje(od, do, jezik)}", kartice=kartice))
    seznam.sort(key=lambda k: k["od"], reverse=True)
    podatki = {"kraji": seznam, "besedila": {"kolescek": b["zemljevid_namig_kolescek"]}}
    return {"zemljevid_json": json.dumps(podatki, ensure_ascii=False).replace("</", "<\\/")}


def izhod_ogleda(oznaka, jezik):
    return f"{'sl/' if jezik == 'sl' else ''}vlogi/{oznaka}/index.html"


def pot_ogleda(p, oznaka, jezik):
    """Relativna povezava s te strani na stran ogleda vloga."""
    if p["koren"] == "/":  # stran 404: absolutne poti
        return "/" + izhod_ogleda(oznaka, jezik).removesuffix("index.html")
    return relmapa(p["_ta"], izhod_ogleda(oznaka, jezik), "./")


MESECI_DOLGI = {"sl": ["januarja", "februarja", "marca", "aprila", "maja", "junija", "julija", "avgusta",
                       "septembra", "oktobra", "novembra", "decembra"],
                "en": ["January", "February", "March", "April", "May", "June", "July", "August",
                       "September", "October", "November", "December"]}


def opis_ogleda(v, jezik):
    """Kraj, kdaj je posneto in iz koliko posnetkov je film (brez vrstice metapodatkov)."""
    stavek = _opis_ogleda(v, jezik)
    n = v.get("posnetkov")
    if n:
        stavek += f" Zmontirano iz {n} posnetkov." if jezik == "sl" else f" Edited from {n} clips."
    return stavek


def _opis_ogleda(v, jezik):
    M = MESECI_DOLGI[jezik]
    l1, m1, d1 = map(int, v["datum"].split("-"))
    do = v.get("datum_do")
    kraj = v["kraj"][jezik]
    if jezik == "sl":
        if not do or do == v["datum"]:
            return f"{kraj}. Posneto {d1}. {M[m1 - 1]} {l1}."
        l2, m2, d2 = map(int, do.split("-"))
        zacetek = f"{d1}. {M[m1 - 1]}" + (f" {l1}" if l1 != l2 else "")
        return f"{kraj}. Posneto od {zacetek} do {d2}. {M[m2 - 1]} {l2}."
    if not do or do == v["datum"]:
        return f"{kraj}. Filmed on {d1} {M[m1 - 1]} {l1}."
    l2, m2, d2 = map(int, do.split("-"))
    zacetek = f"{d1} {M[m1 - 1]}" + (f" {l1}" if l1 != l2 else "")
    return f"{kraj}. Filmed {zacetek} – {d2} {M[m2 - 1]} {l2}."


def naprej_vlogi(v, vlogi):
    """Ob filmu le ostali filmi iste serije (istega potovanja), po vrsti dni;
    povzetek (z obdobjem) pride na konec."""
    isti = [x for x in vlogi if x["kraj"]["en"] == v["kraj"]["en"] and x["oznaka"] != v["oznaka"]]
    return sorted(isti, key=lambda x: (x.get("datum_do") or x["datum"], x["oznaka"]))


def ogled_stran(oznaka, jezik, b, p):
    """Vrednosti za stran ogleda enega vloga (predloga-ogled.html)."""
    vlogi = vlogi_podatki()
    v = next(x for x in vlogi if x["oznaka"] == oznaka)
    media = p["koren"] + "media/vlogi/"
    o = opis_vloga(v, jezik, media)
    opis = opis_ogleda(v, jezik)
    serija = naprej_vlogi(v, vlogi)
    naprej = "".join(kartica_html(x, opis_vloga(x, jezik, media), pot_ogleda(p, x["oznaka"], jezik), izberi=False, vrsta=True,
                                  velikosti="(min-width: 900px) 180px, 100vw")
                     for x in serija)
    return {
        "ogled_naslov_strani": html.escape(f"{o['naslov']} — Wayfare Studio"),
        "ogled_opis_meta": html.escape(opis),
        "ogled_naslov": html.escape(o["naslov"]),
        "ogled_opis": html.escape(opis),
        "ogled_slika": o["slika"],
        "ogled_youtube_id": o["youtube"],
        "ogled_oznaka": oznaka,
        "ogled_pokoncno": "true" if o["pokoncno"] else "false",
        "ogled_trajanje": o["trajanje"],
        "ogled_poglavja": poglavja_html(o["poglavja"]),
        "ogled_poglavja_skrito": "" if o["poglavja"] else "hidden",
        "ogled_naprej_seznam": naprej,
        # naslov stranskega stolpca je ime serije (kraj); brez drugih filmov stolpca ni
        "ogled_serija": html.escape(o["kraj"].split(",")[0]),
        "ogled_naprej_skrito": "" if serija else " hidden",
        "ogled_razred": "" if serija else " ogled-sam",
    }


def poglavja_html(poglavja):
    return "".join(
        f'<li><button type="button" class="poglavje-gumb" data-cas="{t}">'
        f'<span class="poglavje-cas">{cas(t)}</span>{html.escape(ime)}</button></li>'
        for t, ime in poglavja
    )


def opis_vloga(v, jezik, media):
    """Vrednosti enega vloga za kartico, predvajalnik in skript strani."""
    yt = v.get("youtube") or ""
    return dict(
        oznaka=v["oznaka"], naslov=v["naslov"][jezik], kraj=v["kraj"][jezik],
        trajanje=cas(v["trajanje"]),
        slika=f"{media}{v['oznaka']}.jpg", v1080=f"{media}{v['oznaka']}-1080.mp4",
        v720=f"{media}{v['oznaka']}-720.mp4",
        zanka=f"{media}{v['oznaka']}-zanka.mp4" if Path(TU, "media", "vlogi", f"{v['oznaka']}-zanka.mp4").is_file() else "",
        youtube=yt, okvir=youtube_okvir(yt) if yt else "",
        # povezava kartice brez JS: film na YouTubu ali spletna datoteka
        povezava=f"https://www.youtube.com/watch?v={yt}" if yt else f"{media}{v['oznaka']}-1080.mp4",
        pokoncno=v["visina"] > v["sirina"], poglavja=v["poglavja"],
    )


# Kartice kažejo majhno sličico (media/vlogi/male/<oznaka>.webp, 640 px), velika
# naslovnica (1280 px) je le za zaslone z gosto mrežo pik. male_slike() jih naredi,
# kjer manjkajo (ffmpeg); brez ffmpeg ostane velika naslovnica.
FFMPEG = [Path("~/Claude/claude/Wayfare/vendor/ffmpeg/bin/ffmpeg").expanduser(), shutil.which("ffmpeg")]


def male_slike():
    ff = next((str(f) for f in FFMPEG if f and Path(f).is_file()), None)
    for jpg in Path(TU, "media", "vlogi").glob("*.jpg"):
        cilj = Path(TU, "media", "vlogi", "male", jpg.stem + ".webp")
        if cilj.is_file() or not ff:
            continue
        cilj.parent.mkdir(exist_ok=True)
        subprocess.run([ff, "-v", "error", "-y", "-i", str(jpg), "-vf", "scale=640:-2", "-c:v", "libwebp",
                        "-quality", "74", str(cilj)], check=False)


def slika_kartice(o, sirina, visina, velikosti):
    mala = o["slika"].replace("media/vlogi/", "media/vlogi/male/").removesuffix(".jpg") + ".webp"
    if not Path(TU, "media", "vlogi", "male", o["oznaka"] + ".webp").is_file():
        return f'<img src="{o["slika"]}" alt="" width="{sirina}" height="{visina}" loading="lazy" decoding="async">', o["slika"]
    return (f'<img src="{mala}" srcset="{mala} 640w, {o["slika"]} 1280w" sizes="{velikosti}" alt="" '
            f'width="{sirina}" height="{visina}" loading="lazy" decoding="async">'), mala


def kartica_html(v, o, href, izberi=True, vrsta=False, velikosti="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", skrita=False):
    """Kartica filma: naslovnica, nem predogled za kazalec, trajanje, naslov.
    Ime povezave je naslov in trajanje (trajanje za bralnike za naslovom, vidna
    kapsula je zanje skrita), da se ujema z vidnim besedilom. `skrita` je
    kopija za neskončni zid: povezava ni v vrstnem redu tipke Tab."""
    img, mala = slika_kartice(o, v["sirina"], v["visina"], velikosti)
    tab = ' tabindex="-1"' if skrita else ""
    return (
        f'<li class="kartica{" kartica-pokoncna" if o["pokoncno"] else ""}{" kartica-vrsta" if vrsta else ""}" data-vlog="{o["oznaka"]}">'
        f'<a class="kartica-povezava" href="{href}"{" data-izberi" if izberi else ""}{tab}>'
        f'<span class="kartica-slika">'
        + (f'<img class="kartica-ozadje" src="{mala}" alt="" aria-hidden="true" loading="lazy" decoding="async">' if o["pokoncno"] else "") +
        img
        + (f'<video class="kartica-zanka" muted playsinline loop preload="none" tabindex="-1" aria-hidden="true" data-zanka-src="{o["zanka"]}"></video>' if o["zanka"] else "") +
        f'<span class="kartica-cas" aria-hidden="true">{o["trajanje"]}</span></span>'
        f'<span class="kartica-naslov serif">{html.escape(o["naslov"])}<span class="skrito">, {o["trajanje"]}</span></span></a></li>'
    )


def vlogi_dom(jezik, p):
    """Domača stran: zid vseh filmov v dveh vrstah (zid.js). Vsaka vrsta je
    dvakrat, druga kopija je le za neskončen tek (skrita bralnikom in tipki Tab)."""
    vlogi = vlogi_podatki()
    media = p["koren"] + "media/vlogi/"
    pol = (len(vlogi) + 1) // 2
    vrste = []
    for smer, del_ in ((1, vlogi[:pol]), (-1, vlogi[pol:])):
        def niz(skrita):
            return "".join(kartica_html(v, opis_vloga(v, jezik, media), pot_ogleda(p, v["oznaka"], jezik), izberi=False,
                                        velikosti="340px", skrita=skrita) for v in del_)
        vrste.append(f'      <div class="zid-vrsta" data-smer="{smer}"><ul class="zid-niz">{niz(False)}</ul>'
                     f'<ul class="zid-niz" aria-hidden="true" inert>{niz(True)}</ul></div>')
    krajev = len({v["kraj"]["en"] for v in vlogi})
    return {"zid": "\n".join(vrste), "st_filmov": mnozina(len(vlogi), jezik, "film"),
            "st_potovanj": mnozina(krajev, jezik, "potovanje")}


def vlogi_stran(jezik, b, p):
    """Vrednosti za predlogo zavihka Vlogi: najnovejši film izpostavljen,
    spodaj skupine po krajih. Vsaka kartica vodi na stran ogleda."""
    vlogi = vlogi_podatki()
    media = p["koren"] + "media/vlogi/"
    opisi = [opis_vloga(v, jezik, media) for v in vlogi]

    # skupine po kraju, v vrstnem redu prvega pojava (najnovejše potovanje prvo)
    skupine = {}
    for v, o in zip(vlogi, opisi):
        skupine.setdefault(o["kraj"], []).append((v, o))
    deli = []
    for i, (kraj, filmi) in enumerate(skupine.items(), 1):
        kartice = [kartica_html(v, o, pot_ogleda(p, v["oznaka"], jezik), izberi=False) for v, o in filmi]
        deli.append(
            f'<section class="skupina" aria-labelledby="skupina-{i}">'
            f'<h3 id="skupina-{i}" class="serif">{html.escape(kraj.split(",")[0])}</h3>'
            f'<ul class="kartice">{"".join(kartice)}</ul></section>'
        )
    prvi, v0 = opisi[0], vlogi[0]
    return {
        "skupine": "\n      ".join(deli),
        "st_filmov": mnozina(len(vlogi), jezik, "film"),
        "st_potovanj": mnozina(len(skupine), jezik, "potovanje"),
        "og_slika": prvi["slika"],
        "prvi_naslov": html.escape(prvi["naslov"]),
        "prvi_opis": html.escape(opis_ogleda(v0, jezik)),
        "prvi_slika": prvi["slika"],
        "prvi_trajanje": prvi["trajanje"],
        "prvi_pot": pot_ogleda(p, prvi["oznaka"], jezik),
    }


# ---------------------------------------------------------------- deljenje in iskalniki

def url_strani(izhod):
    return f"{STRAN_URL}/{izhod.removesuffix('index.html')}"


def iso_trajanje(sekunde):
    s = int(round(sekunde))
    return f"PT{s // 60}M{s % 60}S"


def meta(html_, stran, jezik, b):
    """Absolutne povezave za deljenje in iskalnike, ikone in strukturirani podatki.

    og:image, hreflang in canonical morajo biti polni naslovi (WhatsApp,
    Messenger in Google relativnih ne razumejo). Vstavi se za <link rel="icon">."""
    izhod = STRANI[stran]["izhod"][jezik]
    url = url_strani(izhod)
    en, sl = (url_strani(STRANI[stran]["izhod"][j]) for j in ("en", "sl"))
    html_ = re.sub(r'<link rel="alternate" hreflang="en" href="[^"]*">', f'<link rel="alternate" hreflang="en" href="{en}">', html_)
    html_ = re.sub(r'<link rel="alternate" hreflang="sl" href="[^"]*">',
                   f'<link rel="alternate" hreflang="sl" href="{sl}">\n<link rel="alternate" hreflang="x-default" href="{en}">', html_)
    m = re.search(r'<meta property="og:image" content="([^"]*)">', html_)
    slika = urljoin(url, m.group(1)) if m else f"{STRAN_URL}/media/promo-naslovna.jpg"
    if m:
        html_ = html_.replace(m.group(0), f'<meta property="og:image" content="{slika}">')
    else:
        html_ = html_.replace('<meta name="description"', f'<meta property="og:image" content="{slika}">\n<meta name="description"', 1)
    naslov = re.search(r"<title>(.*?)</title>", html_, re.S).group(1)
    opis = re.search(r'<meta name="description" content="([^"]*)">', html_).group(1)
    sirina, visina = (1920, 1080) if slika.endswith("promo-naslovna.jpg") else (1280, 720)
    dodatno = []
    if "og:title" not in html_:
        dodatno += [f'<meta property="og:title" content="{naslov}">', f'<meta property="og:description" content="{opis}">']
    if "og:type" not in html_:
        dodatno.append('<meta property="og:type" content="website">')
    dodatno += [
        f'<meta property="og:url" content="{url}">',
        '<meta property="og:site_name" content="Wayfare Studio">',
        f'<meta property="og:locale" content="{"sl_SI" if jezik == "sl" else "en_US"}">',
        f'<meta property="og:image:width" content="{sirina}">',
        f'<meta property="og:image:height" content="{visina}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if stran == "napaka":
        dodatno.append('<meta name="robots" content="noindex">')
    else:
        dodatno.append(f'<link rel="canonical" href="{url}">')
    dodatno += [
        '<link rel="apple-touch-icon" href="/media/apple-touch-icon.png">',
        '<link rel="manifest" href="/manifest.webmanifest">',
        '<meta name="theme-color" content="#0b0c0f">',
    ]
    podatki = strukturirani(stran, jezik, b, url, slika, opis)
    if podatki:
        dodatno.append('<script type="application/ld+json">' + json.dumps(podatki, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    ikona = re.search(r'<link rel="icon"[^>]*>', html_).group(0)
    return html_.replace(ikona, ikona + "\n" + "\n".join(dodatno), 1)


def strukturirani(stran, jezik, b, url, slika, opis):
    """schema.org: aplikacija na domači strani, video na strani ogleda."""
    if stran == "dom":
        paket = prenos()
        return {
            "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Wayfare Studio",
            "applicationCategory": "MultimediaApplication", "operatingSystem": "macOS 12+, Windows 10+, Android 8+",
            "softwareVersion": paket["razlicica"], "description": opis, "url": url, "image": slika,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        }
    if stran.startswith("ogled:"):
        v = next(x for x in vlogi_podatki() if x["oznaka"] == stran.split(":", 1)[1])
        return {
            "@context": "https://schema.org", "@type": "VideoObject", "name": v["naslov"][jezik], "description": opis,
            "thumbnailUrl": [slika], "uploadDate": v.get("datum_do") or v["datum"], "duration": iso_trajanje(v["trajanje"]),
            "embedUrl": f"https://www.youtube.com/embed/{v['youtube']}", "inLanguage": v.get("jezik", "sl"), "url": url,
        }
    return None


def zemljevid_strani():
    """sitemap.xml: vse strani v obeh jezikih z jezikovnimi različicami (brez 404)."""
    vrstice = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for stran, s_ in STRANI.items():
        if stran == "napaka":
            continue
        for jezik in ("en", "sl"):
            vrstice.append(f"  <url><loc>{url_strani(s_['izhod'][jezik])}</loc>")
            for j in ("en", "sl"):
                vrstice.append(f'    <xhtml:link rel="alternate" hreflang="{j}" href="{url_strani(s_["izhod"][j])}"/>')
            vrstice.append("  </url>")
    vrstice.append("</urlset>")
    return "\n".join(vrstice) + "\n"


MANIFEST = {
    "name": "Wayfare Studio", "short_name": "Wayfare", "start_url": "/", "display": "browser",
    "background_color": "#0b0c0f", "theme_color": "#0b0c0f",
    "icons": [{"src": "/media/ikona-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "/media/ikona-512.png", "sizes": "512x512", "type": "image/png"}],
}


# ---------------------------------------------------------------- gradnja

GLAVE = """/*
  Content-Security-Policy: {csp}; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(), display-capture=(), xr-spatial-tracking=(), serial=(), bluetooth=()
  X-Permitted-Cross-Domain-Policies: none
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

# Slike v e-pošti (logo, naslovnice vlogov) nalaga odjemalec pošte z drugega
# izvora, zato pod /media/ ni omejitve same-origin. Mediji se hranijo teden dni
# (zamenjan medij dobi novo ime ali počaka teden); pisave imajo v imenu zgoščeno
# vrednost, knjižnice različico v komentarju predloge, zato se hranijo dlje.
# HTML, css/ in js/ ostanejo brez hranjenja (vsaka objava takoj velja).
/media/*
  ! Cross-Origin-Resource-Policy
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400

/pisave/*
  Cache-Control: public, max-age=31536000, immutable

/js/knjiznice/*
  Cache-Control: public, max-age=2592000

/model/*
  Cache-Control: public, max-age=2592000

# Spremljevalec na telefonu (telefon/): mikrofon za glasovne zapiske, GPS za
# kraj oznake, servisni delavec za delo brez povezave. Ostala stran tega ne sme.
/telefon/*
  ! Content-Security-Policy
  ! Permissions-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  Permissions-Policy: microphone=(self), geolocation=(self), camera=(), payment=(), usb=()
"""


# Spletni različici vloga (-1080.mp4, -720.mp4) so za gostovanje prevelike in
# jih v objavi nikoli ni: vlog igra z YouTuba. Dokler vlog nima oznake youtube,
# predvajalnik na objavljeni strani pove, da film še ni na spletu.
SPLETNI_VIDEO = re.compile(r"^media/vlogi/.+-(1080|720)\.mp4$")
NAJVEC_MB = 25  # meja Cloudflare Pages za eno datoteko


def objavi(zgoscene, strani, okvirji):
    """Mapa ../objava: samo javne datoteke, ki jih stran res uporablja.

    Predloge, besedila, gradnja, .DS_Store, neuporabljeni mediji, spletni
    video vlogov in paket za prenos ostanejo doma. Glave za strežnik so v
    _headers (Cloudflare Pages, Netlify). Na koncu preveri mejo velikosti."""
    import shutil
    objava = Path(TU).parent / "objava"
    shutil.rmtree(objava, ignore_errors=True)
    besedila = [p.read_text(encoding="utf-8") for p in strani]
    besedila += [p.read_text(encoding="utf-8") for p in Path(TU, "css").glob("*.css")]
    besedila += [p.read_text(encoding="utf-8") for p in Path(TU, "js").glob("*.js")]
    uporabljeni = set()
    for t in besedila:
        uporabljeni |= set(re.findall(r"(media/[\w./-]+?\.(?:mp4|jpg|jpeg|png|webp|svg))", t))
    # majhne sličice kartic (tudi za kartice na globusu, ki so v JSON s poševnicami)
    uporabljeni |= {str(p.relative_to(TU)) for p in Path(TU, "media", "vlogi", "male").glob("*.webp")
                    if any(v["oznaka"] == p.stem for v in vlogi_podatki())}
    uporabljeni = {u for u in uporabljeni if not SPLETNI_VIDEO.match(u)}
    uporabljeni.add("model/wayfare-znak-kosi.glb")
    uporabljeni.add("media/zemljevid/meje.json")  # črte globusa (zemljevid.js jih naloži s fetch)
    uporabljeni.add("media/posta/logo.png")  # glava e-pošte (zaledje/posta.js)
    uporabljeni |= {"media/ikona-192.png", "media/ikona-512.png"}  # manifest.webmanifest
    manjkajo = [u for u in sorted(uporabljeni) if not Path(TU, u).is_file()]
    if manjkajo:
        raise SystemExit(f"Stran kaže na datoteke, ki jih ni: {manjkajo}")
    datoteke = [p.relative_to(TU) for p in strani]
    for mapa in ("css", "js", "pisave", "telefon"):
        datoteke += [p.relative_to(TU) for p in Path(TU, mapa).rglob("*") if p.is_file()]
    datoteke += [Path(u) for u in uporabljeni]
    for rel in datoteke:
        if rel.name == ".DS_Store":
            continue
        cilj = objava / rel
        cilj.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(TU, rel), cilj)
    (objava / "_headers").write_text(GLAVE.format(csp=csp(zgoscene, okvirji)))
    (objava / "sitemap.xml").write_text(zemljevid_strani(), encoding="utf-8")
    (objava / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /nadzor\n\nSitemap: {STRAN_URL}/sitemap.xml\n")
    (objava / "manifest.webmanifest").write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=1))
    shutil.copy2(Path(TU, "favicon.ico"), objava / "favicon.ico")
    # imena vlogov za nadzor (ogledi): le oznaka in slovenski naslov
    (objava / "vlogi").mkdir(parents=True, exist_ok=True)
    (objava / "vlogi" / "seznam.json").write_text(json.dumps(
        [{"oznaka": v["oznaka"], "naslov": v["naslov"]["sl"]} for v in vlogi_podatki()], ensure_ascii=False))
    neuporabljeni = sorted(str(p.relative_to(TU)) for p in Path(TU, "media").rglob("*")
                           if p.is_file() and str(p.relative_to(TU)) not in uporabljeni
                           and p.name != ".DS_Store" and not SPLETNI_VIDEO.match(str(p.relative_to(TU))))
    prevelike = [str(p.relative_to(objava)) for p in objava.rglob("*")
                 if p.is_file() and p.stat().st_size > NAJVEC_MB * 1024 * 1024]
    velikost = sum(p.stat().st_size for p in objava.rglob("*") if p.is_file()) / 1e6
    print(f"objava: {len(datoteke)} datotek, {velikost:.0f} MB")
    if neuporabljeni:
        print("ni v objavi (stran jih ne uporablja):", ", ".join(neuporabljeni))
    brez = [v["oznaka"] for v in vsi_vlogi() if not v.get("youtube")]
    if brez:
        print("brez oznake youtube (še niso objavljeni, na strani jih ni):", ", ".join(brez))
    if prevelike:
        raise SystemExit(f"Prevelike za Cloudflare Pages (nad {NAJVEC_MB} MB): {prevelike}")


def main():
    besedila = json.load(open(os.path.join(TU, "besedila.json"), encoding="utf-8"))
    deli = {ime: open(os.path.join(TU, "deli", f"{ime}.html"), encoding="utf-8").read().rstrip("\n")
            for ime in ("glava", "noga", "obvestilo", "prijava")}
    paket = prenos()
    # velikost brez pike spredaj (" · 312 MB" → "312 MB") za stavke na karticah naprav
    paket["prenos_windows_mb"] = paket["prenos_windows_velikost"].strip(" ·") or "Windows"
    paket["prenos_android_mb"] = paket["prenos_android_velikost"].strip(" ·") or "Android"
    male_slike()
    okvirji = any(v.get("youtube") for v in vlogi_podatki())
    for v in vlogi_podatki():
        STRANI[f"ogled:{v['oznaka']}"] = dict(predloga="predloga-ogled.html",
                                               izhod={j: izhod_ogleda(v["oznaka"], j) for j in ("en", "sl")})
    vse_zgoscene, izhodi = set(), []
    for stran, s in STRANI.items():
        predloga = open(os.path.join(TU, s["predloga"]), encoding="utf-8").read()
        for jezik in ("en", "sl"):
            p = poti(stran, jezik)
            b = {**besedila[jezik], **{k: v for k, v in p.items() if not k.startswith("_")}}
            if stran == "vlogi":
                b.update(vlogi_stran(jezik, b, p))
            elif stran.startswith("ogled:"):
                b.update(ogled_stran(stran.split(":", 1)[1], jezik, b, p))
            elif stran == "dom":
                b.update(vlogi_dom(jezik, p))
                b.update(zemljevid_dom(jezik, b, p))
            html_ = predloga
            for ime, vsebina in deli.items():
                html_ = html_.replace("{{" + ime + "}}", vsebina)
            html_ = html_.replace("{{oblak}}", oblak())
            html_ = html_.replace("{{preusmeritev}}", preusmeritev(p["url_sl"]) if jezik == "en" else "")
            html_ = html_.replace("{{razglednice}}", razglednice())
            html_ = html_.replace("{{mesta}}", trak(MESTA))
            html_ = html_.replace("{{mesta_obrnjeno}}", trak(MESTA[::-1][1:] + MESTA[-1:]))
            html_ = html_.replace("{{hero_video}}", HERO_VIDEO)
            html_ = html_.replace("{{skill_ukaz}}", deli_ukaza(SKILL_UKAZ))
            for i, d in enumerate(PLUGIN_UKAZI, 1):
                html_ = html_.replace("{{plugin_ukaz_%d}}" % i, deli_ukaza(d))
            html_ = re.sub(r"\{\{kopiraj:([\w-]+)\}\}",
                           lambda m: GUMB_KOPIRAJ.replace("{id}", m.group(1)), html_)
            for kljuc, vrednost in b.items():
                html_ = html_.replace("{{" + kljuc + "}}", vrednost)
            html_ = html_.replace("{{prenos_href}}", paket["url"])
            for kljuc in ("prenos_ime", "prenos_velikost", "razlicica", "prenos_windows_href",
                          "prenos_windows_ime", "prenos_windows_velikost", "prenos_android_href",
                          "prenos_android_ime", "prenos_android_velikost", "prenos_windows_mb", "prenos_android_mb"):
                html_ = html_.replace("{{" + kljuc + "}}", paket[kljuc])
            html_ = meta(html_, stran, jezik, b)
            zgoscene = zgoscene_skript(html_)
            vse_zgoscene |= zgoscene
            html_ = html_.replace("{{csp}}", csp(zgoscene, okvirji and stran.startswith("ogled:")))
            manjka = sorted(set(re.findall(r"\{\{(\w+)\}\}", html_)))
            if manjka:
                raise SystemExit(f"{stran}/{jezik}: manjkajo besedila za {manjka}")
            pot = Path(TU, s["izhod"][jezik])
            pot.parent.mkdir(parents=True, exist_ok=True)
            pot.write_text(html_, encoding="utf-8")
            izhodi.append(pot)
            if not stran.startswith("ogled:"):
                print(f"{stran}/{jezik}: {pot.relative_to(TU)}")
    print(f"ogled: {sum(1 for s in STRANI if s.startswith('ogled:'))} vlogov × 2 jezika")
    if "--brez-objave" not in sys.argv:
        objavi(vse_zgoscene, izhodi, okvirji)


main()
