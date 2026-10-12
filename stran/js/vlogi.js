// Zavihek Vlogi: en predvajalnik zgoraj, zbirka kartic spodaj. Klik na
// kartico naloži film v predvajalnik in stran odpelje k njemu; poglavja
// skačejo po filmu, trenutno poglavje se označi med predvajanjem; nad
// kartico teče nem predogled. Podatki o filmih so v <script type="application/json">,
// ki ga zgradi zgradi.py, zato skript ne zahteva ničesar s strežnika.
//
// Film igra na dva načina. Z YouTuba (vlog ima oznako youtube): v okvirju
// brez piškotkov, ki mu ukazujemo prek postMessage po istem kanalu kot
// uradni IFrame API, a brez njegove skripte: po nalaganju pošljemo
// "listening", predvajalnik javi onReady in nato stanje in čas
// (infoDelivery); ukaza sta seekTo in playVideo. Z lastnega strežnika (vlog
// brez oznake): <video> z datotekama -1080 in -720. Na objavljeni strani
// teh datotek ni, zato napaka pri nalaganju pomeni, da film še ni na spletu.
import { zazeniDrsenje, prikaziNaslove, besede, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";
import { zankeKartic, prihodKartic } from "./kartice.js";

const { gsap, ScrollTrigger, lenis } = zazeniDrsenje();
if (!mirno) document.documentElement.classList.add("gibanje");

const YOUTUBE = "https://www.youtube-nocookie.com";
const podatki = JSON.parse(document.getElementById("vlogi-podatki").textContent);
const vlogi = new Map(podatki.vlogi.map((v) => [v.oznaka, v]));
const platno = document.querySelector("[data-platno]");
const video = platno.querySelector("[data-video]");
const viri = { 1080: platno.querySelector('[data-vir="1080"]'), 720: platno.querySelector('[data-vir="720"]') };
const okvir = platno.querySelector("[data-okvir]");
const ozadje = platno.querySelector("[data-ozadje]");
const naslov = document.querySelector("[data-film-naslov]");
const seznam = document.querySelector("[data-poglavja]");
const stanje = document.querySelector("[data-stanje-filma]");
const kartice = [...document.querySelectorAll("[data-vlog]")];
let trenutni = podatki.vlogi[0].oznaka;
let nacin = platno.dataset.nacin; // "youtube" ali "video"
let okvirPripravljen = false;     // YouTube sprejema ukaze (javil je onReady)
let najavljen = false;            // bralnik zaslona je slišal, kateri film teče
let zadnjeOznaceno = null;        // poglavje, označeno med predvajanjem

const cas = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const varno = (t) => t.replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z]));

function poglavjaHtml(v) {
  return v.poglavja.map(([t, ime]) =>
    `<li><button type="button" class="poglavje-gumb" data-cas="${t}">` +
    `<span class="poglavje-cas">${cas(t)}</span>${varno(ime)}</button></li>`).join("");
}

// ---------------------------------------------------------------- YouTube
function okvirUrl(oznaka, { zacetek = 0, samodejno = false } = {}) {
  const p = new URLSearchParams({ enablejsapi: "1", rel: "0", playsinline: "1", origin: location.origin });
  if (zacetek > 0) p.set("start", String(Math.floor(zacetek)));
  if (samodejno) p.set("autoplay", "1");
  return `${YOUTUBE}/embed/${encodeURIComponent(oznaka)}?${p}`;
}
const sporoci = (s) => okvir.contentWindow?.postMessage(JSON.stringify(s), YOUTUBE);
const ukaz = (func, args = []) => sporoci({ event: "command", func, args });
const poslusaj = () => sporoci({ event: "listening", id: 1, channel: "widget" });

function naloziOkvir(v, nastavitve) {
  okvirPripravljen = false;
  okvir.title = v.naslov;
  if (!okvir.isConnected) platno.insertBefore(okvir, platno.querySelector("[data-kino-gumb]"));
  okvir.hidden = false;
  okvir.src = okvirUrl(v.youtube, nastavitve);
}

