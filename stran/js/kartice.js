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

// Nagib kartice ob miški: slika se rahlo nagne proti kazalcu in ujame sij
// (CSS --rx, --ry, --mx, --my). Le z miško in brez prefers-reduced-motion;
// predogled zanke ostane, kot je (potrjeno 18. 10. 2026).
export function nagibKartic(povezave) {
  if (mirno || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const a of povezave) {
    const slika = a.querySelector(".kartica-slika");
    if (!slika || a.dataset.nagibPripravljen) continue;
    a.dataset.nagibPripravljen = "";
    let okvir = 0;
    a.addEventListener("pointermove", (e) => {
      if (okvir) return;
      okvir = requestAnimationFrame(() => {
        okvir = 0;
        const r = slika.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        a.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
        a.style.setProperty("--rx", `${((0.5 - y) * 7).toFixed(2)}deg`);
        a.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        a.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        a.dataset.nagib = "";
      });
    });
    a.addEventListener("pointerleave", () => {
      cancelAnimationFrame(okvir); okvir = 0;
      delete a.dataset.nagib;
      a.style.removeProperty("--rx"); a.style.removeProperty("--ry");
    });
  }
}
