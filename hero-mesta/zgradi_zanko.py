"""Zanka evropskih mest za ozadje heroja na spletni strani Wayfare.

    python3 zgradi_zanko.py

Iz posnetkov v izvor/ (Pexels, licenca Pexels: brezplačna komercialna raba,
pripis ni obvezen) zmontira zanko brez šiva in jo shrani v
../stran/media/hero-mesta-1080.mp4, hero-mesta-720.mp4 in hero-mesta.jpg.

Zanka brez šiva: za zadnjim kadrom pride še enkrat prvi (isti odsek), izrez
pa se začne in konča X sekund po začetku prvega kadra. Tako je zadnja sličica
enaka prvi in preliv v zadnji kader se nadaljuje v začetek zanke.
"""

import os
import subprocess

TU = os.path.dirname(os.path.abspath(__file__))
FF = os.path.expanduser("~/Claude/claude/Wayfare/vendor/ffmpeg/bin/ffmpeg")
CILJ = os.path.join(TU, "..", "stran", "media")

D = 2.6     # dolžina kadra s prelivi vred (s)
X = 0.5     # preliv (s)
FPS = 30

# (datoteka, začetek v izvoru, približevanje: statični kadri dobijo počasen
# potisk naprej, kadri z lastnim gibanjem ostanejo, kot so)
KADRI = [
    ("01-lisboa.mp4", 0.5, False),     # sončni zahod nad Alfamo, kamera pluje
    ("08-barcelona.mp4", 2.0, False),  # dron nad Eixamplom ob zahodu
    ("07-roma.mp4", 3.0, True),        # Kolosej v zlati luči
    ("11-milano.mp4", 1.0, True),      # Duomo
    ("04-venezia.mp4", 1.5, False),    # gondola v kanalu
    ("05-ljubljana.mp4", 2.0, True),   # Tromostovje
    ("06-amsterdam.mp4", 1.0, True),   # kanal s cerkvijo sv. Nikolaja
    ("10-madrid.mp4", 2.0, True),      # Palacio de Cibeles
    ("02-paris.mp4", 2.0, True),       # Eifflov stolp v mraku
    ("03-praha.mp4", 49.0, True),      # Karlov most v modri uri, luči
    ("09-wien.mp4", 2.0, True),        # Dunaj ponoči
]

# enoten videz: malo manj nasičeno, sence proti temnomodri, svetlo toplo,
# rahlo temneje (stran čez video položi še svojo tančico)
VIDEZ = (
    "eq=saturation=0.86:contrast=1.03:brightness=-0.025:gamma=0.97,"
    "colorbalance=rs=-0.03:bs=0.07:rh=0.03:bh=-0.03"
)


def veriga(i, priblizaj):
    if priblizaj:
        # 4K vmesni korak, da je potisk gladek (zoompan zaokrožuje na piksle)
        n = round(D * FPS)
        okvir = (
            f"scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,"
            f"zoompan=z='1+0.07*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s=1920x1080:fps={FPS}"
        )
    else:
        okvir = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080"
    return f"[{i}:v]fps={FPS},{okvir},setsar=1,{VIDEZ},format=yuv420p,trim=duration={D},setpts=PTS-STARTPTS[v{i}]"


def main():
    kadri = KADRI + [KADRI[0]]  # prvi še enkrat za zanko brez šiva
    vhodi = []
    for ime, zacetek, _ in kadri:
        vhodi += ["-ss", str(zacetek), "-t", str(D + 0.5), "-i", os.path.join(TU, "izvor", ime)]
    deli = [veriga(i, p) for i, (_, _, p) in enumerate(kadri)]
    prej = "v0"
    for k in range(1, len(kadri)):
        izhod = f"x{k}"
        deli.append(f"[{prej}][v{k}]xfade=transition=fade:duration={X}:offset={k * (D - X):.3f}[{izhod}]")
        prej = izhod
    dolzina = len(KADRI) * (D - X)
    deli.append(f"[{prej}]trim=start={X}:duration={dolzina:.3f},setpts=PTS-STARTPTS,split=2[a][b]")
    deli.append("[b]scale=1280:720:flags=lanczos[m]")
    graf = ";".join(deli)

    x264 = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-an", "-g", str(FPS * 2),
            # brez metapodatkov izvora (GPS lokacija snemalca, naprava, datum)
            "-map_metadata", "-1", "-map_chapters", "-1", "-metadata:s:v", "handler_name=", "-fflags", "+bitexact"]
    ukaz = [FF, "-v", "error", "-stats", "-y", *vhodi, "-filter_complex", graf,
            "-map", "[a]", *x264, "-crf", "25", "-maxrate", "4M", "-bufsize", "8M",
            os.path.join(CILJ, "hero-mesta-1080.mp4"),
            "-map", "[m]", *x264, "-crf", "26", "-maxrate", "1.8M", "-bufsize", "3.6M",
            os.path.join(CILJ, "hero-mesta-720.mp4")]
    subprocess.run(ukaz, check=True)

    # naslovna slika: prva sličica zanke (enaka zadnji)
    subprocess.run([FF, "-v", "error", "-y", "-i", os.path.join(CILJ, "hero-mesta-1080.mp4"),
                    "-frames:v", "1", "-q:v", "4", "-map_metadata", "-1", os.path.join(CILJ, "hero-mesta.jpg")], check=True)
    print(f"zanka: {dolzina:.1f} s, {len(KADRI)} kadrov")


main()