// okvir gre iz dokumenta, da film z YouTuba zares utihne (skrit okvir bi igral naprej)
function odstraniOkvir() {
  okvirPripravljen = false;
  okvir.hidden = true;
  okvir.remove();
}

okvir.addEventListener("load", poslusaj);
addEventListener("message", (e) => {
  if (e.origin !== YOUTUBE || e.source !== okvir.contentWindow || typeof e.data !== "string") return;
  let s;
  try { s = JSON.parse(e.data); } catch (napaka) { return; }
  if (s.event === "onReady") okvirPripravljen = true;
  if (s.event !== "infoDelivery" || !s.info) return;
  if (s.info.playerState === 1) tece(); // 1 = predvaja
  if (typeof s.info.currentTime === "number") oznaciPoglavje(s.info.currentTime);
});

// ---------------------------------------------------------------- predvajalnik
function tece() {
  platno.dataset.stanje = "tece";
  if (najavljen) return;
  najavljen = true;
  stanje.textContent = `${podatki.besedila.zdaj} ${vlogi.get(trenutni).naslov}`;
}

// Predvajanje z zvokom: brskalnik ga dovoli le ob kliku, zato gre vsak
// začetek skozi to funkcijo (gumb, kartica, poglavje).
function predvajaj() {
  if (nacin === "youtube") {
    if (okvirPripravljen) ukaz("playVideo");
    else naloziOkvir(vlogi.get(trenutni), { samodejno: true });
    return;
  }
  platno.dataset.stanje = "nalaga";
  video.muted = false;
  video.controls = true;
  video.play().then(() => {
    tece();
    video.focus({ preventScroll: true });
  }).catch((napaka) => {
    platno.dataset.stanje = napaka?.name === "NotAllowedError" ? "pripravljen" : "napaka";
    video.controls = false;
  });
}

function izberi(oznaka, { predvajajTakoj = false, drsi = false, naslovVrstica = true } = {}) {
  const v = vlogi.get(oznaka);
  if (!v) return;
  const menjava = oznaka !== trenutni;
  trenutni = oznaka;
  if (menjava) {
    video.pause();
    video.controls = false;
    nacin = v.youtube ? "youtube" : "video";
    platno.dataset.nacin = nacin;
    najavljen = false;
    zadnjeOznaceno = null;
    if (nacin === "youtube") {
      video.hidden = true;
      naloziOkvir(v, { samodejno: predvajajTakoj });
    } else {
      odstraniOkvir();
      video.hidden = false;
      video.poster = v.slika;
      viri[1080].src = v.v1080;
      viri[720].src = v.v720;
      video.setAttribute("aria-label", v.naslov);
      video.load();
    }
    ozadje.src = v.slika;
    platno.dataset.pokoncno = String(v.pokoncno);
    platno.dataset.stanje = "pripravljen";
    naslov.textContent = v.naslov;
    seznam.innerHTML = poglavjaHtml(v);
    seznam.hidden = !v.poglavja.length;
  }
  for (const k of kartice) {
    if (k.dataset.vlog === oznaka) k.setAttribute("aria-current", "true");
    else k.removeAttribute("aria-current");
  }
  if (naslovVrstica) history.replaceState(null, "", "#" + oznaka);
  if (drsi) {
    const cilj = document.getElementById("predvajalnik");
    if (lenis) { lenis.resize(); lenis.scrollTo(cilj, { offset: -84 }); }
    else window.scrollTo({ top: cilj.getBoundingClientRect().top + scrollY - 84, behavior: mirno ? "auto" : "smooth" });
  }
  // film z YouTuba se ob menjavi že naloži s samodejnim predvajanjem
  if (predvajajTakoj && !(menjava && nacin === "youtube")) predvajaj();
}

