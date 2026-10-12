# Objava spletne strani

Stran gostuje na Cloudflare Pages, https://wayfarestudio.pages.dev (zastonj,
brez omejitve prometa). Objavi se
mapa `objava`, ki jo naredi `stran/zgradi.py`. Vlogi igrajo z YouTuba, paket
za prenos je na GitHub Releases: oboje je za Pages preveliko (meja je 25 MB na
datoteko), `zgradi.py` zato teh datotek v objavo ne da in prevelike datoteke
odkloni.

## Prvič

1. Na GitHubu ustvari javni repozitorij `vidzadnikar/wayfare-web`. Javen mora
   biti zato, da so priloge izdaj (paket za prenos) prosto dostopne. Ime je
   zapisano v `PRENOS_URL` v `stran/zgradi.py`.

2. V tej mapi:

       git add -A
       git commit -m "Spletna stran Wayfare Studio"
       git remote add origin https://github.com/vidzadnikar/wayfare-web.git
       git push -u origin main

3. Cloudflare (narejeno 12. 10. 2026): projekt Pages `wayfarestudio`,
   povezan z GitHub repozitorijem `wayfare-web`, veja `main`. Framework
   preset: None. Build command: prazno. Build output directory: `objava`.
   Stran je na https://wayfarestudio.pages.dev; lastna domena se doda v
   nadzorni plošči pod Custom domains (Workers & Pages → wayfarestudio).

4. Paket: GitHub → Releases → Draft a new release → oznaka `v0.1.0`, priloži
   `stran/prenos/Wayfare-Studio-0.1.0.dmg`, Publish. Gumb Prenos na strani
   kaže na ta naslov (različica pride iz imena paketa v `stran/prenos/`).

5. Vlogi: vsak film naloži na YouTube (izvorni izvoz iz `~/Video`, vidnost
   Neobjavljeno ali Javno, vdelava dovoljena). Oznako videa (del naslova za
   `v=`) vpiši v `vlogi/zberi.py` pri vlogu kot `youtube="..."` in zaženi
   `python3 vlogi/zberi.py --slike`, ali pa jo vpiši neposredno v
   `stran/vlogi.json`. Dokler vlog oznake nima, predvajalnik na objavljeni
   strani pove, da film še ni na spletu.

## Vsakič

    cd stran && python3 zgradi.py
    git add -A && git commit -m "..." && git push

Cloudflare po vsakem pushu objavi novo različico v minuti.

Nova različica paketa: `python3 paket/zgradi_paket.py`, nova izdaja z oznako
`v<različica>` na GitHubu, `python3 stran/zgradi.py`, push.

## Predogled objave doma

    python3 streznik.py 8496 objava

Mapa `objava` je koren strani, kot na Cloudflaru (absolutne poti strani 404
delajo le tako). `python3 streznik.py` brez mape še vedno postreže vse,
stran je na `/stran/`.
