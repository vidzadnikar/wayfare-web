#!/usr/bin/env python3
"""Naloži filme vlogov v zasebno vedro R2 (wayfare-vlogi), od koder jih stran
pošilja naročnikom (/api/video/<oznaka>-1080.mp4 in -720.mp4).

    python3 zaledje/videi.py              # naloži, kar manjka (po stran/videi.json)
    python3 zaledje/videi.py --samo madrid-1
    python3 zaledje/videi.py --seznam     # kaj je naloženo in kaj manjka
    python3 zaledje/videi.py --local      # v lokalno vedro za npx wrangler pages dev

Vir so spletni različici iz stran/media/vlogi/ (naredi jih vlogi/zberi.py
--video). Plačljiv je vsak vlog brez "brezplacen": true v stran/vlogi.json;
nalagajo se le plačljivi. stran/videi.json hrani, kaj je naloženo (ime,
velikost, čas), da se ista datoteka ne nalaga dvakrat; spremenjena datoteka
(druga velikost) se naloži znova.

Datoteke do 300 MB nalaga npx wrangler (prijava: npx wrangler login; vedro:
npx wrangler r2 bucket create wayfare-vlogi, prej v nadzorni plošči vklopi
R2). Večje gredo prek S3 API-ja R2 v kosih (multipart); zanj rabiš žeton R2
(Cloudflare → R2 → Manage R2 API Tokens → Object Read & Write) v datoteki
~/.config/wayfare/r2.env:

    R2_ACCOUNT_ID=…
    R2_ACCESS_KEY_ID=…
    R2_SECRET_ACCESS_KEY=…

Z žetonom gredo prek S3 API-ja vse datoteke (hitreje in brez meje).
"""

import hashlib
import hmac
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

TU = Path(__file__).resolve().parent
REPO = TU.parent
MEDIA = REPO / "stran" / "media" / "vlogi"
VLOGI = REPO / "stran" / "vlogi.json"
MANIFEST = REPO / "stran" / "videi.json"
ZETON = Path("~/.config/wayfare/r2.env").expanduser()
VEDRO = "wayfare-vlogi"
RAZLICICE = ("1080", "720")
MEJA_WRANGLER = 300 * 1024 * 1024
KOS = 64 * 1024 * 1024


def nalozi_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.is_file() else {}