// skok na poglavje: pri <video> se čas nastavi, ko so metapodatki naloženi
// (preload="none"); pri YouTubu z ukazom, če predvajalnik še ni pripravljen,
// pa z novim nalaganjem od tega časa
seznam.addEventListener("click", (e) => {
  const gumb = e.target.closest("[data-cas]");
  if (!gumb) return;
  const t = Number(gumb.dataset.cas);
  if (nacin === "youtube") {
    if (okvirPripravljen) { ukaz("seekTo", [t, true]); ukaz("playVideo"); }
    else naloziOkvir(vlogi.get(trenutni), { zacetek: t, samodejno: true });
    return;
  }
  const skoci = () => { video.currentTime = t; };
  if (video.readyState >= 1) skoci();
  else video.addEventListener("loadedmetadata", skoci, { once: true });
  if (platno.dataset.stanje !== "tece") predvajaj();
  else video.play().catch(() => {});
});

// trenutno poglavje med predvajanjem
function oznaciPoglavje(t) {
  const v = vlogi.get(trenutni);
  if (!v.poglavja.length) return;
  let i = 0;
  for (let k = 0; k < v.poglavja.length; k++) if (v.poglavja[k][0] <= t + 0.25) i = k;
  if (i === zadnjeOznaceno) return;
  zadnjeOznaceno = i;
  seznam.querySelectorAll("[data-cas]").forEach((g, k) => {
    if (k === i) g.setAttribute("aria-current", "true");
    else g.removeAttribute("aria-current");
  });
}
video.addEventListener("timeupdate", () => oznaciPoglavje(video.currentTime));
video.addEventListener("emptied", () => { zadnjeOznaceno = null; });

platno.querySelector("[data-predvajaj]").addEventListener("click", predvajaj);
video.addEventListener("ended", () => { platno.dataset.stanje = "konec"; });
// Napaka med predvajanjem pride na video. Napaka pri nalaganju pa pride na
// <source>, ne na video — in brskalnik jo sproži tudi na viru 1080, ki ga na
// ozkem zaslonu le preskoči (media). Zato poslušamo zadnji vir (720) in
// napako priznamo šele, ko ne ostane noben (NETWORK_NO_SOURCE); play() takrat
// nikoli ne odgovori, zato se nanj ni mogoče zanesti. Ob napaki ostane le
// sporočilo; prazni gumbi predvajalnika bi ga prekrili.
const napaka = () => { platno.dataset.stanje = "napaka"; video.controls = false; };
video.addEventListener("error", napaka);
viri[720].addEventListener("error", () => setTimeout(() => {
  if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) napaka();
}, 0));

// kartice: klik naloži film; miška ali fokus zažene nem predogled (kartice.js)
for (const k of kartice) {
  k.querySelector("[data-izberi]").addEventListener("click", (e) => {
    e.preventDefault();
    izberi(k.dataset.vlog, { predvajajTakoj: true, drsi: true });
  });
}
zankeKartic(kartice);

// povezava s #oznako odpre ta film (brez predvajanja; zvok potrebuje klik);
// naslovna vrstica se spremeni šele ob izbiri, ne ob nalaganju
const zeljeni = decodeURIComponent(location.hash.slice(1));
izberi(vlogi.has(zeljeni) ? zeljeni : trenutni, { naslovVrstica: false });
// Prvi film z YouTuba je v okvirju že iz HTML. Če se je naložil pred skriptom,
// se javimo zdaj (dokument YouTuba je tujega izvora, zato je contentDocument
// null); sicer ga počaka poslušalec dogodka load.
if (nacin === "youtube" && okvir.contentDocument === null) poslusaj();

// uvod in gibanje
if (!mirno) {
  const h1 = document.querySelector("[data-naslov-uvod]");
  const deli = besede(h1);
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .set(h1, { autoAlpha: 1 }, 0)
    .from(deli, { yPercent: 110, duration: 1.1, stagger: 0.05 }, 0.1)
    .fromTo("[data-uvod]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.0, stagger: 0.09 }, 0.3);

  prihodKartic(".skupina h3, .kartica", { gsap, ScrollTrigger });
  svet({ gsap });
}
prikaziNaslove("[data-naslov]", { gsap });

// izbira jezika se zapomni (angleška stran sicer slovenske obiskovalce preusmeri)
for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

prenos();
