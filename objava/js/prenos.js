// Prenos aplikacije: gumbi so navadne povezave na .dmg z atributom download,
// zato prenos dela tudi brez JS. Ta modul glede na napravo pokaže obvestilo:
//   mac       prenos teče naprej, obvestilo pove, kako aplikacijo odpreš prvič
//   mac-intel brskalnik (Chromium) pove, da je procesor Intel: najprej opozorilo
//   mobilno   telefon ali tablica: namesto prenosa deli povezavo do strani
//   drugo     Windows, Linux ...: razlaga in »Vseeno prenesi«

function zaznajNapravo() {
  const ua = navigator.userAgent;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS se predstavi kot Mac
  if (/Android|iPhone|iPod|iPad|Mobile/.test(ua) || ipad) return Promise.resolve("mobilno");
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
  zaznajNapravo().then((n) => { naprava = n; });
  let prej = null;

  function pokazi(predloga, gumb) {
    vsebina.replaceChildren(document.getElementById(`obvestilo-${predloga}`).content.cloneNode(true));
    prej = gumb;
    plosca.hidden = false;
    plosca.dataset.odprto = "";
    vsebina.querySelector("[tabindex='-1']")?.focus({ preventScroll: true });
    vsebina.querySelector("[data-deli]")?.addEventListener("click", deli);
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
      if (naprava === "mac") { pokazi("mac", gumb); return; } // prenos teče naprej
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
