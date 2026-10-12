// Stran 404: isti svet, glava in obvestilo ob prenosu kot drugod, brez vsebine
// za drsenje. Naslov pride po besedah kot na zavihku Vlogi.
import { zazeniDrsenje, besede, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";

const { gsap } = zazeniDrsenje();
if (!mirno) {
  document.documentElement.classList.add("gibanje");
  const h1 = document.querySelector("[data-naslov-uvod]");
  const deli = besede(h1);
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .set(h1, { autoAlpha: 1 }, 0)
    .from(deli, { yPercent: 110, duration: 1.1, stagger: 0.05 }, 0.1)
    .fromTo("[data-uvod]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.0, stagger: 0.09 }, 0.3);
  svet({ gsap });
}

// izbira jezika se zapomni (angleška stran sicer slovenske obiskovalce preusmeri)
for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

prenos();
