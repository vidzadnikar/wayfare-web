"""Mapa LICENSES za paket: kaj je vgrajeno, pod katero licenco in kje je vir.

Vgrajeni ffmpeg je zgrajen z --enable-gpl --enable-version3 (x264, x265),
zato ga paket sme deliti le z besedilom licence in s potjo do izvorne kode.
Wayfare ga kliče kot ločen program, zato lastna koda ni pod GPL.

Seznam paketov pride iz conda-meta obeh okolij (ime, različica, licenca).
Celotna besedila GPL, LGPL in Apache se ob prvi gradnji prenesejo z uradnih
strani in ostanejo v besedila/ ob tej skripti.
"""

import json
import os
import urllib.request
from pathlib import Path

TU = Path(__file__).resolve().parent
BESEDILA = TU / "besedila"
# Besedila iz seznama licenc SPDX (isto besedilo kot na gnu.org; gnu.org je
# 7. 10. 2026 prenos prekinjal).
_SPDX = "https://raw.githubusercontent.com/spdx/license-list-data/main/text/"
URADNA = {
    "GPL-3.0.txt": _SPDX + "GPL-3.0-only.txt",
    "GPL-2.0.txt": _SPDX + "GPL-2.0-only.txt",
    "LGPL-2.1.txt": _SPDX + "LGPL-2.1-only.txt",
    "LGPL-3.0.txt": _SPDX + "LGPL-3.0-only.txt",
    "Apache-2.0.txt": _SPDX + "Apache-2.0.txt",
}

# Paketi, ki jih paket izpusti (glej zgradi_paket.py), se ne naštejejo.
IZPUSCENI = {"readline"}

# Kar ni v conda-meta: modeli, pisava, zastave, whisper.cpp, glasba.
DRUGI = [
    ("whisper.cpp", "1.6.2", "MIT", "https://github.com/ggerganov/whisper.cpp/tree/v1.6.2"),
    ("sherpa-onnx", "1.13.8", "Apache-2.0", "https://github.com/k2-fsa/sherpa-onnx"),
    ("Audio tagging model (zipformer small, 2024-04-15)", "", "Apache-2.0",
     "https://huggingface.co/k2-fsa/sherpa-onnx-zipformer-small-audio-tagging-2024-04-15"),
    ("DPDFNet speech enhancement model (dpdfnet2_48khz_hr)", "", "Apache-2.0",
     "https://huggingface.co/Ceva-IP/DPDFNet"),
    ("Instrument Sans", "", "OFL-1.1", "https://github.com/Instrument/instrument-sans"),
    ("Circle flags (HatScripts)", "", "MIT", "https://github.com/HatScripts/circle-flags"),
]

VIRI = {
    "ffmpeg": "https://ffmpeg.org/releases/ffmpeg-{v}.tar.xz",
    "x264": "https://code.videolan.org/videolan/x264",
    "x265": "https://bitbucket.org/multicoreware/x265_git",
}


def _besedila():
    BESEDILA.mkdir(exist_ok=True)
    for ime, url in URADNA.items():
        cilj = BESEDILA / ime
        if not cilj.is_file():
            with urllib.request.urlopen(url, timeout=60) as odgovor:
                cilj.write_bytes(odgovor.read())
    return {ime: (BESEDILA / ime).read_text(encoding="utf-8") for ime in URADNA}


