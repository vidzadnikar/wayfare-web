// Zavihek Vlogi: najnovejši film izpostavljen, spodaj zbirka kartic po
// potovanjih. Vsaka kartica vodi na svojo stran ogleda (vlogi/<oznaka>/),
// kjer so predvajalnik, poglavja in komentarji (ogled.js). Nad kartico teče
// nem predogled. Stare povezave s #oznako (pošta, zaznamki) preusmeri na
// stran ogleda.
import { zazeniDrsenje, prikaziNaslove, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";
import { zankeKartic, prihodKartic, nagibKartic } from "./kartice.js";
import { clan } from "./clan.js";

// #rim-2 → rim-2/ (le za vlog, ki je na strani)
const zeljeni = decodeURIComponent(location.hash.slice(1));
if (zeljeni && /^[a-z0-9-]+$/.test(zeljeni) && document.querySelector(`[data-vlog="${zeljeni}"]`)) {
  location.replace(`${zeljeni}/`);
}

const { gsap, ScrollTrigger } = zazeniDrsenje();
if (!mirno) document.documentElement.classList.add("gibanje");

zankeKartic([...document.querySelectorAll("[data-vlog]")]);
nagibKartic(document.querySelectorAll(".kartica-povezava"));

// uvod (naslov po besedah, opis, izpostavljeni film) je v CSS (.uvod-css v
// slog.css), da steče ob prvem izrisu in ne čaka na knjižnice
if (!mirno) {
  prihodKartic(".skupina h3, .kartica", { gsap, ScrollTrigger });
  svet({ gsap });
}
prikaziNaslove("[data-naslov]", { gsap });

// izbira jezika se zapomni (angleška stran sicer slovenske obiskovalce preusmeri)
for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

prenos();
clan();
