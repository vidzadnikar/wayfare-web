// Stran ogleda enega vloga (vlogi/<oznaka>/): predvajalnik, poglavja,
// deljenje, komentarji (komentarji.js) in seznam Naprej.
//
// Plačljiv vlog (data-placljiv="true"): v strani ni ne filma ne oznake
// YouTube. Skripta vpraša /api/vlog/<oznaka>, ali sme prijavljeni gledati;
// če sme, dobi povezavi do filma (/api/video/…, iz zasebnega R2) in igra v
// lastnem <video>; sicer čez naslovnico pride zaklep z gumbom za prijavo
// ali naročnino. Po prijavi ali plačilu se dostop preveri znova.
//
// Brezplačen vlog igra z YouTuba: do klika le naslovnica z gumbom, ob kliku
// okvir YouTuba brez piškotkov s samodejnim predvajanjem; ukaze mu
// pošiljamo prek postMessage po istem kanalu kot uradni IFrame API, a brez
// njegove skripte: po nalaganju pošljemo "listening", predvajalnik javi
// onReady ter nato stanje in čas (infoDelivery); ukaza sta seekTo in playVideo.
import { zazeniDrsenje, prikaziNaslove, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";
import { zankeKartic, nagibKartic } from "./kartice.js";
import { clan } from "./clan.js";
import { komentarji } from "./komentarji.js";

const { gsap } = zazeniDrsenje();
if (!mirno) document.documentElement.classList.add("gibanje");

const YOUTUBE = "https://www.youtube-nocookie.com";
const oderEl = document.querySelector("[data-ogled-oder]");
const gumb = oderEl.querySelector("[data-predvajaj]");
const zaklep = oderEl.querySelector("[data-zaklep]");
const videoEl = oderEl.querySelector("[data-video]");
const seznam = document.querySelector("[data-poglavja]");
const sporocilo = document.querySelector("[data-ogled-sporocilo]");
const id = oderEl.dataset.youtube;
const oznaka = oderEl.dataset.oznaka;
const placljiv = oderEl.dataset.placljiv === "true";
let okvir = null;
let pripravljen = false;    // YouTube sprejema ukaze (javil je onReady)
let ogledZapisan = false;
let zadnjeOznaceno = null;
let viri = null;            // plačljiv vlog z dostopom: { "1080": url, "720": url }

const sporoci = (s) => okvir?.contentWindow?.postMessage(JSON.stringify(s), YOUTUBE);
const ukaz = (func, args = []) => sporoci({ event: "command", func, args });
const poslusaj = () => sporoci({ event: "listening", id: 1, channel: "widget" });

// ---------------------------------------------------------------- dostop (plačljiv vlog)
function pokaziZaklep(za) {
  zaklep.dataset.za = za;
  zaklep.hidden = false;
  gumb.hidden = true;
}
function skrijZaklep() {
  zaklep.hidden = true;
  gumb.hidden = false;
}

async function preveriDostop() {
  if (!placljiv) return;
  let odg = null;
  try {
    const r = await fetch(`/api/vlog/${encodeURIComponent(oznaka)}`, { headers: { Accept: "application/json" } });
    if (r.ok) odg = await r.json();
  } catch (e) { odg = null; }
  if (!odg) { pokaziZaklep("povabilo"); return; }
  if (odg.dostop && !odg.kmalu) {
    viri = odg.viri;
    skrijZaklep();
    return;
  }
  viri = null;
  // brez Stripa (brez ključev) dostop daje le admin: prijavljen brez dostopa zaprosi zanj
  if (odg.dostop) pokaziZaklep("kmalu");
  else if (!odg.prijavljen) pokaziZaklep("gost");
  else if (!odg.na_voljo) pokaziZaklep("povabilo");
  else pokaziZaklep("clan");
}

if (placljiv) {
  preveriDostop();
  // prijava, izpis ali plačilo (clan.js) spremenijo dostop
  document.addEventListener("wayfare:clan", preveriDostop);
  document.addEventListener("wayfare:narocnina", preveriDostop);
  zaklep.querySelector("[data-zaklep-prijava]")?.addEventListener("click", () => document.querySelector("[data-prijava-odpri]")?.click());
  // soglasje in gumb: obrazec pošlje strežnik (preusmeritev na Stripe), tu le preverimo kljukico
  zaklep.querySelector("[data-zaklep-obrazec]")?.addEventListener("submit", (e) => {
    const f = e.currentTarget;
    if (!f.elements.soglasje.checked) { e.preventDefault(); f.elements.soglasje.focus(); }
  });
}

// ---------------------------------------------------------------- predvajanje
function izberiVir() {
  if (!viri) return null;
  const sirok = innerWidth >= 900 || devicePixelRatio > 1.5;
  return (sirok && viri["1080"]) || viri["720"] || viri["1080"] || null;
}

function predvajajVideo(zacetek) {
  const vir = izberiVir();
  if (!vir) return;
  if (videoEl.getAttribute("src") !== vir) {
    videoEl.src = vir;
    videoEl.load();
  }
  videoEl.hidden = false;
  oderEl.dataset.stanje = "tece";
  const skoci = () => { if (zacetek > 0) { try { videoEl.currentTime = zacetek; } catch (e) {} } };
  if (videoEl.readyState >= 1) skoci(); else videoEl.addEventListener("loadedmetadata", skoci, { once: true });
  videoEl.play().catch(() => {});
  videoEl.focus({ preventScroll: true });
}

function predvajaj(zacetek = 0) {
  if (placljiv) {
    if (!viri) { if (zaklep.hidden) pokaziZaklep("povabilo"); zaklep.querySelector(".gumb, input")?.focus({ preventScroll: true }); return; }
    predvajajVideo(zacetek);
    return;
  }
  if (!id) return;
  if (okvir && pripravljen) {
    if (zacetek > 0) ukaz("seekTo", [zacetek, true]);
    ukaz("playVideo");
    return;
  }
  const p = new URLSearchParams({ enablejsapi: "1", rel: "0", playsinline: "1", autoplay: "1", origin: location.origin });
  if (zacetek > 0) p.set("start", String(Math.floor(zacetek)));
  if (!okvir) {
    okvir = document.createElement("iframe");
    okvir.className = "ogled-oder-okvir";
    okvir.title = document.querySelector("#ogled-naslov").textContent;
    okvir.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
    okvir.allowFullscreen = true;
    okvir.referrerPolicy = "strict-origin-when-cross-origin";
    okvir.addEventListener("load", poslusaj);
    oderEl.append(okvir);
  }
  pripravljen = false;
  okvir.src = `${YOUTUBE}/embed/${encodeURIComponent(id)}?${p}`;
  oderEl.dataset.stanje = "tece";
  okvir.focus({ preventScroll: true });
}

gumb.addEventListener("click", (e) => { e.preventDefault(); predvajaj(); });

videoEl.addEventListener("play", zapisiOgled);
videoEl.addEventListener("timeupdate", () => oznaciPoglavje(videoEl.currentTime));
videoEl.addEventListener("error", () => {
  // povezava poteče ali dostop ugasne med ogledom: preveri znova
  oderEl.dataset.stanje = "pripravljen";
  videoEl.hidden = true;
  videoEl.removeAttribute("src");
  preveriDostop();
});

addEventListener("message", (e) => {
  if (!okvir || e.origin !== YOUTUBE || e.source !== okvir.contentWindow || typeof e.data !== "string") return;
  let s;
  try { s = JSON.parse(e.data); } catch (napaka) { return; }
  if (s.event === "onReady") pripravljen = true;
  if (s.event !== "infoDelivery" || !s.info) return;
  if (s.info.playerState === 1) zapisiOgled();
  if (typeof s.info.currentTime === "number") oznaciPoglavje(s.info.currentTime);
});

// ogled se zapiše enkrat na obisk strani (zaledje: /api/ogled)
function zapisiOgled() {
  if (ogledZapisan) return;
  ogledZapisan = true;
  fetch("/api/ogled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oznaka }), keepalive: true }).catch(() => {});
}

// ---------------------------------------------------------------- poglavja
const casi = seznam ? [...seznam.querySelectorAll("[data-cas]")] : [];
function skoci(t) {
  if (placljiv && viri && !videoEl.hidden && videoEl.getAttribute("src")) {
    try { videoEl.currentTime = t; } catch (e) {}
    videoEl.play().catch(() => {});
  } else {
    predvajaj(t);
    if (!placljiv && pripravljen) ukaz("playVideo");
  }
  if (!mirno && oderEl.getBoundingClientRect().top < 0) oderEl.scrollIntoView({ behavior: "smooth", block: "start" });
}
seznam?.addEventListener("click", (e) => {
  const g = e.target.closest("[data-cas]");
  if (g) skoci(Number(g.dataset.cas));
});
function oznaciPoglavje(t) {
  if (!casi.length) return;
  let i = 0;
  casi.forEach((g, k) => { if (Number(g.dataset.cas) <= t + 0.25) i = k; });
  if (i === zadnjeOznaceno) return;
  zadnjeOznaceno = i;
  casi.forEach((g, k) => (k === i ? g.setAttribute("aria-current", "true") : g.removeAttribute("aria-current")));
}

// ---------------------------------------------------------------- deljenje
let casSporocila;
function povej(besedilo) {
  sporocilo.textContent = besedilo;
  sporocilo.hidden = false;
  clearTimeout(casSporocila);
  casSporocila = setTimeout(() => { sporocilo.hidden = true; }, 3200);
}
const deli = document.querySelector("[data-deli]");
deli.addEventListener("click", async () => {
  const url = location.origin + location.pathname;
  const naslov = document.title;
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ title: naslov, url }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    povej(deli.dataset.kopirano);
  } catch (e) {
    prompt("", url);
  }
});

// ---------------------------------------------------------------- komentarji, seznam Naprej
komentarji(document.querySelector("[data-komentarji]"), { skoci });
zankeKartic([...document.querySelectorAll(".naprej [data-vlog]")]);
nagibKartic(document.querySelectorAll(".naprej .kartica-povezava"));

if (!mirno) {
  gsap.fromTo("[data-uvod]", { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "expo.out" });
  gsap.fromTo(".ogled-podatki > *, .komentarji > h2", { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.1 });
  gsap.fromTo(".naprej > h2, .naprej .kartica", { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.05, delay: 0.25 });
  svet({ gsap });
}
prikaziNaslove("[data-naslov]", { gsap });

for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

prenos();
clan();