def paketi(okolje: Path) -> list:
    vrstice = []
    for f in sorted((okolje / "conda-meta").glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if d["name"] in IZPUSCENI:
            continue
        vir = (VIRI.get(d["name"], "").format(v=d["version"])
               or f"https://github.com/conda-forge/{d['name']}-feedstock")
        vrstice.append((d["name"], d["version"], d.get("license", "?"), vir))
    return vrstice


def pip_paketi(okolje: Path, razen=()) -> list:
    """Paketi, ki jih je namestil pip (anthropic in njegove odvisnosti,
    sherpa-onnx): conda-meta jih ne pozna, zato jih beremo iz METADATA."""
    vrstice, videni = [], set()
    normaliziraj = lambda ime: ime.lower().replace("_", "-")
    razen = {normaliziraj(i) for i in razen}
    # lib/python3.1 je povezava na python3.12: isti paket le enkrat.
    for meta in sorted(okolje.glob("lib/python3*/site-packages/*.dist-info/METADATA")):
        mapa = meta.parent
        namestil = mapa / "INSTALLER"
        if namestil.is_file() and namestil.read_text(encoding="utf-8").strip() != "pip":
            continue
        polja, url = {}, ""
        for vrstica in meta.read_text(encoding="utf-8", errors="replace").splitlines():
            if not vrstica.strip():
                break                       # konec glave, naprej je opis
            kljuc, _, vrednost = vrstica.partition(":")
            vrednost = vrednost.strip()
            if kljuc in ("Name", "Version", "License-Expression", "Home-page") and kljuc not in polja:
                polja[kljuc] = vrednost
            elif kljuc == "License" and "License" not in polja and len(vrednost) < 60:
                polja["License"] = vrednost
            elif kljuc == "Classifier" and vrednost.startswith("License ::") and "Classifier" not in polja:
                polja["Classifier"] = vrednost.split("::")[-1].strip()
            elif kljuc == "Project-URL" and not url and "," in vrednost:
                url = vrednost.split(",", 1)[1].strip()
        ime = polja.get("Name", mapa.name.split("-")[0])
        if normaliziraj(ime) in razen | videni or ime in IZPUSCENI:
            continue
        videni.add(normaliziraj(ime))
        licenca = (polja.get("License-Expression") or polja.get("License")
                   or polja.get("Classifier") or "?")
        vrstice.append((ime, polja.get("Version", ""), licenca,
                        polja.get("Home-page") or url or f"https://pypi.org/project/{ime}/"))
    return vrstice


def zapisi(cilj: Path, vendor: Path, vir_kode: Path, razlicica: str):
    """Napiše LICENSES/ v paket. `vendor` je Wayfare/vendor, `vir_kode` Wayfare/."""
    cilj.mkdir(parents=True, exist_ok=True)
    for ime, besedilo in _besedila().items():
        (cilj / ime).write_text(besedilo, encoding="utf-8")
    python_licenca = vendor / "python" / "lib" / "python3.12" / "LICENSE.txt"
    if python_licenca.is_file():
        (cilj / "Python-PSF.txt").write_text(python_licenca.read_text(encoding="utf-8"),
                                             encoding="utf-8")
    ofl = vir_kode / "wayfare" / "static" / "pisava" / "OFL.txt"
    if ofl.is_file():
        (cilj / "OFL-1.1-Instrument-Sans.txt").write_text(ofl.read_text(encoding="utf-8"),
                                                         encoding="utf-8")
    zastave = vir_kode / "wayfare" / "static" / "zastave" / "LICENSE.md"
    if zastave.is_file():
        (cilj / "MIT-flag-icons.md").write_text(zastave.read_text(encoding="utf-8"),
                                               encoding="utf-8")

    conda = paketi(vendor / "ffmpeg") + paketi(vendor / "python")
    znani = {i for i, _, _, _ in conda + DRUGI}
    vse = conda + pip_paketi(vendor / "python", razen=znani) + DRUGI
    sirina = max(len(f"{i} {v}".strip()) for i, v, _, _ in vse) + 2
    tabela = "\n".join(f"{(i + ' ' + v).strip():<{sirina}}{lic}\n{'':<{sirina}}{vir}"
                       for i, v, lic, vir in vse)
    kontakt = os.environ.get("WAYFARE_KONTAKT", "").strip()
    ponudba = (f"You can also request a copy of the corresponding source code by "
               f"writing to {kontakt}. This offer is valid for three years from "
               f"the date you received this version." if kontakt else "")
    (cilj / "README.txt").write_text(f"""Wayfare Studio {razlicica} — third-party software
{'=' * 60}

Wayfare Studio bundles the programs and models listed below. Each one keeps
its own licence; the full licence texts are in this folder.

FFmpeg is built with x264 and x265 and is licensed under the GNU General
Public License version 3 (GPL-3.0.txt). Wayfare Studio runs FFmpeg as a
separate program; it does not link to it. The FFmpeg build is the conda-forge
package ffmpeg {next((v for i, v, _, _ in vse if i == 'ffmpeg'), '')}. Its corresponding source code is
available from the links below: the upstream release archive and the
conda-forge recipe (build scripts and exact source URLs) for every package.
{ponudba}

Music in the starter library is licensed under Creative Commons (CC BY 3.0,
CC BY 4.0) or CC0. The title, artist, licence and required credit for each
track are in _glasba/knjiznica.json in your music folder; Wayfare Studio
copies the credit for you when a track is used.

Component{'':<{max(0, sirina - 9)}}Licence / source
{'-' * 60}
{tabela}
""", encoding="utf-8")
    return cilj
