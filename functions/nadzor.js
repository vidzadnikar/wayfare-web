// Stran /nadzor: le za prijavljenega člana z e-naslovom ADMIN_EMAIL. Brez
// seje preusmeri domov s pozivom k prijavi; prijavljen tujec dobi 404, da
// stran ne izdaja, da obstaja. Vsebino nariše /js/nadzor.js iz /api/nadzor/clani.
import { preusmeri, pobegni } from "../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../zaledje/seja.js";
import { obravnavaj, stranHtml, stranNapake } from "../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const clan = await clanIzSeje(env, request);
  if (!clan) return preusmeri("/sl/?prijava=nadzor");
  if (!jeAdmin(env, clan)) return stranNapake("sl", "ni", 404);
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
  <a class="znamka" href="/sl/"><img src="/media/logo.svg" alt="" width="26" height="26"><span><b>wayfare</b> studio</span></a>
  <span class="nadzor-kdo drobno">${pobegni(clan.email)}</span>
</header>
<main id="vsebina" class="nadzor" data-nadzor>
  <section class="nadzor-glava">
    <h1 class="serif">Nadzor <em>članov.</em></h1>
    <p class="uvodnik" data-povzetek>Nalagam …</p>
    <div class="nadzor-akcije">
      <button class="gumb gumb-majhen gumb-tihi" type="button" data-vrsta-poslji hidden>Pošlji, kar čaka</button>
      <a class="gumb gumb-majhen gumb-tihi" href="/api/nadzor/izvoz">Izvozi CSV</a>
      <button class="gumb gumb-majhen gumb-tihi" type="button" data-osvezi>Osveži</button>
    </div>
    <p class="nadzor-sporocilo" role="status" aria-live="polite" data-sporocilo hidden></p>
  </section>

  <section class="nadzor-odsek" aria-labelledby="clani-naslov">
    <h2 id="clani-naslov" class="serif">Člani</h2>
    <div class="tabela-ovoj">
      <table class="tabela" data-clani>
        <thead><tr><th>Ime</th><th>E-naslov</th><th>Vir</th><th>Jezik</th><th>Prijavljen</th><th>Zadnji obisk</th><th>Obiskov</th><th>Stanje</th><th></th></tr></thead>
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
        <thead><tr><th>Ključ</th><th>Vrsta</th><th>Naslov</th><th>Ustvarjeno</th><th>Prejemnikov</th><th>Čaka</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>
</main>
<script type="module" src="/js/nadzor.js"></script>
</body>
</html>
`);
}, { html: true });
