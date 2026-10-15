"""Zgradi paket Wayfare Studio za macOS (Apple silicon): aplikacijo in .dmg.

    python3 zgradi_paket.py

Vir je repozitorij ~/Claude/claude/Wayfare. Paket vsebuje samo, kar aplikacija
potrebuje za delo: kodo (wayfare/, wayfare.py), vgrajeni Python, ffmpeg, model
za poslušanje zvoka, binarko whisper (brez modelov, ti se prenesejo ob prvi
rabi), začetno knjižnico glasbe (CC BY in CC0) in mapo LICENSES. Ne vsebuje:
gita, testov, dokumentov, nastavitev za Claude in Obsidian, modelov whisper,
cele glasbene knjižnice in projektov.

Zasebnost: vgrajena Python in ffmpeg imata v datotekah zapisano pot namestitve
(/Users/<ime>/...). V kopiji se uporabniško ime zamenja z enako dolgim nevtralnim
nizom (dolžina mora ostati enaka, ker so poti tudi v programih), nato se vsi
programi znova podpišejo (ad hoc). Na koncu skripta preveri, da ime nikjer ne
ostane.

Izhod: gradnja/Wayfare Studio.app in ../stran/prenos/Wayfare-Studio-<različica>.dmg

Podpis: privzeto ad hoc (Gatekeeper paket prvič ustavi). Z WAYFARE_PODPIS in
WAYFARE_NOTAR (glej spodaj) je paket podpisan z Developer ID, notariziran in
ožigosan, zato se namesti brez opozoril.
"""

import os
import plistlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

TU = Path(__file__).resolve().parent
VIR = Path.home() / "Claude" / "claude" / "Wayfare"
GRADNJA = TU / "gradnja"
PRENOS = TU.parent / "stran" / "prenos"

IME = "Wayfare Studio"
ID = "studio.wayfare.app"

# Podpis in notarizacija, da Gatekeeper paketa ne ustavi (potreben je Apple
# Developer Program). Brez teh spremenljivk je podpis ad hoc in paket brez
# notarizacije: macOS ga prvič ustavi, uporabnik ga dovoli v nastavitvah.
#   WAYFARE_PODPIS  identiteta v keychainu, npr. "Developer ID Application: Ime Priimek (TEAMID)"
#                   (Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application)
#   WAYFARE_NOTAR   profil za notarytool, narejen enkrat z
#                   xcrun notarytool store-credentials wayfare --apple-id <Apple ID> --team-id <TEAMID>
#                   (geslo je »app-specific password« z appleid.apple.com)
PODPIS = os.environ.get("WAYFARE_PODPIS", "-")
NOTAR = os.environ.get("WAYFARE_NOTAR")
UPRAVICENJA = TU / "upravicenja.plist"
UPORABNIK = Path.home().name                 # zasebni niz, ki ne sme v paket
NEVTRALNO = ("wayfare" * 4)[: len(UPORABNIK)]  # enaka dolžina

# kaj iz vgrajenih okolij ni potrebno za delo aplikacije
IZPUSTI_MAPE = {"conda-meta", "include", "pkgconfig", "man", "doc", "__pycache__",
                "cmake", "gtk-doc", "info", "test", "tests", "idlelib", "turtledemo",
                "ensurepip", "lib2to3", "tkinter", "tcl8.6", "tk8.6", "itcl4.2.3"}
IZPUSTI_KONCNICE = {".a", ".pyc", ".pyo", ".la"}
# readline je GPL-3.0 in ga aplikacija ne rabi (Python brez interaktivne
# lupine); brez njega paket ne nosi knjižnice pod GPL, ki bi bila povezana
# s Pythonom.
IZPUSTI_ZACETKE = ("libreadline", "libhistory", "readline.cpython")

# Začetna knjižnica glasbe: po dve skladbi iz vsake skupine, samo CC BY in CC0
# (javna last je izpuščena, ker za posnetek ni jasno, ali je prost).
GLASBA = Path.home() / "Video" / "_glasba"
NA_SKUPINO = 2
NAJVEC_MB = 10
BIN_OBDRZI = {"python3", "python3.12", "ffmpeg", "ffprobe"}


def zazeni(*ukaz, **kw):
    return subprocess.run(ukaz, check=True, **kw)


def kopiraj_okolje(vir: Path, cilj: Path):
    for koren, mape, datoteke in os.walk(vir):
        koren = Path(koren)
        mape[:] = [m for m in mape if m not in IZPUSTI_MAPE]
        rel = koren.relative_to(vir)
        (cilj / rel).mkdir(parents=True, exist_ok=True)
        for ime in datoteke:
            pot = koren / ime
            if pot.suffix in IZPUSTI_KONCNICE or ime == ".DS_Store":
                continue
            if ime.startswith(IZPUSTI_ZACETKE):
                continue
            if rel.parts[:1] == ("bin",) and ime not in BIN_OBDRZI:
                continue
            nova = cilj / rel / ime
            if pot.is_symlink():
                os.symlink(os.readlink(pot), nova)
            else:
                shutil.copy2(pot, nova)


