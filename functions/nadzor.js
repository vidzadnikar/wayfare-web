// Stran /nadzor: le za prijavljenega člana z e-naslovom ADMIN_EMAIL.
// Pregled, čakajoča obvestila, odzivi, vlogi z YouTuba, člani, ogledi, novica,
// obvestila in nastavitve. Brez
// seje preusmeri domov s pozivom k prijavi; prijavljen tujec dobi 404, da
// stran ne izdaja, da obstaja. Vsebino nariše /js/nadzor.js iz /api/nadzor/clani.
import { preusmeri, pobegni } from "../zaledje/osnova.js";
import { clanIzSeje, jeAdmin, svezaSejaAdmina } from "../zaledje/seja.js";
import { obravnavaj, stranHtml, stranNapake } from "../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const clan = await clanIzSeje(env, request);
  if (!clan) return preusmeri("/sl/?prijava=nadzor");
  if (!jeAdmin(env, clan)) return stranNapake("sl", "ni", 404);
  // seja skrbnika, starejša od 14 dni: znova v prijavo
  if (!svezaSejaAdmina(clan)) return preusmeri("/sl/?prijava=nadzor");
  return stranHtml(`<!doctype html>
<html lang="sl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nadzor — Wayfare Studio</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/media/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/pisave.css">
<link rel="stylesheet" href="/css/slog.css">
<link rel="stylesheet" href="/css/zaledje.css">
</head>
<body class="zaledje nadzor-stran">
<div class="svet" aria-hidden="true"><span class="svet-luc svet-luc-1"></span><span class="svet-luc svet-luc-2"></span><span class="svet-luc svet-luc-3"></span></div>
<header class="glava">
  <a class="znamka" href="/sl/"><img src="/media/logo.svg" alt="" width="26" height="26"><span>Wayfare</span></a>
  <span class="nadzor-kdo drobno">${pobegni(clan.email)}</span>
</header>
<main id="vsebina" class="nadzor" data-nadzor>
  <section class="nadzor-glava">
    <h1 class="serif">Nadzor <em>strani.</em></h1>
    <p class="uvodnik" data-povzetek>Nalagam …</p>
    <div class="nadzor-akcije">
      <button class="gumb gumb-majhen gumb-tihi" type="button" data-vrsta-poslji hidden>Pošlji, kar čaka</button>
      <a class="gumb gumb-majhen gumb-tihi" href="/api/nadzor/izvoz">Izvozi CSV</a>
      <button class="gumb gumb-majhen gumb-tihi" type="button" data-osvezi>Osveži</button>
    </div>
    <p class="nadzor-sporocilo" role="status" aria-live="polite" data-sporocilo hidden></p>
  </section>

  <section class="nadzor-odsek" aria-labelledby="pregled-naslov">
    <h2 id="pregled-naslov" class="serif">Pregled</h2>
    <div class="ploscice" data-ploscice></div>
    <div class="graf" data-graf aria-label="Nalaganja strani zadnjih 14 dni"></div>
  </section>

  <section class="nadzor-odsek nadzor-cakajo" aria-labelledby="cakajo-naslov" data-cakajo-odsek hidden>
    <h2 id="cakajo-naslov" class="serif">Čaka <em>tebe</em></h2>
    <div class="tabela-ovoj">
      <table class="tabela" data-cakajo>
        <thead><tr><th>Kaj</th><th>Naslov</th><th>Ustvarjeno</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" id="odzivi" aria-labelledby="odzivi-naslov">
    <h2 id="odzivi-naslov" class="serif">Odzivi</h2>
    <p class="nadzor-opis">Kar testerji pošljejo z obrazca na strani (/odziv/) ali iz aplikacije (meni ⋯ → Pošlji odziv). Nerešeni so zgoraj. Če je kdo pustil e-naslov, mu odgovoriš iz pošte, ki jo dobiš ob odzivu.</p>
    <div class="nadzor-akcije">
      <a class="gumb gumb-majhen gumb-tihi" href="/api/nadzor/izvoz?kaj=odzivi">Izvozi odzive CSV</a>
    </div>
    <div class="tabela-ovoj">
      <table class="tabela" data-odzivi>
        <thead><tr><th>Vrsta</th><th>Odziv</th><th>Od koga</th><th>Od kod</th><th>Kdaj</th><th>Stanje</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="youtube-naslov">
    <h2 id="youtube-naslov" class="serif">Nov vlog z YouTuba</h2>
    <p class="nadzor-opis">Prilepi povezavo do videa. Naslov in kraj se izpolnita sama iz naslova na YouTubu. Ko klikneš Dodaj, je vlog v nekaj minutah na strani in člani dobijo obvestilo.</p>
    <form class="novica" data-youtube>
      <div class="novica-mreza">
        <label class="novica-cela">Povezava YouTube<input name="url" type="url" required placeholder="https://youtu.be/…" autocomplete="off" data-youtube-url></label>
        <label>Naslov (SL)<input name="naslov_sl" required maxlength="120"></label>
        <label>Naslov (EN)<input name="naslov_en" required maxlength="120"></label>
        <label>Kraj (SL)<input name="kraj_sl" required maxlength="80" placeholder="Rim, Italija"></label>
        <label>Kraj (EN)<input name="kraj_en" required maxlength="80" placeholder="Rome, Italy"></label>
        <label>Dan snemanja (neobvezno)<input name="datum" type="date"></label>
        <p class="nadzor-opis novica-namig" data-youtube-namig></p>
      </div>
      <div class="nadzor-akcije">
        <button class="gumb gumb-majhen" type="submit">Dodaj na stran</button>
      </div>
    </form>
    <div class="tabela-ovoj">
      <table class="tabela" data-youtube-seznam>
        <thead><tr><th>Naslov</th><th>Kraj</th><th>Vir</th><th>Stanje</th><th>Vneseno</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="clani-naslov">
    <h2 id="clani-naslov" class="serif">Člani</h2>
    <div class="tabela-ovoj">
      <table class="tabela" data-clani>
        <thead><tr><th>Ime</th><th>E-naslov</th><th>Vir</th><th>Jezik</th><th>Želi</th><th>Prijavljen</th><th>Zadnji obisk</th><th>Obiskov</th><th>Ogledal</th><th>Stanje</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="ogledi-naslov">
    <h2 id="ogledi-naslov" class="serif">Ogledi vlogov</h2>
    <p class="nadzor-opis">Šteje se, ko nekdo na strani začne predvajati film. Prijavljene člane vidiš po imenu, goste le kot število.</p>
    <div class="tabela-ovoj">
      <table class="tabela" data-ogledi>
        <thead><tr><th>Vlog</th><th>Ogledov</th><th>Članov</th><th>Gostov</th><th>Kdo</th><th>Zadnji</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="komentarji-naslov">
    <h2 id="komentarji-naslov" class="serif">Komentarji</h2>
    <div class="tabela-ovoj">
      <table class="tabela" data-komentarji>
        <thead><tr><th>Vlog</th><th>Kdo</th><th>Komentar</th><th>Všečkov</th><th>Kdaj</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="novica-naslov">
    <h2 id="novica-naslov" class="serif">Novica</h2>
    <form class="novica" data-novica>
      <div class="novica-mreza">
        <label>Naslov (SL)<input name="naslov_sl" required maxlength="200"></label>
        <label>Naslov (EN)<input name="naslov_en" required maxlength="200"></label>
        <label>Besedilo (SL)<textarea name="besedilo_sl" rows="6" maxlength="5000" placeholder="Odstavke loči prazna vrstica. Povezave so klikljive."></textarea></label>
        <label>Besedilo (EN)<textarea name="besedilo_en" rows="6" maxlength="5000"></textarea></label>
        <label class="novica-cela">Povezava gumba (neobvezno)<input name="url" type="url" placeholder="https://"></label>
      </div>
      <div class="nadzor-akcije">
        <button class="gumb gumb-majhen gumb-tihi" type="submit" data-komu="sebi">Pošlji sebi (preizkus)</button>
        <button class="gumb gumb-majhen" type="submit" data-komu="vsem">Pošlji vsem</button>
      </div>
    </form>
  </section>

  <section class="nadzor-odsek" aria-labelledby="obvestila-naslov">
    <h2 id="obvestila-naslov" class="serif">Obvestila</h2>
    <div class="tabela-ovoj">
      <table class="tabela" data-obvestila>
        <thead><tr><th>Ključ</th><th>Vrsta</th><th>Naslov</th><th>Ustvarjeno</th><th>Prejemnikov</th><th>Stanje</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>

  <section class="nadzor-odsek" aria-labelledby="nastavitve-naslov">
    <h2 id="nastavitve-naslov" class="serif">Nastavitve</h2>
    <form class="nastavitve" data-nastavitve>
      <div class="nastavitve-seznam" data-nastavitve-seznam></div>
      <div class="nadzor-akcije">
        <button class="gumb gumb-majhen" type="submit">Shrani nastavitve</button>
      </div>
    </form>
  </section>
</main>
<script type="module" src="/js/nadzor.js"></script>
</body>
</html>
`);
}, { html: true });
