"""Pike kopnega za zemljevid v slogu strani (dot-matrix).

    python3 pike.py <ne_110m_land.geojson> <ne_50m_land.geojson>

Izhod pike.json: {"svet": [lon, lat, ...] (1°, brez Antarktike), "evropa": [...] (0,4°,
lon −25…45, lat 30…72)}. Kopno je iz Natural Earth (javna last, naturalearthdata.com).
Točke mreže so preizkušene s prerezom vrstice (scanline): za vsako zemljepisno
širino zberemo presečišča z robovi poligonov, uredimo in zapolnimo pare.
"""
import json
import sys
from pathlib import Path


def robovi(geojson):
    r = []
    for f in geojson["features"]:
        g = f["geometry"]
        poligoni = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poligon in poligoni:
            for obroc in poligon:
                for (x1, y1), (x2, y2) in zip(obroc, obroc[1:] + obroc[:1]):
                    if y1 != y2:
                        r.append((x1, y1, x2, y2))
    return r


def pike(robovi_, lon0, lon1, lat0, lat1, korak):
    # robove razvrstimo po širini, da za vsako vrstico pregledamo le ustrezne
    po_vrsticah = {}
    for x1, y1, x2, y2 in robovi_:
        a, b = (y1, y2) if y1 < y2 else (y2, y1)
        za = int((a - lat0) // korak)
        do = int((b - lat0) // korak) + 1
        for i in range(max(za, 0), do + 1):
            po_vrsticah.setdefault(i, []).append((x1, y1, x2, y2))
    izhod = []
    i = 0
    lat = lat0 + korak / 2
    stolpci = [lon0 + korak / 2 + j * korak for j in range(int((lon1 - lon0) / korak))]
    while lat < lat1:
        presek = []
        for x1, y1, x2, y2 in po_vrsticah.get(i, ()):
            if (y1 <= lat < y2) or (y2 <= lat < y1):
                presek.append(x1 + (lat - y1) * (x2 - x1) / (y2 - y1))
        presek.sort()
        for k in range(0, len(presek) - 1, 2):
            a, b = presek[k], presek[k + 1]
            for lon in stolpci:
                if a <= lon <= b:
                    izhod.extend((round(lon, 2), round(lat, 2)))
        i += 1
        lat += korak
    return izhod


def main(pot110, pot50):
    r110 = robovi(json.load(open(pot110, encoding="utf-8")))
    r50 = robovi(json.load(open(pot50, encoding="utf-8")))
    svet = pike(r110, -180, 180, -60, 85, 1.0)
    evropa = pike(r50, -25, 45, 30, 72, 0.4)
    cilj = Path(__file__).resolve().parent / "pike.json"
    cilj.write_text(json.dumps({"svet": svet, "evropa": evropa}, separators=(",", ":")), encoding="utf-8")
    print(f"svet {len(svet) // 2} pik, evropa {len(evropa) // 2} pik, {cilj.stat().st_size // 1000} kB")


if __name__ == "__main__":
    main(*sys.argv[1:3])
