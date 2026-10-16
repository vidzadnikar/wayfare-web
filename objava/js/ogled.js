// Stran ogleda enega vloga (vlogi/<oznaka>/): predvajalnik, poglavja,
// deljenje, komentarji (komentarji.js) in seznam Naprej.
//
// Predvajalnik je do klika le naslovnica z gumbom (nič z YouTuba se ne
// naloži, dokler obiskovalec ne predvaja). Ob kliku pride okvir YouTuba brez
// piškotkov s samodejnim predvajanjem; ukaze mu pošiljamo prek postMessage po
// istem kanalu kot uradni IFrame API, a brez njegove skripte: po nalaganju
// pošljemo "listening", predvajalnik javi onReady ter nato stanje in čas
// (infoDelivery); ukaza sta seekTo in playVideo.
import { zazeniDrsenje, prikaziNaslove, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";
import { zankeKartic } from "./kartice.js";
import { clan } from "./clan.js";
import { komentarji } from "./komentarji.js";

const { gsap } = zazeniDrsenje();
if (!mirno) document.documentElement.classList.add("gibanje");

const YOUTUBE = "https://www.youtube-nocookie.com";
const oderEl = document.querySelector("[data-ogled-oder]");
const gumb = oderEl.querySelector("[data-predvajaj]");
const seznam = document.querySelector("[data-poglavja]");
const sporocilo = document.querySelector("[data-ogled-sporocilo]");
const id = oderEl.dataset.youtube;
const oznaka = oderEl.dataset.oznaka;
let okvir = null;
let pripravljen = false;    // YouTube sprejema ukaze (javil je onReady)
let ogledZapisan = false;
let zadnjeOznaceno = null;

const sporoci = (s) => okvir?.contentWindow?.postMessage(JSON.stringify(s), YOUTUBE);
const ukaz = (func, args = []) => sporoci({ event: "command", func, args });
const poslusaj = () => sporoci({ event: "listening", id: 1, channel: "widget" });

function predvajaj(zacetek = 0) {
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
  predvajaj(t);
  if (pripravljen) ukaz("playVideo");
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
