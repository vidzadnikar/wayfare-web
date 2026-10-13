"""Podatki za globus na strani: obale in meje držav kot črte ter senčen relief.

    python3 globus.py <mapa z Natural Earth geojson> [GRAY_50M_SR_OB.tif] [lon0 lon1 lat0 lat1]

Izhod v ../stran/media/zemljevid/:
  meje.json          {"okvir": [lon0, lon1, lat0, lat1], "obale": ..., "obale_fino": ..., "svet": ..., "fino": ...}
                     lomljenke [lon, lat, ...]: obale in meje držav za svet (110m) ter podrobne
                     (50m) le v okvirju okoli krajev (privzeto −14…30, 34…54)
  relief-4096.webp   senčen relief sveta v barvah strani (ocean temen, kopno svetlejše), 4096 × 2048
  relief-2048.webp   isto za telefon

Vir: Natural Earth (javna last, naturalearthdata.com): geojson iz
github.com/nvkelso/natural-earth-vector (ne_110m_coastline, ne_50m_coastline,
ne_110m_admin_0_boundary_lines_land, ne_50m_admin_0_boundary_lines_land) in raster
»Gray Earth with Shaded Relief and Ocean Bottom« naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_OB.zip.
Relief obarva ffmpeg iz Wayfare vendor: sivine oceana (76–110) v temno modro ob barvi
površine strani, kopno (110–228) v svetlejšo modro, da se vidijo gorovja.
"""
import json
import subprocess
import sys
from pathlib import Path

TU = Path(__file__).resolve().parent
CILJ = TU.parent / "stran" / "media" / "zemljevid"
FF = Path("~/Claude/claude/Wayfare/vendor/ffmpeg/bin/ffmpeg").expanduser()
LUT = ("lutrgb=r='clip(if(lt(val,110),12+(val-76)*0.2,30+(val-110)*0.40),0,255)'"
       ":g='clip(if(lt(val,110),18+(val-76)*0.25,38+(val-110)*0.46),0,255)'"
       ":b='clip(if(lt(val,110),40+(val-76)*0.35,66+(val-110)*0.56),0,255)'")


def lomljenke(geojson, okvir=None):
    """Lomljenke; z okvirjem le tiste, ki imajo vsaj eno točko v njem."""
    out = []
    for f in geojson["features"]:
        g = f["geometry"]
        crte = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for crta in crte:
            tocke = [(round(x, 2), round(y, 2)) for x, y in crta]
            if okvir:
                lon0, lon1, lat0, lat1 = okvir
                if not any(lon0 <= x <= lon1 and lat0 <= y <= lat1 for x, y in tocke):
                    continue
            if len(tocke) >= 2:
                out.append([v for t in tocke for v in t])
    return out


def relief(tif):
    for sirina in (4096, 2048):
        cilj = CILJ / f"relief-{sirina}.webp"
        subprocess.run([FF, "-v", "error", "-y", "-i", str(tif),
                        "-vf", f"scale={sirina}:{sirina // 2}:flags=lanczos,format=rgb24,{LUT}",
                        "-c:v", "libwebp", "-quality", "82", str(cilj)], check=True)
        print(f"{cilj.name}: {cilj.stat().st_size // 1000} kB")


def main(mapa, tif=None, okvir=(-14, 30, 34, 54)):
    CILJ.mkdir(parents=True, exist_ok=True)
    mapa = Path(mapa)
    nalozi = lambda ime: json.load(open(mapa / f"{ime}.geojson", encoding="utf-8"))
    meje = {"okvir": list(okvir),
            "obale": lomljenke(nalozi("ne_110m_coastline")),
            "obale_fino": lomljenke(nalozi("ne_50m_coastline"), okvir),
            "svet": lomljenke(nalozi("ne_110m_admin_0_boundary_lines_land")),
            "fino": lomljenke(nalozi("ne_50m_admin_0_boundary_lines_land"), okvir)}
    pot = CILJ / "meje.json"
    pot.write_text(json.dumps(meje, separators=(",", ":")), encoding="utf-8")
    print(f"meje.json: {pot.stat().st_size // 1000} kB ({len(meje['obale'])} obal, {len(meje['svet'])} mej)")
    if tif:
        relief(tif)


if __name__ == "__main__":
    a = sys.argv[1:]
    tif = a[1] if len(a) >= 2 and a[1].lower().endswith(".tif") else None
    st = a[2:6] if tif else a[1:5]
    main(a[0], tif, tuple(float(x) for x in st) if len(st) == 4 else (-14, 30, 34, 54))
