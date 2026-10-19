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

Namestitev na Macu z enim ukazom (`curl -fsSL https://wayfarestudio.pages.dev/install.sh | bash`):
`zgradi.py` iz `stran/install.sh` naredi `objava/install.sh` z različico,
naslovom in kontrolno vsoto SHA-256 paketa iz `stran/prenos/` (vsota je tudi
v `prenos.json`, da gradnja brez paketa, npr. v GitHub Actions, ostane
pravilna). Skripta prenese paket z izdaje, preveri vsoto in aplikacijo
skopira v Applications. Paket, prenesen s curl, ni označen kot prenesen iz
brskalnika, zato ga macOS ob zagonu ne ustavi; Apple ga s tem ne preveri.
Zato mora biti `stran/prenos/` ob gradnji isti paket kot v izdaji.

Enako za Windows (`irm https://wayfarestudio.pages.dev/install.ps1 | iex`,
PowerShell 5.1): `stran/install.ps1` dobi naslov in vsoto namestitvenega
programa (`sha256_windows` v `prenos.json`). Skripta ga prenese, preveri in
zažene tiho za trenutnega uporabnika (`/SILENT /CURRENTUSER`), nato odpre
Wayfare. Datoteka, ki jo prenese PowerShell, nima oznake Zone.Identifier,
zato je SmartScreen ne ustavi. Nikoli ne kliče `exit` (z `iex` bi zaprl okno
PowerShella). Preizkušeno 19. 10. 2026 na Windows Server v GitHub Actions:
namestitev, zagon (studio odgovori na 8420), brez Zone.Identifier, zavrnitev
napačne vsote.

## Predogled objave doma

    python3 streznik.py 8496 objava

Mapa `objava` je koren strani, kot na Cloudflaru (absolutne poti strani 404
delajo le tako). `python3 streznik.py` brez mape še vedno postreže vse,
stran je na `/stran/`.

## Prijava članov in obvestila

Obiskovalci se lahko prijavijo (z Googlom ali z e-naslovom in povezavo za
potrditev) in dobijo e-pošto ob novem vlogu ali novi izdaji aplikacije.
Zaledje so Pages Functions v mapi `functions/` (skupni moduli v `zaledje/`),
člani so v bazi Cloudflare D1, pošto pošilja Brevo (brezplačno do 300 pošt na
dan), nadzor je na `/nadzor` (vidi ga le prijavljeni član z e-naslovom
`ADMIN_EMAIL`, ne glede na to, ali je prišel prek Googla ali e-pošte). Vse je
zastonj in brez lastne domene: Brevo brez potrjene domene pošiljatelja prepiše
v `<lokalni-del>@<id>.brevosend.com`, ime pošiljatelja (»Wayfare Studio«) in
naslov za odgovor pa ostaneta tvoja.

### Prvič (koraki)

1. **Brevo** (brevo.com): brezplačen račun. Senders, Domains & Dedicated IPs →
   Senders → Add a sender: ime »Wayfare Studio«, e-naslov tvoj Gmail (isti kot
   `EMAIL_FROM` in `ADMIN_EMAIL`); potrditvena koda pride na ta naslov. Nato
   SMTP & API → API Keys → Generate a new API key in:

       npx wrangler pages secret put BREVO_API_KEY --project-name wayfarestudio

2. **Google Cloud** (console.cloud.google.com), za prijavo z Googlom:
   - nov projekt (npr. »Wayfare Studio«);
   - APIs & Services → OAuth consent screen (Google Auth Platform): User type
     External; ime aplikacije, podporni e-naslov, e-naslov razvijalca; obsegi
     le `openid`, `email` in `profile`; nato Publish app (pregled ni potreben,
     ker obsegi niso občutljivi; v stanju Testing bi se lahko prijavilo le do
     100 vnaprej vpisanih računov);
   - Credentials → Create credentials → OAuth client ID → Web application;
     Authorized redirect URIs: `https://wayfarestudio.pages.dev/api/google/povratek`;
   - Client ID in Client secret:

         npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name wayfarestudio
         npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name wayfarestudio

