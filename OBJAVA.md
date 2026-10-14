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

## Prijava članov in obvestila

Obiskovalci se lahko prijavijo (z Googlom ali z e-naslovom in povezavo za
potrditev) in dobijo e-pošto ob novem vlogu ali novi izdaji aplikacije.
Zaledje so Pages Functions v mapi `functions/` (skupni moduli v `zaledje/`),
člani so v bazi Cloudflare D1, pošto pošilja Resend, nadzor je na `/nadzor`
(vidi ga le prijavljeni član z e-naslovom `ADMIN_EMAIL`). Vse je zastonj do
100 pošt na dan in 3000 na mesec (Resend, brezplačni paket).

### Prvič (koraki, ki jih narediš sam)

1. **Domena.** Resend pošilja tujim prejemnikom le z lastne domene; brez nje
   pošta ne gre ven. Kupi jo (najlažje Cloudflare → Domain Registration, brez
   pribitka) in jo dodaj strani: Workers & Pages → wayfarestudio → Custom
   domains. Proste 14. 10. 2026: wayfare-studio.com, wayfarestudio.app,
   wayfarestudio.net, wayfarestudio.io, wayfarestudio.video.

2. **Resend** (resend.com): račun → Domains → Add domain → vpiši DNS zapise
   (če je domena na Cloudflaru, so v isti plošči) → počakaj na »Verified«.
   API Keys → Create API key (Sending access); ključ gre v Pages (korak 5).
   Pošiljatelj bo npr. `Wayfare Studio <obvestila@tvoja-domena>`.

3. **Google Cloud** (console.cloud.google.com), za prijavo z Googlom:
   - nov projekt (npr. »Wayfare Studio«);
   - APIs & Services → OAuth consent screen (Google Auth Platform): User type
     External; ime aplikacije, podporni e-naslov, e-naslov razvijalca; obsegi
     le `openid`, `email` in `profile`; nato Publish app (pregled ni potreben,
     ker obsegi niso občutljivi; v stanju Testing bi se lahko prijavilo le do
     100 vnaprej vpisanih računov);
   - Credentials → Create credentials → OAuth client ID → Web application;
     Authorized redirect URIs: `https://wayfarestudio.pages.dev/api/google/povratek`
     in isto z lastno domeno (`https://tvoja-domena/api/google/povratek`);
   - Client ID in Client secret gresta v Pages (korak 5).

4. **Baza D1.** Enkrat, v tej mapi:

       npx wrangler login
       npx wrangler d1 create wayfare-clani

   Izpisani `database_id` vpiši v `wrangler.toml` namesto
   `VPISI-PO-UKAZU-D1-CREATE`. Nato naredi tabele:

       npx wrangler d1 migrations apply wayfare-clani --remote

   Migracija vloge, ki so na strani že zdaj, označi kot poslane, da ob prvem
   samodejnem obvestilu ne gredo ven za nazaj.

5. **Skrivnosti v Pages.** Workers & Pages → wayfarestudio → Settings →
   Variables and Secrets → Add, vrsta Secret, okolje Production:
   - `SESSION_SECRET`: dolg naključen niz (`openssl rand -base64 48`);
   - `OBVESTI_SECRET`: drug naključen niz (isti gre v GitHub, korak 6);
   - `ADMIN_EMAIL`: tvoj Googlov e-naslov (kdo vidi `/nadzor`);
   - `EMAIL_FROM`: `Wayfare Studio <obvestila@tvoja-domena>`;
   - `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

   `DNEVNA_MEJA` (100) je v `wrangler.toml`. `EMAIL_NACIN` na Cloudflaru ne
   nastavljaj: `dnevnik` je le za doma in pošto samo izpiše.

6. **GitHub.** Skrivnost za samodejna obvestila (ista vrednost kot v Pages):

       gh secret set OBVESTI_SECRET --repo vidzadnikar/wayfare-web

   Ko bo stran na lastni domeni, še naslov strani za povezave v pošti:
   `gh variable set STRAN_URL --body https://tvoja-domena --repo vidzadnikar/wayfare-web`
   (in isto kot spremenljivko `STRAN_URL` v Pages).

7. **Web Analytics** (neobvezno, obiski vseh, brez piškotkov): Workers &
   Pages → wayfarestudio → Metrics → Enable Web Analytics. Cloudflare v stran
   vstavi svoj skript, zato v `stran/zgradi.py` v `csp()` dodaj
   `https://static.cloudflareinsights.com` k `script-src` in
   `https://cloudflareinsights.com` k `connect-src`, sicer ga CSP ustavi.
   Če analitike ne vklopiš, v `stran/besedila.json` pri `zasebnost_6_besedilo`
   (SL in EN) umakni stavek o Web Analytics.