def shrani_manifest(m):
    MANIFEST.write_text(json.dumps(dict(sorted(m.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def placljivi_vlogi():
    vlogi = json.loads(VLOGI.read_text(encoding="utf-8"))["vlogi"]
    return [v for v in vlogi if (v.get("youtube") or v.get("objavljen")) and not v.get("brezplacen")]


def zeton_r2():
    """Žeton R2 iz okolja ali ~/.config/wayfare/r2.env; None, če ga ni."""
    k = {}
    if ZETON.is_file():
        for vrstica in ZETON.read_text().splitlines():
            if "=" in vrstica and not vrstica.startswith("#"):
                ime, vrednost = vrstica.split("=", 1)
                k[ime.strip()] = vrednost.strip()
    k = {ime: os.environ.get(ime) or k.get(ime) for ime in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")}
    return k if all(k.values()) else None


# ---------------------------------------------------------------- S3 API (SigV4, multipart)

class S3:
    """Minimalni odjemalec S3 API-ja R2: podpis AWS SigV4, nalaganje v kosih."""

    def __init__(self, k):
        self.gostitelj = f"{k['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
        self.kljuc, self.skrivnost = k["R2_ACCESS_KEY_ID"], k["R2_SECRET_ACCESS_KEY"]

    def _podpis(self, metoda, pot, poizvedba, telo_sha, cas):
        datum = cas[:8]
        glave = {"host": self.gostitelj, "x-amz-content-sha256": telo_sha, "x-amz-date": cas}
        podpisane = ";".join(sorted(glave))
        kanonicno = "\n".join([metoda, pot, poizvedba, "".join(f"{i}:{glave[i]}\n" for i in sorted(glave)), podpisane, telo_sha])
        obseg = f"{datum}/auto/s3/aws4_request"
        niz = "\n".join(["AWS4-HMAC-SHA256", cas, obseg, hashlib.sha256(kanonicno.encode()).hexdigest()])
        k = hmac.new(("AWS4" + self.skrivnost).encode(), datum.encode(), hashlib.sha256).digest()
        for del_ in ("auto", "s3", "aws4_request"):
            k = hmac.new(k, del_.encode(), hashlib.sha256).digest()
        podpis = hmac.new(k, niz.encode(), hashlib.sha256).hexdigest()
        glave["Authorization"] = f"AWS4-HMAC-SHA256 Credential={self.kljuc}/{obseg}, SignedHeaders={podpisane}, Signature={podpis}"
        return glave

    def zahteva(self, metoda, ime, poizvedba="", telo=b"", vrsta=None):
        pot = f"/{VEDRO}/{quote(ime, safe='')}"
        telo_sha = hashlib.sha256(telo).hexdigest()
        cas = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        glave = self._podpis(metoda, pot, poizvedba, telo_sha, cas)
        glave.pop("host")
        if vrsta:
            glave["Content-Type"] = vrsta
        url = f"https://{self.gostitelj}{pot}" + (f"?{poizvedba}" if poizvedba else "")
        zahteva = urllib.request.Request(url, data=telo if telo else None, method=metoda, headers=glave)
        try:
            with urllib.request.urlopen(zahteva, timeout=600) as odg:
                return odg.status, odg.headers, odg.read()
        except urllib.error.HTTPError as e:
            raise SystemExit(f"R2 {metoda} {ime}: {e.code} {e.read().decode(errors='replace')[:300]}")

    def nalozi(self, ime, pot):
        velikost = pot.stat().st_size
        _, _, telo = self.zahteva("POST", ime, "uploads=", vrsta="video/mp4")
        upload_id = telo.decode().split("<UploadId>")[1].split("</UploadId>")[0]
        oznake = []
        with open(pot, "rb") as f:
            st = 1
            while True:
                kos = f.read(KOS)
                if not kos:
                    break
                _, glave, _ = self.zahteva("PUT", ime, f"partNumber={st}&uploadId={quote(upload_id, safe='')}", kos)
                oznake.append((st, glave["ETag"]))
                print(f"  {min(st * KOS, velikost) / 1e6:.0f} / {velikost / 1e6:.0f} MB", flush=True)
                st += 1
        xml = "<CompleteMultipartUpload>" + "".join(f"<Part><PartNumber>{n}</PartNumber><ETag>{e}</ETag></Part>" for n, e in oznake) + "</CompleteMultipartUpload>"
        self.zahteva("POST", ime, f"uploadId={quote(upload_id, safe='')}", xml.encode(), vrsta="application/xml")


def nalozi_wrangler(ime, pot, lokalno):
    ukaz = ["npx", "wrangler", "r2", "object", "put", f"{VEDRO}/{ime}", "--file", str(pot),
            "--content-type", "video/mp4", "--local" if lokalno else "--remote"]
    r = subprocess.run(ukaz, cwd=REPO)
    if r.returncode:
        raise SystemExit(f"nalaganje {ime} ni uspelo (koda {r.returncode})")


def main():
    argv = sys.argv[1:]
    lokalno = "--local" in argv
    samo = argv[argv.index("--samo") + 1] if "--samo" in argv else None
    manifest = nalozi_manifest()
    kljuc_manifesta = "lokalno" if lokalno else "oddaljeno"
    nalozeno = manifest.setdefault(kljuc_manifesta, {})
    naloga, manjka = [], []
    for v in placljivi_vlogi():
        o = v["oznaka"]
        if samo and o != samo:
            continue
        for r in RAZLICICE:
            ime = f"{o}-{r}.mp4"
            pot = MEDIA / ime
            if not pot.is_file():
                manjka.append(ime)
                continue
            velikost = pot.stat().st_size
            if nalozeno.get(ime, {}).get("velikost") == velikost:
                continue
            naloga.append((ime, pot, velikost))
    if "--seznam" in argv:
        print(f"naloženo ({kljuc_manifesta}): {len(nalozeno)} datotek")
        for ime in sorted(nalozeno):
            print(f"  {ime}  {nalozeno[ime]['velikost'] / 1e6:.0f} MB  {nalozeno[ime]['nalozeno_at'][:10]}")
        print(f"za naložiti: {len(naloga)}")
        for ime, _, velikost in naloga:
            print(f"  {ime}  {velikost / 1e6:.0f} MB")
        if manjka:
            print("ni spletne različice v stran/media/vlogi (vlogi/zberi.py --video):", ", ".join(manjka))
        return
    s3 = None if lokalno else (S3(zeton_r2()) if zeton_r2() else None)
    if not naloga:
        print("vse je že naloženo")
    for ime, pot, velikost in naloga:
        print(f"nalagam {ime} ({velikost / 1e6:.0f} MB) …", flush=True)
        if s3:
            s3.nalozi(ime, pot)
        elif velikost > MEJA_WRANGLER and not lokalno:
            raise SystemExit(f"{ime} je večja od 300 MB: wrangler je ne more naložiti. Naredi žeton R2 (glej vrh datoteke) in zaženi znova.")
        else:
            nalozi_wrangler(ime, pot, lokalno)
        nalozeno[ime] = {"velikost": velikost, "nalozeno_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        shrani_manifest(manifest)
    if manjka:
        print("ni spletne različice v stran/media/vlogi (vlogi/zberi.py --video):", ", ".join(manjka))


if __name__ == "__main__":
    main()
