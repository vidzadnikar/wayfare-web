"""Relief za globus na strani v barvah Svinčnik (papir in grafit), 21. 10. 2026.

    python relief.py <gebco_08_rev_elev_21600x10800.png> <gebco_08_rev_bath_21600x10800.png>

Potrebuje Pillow in numpy (npr. v začasnem venv). Izhod v ../stran/media/zemljevid/:
  relief-8192.webp   računalnik (8192 × 4096)
  relief-4096.webp   telefon

Vir višin: NASA Visible Earth, Blue Marble Next Generation, topografija in
batimetrija (GEBCO 2008), 21600 × 10800, javna last:
  eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png
  eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png

Kako: višina kopnega (0–6400 m) in globina morja se združita v eno polje. Iz
njega se izračuna senčenje z več smeri (luč z leve zgoraj, kot na tiskanih
reliefnih zemljevidih), ki zatemni pobočja v grafit. Kopno je papir, ki z
višino preide v topel kamen in na vrhovih v sneg; morje je za odtenek
hladnejši in temnejši papir, globlje temnejše. Led (Antarktika, Grenlandija)
je bel. Obala dobi tanko temnejšo črto.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
CILJ = Path(__file__).resolve().parent.parent / "stran" / "media" / "zemljevid"
W, H = 8192, 4096
R = 6_371_000.0

# barve (sRGB) po višini kopnega in globini morja, v metrih
KOPNO = [(0, (248, 245, 237)), (250, (244, 239, 228)), (800, (236, 228, 212)), (1800, (225, 215, 196)),
         (3200, (214, 204, 185)), (4800, (232, 228, 220)), (6400, (246, 245, 242))]
MORJE = [(0, (222, 224, 222)), (150, (215, 218, 217)), (1000, (203, 207, 208)), (3500, (190, 196, 199)),
         (6500, (179, 186, 191))]
LED = np.array([249, 249, 247], float)


def preberi(pot):
    im = Image.open(pot).convert("L").resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32)


def kopno_maska(bath_pot):
    """Kopno: v batimetriji je kopno belo (255). Maska se pomanjša iz polne
    ločljivosti s povprečenjem, zato je obala natančna na slikovno piko."""
    im = Image.open(bath_pot).convert("L").point(lambda v: 255 if v >= 255 else 0)
    return np.asarray(im.resize((W, H), Image.BOX), dtype=np.uint8) >= 128


def globina_iz(bath):
    """Globina morja v metrih: 255 je gladina, 0 je 8000 m ali globlje (GEBCO 2008)."""
    return np.clip((255 - bath) / 255 * 8000, 0, 8000)


def lestvica(v, stopnje):
    xs = np.array([s[0] for s in stopnje], float)
    out = np.empty(v.shape + (3,), np.float32)
    for k in range(3):
        out[..., k] = np.interp(v, xs, [s[1][k] for s in stopnje])
    return out


def sencenje(h, pretirano, smeri):
    """Senčenje z več smeri; 1.0 = ravnina, manj je senca, več osvetljeno pobočje."""
    lat = np.deg2rad(90 - (np.arange(H) + 0.5) / H * 180)[:, None]
    dx = 2 * np.pi * R / W * np.maximum(np.cos(lat), 0.05)
    dy = np.pi * R / H
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * dx) * pretirano
    gy = (np.vstack([h[:1], h[:-2], h[-2:-1]]) - np.vstack([h[1:2], h[2:], h[-1:]])) / (2 * dy) * pretirano
    naklon = np.arctan(np.hypot(gx, gy))
    smer = np.arctan2(gx, gy)  # smer pobočja navzdol, od severa v smeri urinega kazalca
    zenit = np.deg2rad(45)
    s = np.zeros_like(h)
    for az, utez in smeri:
        a = np.deg2rad(az)
        s += utez * (np.cos(zenit) * np.cos(naklon) + np.sin(zenit) * np.sin(naklon) * np.cos(a - smer - np.pi))
    return s / np.cos(zenit) / sum(u for _, u in smeri)


def main(elev_pot, bath_pot):
    elev = preberi(elev_pot)
    bath = preberi(bath_pot)
    kopno = kopno_maska(bath_pot)
    visina = elev / 255 * 6400
    globina = globina_iz(bath)
    h = np.where(kopno, np.maximum(visina, 0), -globina)

    lat = 90 - (np.arange(H) + 0.5) / H * 180
    lon = (np.arange(W) + 0.5) / W * 360 - 180
    LAT, LON = np.meshgrid(lat, lon, indexing="ij")
    led = kopno & ((LAT < -60) | ((LAT > 59) & (LON > -75) & (LON < -10) & (visina > 250)))

    s = sencenje(h, 9.0, [(315, 0.55), (270, 0.2), (0, 0.15), (225, 0.1)])
    barva = np.where(kopno[..., None], lestvica(visina, KOPNO), lestvica(globina, MORJE))
    barva = np.where(led[..., None], LED, barva)
    # kopno: senca v grafit, osvetljena pobočja proti beli; morje le rahlo
    sk = np.clip(np.where(kopno, s, 1 + (s - 1) * 0.35), 0.38, 1.3)[..., None]
    temno = barva * (0.32 + 0.68 * np.minimum(sk, 1))   # grafit ni črn: najgloblja senca je ~ tretjina svetlosti
    svetlo = barva + (255 - barva) * (np.maximum(sk, 1) - 1) / 0.3 * 0.55
    barva = np.where(sk < 1, temno, svetlo)
    # obala: tanka temnejša črta na morski strani
    meja = kopno.copy()
    for os_, k in ((0, 1), (0, -1), (1, 1), (1, -1)):
        meja |= np.roll(kopno, k, os_)
    obala = meja & ~kopno
    barva[obala] *= 0.9
    slika = Image.fromarray(np.clip(barva + 0.5, 0, 255).astype(np.uint8))
    CILJ.mkdir(parents=True, exist_ok=True)
    for sirina in (8192, 4096):
        pot = CILJ / f"relief-{sirina}.webp"
        s_ = slika if sirina == W else slika.resize((sirina, sirina // 2), Image.LANCZOS)
        s_.save(pot, "WEBP", quality=80, method=6)
        print(f"{pot.name}: {pot.stat().st_size // 1000} kB")


if __name__ == "__main__":
    main(*sys.argv[1:3])
