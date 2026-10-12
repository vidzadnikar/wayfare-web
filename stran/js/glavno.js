import { zazeniDrsenje, prikaziNaslove, promoPredvajalnik, znak, besede, mirno, svet } from "./gibanje.js";
import { sestavljanje } from "./sestavljanje.js";
import { prenos } from "./prenos.js";
import { zankeKartic, prihodKartic } from "./kartice.js";

const { gsap, ScrollTrigger, lenis } = zazeniDrsenje();
if (!mirno) document.documentElement.classList.add("gibanje");
const koren = document.querySelector('link[rel="icon"]').getAttribute("href").replace("media/logo.svg", "");

// 3D znak desno nad mestom: razmakne se pri kazalcu, z vlečenjem se vrti
znak(document.querySelector("[data-znak]"), {
  model: koren + "model/wayfare-znak-kosi.glb",
  notranjost: { barva: 0x64e2d6, sij: 1.6 },
  velikost: (w, h) => (w / h < 0.8 ? 0.6 : 0.42),
  zamik: (w, h) => (w / h < 0.8 ? [0, 0.24] : [0.22, 0.1]),
});

// uvod: video se odpre iz središča kot zaslonka (maska --iris), nato naslov po besedah
const naslov = document.querySelector("[data-naslov-uvod]");
const deli = besede(naslov);
if (!mirno) {
  gsap.timeline({ defaults: { ease: "expo.inOut" } })
    .fromTo("[data-hero-medij]", { "--iris": "1%" }, { "--iris": "260%", duration: 2.2 }, 0)
    .fromTo(".hero-ozadje", { scale: 1.18 }, { scale: 1.04, duration: 2.6, ease: "expo.out" }, 0)
    .fromTo("[data-uvod]", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 }, 1.0)
    .set(naslov, { autoAlpha: 1 }, 0.9)
    .from(deli, { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.05 }, 0.9);

  // ko hero odide: besedilo odplava hitreje od mesta, znak se dvigne in
  // pomanjša, video se počasi približa (globina z drsenjem)
  const izhod = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".hero-besedilo", { yPercent: -35, autoAlpha: 0, ease: "none", scrollTrigger: { ...izhod, end: "bottom 30%" } });
  gsap.to(".hero-znak", { yPercent: -22, scale: 0.82, ease: "none", scrollTrigger: izhod });
  gsap.fromTo(".hero-ozadje", { scale: 1.04 }, { scale: 1.22, ease: "none", immediateRender: false, scrollTrigger: izhod });

  trakMest();
  sestavljanje({ gsap, ScrollTrigger });

  // kino: med prihodom na zaslon se platno dvigne iz nagiba in zraste —
  // brez pripenjanja, stran ves čas teče naprej
  gsap.timeline({
    scrollTrigger: { trigger: "[data-kino]", start: "top bottom", end: "top top", scrub: true },
    defaults: { ease: "none" },
  })
    .fromTo(".kino-okvir", { scale: 0.7, rotationX: 24, y: 60, transformPerspective: 1600 },
      { scale: 1, rotationX: 0, y: 0, duration: 1, ease: "power2.inOut" }, 0)
    .to(".kino-naslov", { autoAlpha: 0, y: -30, duration: 0.45 }, 0.25)
    .fromTo("[data-kino-gumb]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0.85);

  svet({ gsap });
  razglednice();
}

// Razglednice priletijo od spodaj z vrtenjem, ko pride cilj na zaslon (scrub),
// nato ob nadaljnjem drsenju plavajo v globini. Z miško se rahlo premaknejo.
function razglednice() {
  const karte = [...document.querySelectorAll("[data-razglednica]")];
  karte.forEach((k, i) => {
    const globina = 0.6 + (i % 3) * 0.25;
    const levo = parseFloat(getComputedStyle(k).getPropertyValue("--x")) < 50;
    gsap.fromTo(k, { y: () => innerHeight * 0.5 * globina, x: levo ? -80 : 80, rotation: levo ? -25 : 25, autoAlpha: 0 },
      { y: 0, x: 0, rotation: 0, autoAlpha: 1, ease: "power3.out",
        scrollTrigger: { trigger: ".cilj", start: `top ${85 - i * 4}%`, end: "top 15%", scrub: 1.2, invalidateOnRefresh: true } });
  });
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  // globina kartice: bolj oddaljene se premaknejo manj (CSS --px/--py, prehod v CSS)
  const cilj = document.querySelector(".cilj");
  let okvir = 0;
  cilj.addEventListener("pointermove", (e) => {
    if (okvir) return;
    okvir = requestAnimationFrame(() => {
      okvir = 0;
      const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
      karte.forEach((k, i) => {
        const g = 14 + (i % 3) * 12;
        k.style.setProperty("--px", (-dx * g).toFixed(1));
        k.style.setProperty("--py", (-dy * g).toFixed(1));
      });
    });
  }, { passive: true });
}