3. **Baza D1** `wayfare-clani` je ustvarjena 14. 10. 2026 (id je v
   `wrangler.toml`; nova baza: `npx wrangler d1 create wayfare-clani` in nov id
   v `wrangler.toml`). Tabele naredi migracija:

       npx wrangler d1 migrations apply wayfare-clani --remote

   Migracija vloge, ki so na strani že zdaj, označi kot poslane, da ob prvem
   samodejnem obvestilu ne gredo ven za nazaj.

4. **Skrivnosti in spremenljivke v Pages** (`npx wrangler pages secret put IME
   --project-name wayfarestudio` ali Workers & Pages → wayfarestudio →
   Settings → Variables and Secrets, okolje Production):
   - `SESSION_SECRET`: dolg naključen niz (`openssl rand -base64 48`);
   - `OBVESTI_SECRET`: drug naključen niz (isti je v GitHub secrets);
   - `ADMIN_EMAIL`: tvoj Googlov e-naslov (kdo vidi `/nadzor`); ne piši ga v
     repozitorij, ker je javen;
   - `EMAIL_FROM`: pošiljatelj, potrjen pri Brevu (tvoj Gmail; lahko tudi
     `Wayfare Studio <naslov>`);
   - `POSTA_PONUDNIK`: `brevo` (privzeto; `resend` ko bo lastna domena,
     `dnevnik` le doma);
   - `POSTA_DNEVNO`: `300` (največ pošt na dan; kar je čez, čaka v vrsti);
   - `BREVO_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (koraka 1 in 2).

   Stanje 14. 10. 2026: nastavljeni so SESSION_SECRET, OBVESTI_SECRET,
   ADMIN_EMAIL, EMAIL_FROM, POSTA_PONUDNIK in POSTA_DNEVNO; manjkajo
   BREVO_API_KEY, GOOGLE_CLIENT_ID in GOOGLE_CLIENT_SECRET. Brez Googlovih
   ključev prijava z Googlom vrne napako, prijava z e-pošto dela; brez ključa
   Brevo pošta ne gre ven (zaledje vrne napako, vrsta čaka).

5. **GitHub.** `OBVESTI_SECRET` je v skrivnostih repozitorija (14. 10. 2026;
   sicer `gh secret set OBVESTI_SECRET --repo vidzadnikar/wayfare-web`). Ko bo
   stran kdaj na lastni domeni: `gh variable set STRAN_URL --body
   https://tvoja-domena --repo vidzadnikar/wayfare-web` in isto kot `STRAN_URL`
   v Pages.

6. **Web Analytics** (neobvezno, obiski vseh, brez piškotkov): Workers &
   Pages → wayfarestudio → Metrics → Enable Web Analytics. Cloudflare v stran
   vstavi svoj skript, zato v `stran/zgradi.py` v `csp()` dodaj
   `https://static.cloudflareinsights.com` k `script-src` in
   `https://cloudflareinsights.com` k `connect-src`, sicer ga CSP ustavi.
   Če analitike ne vklopiš, v `stran/besedila.json` pri `zasebnost_6_besedilo`
   (SL in EN) umakni stavek o Web Analytics.

7. Združi vejo `prijava` v `main` in push: Cloudflare objavi stran in zaledje.
   Po objavi preveri: prijava z Googlom s pravim računom, `/nadzor` s svojim
   računom, v nadzoru »Pošlji sebi« (preizkus pošte prek Breva), povezava za
   odjavo na dnu te pošte. Če pošta pristane med nezaželeno, v Gmailu označi
   »Ni nezaželeno« (brez lastne domene je to pričakovano).

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
- **Dnevna meja:** zaledje pošlje največ `POSTA_DNEVNO` − 10 obvestil na dan
  (10 ostane za potrditvene povezave), ostalo čaka v vrsti. Action jo vsak dan
  ob 8:00 UTC izprazni, v nadzoru je tudi gumb »Pošlji, kar čaka«. Pri več kot
  približno 290 članih obvestilo traja več dni.
