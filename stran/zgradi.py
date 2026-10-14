"""Zgradi obe jezikovni različici strani iz predlog in besedila.json.

    python3 zgradi.py                # zgradi strani in mapo ../objava
    python3 zgradi.py --brez-objave  # samo strani (hitro, med delom)

Strani:
    predloga.html        → index.html (angleščina, koren) in sl/index.html
    predloga-vlogi.html  → vlogi/index.html in sl/vlogi/index.html
    predloga-zasebnost.html → zasebnost/index.html in sl/zasebnost/index.html

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
import sys
from pathlib import Path

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
HERO_VIDEO = "hero-mesta"  # media/<ime>-1080.mp4, <ime>-720.mp4, <ime>.jpg


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
            f"script-src 'self' {skripte}; "
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
    paketi = sorted(Path(TU, "prenos").glob("Wayfare-Studio-*.dmg"), key=lambda p: p.stat().st_mtime)
    if not paketi:
        raise SystemExit("V prenos/ ni paketa. Najprej zaženi ../paket/zgradi_paket.py.")
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
        "vlogi_aktiven": ' aria-current="page"' if stran == "vlogi" else "",
        "zasebnost_aktiven": ' aria-current="page"' if stran == "zasebnost" else "",
        "_drug": drug,
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


def vlogi_podatki():
    p = Path(TU, "vlogi.json")
    if not p.is_file():
        raise SystemExit("Ni vlogi.json. Najprej zaženi ../vlogi/zberi.py --slike.")
    return json.load(open(p, encoding="utf-8"))["vlogi"]


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
        kartice = "".join(kartica_html(v, opis_vloga(v, jezik, media), f'{p["pot_vlogi"]}#{v["oznaka"]}', izberi=False) for v in filmi)
        seznam.append(dict(ime=filmi[0]["kraj"][jezik].split(",")[0].strip(), lon=k["lon"], lat=k["lat"], stran=k.get("stran"),
                           od=od, opis=f"{mnozina(len(filmi), jezik, 'film')} · {obdobje(od, do, jezik)}", kartice=kartice))
    seznam.sort(key=lambda k: k["od"], reverse=True)
    podatki = {"kraji": seznam, "besedila": {"kolescek": b["zemljevid_namig_kolescek"]}}
    return {"zemljevid_json": json.dumps(podatki, ensure_ascii=False).replace("</", "<\\/")}


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
        v720=f"{media}{v['oznaka']}-720.mp4", zanka=f"{media}{v['oznaka']}-zanka.mp4",
        youtube=yt, okvir=youtube_okvir(yt) if yt else "",
        # povezava kartice brez JS: film na YouTubu ali spletna datoteka
        povezava=f"https://www.youtube.com/watch?v={yt}" if yt else f"{media}{v['oznaka']}-1080.mp4",
        pokoncno=v["visina"] > v["sirina"], poglavja=v["poglavja"],
    )


def kartica_html(v, o, href, izberi=True):
    """Kartica filma: naslovnica, nem predogled za kazalec, trajanje, naslov.
    Z `izberi` klik na zavihku Vlogi film naloži v predvajalnik (vlogi.js);
    na domači strani povezava pelje na zavihek."""
    return (
        f'<li class="kartica{" kartica-pokoncna" if o["pokoncno"] else ""}" data-vlog="{o["oznaka"]}">'
        f'<a class="kartica-povezava" href="{href}"{" data-izberi" if izberi else ""} aria-label="{html.escape(o["naslov"])}, {o["trajanje"]}">'
        f'<span class="kartica-slika">'
        + (f'<img class="kartica-ozadje" src="{o["slika"]}" alt="" aria-hidden="true" loading="lazy" decoding="async">' if o["pokoncno"] else "") +
        f'<img src="{o["slika"]}" alt="" width="{v["sirina"]}" height="{v["visina"]}" loading="lazy" decoding="async">'
        f'<video class="kartica-zanka" muted playsinline loop preload="none" tabindex="-1" aria-hidden="true" data-zanka-src="{o["zanka"]}"></video>'
        f'<span class="kartica-cas">{o["trajanje"]}</span></span>'
        f'<span class="kartica-naslov serif">{html.escape(o["naslov"])}</span></a></li>'
    )


def vlogi_dom(jezik, p, koliko=3):
    """Domača stran: najnovejši filmi s povezavo na zavihek Vlogi."""
    vlogi = vlogi_podatki()
    media = p["koren"] + "media/vlogi/"
    kartice = [kartica_html(v, opis_vloga(v, jezik, media), f'{p["pot_vlogi"]}#{v["oznaka"]}', izberi=False)
               for v in vlogi[:koliko]]
    return {"dom_kartice": "".join(kartice), "st_filmov": mnozina(len(vlogi), jezik, "film")}


def vlogi_stran(jezik, b, p):
    """Vrednosti za predlogo zavihka Vlogi: prvi film v predvajalniku, skupine po
    krajih, podatki za skript in številke v uvodu."""
    vlogi = vlogi_podatki()
    media = p["koren"] + "media/vlogi/"
    opisi = [opis_vloga(v, jezik, media) for v in vlogi]

    # skupine po kraju, v vrstnem redu prvega pojava (najnovejše potovanje prvo)
    skupine = {}
    for v, o in zip(vlogi, opisi):
        skupine.setdefault(o["kraj"], []).append((v, o))
    deli = []
    for i, (kraj, filmi) in enumerate(skupine.items(), 1):
        kartice = [kartica_html(v, o, o["povezava"]) for v, o in filmi]
        deli.append(
            f'<section class="skupina" aria-labelledby="skupina-{i}">'
            f'<h3 id="skupina-{i}" class="serif">{html.escape(kraj.split(",")[0])}</h3>'
            f'<ul class="kartice">{"".join(kartice)}</ul></section>'
        )

    prvi = opisi[0]
    podatki = {"vlogi": opisi, "besedila": {"zdaj": b["vlogi_zdaj"]}}
    okvir = bool(prvi["youtube"])
    return {
        "skupine": "\n      ".join(deli),
        "vlogi_json": json.dumps(podatki, ensure_ascii=False).replace("</", "<\\/"),
        "st_filmov": mnozina(len(vlogi), jezik, "film"),
        "st_potovanj": mnozina(len(skupine), jezik, "potovanje"),
        "og_slika": prvi["slika"],
        "prvi_naslov": html.escape(prvi["naslov"]),
        "prvi_slika": prvi["slika"],
        "prvi_1080": prvi["v1080"],
        "prvi_720": prvi["v720"],
        "prvi_pokoncno": "true" if prvi["pokoncno"] else "false",
        # prvi film je v predvajalniku že brez JS: okvir YouTuba ali <video>
        "prvi_nacin": "youtube" if okvir else "video",
        "prvi_video_skrito": " hidden" if okvir else "",
        "prvi_okvir_src": f' src="{prvi["okvir"]}"' if okvir else "",
        "prvi_okvir_skrito": "" if okvir else " hidden",
        "prvi_poglavja": poglavja_html(prvi["poglavja"]),
        "prvi_poglavja_skrito": "" if prvi["poglavja"] else "hidden",
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
    uporabljeni = {u for u in uporabljeni if not SPLETNI_VIDEO.match(u)}
    uporabljeni.add("model/wayfare-znak-kosi.glb")
    uporabljeni.add("media/zemljevid/meje.json")  # črte globusa (zemljevid.js jih naloži s fetch)
    manjkajo = [u for u in sorted(uporabljeni) if not Path(TU, u).is_file()]
    if manjkajo:
        raise SystemExit(f"Stran kaže na datoteke, ki jih ni: {manjkajo}")
    datoteke = [p.relative_to(TU) for p in strani]
    for mapa in ("css", "js", "pisave"):
        datoteke += [p.relative_to(TU) for p in Path(TU, mapa).rglob("*") if p.is_file()]
    datoteke += [Path(u) for u in uporabljeni]
    for rel in datoteke:
        if rel.name == ".DS_Store":
            continue
        cilj = objava / rel
        cilj.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(Path(TU, rel), cilj)
    (objava / "_headers").write_text(GLAVE.format(csp=csp(zgoscene, okvirji)))
    neuporabljeni = sorted(str(p.relative_to(TU)) for p in Path(TU, "media").rglob("*")
                           if p.is_file() and str(p.relative_to(TU)) not in uporabljeni
                           and p.name != ".DS_Store" and not SPLETNI_VIDEO.match(str(p.relative_to(TU))))
    prevelike = [str(p.relative_to(objava)) for p in objava.rglob("*")
                 if p.is_file() and p.stat().st_size > NAJVEC_MB * 1024 * 1024]
    velikost = sum(p.stat().st_size for p in objava.rglob("*") if p.is_file()) / 1e6
    print(f"objava: {len(datoteke)} datotek, {velikost:.0f} MB")
    if neuporabljeni:
        print("ni v objavi (stran jih ne uporablja):", ", ".join(neuporabljeni))
    brez = [v["oznaka"] for v in vlogi_podatki() if not v.get("youtube")]
    if brez:
        print("brez oznake youtube (na objavljeni strani ne igrajo):", ", ".join(brez))
    if prevelike:
        raise SystemExit(f"Prevelike za Cloudflare Pages (nad {NAJVEC_MB} MB): {prevelike}")


def main():
    besedila = json.load(open(os.path.join(TU, "besedila.json"), encoding="utf-8"))
    deli = {ime: open(os.path.join(TU, "deli", f"{ime}.html"), encoding="utf-8").read().rstrip("\n")
            for ime in ("glava", "noga", "obvestilo", "prijava")}
    paket = prenos()
    okvirji = any(v.get("youtube") for v in vlogi_podatki())
    vse_zgoscene, izhodi = set(), []
    for stran, s in STRANI.items():
        predloga = open(os.path.join(TU, s["predloga"]), encoding="utf-8").read()
        for jezik in ("en", "sl"):
            p = poti(stran, jezik)
            b = {**besedila[jezik], **{k: v for k, v in p.items() if not k.startswith("_")}}
            if stran == "vlogi":
                b.update(vlogi_stran(jezik, b, p))
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
                          "prenos_android_ime", "prenos_android_velikost"):
                html_ = html_.replace("{{" + kljuc + "}}", paket[kljuc])
            zgoscene = zgoscene_skript(html_)
            vse_zgoscene |= zgoscene
            html_ = html_.replace("{{csp}}", csp(zgoscene, okvirji and stran == "vlogi"))
            manjka = sorted(set(re.findall(r"\{\{(\w+)\}\}", html_)))
            if manjka:
                raise SystemExit(f"{stran}/{jezik}: manjkajo besedila za {manjka}")
            pot = Path(TU, s["izhod"][jezik])
            pot.parent.mkdir(parents=True, exist_ok=True)
            pot.write_text(html_, encoding="utf-8")
            izhodi.append(pot)
            print(f"{stran}/{jezik}: {pot.relative_to(TU)}")
    if "--brez-objave" not in sys.argv:
        objavi(vse_zgoscene, izhodi, okvirji)


main()