// Trak mest: vrsti tečeta v nasprotnih smereh. Drsenje ju pospeši in nagne,
// drsenje navzgor obrne smer. Teče le, ko je trak na zaslonu.
function trakMest() {
  const tiri = [...document.querySelectorAll("[data-mesta] .mesta-vrsta")].map((v) => {
    const tir = v.querySelector(".mesta-tir");
    return { tir, smer: Number(v.dataset.smer), x: 0, polovica: tir.scrollWidth / 2,
      nagib: gsap.quickTo(tir, "skewX", { duration: 0.6, ease: "power3.out" }) };
  });
  const izmeri = () => tiri.forEach((t) => { t.polovica = t.tir.scrollWidth / 2; });
  addEventListener("resize", izmeri);
  document.fonts?.ready.then(izmeri);
  let vidno = false, hitrost = 0, nazaj = 1;
  ScrollTrigger.create({ trigger: "[data-mesta]", start: "top bottom", end: "bottom top", onToggle: (st) => { vidno = st.isActive; } });
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (st) => { hitrost = st.getVelocity(); nazaj = st.direction; } });
  gsap.ticker.add((_, dt) => {
    hitrost *= 0.92; // brez novih premikov hitrost hitro ugasne
    if (!vidno) return;
    const v = gsap.utils.clamp(-4000, 4000, hitrost);
    for (const t of tiri) {
      t.x = gsap.utils.wrap(-t.polovica, 0, t.x - t.smer * nazaj * (45 + Math.abs(v) * 0.15) * (dt / 1000));
      gsap.set(t.tir, { x: t.x });
      t.nagib(gsap.utils.clamp(-9, 9, v / 350) * t.smer);
    }
  });
}

prikaziNaslove("[data-naslov]", { gsap });
promoPredvajalnik(document.querySelector("[data-promo]"));

// filmi s poti: najnovejše kartice z zavihka Vlogi
zankeKartic(document.querySelectorAll("[data-vlog]"));
prihodKartic(".kartica", { gsap, ScrollTrigger });

// Claude: zavihka namestitve (vtičnik je privzet, ker ne rabi Node.js).
// Brez JS sta vidni obe poti; tu se skrije neizbrana.
const terminal = document.querySelector("[data-terminal]");
const zavihki = [...terminal.querySelectorAll("[data-zavihek]")];
const plosce = [...terminal.querySelectorAll("[data-plosca]")];
function izberiZavihek(i, fokus) {
  zavihki.forEach((z, k) => {
    z.setAttribute("aria-selected", String(k === i));
    z.tabIndex = k === i ? 0 : -1;
    plosce[k].hidden = k !== i;
  });
  if (fokus) zavihki[i].focus();
}
zavihki.forEach((z, i) => {
  z.addEventListener("click", () => izberiZavihek(i));
  z.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    izberiZavihek((i + (e.key === "ArrowRight" ? 1 : zavihki.length - 1)) % zavihki.length, true);
  });
});
izberiZavihek(0);

// terminal pride od spodaj, nato njegove vrstice po vrsti
if (!mirno) {
  gsap.timeline({ scrollTrigger: { trigger: terminal, start: "top 85%", toggleActions: "play none none none" } })
    .from(terminal, { y: 32, autoAlpha: 0, duration: 1.0, ease: "expo.out" })
    .from(terminal.querySelectorAll("[data-plosca]:not([hidden]) > p"), { y: 8, autoAlpha: 0, duration: 0.6, ease: "expo.out", stagger: 0.12 }, 0.25)
    .from(".claude-zahteve", { autoAlpha: 0, duration: 0.6, ease: "power1.out" }, 0.5);
}

// Gumb ob vsakem ukazu kopira ta ukaz. Odložišče ima 1 s časa (v nekaterih
// vgrajenih brskalnikih obljuba nikoli ne pride); nato ukaz izbere in poskusi
// execCommand. Če ne gre ne tako, ostane ukaz izbran za ⌘C.
async function vOdlozisce(koda) {
  try {
    await Promise.race([
      navigator.clipboard.writeText(koda.textContent.trim()),
      new Promise((_, ne) => setTimeout(() => ne(new Error("odložišče ne odgovori")), 1000)),
    ]);
    return true;
  } catch (e) {
    const izbor = getSelection();
    izbor.selectAllChildren(koda);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) {}
    if (ok) izbor.removeAllRanges();
    return ok;
  }
}
const kopirajStanje = terminal.querySelector("[data-kopiraj-stanje]");
for (const gumb of terminal.querySelectorAll("[data-kopiraj]")) {
  let cas;
  gumb.addEventListener("click", async () => {
    if (!(await vOdlozisce(document.getElementById(gumb.dataset.za)))) return;
    gumb.dataset.stanje = "kopirano";
    kopirajStanje.textContent = gumb.dataset.kopirano;
    clearTimeout(cas);
    cas = setTimeout(() => { delete gumb.dataset.stanje; kopirajStanje.textContent = ""; }, 2000);
  });
}

// izbira jezika se zapomni (angleška stran sicer slovenske obiskovalce preusmeri)
for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

prenos();