- **Odjava:** povezava na dnu vsake pošte. Brevo glave `List-Unsubscribe` ne
  sprejme, zato je pri Brevu odjava le povezava v besedilu; pri Resendu gre
  zraven tudi glava za odjavo z enim klikom. Blokiraj ali izbriši člana v
  nadzoru; blokiran se ne more prijaviti in ne dobi pošte.
- **Jezik:** vsaka pošta v jeziku, ki ga je član izbral ob prijavi.
- **Obiski:** prijavljenim se zapiše zadnji obisk in število obiskov (največ
  enkrat na uro); vidno v nadzoru.
- **Seja:** podpisan piškotek `wayfare_seja` (eno leto, HttpOnly). Odjavni
  žeton je podpis, ne zapis v bazi, zato stare povezave veljajo vedno; z
  menjavo `SESSION_SECRET` nehajo veljati vse seje in odjavne povezave.
- **CSP:** `form-action 'self'` (obrazca gresta na lastno zaledje) in
  `img-src` z `lh3.googleusercontent.com` (slika profila). Drugih zunanjih
  skriptov ni; prijava z Googlom teče prek preusmeritev.
- **Kasneje z lastno domeno:** domeno dodaj strani (Custom domains), Googlu
  dodaj redirect URI z domeno, pri Brevu potrdi domeno (pošiljatelj ni več
  prepisan) ali preklopi na Resend (`POSTA_PONUDNIK=resend`, `RESEND_API_KEY`,
  `EMAIL_FROM` na domeni, `POSTA_DNEVNO=100`).

### Doma

    cp .dev.vars.primer .dev.vars            # vpiši vrednosti; POSTA_PONUDNIK=dnevnik pošto le izpiše
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
- `zaledje/`: skupni moduli (`osnova`, `seja`, `clani`, `posta` s ponudniki
  Brevo, Resend in dnevnik, `strani`) in `obvesti.py` za Action.
- `migrations/0001_clani.sql`: tabele clani, zetoni, omejitve, poslano,
  vrsta, posta. `wrangler.toml`: D1 binding.
- `stran/deli/prijava.html` in `stran/js/clan.js`: okno za prijavo in stanje
  v glavi; `stran/predloga-zasebnost.html`: stran o zasebnosti
  (`/zasebnost/`, `/sl/zasebnost/`), besedila v `besedila.json` (`zasebnost_*`).

## Nadzor: nastavitve, vlogi z YouTuba, ogledi (od 15. 10. 2026)

Na `/nadzor` (le za ADMIN_EMAIL) so poleg članov in novice še:

- **Pregled:** aktivni člani, nalaganja strani danes, ogledi vlogov, pošta
  danes in graf nalaganj zadnjih 14 dni (gostje sivo, člani turkizno).
- **Čaka tebe:** zadržana obvestila (Pošlji ali Zavrzi) in vlogi z YouTuba,
  ki jih ni bilo mogoče dodati (Poskusi znova).
- **Nov vlog z YouTuba:** prilepiš povezavo, naslov in kraj se izpolnita iz
  naslova na YouTubu ("Rome day 1" → "Rim — 1. dan", "Rim, Italija").
  Dodaj ga da v vrsto. GitHub Action `.github/workflows/youtube.yml` vsakih
  10 minut vpraša `/api/samodejno`, ali kaj čaka; če da, `vlogi/samodejno.py`
  prenese naslovnico in dolžino z YouTuba, doda vlog v `stran/vlogi.json`
  (z `"samodejno": true`), zgradi stran, naredi commit in push ter pošlje
  obvestilo (`zaledje/obvesti.py`). Javne videe s kanala z naslovom vloga
  ("… day 3", "… recap") stran najde sama (nastavitev »Javni videi s kanala«);
  neobjavljenih YouTube ne pokaže v viru, zato jih vneseš z obrazcem.
- **Ogledi vlogov:** kdo (član po imenu) ali koliko gostov je začel
  predvajati film na strani.
