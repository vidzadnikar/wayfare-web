// Zid vseh filmov na domači strani (potrjeno 18. 10. 2026): dve vrsti tečeta v
// nasprotnih smereh. Vrsta, nad katero je kazalec ali fokus, se ustavi; gumb
// ustavi obe (WCAG 2.2.2). Zunaj zaslona in v skritem zavihku ne teče. Ob
// prihodu na zaslon vrsti priletita od spodaj. Pod prefers-reduced-motion vrsti
// stojita in se drsata z roko (CSS), kopije za neskončen tek so skrite.
import { mirno } from "./gibanje.js";

export function zid(el, { gsap, ScrollTrigger }) {
  if (!el || mirno) return;
  const gumb = document.querySelector("[data-zid-premor]");
  const vrste = [...el.querySelectorAll(".zid-vrsta")].map((v) => ({
    v, niz: v.querySelector(".zid-niz"), smer: Number(v.dataset.smer) || 1, x: 0, sirina: 0, ustavljena: false,
  }));
  const izmeri = () => vrste.forEach((r) => { r.sirina = r.niz.offsetWidth; });
  izmeri();
  addEventListener("resize", izmeri);
  addEventListener("load", izmeri);
  for (const r of vrste) {
    const ustavi = () => { r.ustavljena = true; }, pusti = () => { r.ustavljena = false; };
    r.v.addEventListener("pointerenter", ustavi);
    r.v.addEventListener("pointerleave", pusti);
    r.v.addEventListener("focusin", ustavi);
    r.v.addEventListener("focusout", pusti);
    // druga vrsta začne zamaknjena, da kartici nista ena nad drugo
    if (r.smer < 0) r.x = -r.sirina * 0.37;
  }
  let vidno = false, premor = false;
  ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onToggle: (st) => { vidno = st.isActive; } });
  gumb.hidden = false;
  gumb.addEventListener("click", () => {
    premor = !premor;
    gumb.setAttribute("aria-pressed", String(premor));
    gumb.textContent = premor ? gumb.dataset.nadaljuj : gumb.dataset.ustavi;
  });
  const HITROST = 38; // px na sekundo
  gsap.ticker.add((_, dt) => {
    if (!vidno || premor || document.hidden) return;
    for (const r of vrste) {
      if (r.ustavljena || !r.sirina) continue;
      r.x = gsap.utils.wrap(-r.sirina, 0, r.x - r.smer * HITROST * (dt / 1000));
      gsap.set(r.v.children, { x: r.x });
    }
  });
  gsap.from(vrste.map((r) => r.v), {
    y: 48, autoAlpha: 0, duration: 1.1, ease: "expo.out", stagger: 0.12,
    scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
  });
}