def zamenjaj_ime(koren: Path) -> list:
    """V vseh datotekah zamenja uporabniško ime z enako dolgim nizom."""
    staro, novo = UPORABNIK.encode(), NEVTRALNO.encode()
    spremenjene = []
    for pot in koren.rglob("*"):
        if pot.is_symlink() or not pot.is_file():
            continue
        podatki = pot.read_bytes()
        if staro in podatki:
            pot.write_bytes(podatki.replace(staro, novo))
            spremenjene.append(pot)
    return spremenjene


# komentarji v studio.html, ki omenjajo osebe ali projekte, ne gredo v paket;
# brišejo se le celi komentarji na začetku vrstice (ne kar koli z /* ali //,
# ker je v strani npr. accept="video/*")
OSEBNO = re.compile(r"\bVid\b|Vidov|Rifnik|Budimpe|Madrid|Milan|Lizbon|\d{1,2}\. \d{1,2}\. 20\d\d")


def ocisti_html(pot: Path):
    t = pot.read_text(encoding="utf-8")
    t = re.sub(r"(?m)^[ \t]*/\*[\s\S]*?\*/[ \t]*\n", lambda m: "" if OSEBNO.search(m.group()) else m.group(), t)
    t = re.sub(r"(?m)^[ \t]*//.*\n", lambda m: "" if OSEBNO.search(m.group()) else m.group(), t)
    t = re.sub(r"(?m)^[ \t]*<!--[\s\S]*?-->[ \t]*\n", lambda m: "" if OSEBNO.search(m.group()) else m.group(), t)
    pot.write_text(t, encoding="utf-8")


def je_macho(pot: Path) -> bool:
    with open(pot, "rb") as f:
        glava = f.read(4)
    return glava in (b"\xcf\xfa\xed\xfe", b"\xca\xfe\xba\xbe", b"\xfe\xed\xfa\xcf")


def ikona(cilj: Path):
    izvor = VIR / "wayfare" / "static" / "logo" / "izvirnik.png"
    mapa = GRADNJA / "AppIcon.iconset"
    shutil.rmtree(mapa, ignore_errors=True)
    mapa.mkdir()
    for v in (16, 32, 128, 256, 512):
        for f in (1, 2):
            ime = f"icon_{v}x{v}{'@2x' if f == 2 else ''}.png"
            zazeni("sips", "-z", str(v * f), str(v * f), str(izvor), "--out", str(mapa / ime),
                   stdout=subprocess.DEVNULL)
    zazeni("iconutil", "-c", "icns", str(mapa), "-o", str(cilj))
    shutil.rmtree(mapa)


# Aplikacija je svoje okno (WKWebView) v Swiftu: zazene studio z vgrajenim
# Pythonom in ga pokaze, ob koncu ga ustavi. Vir je v Wayfare/paket/mac.
OKNO = VIR / "paket" / "mac" / "okno.swift"
IZVRSLJIVA = "Wayfare Studio"


