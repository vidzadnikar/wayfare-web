// Prenos aplikacije: gumbi so navadne povezave na .dmg z atributom download,
// zato prenos dela tudi brez JS. Ta modul glede na napravo pokaže obvestilo:
//   mac       prenos teče naprej, obvestilo pove, kako aplikacijo odpreš prvič
//   mac-intel brskalnik (Chromium) pove, da je procesor Intel: najprej opozorilo
//   android   gumbi kazejo na .apk; obvestilo o namestitvi iz brskalnika
//   mobilno   iPhone, iPad: namesto prenosa deli povezavo do strani
//   windows   gumbi kazejo na namestitveni program za Windows; obvestilo o SmartScreenu
//   drugo     Linux ...: razlaga in »Vseeno prenesi«

import { povezi } from "./kopiraj.js";

function zaznajNapravo() {
  const ua = navigator.userAgent;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS se predstavi kot Mac
  if (/Android/.test(ua)) return Promise.resolve("android");
  if (/iPhone|iPod|iPad|Mobile/.test(ua) || ipad) return Promise.resolve("mobilno");
  if (/Windows NT/.test(ua)) return Promise.resolve("windows");
  if (!/Macintosh|Mac OS X/.test(ua)) return Promise.resolve("drugo");
  // arhitekturo pove le Chromium; Safari in Firefox je ne izdata, zato velja Apple silicon
  const ud = navigator.userAgentData;
  if (!ud?.getHighEntropyValues) return Promise.resolve("mac");
  return ud.getHighEntropyValues(["architecture"])
    .then((v) => (v.architecture === "x86" ? "mac-intel" : "mac"))
    .catch(() => "mac");
}

export function prenos() {
  const plosca = document.querySelector("[data-obvestilo]");
  const vsebina = plosca.querySelector("[data-obvestilo-vsebina]");
  const zapri = plosca.querySelector("[data-obvestilo-zapri]");
  let naprava = "mac";
  zaznajNapravo().then((n) => {
    naprava = n;
    // kartica naprave za ta sistem je poudarjena (prenos na domači strani)
    const kljuc = n === "mac-intel" ? "mac" : n;
    for (const k of document.querySelectorAll("[data-naprava]")) k.toggleAttribute("data-priporoceno", k.dataset.naprava === kljuc);
    // stavek pod gumbom v uvodu pove, za kaj je ta prenos in kaj je še na voljo
    const opomba = document.querySelector("[data-prenos-opomba]");
    const predloga = document.querySelector(`template[data-opomba="${n}"]`);
    if (opomba && predloga) opomba.replaceChildren(predloga.content.cloneNode(true));
    // namestitev z enim ukazom: na Windows je ukaz za PowerShell prvi
    const namesti = document.querySelector(".namesti");
    if (n === "windows" && namesti) {
      const stanje = namesti.querySelector("[data-kopiraj-stanje]");
      for (const e of namesti.querySelectorAll('[data-namesti="mac"]')) namesti.insertBefore(e, stanje);
    }
    // na telefonu kode ne skeniras; na Androidu je vrstica za Android prva
    if ((n === "android" || n === "mobilno") && namesti) {
      for (const e of namesti.querySelectorAll(".namesti-qr, .namesti-qr-opis")) e.remove();
    }
    // iPhone in iPad: Wayfare zanju ni, Obtainium je le za Android
    if (n === "mobilno" && namesti) namesti.querySelector('[data-namesti="android"]')?.remove();
    if (n === "android" && namesti) {
      const android = namesti.querySelector('[data-namesti="android"]');
      namesti.insertBefore(android, namesti.querySelector(".namesti-sistem"));
    }
    // na Windows in Androidu gumbi za prenos kazejo na paket za ta sistem
    if (n !== "windows" && n !== "android") return;
    for (const gumb of document.querySelectorAll(`[data-prenos-${n}]`)) {
      gumb.href = gumb.dataset[n === "windows" ? "prenosWindows" : "prenosAndroid"];
      const besedilo = gumb.dataset[n === "windows" ? "besediloWindows" : "besediloAndroid"];
      if (besedilo) (gumb.querySelector("[data-prenos-besedilo]") || gumb).textContent = besedilo;
    }
  });
  let prej = null;

  function pokazi(predloga, gumb) {
    vsebina.replaceChildren(document.getElementById(`obvestilo-${predloga}`).content.cloneNode(true));
    prej = gumb;
    plosca.hidden = false;
    plosca.dataset.odprto = "";
    vsebina.querySelector("[tabindex='-1']")?.focus({ preventScroll: true });
    vsebina.querySelector("[data-deli]")?.addEventListener("click", deli);
    povezi(vsebina, vsebina.querySelector("[data-kopiraj-stanje]"));
    // »Vseeno prenesi« sproži prenos in pokaže navodila za Mac
    vsebina.querySelector("[data-prenos-vseeno]")?.addEventListener("click", () => {
      setTimeout(() => pokazi("mac", prej), 0);
    });
  }

  function skrij() {
    if (plosca.hidden) return;
    delete plosca.dataset.odprto;
    plosca.hidden = true;
    prej?.focus({ preventScroll: true });
  }

  async function deli(e) {
    const gumb = e.currentTarget;
    const podatki = { title: document.title, url: location.href.split("#")[0] };
    try {
      if (navigator.share) { await navigator.share(podatki); return; }
      await navigator.clipboard.writeText(podatki.url);
      gumb.textContent = gumb.dataset.kopirano;
    } catch (napaka) {
      if (napaka?.name === "AbortError") return; // uporabnik je deljenje preklical
      gumb.textContent = podatki.url;          // brez odložišča vsaj pokaži naslov
    }
  }

  for (const gumb of document.querySelectorAll("[data-prenos]")) {
    gumb.addEventListener("click", (e) => {
      if (naprava === "mac" || naprava === "windows" || naprava === "android") { pokazi(naprava, gumb); return; } // prenos teče naprej
      e.preventDefault();
      pokazi(naprava, gumb);
    });
  }
  zapri.addEventListener("click", skrij);
  addEventListener("keydown", (e) => { if (e.key === "Escape") skrij(); });
  document.addEventListener("click", (e) => {
    if (!plosca.hidden && !plosca.contains(e.target) && !e.target.closest("[data-prenos]")) skrij();
  });
}
