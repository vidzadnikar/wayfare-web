// Zavihek Vlogi: najnovejši film izpostavljen, spodaj zbirka kartic po
// potovanjih. Vsaka kartica vodi na svojo stran ogleda (vlogi/<oznaka>/),
// kjer so predvajalnik, poglavja in komentarji (ogled.js). Nad kartico teče
// nem predogled. Stare povezave s #oznako (pošta, zaznamki) preusmeri na
// stran ogleda.
import { zazeniDrsenje, prikaziNaslove, besede, mirno, svet } from "./gibanje.js";
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
clan();