- **Nastavitve:** samodejna obvestila o vlogih in izdajah (izklopljeno →
  obvestilo počaka v »Čaka tebe«), javni videi s kanala, odprte prijave,
  pošta tebi ob novem članu, dnevna meja pošte, stavek v obvestilu o vlogu.

Člani imajo v meniju z imenom **Nastavitve**: jezik pošte, katera obvestila
hočejo (vlogi, aplikacija, novice), izklop vseh obvestil in izbris računa.

**Pomembno doma:** GitHub Action sam dela commite na `main`. Pred vsakim
lokalnim pushem zato najprej `git pull --rebase origin main`.

Vlog, ki ga doda Action, nima predogleda za kazalec (zanke) in ima za datum
dan objave na YouTubu, če ga v nadzoru ne vpišeš. Ko ga kdaj prevzameš v
`VLOGI` v `vlogi/zberi.py` (z izvorom v ~/Video), dobi zanko in točen datum.
`stran/prenos.json` hrani podatke o zadnjem paketu, da Action zgradi stran
brez .dmg.

## Stran ogleda in komentarji (od 16. 10. 2026)

Vsak vlog ima svojo stran `vlogi/<oznaka>/` (in `sl/vlogi/<oznaka>/`), ki jo
zgradi `stran/zgradi.py` iz `predloga-ogled.html`: velik predvajalnik (YouTube
se naloži šele ob kliku), naslov, en stavek s krajem in datumom, Deli in
Odpri na YouTubu, poglavja, komentarji in desno seznam Naprej (naslednji
dnevi istega potovanja, nato druga potovanja). Zavihek Vlogi ima zgoraj
najnovejši film, kartice povsod vodijo na strani ogleda; stare povezave
`vlogi/#oznaka` preusmeri `js/vlogi.js`.

Komentarji (`js/komentarji.js`, zaledje `functions/api/komentarji*`, tabeli
`komentarji` in `komentarji_vsecki`, migracija 0003): bere vsak, piše le
prijavljen član (ob prvem komentarju vpiše ime, če ga nima), odgovori en
nivo globoko, všečki, urejanje in brisanje svojih, admin briše vse (tudi v
nadzoru, razdelek Komentarji). Časi v besedilu (1:23) skočijo v film.
Nastavitvi: »Komentarji odprti« in »Obvesti me ob novem komentarju«.

## Odzivi testerjev (od 18. 10. 2026)

Stran `odziv/` (in `sl/odziv/`, predloga `stran/predloga-odziv.html`, skripta
`js/odziv.js`) ima obrazec: vrsta (napaka, ideja, pohvala), besedilo in
neobvezen e-naslov za odgovor. Povezava je v nogi in v vprašanju 7. Brez
skripte obrazec pošlje strežnik in preusmeri na `#hvala` ali `#napaka`.

Zaledje `functions/api/odziv.js` (pomočniki `zaledje/odzivi.js`, tabela
`odzivi`, migracija 0004) sprejme odziv s strani in iz aplikacije (meni ⋯ →
Pošlji odziv, `wayfare/odziv.py`). Prijava ni potrebna; omejitev je 10 odzivov
na uro z enega naslova IP, polje `spletna_stran` je past za robote. Aplikacija
odpre obrazec s `?iz=app&v=<različica>&os=<sistem>`, kadar je vklopljeno »Brez
spleta«.

V nadzoru je razdelek Odzivi (nerešeni zgoraj, Rešeno, Izbriši, izvoz
`/api/nadzor/izvoz?kaj=odzivi`) in ploščica »nerešenih odzivov«. Nastavitvi:
»Odzivi odprti« in »Obvesti me ob novem odzivu« (pošta adminu z Reply-To na
testerjev e-naslov). Izbris računa odzive obdrži, a jim odstrani člana in
e-naslov.

Ob objavi najprej na oddaljeni bazi uveljavi migracijo (0004, skupaj z 0005
iz varnostnih popravkov), šele nato pushaj:

    npx wrangler d1 migrations apply wayfare-clani --remote
