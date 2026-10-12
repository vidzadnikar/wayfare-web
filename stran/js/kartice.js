// Kartice filmov (zavihek Vlogi in domača stran): z miško ali fokusom nad
// kartico teče nem predogled (zanka), ob drsenju kartice pridejo od spodaj.
import { mirno } from "./gibanje.js";

export function zankeKartic(kartice) {
  if (mirno || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const k of kartice) {
    const povezava = k.querySelector(".kartica-povezava");
    const zanka = k.querySelector("[data-zanka-src]");
    if (!povezava || !zanka) continue;
    const zacni = () => {
      if (!zanka.getAttribute("src")) zanka.src = zanka.dataset.zankaSrc;
      zanka.play().then(() => { zanka.dataset.tece = ""; }).catch(() => {});
    };
    const ustavi = () => { zanka.pause(); delete zanka.dataset.tece; try { zanka.currentTime = 0; } catch (e) {} };
    povezava.addEventListener("pointerenter", zacni);
    povezava.addEventListener("pointerleave", ustavi);
    povezava.addEventListener("focus", zacni);
    povezava.addEventListener("blur", ustavi);
  }
}

export function prihodKartic(izbirnik, { gsap, ScrollTrigger }) {
  if (mirno) return;
  ScrollTrigger.batch(izbirnik, {
    start: "top 92%",
    onEnter: (skupina) => gsap.to(skupina, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.08, overwrite: true }),
  });
}
