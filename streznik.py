"""Strežnik za predogled spletne strani.

    python3 streznik.py [vrata]          (privzeto 8495; stran je na /stran/)
    python3 streznik.py 8495 objava      (mapa objava kot koren, kot na Cloudflare Pages)

Kot http.server, a z dvema razlikama, ki ju predogled potrebuje:
- brez predpomnjenja, da brskalnik po vsaki spremembi naloži zadnjo različico;
- z zahtevami Range (206), da iskanje po videu dela tudi doma. Brez tega je
  brskalnik ob vsakem skoku (poglavje, drsnik) datoteko naložil od začetka in
  je skok obstal pri 0 — pravi strežniki (Netlify, Cloudflare, nginx) Range
  znajo, zato se napaka na objavljeni strani ne bi videla.
"""
import functools
import http.server
import os
import re
import sys

RANGE = re.compile(r"bytes=(\d*)-(\d*)")


class Streznik(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        """Kot v SimpleHTTPRequestHandler; z glavo Range vrne le zahtevani del."""
        pot = self.translate_path(self.path)
        glava = self.headers.get("Range")
        ujemanje = RANGE.match(glava.strip()) if glava else None
        if not ujemanje or os.path.isdir(pot) or not os.path.isfile(pot):
            return super().send_head()
        velikost = os.path.getsize(pot)
        prvi, zadnji = ujemanje.group(1), ujemanje.group(2)
        if prvi:
            zacetek = int(prvi)
            konec = int(zadnji) if zadnji else velikost - 1
        elif zadnji:                               # zadnjih N bajtov
            zacetek, konec = max(0, velikost - int(zadnji)), velikost - 1
        else:
            return super().send_head()
        if zacetek >= velikost:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{velikost}")
            self.end_headers()
            return None
        konec = min(konec, velikost - 1)
        datoteka = open(pot, "rb")
        datoteka.seek(zacetek)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(pot))
        self.send_header("Content-Range", f"bytes {zacetek}-{konec}/{velikost}")
        self.send_header("Content-Length", str(konec - zacetek + 1))
        self.send_header("Last-Modified", self.date_time_string(os.fstat(datoteka.fileno()).st_mtime))
        self.end_headers()
        self._obseg = konec - zacetek + 1
        return datoteka

    def copyfile(self, vir, izhod):
        obseg = getattr(self, "_obseg", None)
        if obseg is None:
            return super().copyfile(vir, izhod)
        self._obseg = None
        while obseg > 0:
            kos = vir.read(min(65536, obseg))
            if not kos:
                break
            izhod.write(kos)
            obseg -= len(kos)

    def handle(self):
        # brskalnik prekine zahtevo Range ob vsakem skoku po videu; to ni napaka
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass


vrata = int(sys.argv[1]) if len(sys.argv) > 1 else 8495
koren = os.path.join(os.path.dirname(os.path.abspath(__file__)), *sys.argv[2:3])
http.server.ThreadingHTTPServer(("127.0.0.1", vrata), functools.partial(Streznik, directory=koren)).serve_forever()
