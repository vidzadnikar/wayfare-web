// Strani, ki jih vrne zaledje samo (potrditev, odjava, napake, nadzor): isti
// videz kot stran 404 (slog.css, zaledje.css), brez skriptov razen nadzora.
// Ovoj obravnavaj() pričakovane napake (Napaka) vrne kot JSON ali stran.
import { Napaka, json, pobegni, jezikIz } from "./osnova.js";

export const CSP = "default-src 'none'; img-src 'self' data: https://lh3.googleusercontent.com; style-src 'self'; font-src 'self'; "
  + "script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export const B = {
  sl: {
    naslov_strani: "Wayfare Studio",
    domov: "Nazaj na stran",
    neveljavna_naslov: "Povezava <em>ne velja.</em>",
    neveljavna_besedilo: "Povezava je napačna, že porabljena ali je potekla. Prijavi se znova in dobiš novo.",
    blokiran_naslov: "Dostop <em>ni mogoč.</em>",
    blokiran_besedilo: "Ta račun ne more prejemati obvestil.",
    odjava_naslov: "Odjava <em>od obvestil.</em>",
    odjava_besedilo: (email) => `Nič več pošte na ${pobegni(email)}?`,
    odjava_gumb: "Odjavi me",
    potrdi_naslov: "Prijava <em>v Wayfare.</em>",
    potrdi_besedilo: (email) => `Prijavljaš se kot ${pobegni(email)}. <span class="samo-miska">Klikni</span><span class="samo-dotik">Tapni</span> gumb in prijava je končana.`,
    potrdi_gumb: "Prijavi me",
    odjavljen_naslov: "<em>Odjavljen.</em>",
    odjavljen_besedilo: "Obvestil ne pošiljamo več. Če si premisliš, se na strani znova prijavi.",
    ze_odjavljen_naslov: "Že <em>odjavljen.</em>",
    ze_odjavljen_besedilo: "Na ta naslov obvestil ne pošiljamo.",
    napaka_naslov: "Nekaj je šlo <em>narobe.</em>",
    napaka_besedilo: "Poskusi znova čez nekaj minut.",
    ni_naslov: "Zunaj <em>zemljevida.</em>",
    ni_besedilo: "Te strani ni.",
  },
  en: {
    naslov_strani: "Wayfare Studio",
    domov: "Back to the site",
    neveljavna_naslov: "This link <em>isn't valid.</em>",
    neveljavna_besedilo: "The link is wrong, already used or expired. Sign in again to get a new one.",
    blokiran_naslov: "<em>No access.</em>",
    blokiran_besedilo: "This account can't receive updates.",
    odjava_naslov: "<em>Unsubscribe.</em>",
    odjava_besedilo: (email) => `No more email to ${pobegni(email)}?`,
    odjava_gumb: "Unsubscribe me",
    potrdi_naslov: "Sign in <em>to Wayfare.</em>",
    potrdi_besedilo: (email) => `You're signing in as ${pobegni(email)}. <span class="samo-miska">Click</span><span class="samo-dotik">Tap</span> the button to finish.`,
    potrdi_gumb: "Sign me in",
    odjavljen_naslov: "<em>Unsubscribed.</em>",
    odjavljen_besedilo: "We won't email you again. If you change your mind, sign in on the site again.",
    ze_odjavljen_naslov: "Already <em>unsubscribed.</em>",
    ze_odjavljen_besedilo: "We're not sending updates to this address.",
    napaka_naslov: "Something went <em>wrong.</em>",
    napaka_besedilo: "Please try again in a few minutes.",
    ni_naslov: "Off the <em>map.</em>",
    ni_besedilo: "There's no such page.",
  },
};

export function stranHtml(html, status = 200, glave = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP, "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
      ...glave,
    },
  });
}

export const gumbDomov = (jezik) => `<a class="gumb gumb-velik" href="${jezik === "sl" ? "/sl/" : "/"}">${B[jezik].domov}</a>`;

// Sporočilna stran: naslov in besedilo sta zaupanja vredna HTML (besedila
// zgoraj); podatke članov pobegne klicatelj.
export function stran({ jezik = "en", naslov, besedilo = "", telo = "", naslovStrani, status = 200 }) {
  const b = B[jezik];
  return stranHtml(`<!doctype html>
<html lang="${jezik}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pobegni(naslovStrani || b.naslov_strani)}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/media/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/pisave.css">
<link rel="stylesheet" href="/css/slog.css">
<link rel="stylesheet" href="/css/zaledje.css">
</head>
<body class="zaledje">
<div class="svet" aria-hidden="true"><span class="svet-luc svet-luc-1"></span><span class="svet-luc svet-luc-2"></span><span class="svet-luc svet-luc-3"></span></div>
<header class="glava"><a class="znamka" href="${jezik === "sl" ? "/sl/" : "/"}"><img src="/media/logo.svg" alt="" width="26" height="26"><span>Wayfare</span></a></header>
<main id="vsebina" class="napaka-stran">
  <section class="napaka">
    <h1 class="serif">${naslov}</h1>
    ${besedilo ? `<p class="uvodnik">${besedilo}</p>` : ""}
    ${telo}
  </section>
</main>
</body>
</html>
`, status);
}

export const stranNapake = (jezik, kljuc, status = 400) =>
  stran({ jezik, naslov: B[jezik][`${kljuc}_naslov`], besedilo: B[jezik][`${kljuc}_besedilo`], telo: gumbDomov(jezik), status });

// Ovoj za vsak handler: pričakovana napaka (Napaka) gre nazaj s svojo kodo,
// vse drugo je 500 z zapisom v dnevnik. Z html: true vrne stran namesto JSON.
export function obravnavaj(fn, { html = false } = {}) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      const pricakovana = e instanceof Napaka;
      const status = pricakovana ? e.status : 500;
      if (!pricakovana) console.error(e);
      if (html) {
        const jezik = jezikIz(null, ctx.request);
        if (pricakovana) return stran({ jezik, naslov: B[jezik].napaka_naslov, besedilo: pobegni(e.message), telo: gumbDomov(jezik), status });
        return stranNapake(jezik, "napaka", 500);
      }
      return json({ napaka: pricakovana ? e.koda : "streznik", ...(pricakovana && e.message !== e.koda ? { sporocilo: e.message } : {}) }, status);
    }
  };
}
