"""Zbere vloge, zmontirane v Wayfare Studiu, za zavihek Vlogi na spletni strani.

    python3 zberi.py            # vse: spletni video, zanke, naslovnice, vlogi.json
    python3 zberi.py --video    # samo spletni različici videa in zanke (dolgo)
    python3 zberi.py --slike    # samo naslovnice in vlogi.json (hitro)
    python3 zberi.py --samo <oznaka>   # video in zanka le za ta vlog, slike in vlogi.json za vse

Izhod v ../stran/media/vlogi/: <oznaka>-1080.mp4 in <oznaka>-720.mp4 (spletni
različici, x264 kot pri heroju), <oznaka>-zanka.mp4 (6 s nemega predogleda za
kazalec nad kartico) in <oznaka>.jpg (naslovnica). Opis vseh vlogov je v
../stran/vlogi.json (s koordinatami krajev iz KRAJI za globus); iz njega zgradi.py
sestavi stran vlogi/ in zemljevid na domači strani.

Izvor je končni izvoz vsakega vloga v ~/Video. Poglavja in naslovnice pridejo
iz paketa za objavo (_izris/objava), kjer obstaja; sicer naslovnico vzamemo
iz filma ob navedenem času. Vlog z oznako youtube dobi isto naslovnico kot na
YouTubu (velika sličica videa), razen če je naslovna pot do lastne slike. Vrstni red v seznamu je vrstni red na strani:
najnovejši prvi.

Vlog z oznako youtube (v VLOGI ali že v vlogi.json) na strani igra z YouTuba:
zanj nastaneta le zanka in naslovnica, spletni različici ne.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

TU = Path(__file__).resolve().parent
FF = Path("~/Claude/claude/Wayfare/vendor/ffmpeg/bin/ffmpeg").expanduser()
FP = FF.with_name("ffprobe")
VIDEO = Path("~/Video").expanduser()
CILJ = TU.parent / "stran" / "media" / "vlogi"
JSON = TU.parent / "stran" / "vlogi.json"

# oznaka, izvor (pod ~/Video), projekt (mapa s katalogom in paketom za objavo),
# naslov in kraj v obeh jezikih, dan snemanja (od, do), naslovnica: številka
# slike iz paketa za objavo (1–6), čas v filmu (sekunde) za vloge brez paketa
# ali pot do lastne slike (ta velja tudi pred sličico z YouTuba).
# zanka (po želji): trije časi v sekundah za predogled ob kazalcu, kadar
# privzeti (po deležih filma) padejo na prazne kadre.
# youtube (po želji): oznaka videa na YouTubu, kamor gre izvorni izvoz iz ~/Video
# (lahko kot Neobjavljen). Oznaka, ki je že v vlogi.json, se ohrani.
VLOGI = [
    dict(oznaka="milano-4", izvor="Milano vlog day 4.mp4", projekt="Milano day 4",
         naslov=dict(en="Milan — Day 4", sl="Milano — 4. dan"),
         kraj=dict(en="Milan, Italy", sl="Milano, Italija"),
         datum=("2026-10-12", None), naslovna=1, youtube="oV69oloS8Bk"),
    dict(oznaka="milano-3", izvor="Milano vlog day 3.mp4", projekt="Milano day 3",
         naslov=dict(en="Milan — Day 3", sl="Milano — 3. dan"),
         kraj=dict(en="Milan, Italy", sl="Milano, Italija"),
         datum=("2026-10-11", None), naslovna=1, youtube="WkgzNkAhiWg"),
    dict(oznaka="milano-2", izvor="Milano vlog day 2.mp4", projekt="Milano day 2",
         naslov=dict(en="Milan — Day 2", sl="Milano — 2. dan"),
         kraj=dict(en="Milan, Italy", sl="Milano, Italija"),
         datum=("2026-10-10", None), naslovna=1, youtube="byRexCDP6DA"),
    dict(oznaka="milano-1", izvor="Milano vlog day 1.mp4", projekt="Milano day 1",
         naslov=dict(en="Milan — Day 1", sl="Milano — 1. dan"),
         kraj=dict(en="Milan, Italy", sl="Milano, Italija"),
         datum=("2026-10-09", None), naslovna=5, youtube="9tV9cIBiw8w"),
    dict(oznaka="madrid-recap", izvor="Madrid vlog recap.mp4", projekt="Madrid recap",
         naslov=dict(en="Madrid — Recap", sl="Madrid — povzetek"),
         kraj=dict(en="Madrid, Spain", sl="Madrid, Španija"),
         datum=("2026-09-25", "2026-09-28"), naslovna=68.3, youtube="LSp_V7revZU"),
    dict(oznaka="madrid-4", izvor="Madrid vlog day 4.mp4", projekt="Madrid day 4",
         naslov=dict(en="Madrid — Day 4", sl="Madrid — 4. dan"),
         kraj=dict(en="Madrid, Spain", sl="Madrid, Španija"),
         datum=("2026-09-28", None), naslovna=5, youtube="JprZupLajmo"),
    dict(oznaka="madrid-3", izvor="Madrid vlog day 3.mp4", projekt="Madrid day 3",
         naslov=dict(en="Madrid — Day 3", sl="Madrid — 3. dan"),
         kraj=dict(en="Madrid, Spain", sl="Madrid, Španija"),
         datum=("2026-09-27", None), naslovna=2, youtube="KEMtLTS2HV4"),
    dict(oznaka="madrid-2", izvor="Madrid vlog day 2.mp4", projekt="Madrid day 2",
         naslov=dict(en="Madrid — Day 2", sl="Madrid — 2. dan"),
         kraj=dict(en="Madrid, Spain", sl="Madrid, Španija"),
         datum=("2026-09-26", None), naslovna=1, youtube="aR8NKk3gyTc"),
    dict(oznaka="madrid-1", izvor="Madrid vlog day 1.mp4", projekt="Madrid day 1",
         naslov=dict(en="Madrid — Day 1", sl="Madrid — 1. dan"),
         kraj=dict(en="Madrid, Spain", sl="Madrid, Španija"),
         datum=("2026-09-25", None), naslovna=1, youtube="0QB2J8OFnJ4"),
    dict(oznaka="rifnik", izvor="Rifnik 3.mp4", projekt=None,
         naslov=dict(en="Rifnik", sl="Rifnik"),
         kraj=dict(en="Rifnik, Slovenia", sl="Rifnik, Slovenija"),
         datum=("2026-09-05", None), naslovna=72.7),
    dict(oznaka="malta-6", izvor="Malta 2026/Malta day 6.mov", projekt=None,
         naslov=dict(en="Malta — Day 6", sl="Malta — 6. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-05-01", None), naslovna=12, youtube="sXzOiCZ46kI"),
    dict(oznaka="malta-5", izvor="Malta 2026/Malta day 5.mov", projekt=None,
         naslov=dict(en="Malta — Day 5", sl="Malta — 5. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-04-30", None), naslovna=12, youtube="qJLW7UW2BDw"),
    dict(oznaka="malta-4", izvor="Malta 2026/Malta day 4.mov", projekt=None,
         naslov=dict(en="Malta — Day 4", sl="Malta — 4. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-04-29", None), naslovna=12, youtube="04gDUz560Wg"),
    dict(oznaka="malta-3", izvor="Malta 2026/Malta day 3.mov", projekt=None,
         naslov=dict(en="Malta — Day 3", sl="Malta — 3. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-04-28", None), naslovna=12, youtube="9kPLFmRa9qk"),
    dict(oznaka="malta-2", izvor="Malta 2026/Malta day 2.mov", projekt=None,
         naslov=dict(en="Malta — Day 2", sl="Malta — 2. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-04-27", None), naslovna=12, youtube="lEDYangoTDI"),
    dict(oznaka="malta-1", izvor="Malta 2026/Malta day 1.mov", projekt=None,
         naslov=dict(en="Malta — Day 1", sl="Malta — 1. dan"),
         kraj=dict(en="Malta", sl="Malta"),
         datum=("2026-04-26", None), naslovna=12, youtube="OQpgyF4b1N4"),
    dict(oznaka="budimpesta-2-3", izvor="Budimpešta day 2-3.mov", projekt=None,
         naslov=dict(en="Budapest — Days 2–3", sl="Budimpešta — 2. in 3. dan"),
         kraj=dict(en="Budapest, Hungary", sl="Budimpešta, Madžarska"),
         datum=("2025-12-27", "2025-12-28"), naslovna=12, youtube="7wf1LUpqWPM"),
    dict(oznaka="budimpesta-1", izvor="Budimpešta day 1.mov", projekt=None,
         naslov=dict(en="Budapest — Day 1", sl="Budimpešta — 1. dan"),
         kraj=dict(en="Budapest, Hungary", sl="Budimpešta, Madžarska"),
         datum=("2025-12-26", None), naslovna=12, youtube="6XAmNtaazx8"),
    # kratki film iz Wayfare Studia; brez oznake youtube ga na strani ni
    dict(oznaka="budimpesta", izvor="Budimpešta/_izris/Budimpešta.mp4", projekt="Budimpešta",
         naslov=dict(en="Budapest", sl="Budimpešta"),
         kraj=dict(en="Budapest, Hungary", sl="Budimpešta, Madžarska"),
         datum=("2025-12-26", None), naslovna=35.8),
    dict(oznaka="rim-5", izvor="Rim day 5.mov", projekt=None,
         naslov=dict(en="Rome — Day 5", sl="Rim — 5. dan"),
         kraj=dict(en="Rome, Italy", sl="Rim, Italija"),
         datum=("2025-11-01", None), naslovna=50.0, youtube="XhDLPdfycMw",
         zanka=(40.5, 100.5, 200.5)),
    dict(oznaka="rim-4", izvor="Rim day 4.mov", projekt=None,
         naslov=dict(en="Rome — Day 4", sl="Rim — 4. dan"),
         kraj=dict(en="Rome, Italy", sl="Rim, Italija"),
         datum=("2025-10-31", None), naslovna=60.0, youtube="IES2JTfFNBM",
         zanka=(60.5, 204.5, 264.5)),
    # Rome day 3 je v filmu »Day 2 (part 2)«: isti dan kot 2. dan
    dict(oznaka="rim-3", izvor="Rim day 3.mov", projekt=None,
         naslov=dict(en="Rome — Day 3", sl="Rim — 3. dan"),
         kraj=dict(en="Rome, Italy", sl="Rim, Italija"),
         datum=("2025-10-30", None), naslovna=100.0, youtube="ff6QTwta0gY",
         zanka=(10.5, 100.5, 131.0)),
    dict(oznaka="rim-2", izvor="Rim day 2.mov", projekt=None,
         naslov=dict(en="Rome — Day 2", sl="Rim — 2. dan"),
         kraj=dict(en="Rome, Italy", sl="Rim, Italija"),
         datum=("2025-10-30", None), naslovna=130.0, youtube="aPn50KNMeCk",
         zanka=(40.5, 130.5, 210.5)),
    dict(oznaka="rim-1", izvor="Rim day 1.mov", projekt=None,
         naslov=dict(en="Rome — Day 1", sl="Rim — 1. dan"),
         kraj=dict(en="Rome, Italy", sl="Rim, Italija"),
         datum=("2025-10-29", None), naslovna=122.0, youtube="F4BL7-oRi5s",
         zanka=(10.5, 93.0, 121.5)),
]

# Kraji na globusu (zemljevid na domači strani): ključ je kraj v angleščini, kot v VLOGI.
# stran: kje stoji ime ob piki (levo, spodaj; privzeto desno), da se imena bližnjih krajev
# ne prekrivajo. Vlog s krajem, ki ga tu ni, na globusu ni.
KRAJI = {
    "Milan, Italy":      dict(lon=9.19,   lat=45.464, stran="levo"),
    "Madrid, Spain":     dict(lon=-3.704, lat=40.417),
    "Rifnik, Slovenia":  dict(lon=15.42,  lat=46.22,  stran="spodaj"),
    "Budapest, Hungary": dict(lon=19.04,  lat=47.498),
    "Malta":             dict(lon=14.51,  lat=35.9),
    "Rome, Italy":       dict(lon=12.496, lat=41.903),
}

# x264 kot pri zanki heroja; vlogi so 60 sličic/s, zato je zgornja meja višja
X264 = ["-c:v", "libx264", "-preset", "fast", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-map_metadata", "-1", "-map_chapters", "-1",
        "-metadata:s:v", "handler_name=", "-metadata:s:a", "handler_name=", "-fflags", "+bitexact"]
ZVOK = ["-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"]


def probe(pot):
    out = subprocess.run([FP, "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=width,height,r_frame_rate:format=duration",
                          "-of", "json", str(pot)], capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    s = d["streams"][0]
    a, b = s["r_frame_rate"].split("/")
    return dict(sirina=s["width"], visina=s["height"], fps=round(int(a) / int(b)),
                trajanje=round(float(d["format"]["duration"]), 3))


def poglavja(v):
    if not v["projekt"]:
        return []
    p = VIDEO / v["projekt"] / "_izris" / "objava" / "objava.json"
    if not p.is_file():
        return []
    return [[round(float(t), 1), ime] for t, ime in json.load(open(p, encoding="utf-8"))["poglavja"]]


def posnetkov(v):
    if not v["projekt"]:
        return None
    p = VIDEO / v["projekt"] / "_vlog" / "katalog.json"
    return json.load(open(p, encoding="utf-8")).get("clip_count") if p.is_file() else None


def casi_zanke(v, info):
    """Trije dvosekundni odseki za predogled: navedeni (zanka=), ob poglavjih, kjer so, sicer po deležih."""
    if v.get("zanka"):
        return list(v["zanka"])
    pog = [t for t, _ in poglavja(v) if t > 20]
    if len(pog) >= 3:
        return [pog[0] + 1.0, pog[len(pog) // 2] + 1.0, pog[-1] + 1.0]
    d = info["trajanje"]
    return [d * 0.22, d * 0.5, d * 0.78]


def video(v, izvor, info, splet=True):
    """Spletni različici (1080 in 720 v eni obdelavi; vlog z YouTuba ju ne rabi) in zanka za kazalec."""
    gop = str(info["fps"] * 2)
    if splet:
        skala = "scale=w={w}:h={h}:force_original_aspect_ratio=decrease:force_divisible_by=2"
        graf = (f"[0:v]{skala.format(w=1920, h=1080)},setsar=1,format=yuv420p,split=2[a][b];"
                f"[b]{skala.format(w=1280, h=720)}:flags=lanczos[m]")
        subprocess.run([
            FF, "-v", "error", "-stats", "-y", "-i", str(izvor), "-filter_complex", graf,
            "-map", "[a]", "-map", "0:a:0", *X264, "-crf", "24", "-maxrate", "5M", "-bufsize", "10M", "-g", gop, *ZVOK,
            str(CILJ / f"{v['oznaka']}-1080.mp4"),
            "-map", "[m]", "-map", "0:a:0", *X264, "-crf", "25", "-maxrate", "2.2M", "-bufsize", "4.4M", "-g", gop, *ZVOK,
            str(CILJ / f"{v['oznaka']}-720.mp4"),
        ], check=True)

    odsek = "fps=30,scale=w=854:h=480:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1"
    vhodi, veriga = [], ""
    for i, t in enumerate(casi_zanke(v, info)):
        vhodi += ["-ss", f"{t:.2f}", "-t", "2", "-i", str(izvor)]
        veriga += f"[{i}:v]{odsek}[v{i}];"
    veriga += "[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[v]"
    subprocess.run([FF, "-v", "error", "-y", *vhodi, "-filter_complex", veriga, "-map", "[v]", "-an",
                    *X264, "-crf", "28", "-g", "60", str(CILJ / f"{v['oznaka']}-zanka.mp4")], check=True)


def youtube_naslovnica(oznaka):
    """Velika sličica videa na YouTubu (1280 × 720, brez metapodatkov) ali None,
    če je YouTube še ni naredil (nastane nekaj minut po nalaganju)."""
    try:
        with urllib.request.urlopen(f"https://i.ytimg.com/vi/{oznaka}/maxresdefault.jpg", timeout=20) as odg:
            return odg.read()
    except urllib.error.HTTPError:
        return None


def naslovnica(v, izvor, youtube):
    """Naslovnica brez metapodatkov, največ 1600 px: lastna slika (pot), sicer ista
    kot na YouTubu, sicer iz paketa za objavo ali iz filma ob navedenem času."""
    cilj = CILJ / f"{v['oznaka']}.jpg"
    n = v["naslovna"]
    if youtube and not isinstance(n, str):
        slika = youtube_naslovnica(youtube)
        if slika:
            cilj.write_bytes(slika)
            return
        print(f"  {v['oznaka']}: YouTube še nima velike sličice, naslovnica kot brez YouTuba")
    if isinstance(n, str):
        ukaz = [FF, "-v", "error", "-y", "-i", str(Path(n).expanduser())]
    elif isinstance(n, int):
        vir = VIDEO / v["projekt"] / "_izris" / "objava" / f"naslovna-{n}.jpg"
        ukaz = [FF, "-v", "error", "-y", "-i", str(vir)]
    else:
        ukaz = [FF, "-v", "error", "-y", "-ss", f"{n:.2f}", "-i", str(izvor), "-frames:v", "1"]
    subprocess.run([*ukaz, "-vf", "scale=w=1600:h=1600:force_original_aspect_ratio=decrease",
                    "-q:v", "3", "-map_metadata", "-1", str(cilj)], check=True)


def main(argv):
    samo_video = "--video" in argv
    samo_slike = "--slike" in argv
    samo = argv[argv.index("--samo") + 1] if "--samo" in argv else None  # video le za ta vlog
    CILJ.mkdir(parents=True, exist_ok=True)
    prej = {}  # oznake youtube iz prejšnjega vlogi.json ostanejo, če jih v VLOGI ni
    if JSON.is_file():
        prej = {z["oznaka"]: z.get("youtube") for z in json.load(open(JSON, encoding="utf-8"))["vlogi"]}
    zapis = []
    for v in VLOGI:
        izvor = VIDEO / v["izvor"]
        if not izvor.is_file():
            raise SystemExit(f"Ni izvora: {izvor}")
        youtube = v.get("youtube") or prej.get(v["oznaka"])
        info = probe(izvor)
        print(f"{v['oznaka']}: {info['sirina']}×{info['visina']} {info['fps']} fps, {info['trajanje']:.0f} s"
              + (f", YouTube {youtube}" if youtube else ""))
        if not samo_slike and samo in (None, v["oznaka"]):
            video(v, izvor, info, splet=not youtube)
        if not samo_video:
            naslovnica(v, izvor, youtube)
        zapis.append(dict(
            oznaka=v["oznaka"], naslov=v["naslov"], kraj=v["kraj"],
            datum=v["datum"][0], datum_do=v["datum"][1],
            trajanje=info["trajanje"], sirina=info["sirina"], visina=info["visina"],
            posnetkov=posnetkov(v), poglavja=poglavja(v), jezik="sl", youtube=youtube,
        ))
    # vlogi in kraji, ki jih je dodal samodejno.py (GitHub Actions), ostanejo,
    # dokler jih ne prevzameš v VLOGI oziroma KRAJI
    staro = json.load(open(JSON, encoding="utf-8")) if JSON.is_file() else {"vlogi": [], "kraji": []}
    oznake = {v["oznaka"] for v in VLOGI}
    samodejni = [z for z in staro["vlogi"] if z.get("samodejno") and z["oznaka"] not in oznake]
    if samodejni:
        zapis = sorted(zapis + samodejni, key=lambda z: z["datum"], reverse=True)
        print("ohranjeni samodejni vlogi:", ", ".join(z["oznaka"] for z in samodejni))
    if not samo_video:
        brez = sorted({v["kraj"]["en"] for v in VLOGI if v["kraj"]["en"] not in KRAJI})
        if brez:
            print("brez koordinat za globus (dodaj v KRAJI):", ", ".join(brez))
        kraji = [dict(kljuc=k, **v) for k, v in KRAJI.items()]
        kraji += [k for k in staro.get("kraji", []) if k["kljuc"] not in KRAJI]
        JSON.write_text(json.dumps(dict(vlogi=zapis, kraji=kraji), ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{JSON.relative_to(TU.parent)}: {len(zapis)} vlogov, "
              f"{sum(z['trajanje'] for z in zapis) / 60:.0f} min")


if __name__ == "__main__":
    main(sys.argv[1:])