def zacetna_glasba(cilj: Path) -> int:
    """Izbor skladb za novo knjižnico, z opisom in pripisi. Vrne število."""
    import json
    opis = json.loads((GLASBA / "knjiznica.json").read_text(encoding="utf-8"))
    po_skupinah = {}
    for vpis in opis.get("tracks", []):
        licenca = str(vpis.get("license", ""))
        pot = GLASBA / str(vpis.get("file", ""))
        if not licenca.startswith(("CC BY", "CC0")) or not pot.is_file():
            continue
        if pot.stat().st_size > NAJVEC_MB * 1e6:
            continue
        po_skupinah.setdefault(vpis.get("group") or "drugo", []).append(vpis)
    izbrane = []
    for skupina in sorted(po_skupinah):
        # Novejša licenca najprej, nato po imenu: izbor je ob vsaki gradnji isti.
        vrsta = sorted(po_skupinah[skupina],
                       key=lambda v: (not str(v.get("license")).startswith(("CC BY 4", "CC0")),
                                      v["file"].lower()))
        izbrane += vrsta[:NA_SKUPINO]
    cilj.mkdir(parents=True, exist_ok=True)
    for vpis in izbrane:
        shutil.copy2(GLASBA / vpis["file"], cilj / vpis["file"])
    (cilj / "knjiznica.json").write_text(json.dumps({
        "opis": "Starter library bundled with Wayfare Studio. Each track keeps its own licence.",
        "license": "per track — see the credit field",
        "tracks": izbrane}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(izbrane)


def main():
    if sys.platform != "darwin":
        sys.exit("Paket se gradi le na macOS.")
    sys.path.insert(0, str(VIR))
    from wayfare import __version__ as razlicica

    shutil.rmtree(GRADNJA, ignore_errors=True)
    app = GRADNJA / f"{IME}.app"
    vsebina = app / "Contents"
    viri = vsebina / "Resources" / "app"
    (vsebina / "MacOS").mkdir(parents=True)
    viri.mkdir(parents=True)

    print("koda ...")
    shutil.copy2(VIR / "wayfare.py", viri / "wayfare.py")
    shutil.copytree(VIR / "wayfare", viri / "wayfare",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))
    print("zasebnost kode: brez komentarjev in opisov, nevtralni primeri ...")
    vgrajeni = VIR / "vendor" / "python" / "bin" / "python3"
    for cilj in (viri / "wayfare", viri / "wayfare.py"):
        zazeni(str(vgrajeni), str(TU / "ocisti_kodo.py"), str(cilj), stdout=subprocess.DEVNULL)
    ocisti_html(viri / "wayfare" / "static" / "studio.html")
    for svg in (viri / "wayfare" / "static").rglob("*.svg"):
        svg.write_text(re.sub(r"<!--[\s\S]*?-->\s*", "", svg.read_text(encoding="utf-8")), encoding="utf-8")
    primeri = viri / "wayfare" / "vstavki" / "primeri"
    # primer reljefa: namesto zasebne poti s pohoda javna pot na Triglav (Kredarica -> vrh)
    reljef = primeri / "reljef.json"
    if reljef.exists():
        import json
        r = json.loads(reljef.read_text(encoding="utf-8"))
        a, b = (46.3796, 13.8494), (46.3785, 13.8369)
        r.update({"datum": "1. 6. 2027", "naslov": "VZPON NA TRIGLAV",
                  "vrh": {"ime": "TRIGLAV", "visina": 2864, "lat": b[0], "lon": b[1]},
                  "dem": "~/.wayfare/podatki/primeri/triglav-dem.json",
                  "pot": [{"lat": round(a[0] + (b[0] - a[0]) * i / 20, 6), "lon": round(a[1] + (b[1] - a[1]) * i / 20, 6)}
                          for i in range(21)]})
        reljef.write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    karta = primeri / "karta.json"
    if karta.exists():
        import json
        k = json.loads(karta.read_text(encoding="utf-8"))
        k.update({"let": "WF 101", "datum": "1. 6. 2027", "vkrcanje": "08:00", "vrata": "A1", "sedez": "1A", "potnik": ""})
        karta.write_text(json.dumps(k, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print("python, ffmpeg, model za zvok ...")
    for ime in ("python", "ffmpeg", "zvok"):
        kopiraj_okolje(VIR / "vendor" / ime, viri / "vendor" / ime)

    # Prepis govora: binarka in Metal; modele uporabnik prenese ob prvi rabi.
    whisper = viri / "vendor" / "whisper" / "bin"
    whisper.mkdir(parents=True)
    for ime in ("whisper", "ggml-metal.metal"):
        shutil.copy2(VIR / "vendor" / "whisper" / "bin" / ime, whisper / ime)

    print("začetna glasba ...")
    print(f"  skladb: {zacetna_glasba(viri / 'vendor' / 'glasba')}")

    print("licence ...")
    sys.path.insert(0, str(TU))
    import licence
    licence.zapisi(viri / "LICENSES", VIR / "vendor", VIR, razlicica)

    # povezave, ki kažejo v izpuščene mape ali izven paketa, podpis zavrne
    for pot in list(viri.rglob("*")):
        if pot.is_symlink() and (not pot.exists() or os.path.isabs(os.readlink(pot))):
            pot.unlink()

    print(f"zasebnost: '{UPORABNIK}' -> '{NEVTRALNO}' ...")
    spremenjene = zamenjaj_ime(app)
    print(f"  spremenjenih datotek: {len(spremenjene)}")

    # ukaza za terminal (ju kliče skill vlog v Claude Code):
    #   bin/wayfare <ukaz> ...      = wayfare.py z vgrajenim Pythonom
    #   bin/wayfare-python ...      = vgrajeni Python, ki vidi paket wayfare
    (vsebina / "Resources" / "bin").mkdir()
    for ime, telo in (("wayfare", 'exec "$PY" "$APP/wayfare.py" "$@"'),
                      ("wayfare-python", 'export PYTHONPATH="$APP${PYTHONPATH:+:$PYTHONPATH}"\nexec "$PY" "$@"')):
        ukaz = vsebina / "Resources" / "bin" / ime
        ukaz.write_text("#!/bin/bash\n"
                        'APP="$(cd "$(dirname "$0")/../app" && pwd)"\n'
                        'PY="$APP/vendor/python/bin/python3"\n'
                        "export PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1\n"
                        'export SSL_CERT_FILE="$APP/vendor/python/ssl/cacert.pem"\n'
                        'export PATH="$APP/vendor/ffmpeg/bin:$PATH"\n' + telo + "\n")
        ukaz.chmod(0o755)

    print("okno (Swift) ...")
    (vsebina / "MacOS").mkdir(parents=True, exist_ok=True)
    zazeni("swiftc", "-O", "-swift-version", "5", "-target", "arm64-apple-macos12.0",
           str(OKNO), "-o", str(vsebina / "MacOS" / IZVRSLJIVA))
    ikona(vsebina / "Resources" / "AppIcon.icns")
    with open(vsebina / "Info.plist", "wb") as f:
        plistlib.dump({
            "CFBundleName": IME, "CFBundleDisplayName": IME, "CFBundleIdentifier": ID,
            "CFBundleExecutable": IZVRSLJIVA, "CFBundleIconFile": "AppIcon",
            "CFBundlePackageType": "APPL", "CFBundleShortVersionString": razlicica,
            "CFBundleVersion": razlicica, "LSMinimumSystemVersion": "12.0",
            "LSArchitecturePriority": ["arm64"], "NSHighResolutionCapable": True,
            "LSApplicationCategoryType": "public.app-category.video",
            "NSMicrophoneUsageDescription":
                "Wayfare Studio records voiceover with the microphone when you choose to.",
        }, f)

    # Podpis od znotraj navzven: najprej vsaka Mach-O datoteka, nazadnje paket.
    # Z Developer ID še okrepljeno izvajanje, časovni žig in upravičenja.
    pravi = PODPIS != "-"
    print("podpis (Developer ID) ..." if pravi else "podpis (ad hoc) ...")
    dodatno = ["--timestamp", "--options", "runtime", "--entitlements", str(UPRAVICENJA)] if pravi else []
    for pot in viri.rglob("*"):
        if pot.is_file() and not pot.is_symlink() and je_macho(pot):
            zazeni("codesign", "--force", *dodatno, "--sign", PODPIS, str(pot),
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    zazeni("codesign", "--force", *dodatno, "--sign", PODPIS, str(app))
    zazeni("codesign", "--verify", "--deep", "--strict", str(app))
    if pravi and NOTAR:
        # notarizacija aplikacije (zip), nato žig v paket, da velja tudi brez spleta
        print("notarizacija aplikacije ...")
        zip_ = GRADNJA / "notar.zip"
        zazeni("ditto", "-c", "-k", "--keepParent", str(app), str(zip_))
        zazeni("xcrun", "notarytool", "submit", str(zip_), "--keychain-profile", NOTAR, "--wait")
        zazeni("xcrun", "stapler", "staple", str(app))
        zip_.unlink()
        zazeni("spctl", "--assess", "--type", "execute", str(app))

    print("preverjanje zasebnosti ...")
    ostanki = [p for p in app.rglob("*") if p.is_file() and not p.is_symlink()
               and UPORABNIK.encode() in p.read_bytes()]
    if ostanki:
        sys.exit(f"V paketu je ostalo ime: {ostanki[:5]}")
    for vzorec in (r"sk-ant-[A-Za-z0-9_\-]{20,}", r"ANTHROPIC_API_KEY\s*=\s*\S", r"@gmail\.com"):
        for p in (viri / "wayfare").rglob("*"):
            if p.is_file() and re.search(vzorec, p.read_text(errors="ignore")):
                sys.exit(f"Sumljiv niz {vzorec} v {p}")

    print("dmg ...")
    oder = GRADNJA / "dmg"
    oder.mkdir()
    shutil.move(str(app), oder / app.name)
    os.symlink("/Applications", oder / "Applications")
    PRENOS.mkdir(parents=True, exist_ok=True)
    dmg = PRENOS / f"Wayfare-Studio-{razlicica}.dmg"
    dmg.unlink(missing_ok=True)
    zazeni("hdiutil", "create", "-volname", IME, "-srcfolder", str(oder), "-fs", "HFS+",
           "-format", "ULFO", "-ov", str(dmg), stdout=subprocess.DEVNULL)
    shutil.move(str(oder / app.name), app)
    if pravi:
        zazeni("codesign", "--force", "--timestamp", "--sign", PODPIS, str(dmg))
        if NOTAR:
            print("notarizacija dmg ...")
            zazeni("xcrun", "notarytool", "submit", str(dmg), "--keychain-profile", NOTAR, "--wait")
            zazeni("xcrun", "stapler", "staple", str(dmg))
    print(f"{dmg.name}: {dmg.stat().st_size / 1e6:.0f} MB"
          + ("" if pravi and NOTAR else " (brez notarizacije: Gatekeeper ga bo prvič ustavil)"))


main()