8. Združi vejo `prijava` v `main` in push: Cloudflare objavi stran in zaledje.
   Po objavi preveri: prijava z Googlom s pravim računom, `/nadzor` s svojim
   računom, v nadzoru »Pošlji sebi« (preizkus pošte prek Resend), povezava za
   odjavo na dnu te pošte.

### Kako deluje

- **Nov vlog:** kot doslej (`vlogi/zberi.py`, `stran/zgradi.py`, push). GitHub
  Action »Obvesti člane« (`.github/workflows/obvesti.yml`) ob spremembi
  `stran/vlogi.json` ugotovi, kateri vlogi so na novo dobili oznako youtube,
  počaka (do 5 minut), da je film na objavljeni strani, in pokliče
  `/api/obvesti`. Vsak vlog gre ven največ enkrat, tudi če Action teče
  večkrat.
- **Nova izdaja:** ob »Publish release« na GitHubu isti Action pošlje
  obvestilo z opombami izdaje (osnutki in predizdaje ne).
- **Novica po meri:** `/nadzor` → Novica (SL in EN) → najprej »Pošlji sebi«,
  nato »Pošlji vsem«.
- **Dnevna meja:** zaledje pošlje največ `DNEVNA_MEJA` − 10 obvestil na dan
  (10 ostane za potrditvene povezave), ostalo čaka v vrsti. Action jo vsak dan
  ob 8:00 UTC izprazni, v nadzoru je tudi gumb »Pošlji, kar čaka«. Pri več kot
  približno 90 članih obvestilo traja več dni; takrat Resend Pro (20 $/mesec)
  ali večja meja pri drugem ponudniku.
- **Odjava:** povezava na dnu vsake pošte (dela tudi odjava z enim klikom v
  Gmailu). Blokiraj ali izbriši člana v nadzoru; blokiran se ne more
  prijaviti in ne dobi pošte.
- **Jezik:** vsaka pošta v jeziku, ki ga je član izbral ob prijavi.
- **Obiski:** prijavljenim se zapiše zadnji obisk in število obiskov (največ
  enkrat na uro); vidno v nadzoru.
- **Seja:** podpisan piškotek `wayfare_seja` (eno leto, HttpOnly). Odjavni
  žeton je podpis, ne zapis v bazi, zato stare povezave veljajo vedno; z
  menjavo `SESSION_SECRET` nehajo veljati vse seje in odjavne povezave.
- **CSP:** `form-action 'self'` (obrazca gresta na lastno zaledje) in
  `img-src` z `lh3.googleusercontent.com` (slika profila). Drugih zunanjih
  skriptov ni; prijava z Googlom teče prek preusmeritev.

### Doma

    cp .dev.vars.primer .dev.vars            # vpiši vrednosti; EMAIL_NACIN=dnevnik pošto le izpiše
    npx wrangler d1 migrations apply wayfare-clani --local
    cd stran && python3 zgradi.py && cd ..
    npx wrangler pages dev objava --port 8788

Stran je na http://localhost:8788; potrditvene povezave so v izpisu
strežnika (`[pošta potrditev]`). Za pravo prijavo z Googlom doma dodaj v
Google Cloud še redirect URI `http://localhost:8788/api/google/povratek`.
Ročni klic obvestila: `OBVESTI_SECRET=… STRAN_URL=http://localhost:8788 python3 zaledje/obvesti.py vrsta`.

### Datoteke

- `functions/api/*.js`: `google`, `google/povratek`, `prijava`, `potrdi`,
  `jaz`, `izpis`, `odjava`, `obvesti`, `nadzor/clani`, `nadzor/clan`,
  `nadzor/izvoz`, `nadzor/novica`, `nadzor/vrsta`;
  `functions/nadzor.js` je stran nadzora, polni jo `stran/js/nadzor.js`.
- `zaledje/`: skupni moduli (`osnova`, `seja`, `clani`, `posta`, `strani`)
  in `obvesti.py` za Action.
- `migrations/0001_clani.sql`: tabele clani, zetoni, omejitve, poslano,
  vrsta, posta. `wrangler.toml`: D1 binding in dnevna meja.
- `stran/deli/prijava.html` in `stran/js/clan.js`: okno za prijavo in stanje
  v glavi; `stran/predloga-zasebnost.html`: stran o zasebnosti
  (`/zasebnost/`, `/sl/zasebnost/`), besedila v `besedila.json` (`zasebnost_*`).
