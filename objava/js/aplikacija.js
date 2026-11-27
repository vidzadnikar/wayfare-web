// Razdelek Aplikacija (27. 11. 2026): namesto vmesnika, ki se je ob drsenju
// sestavljal iz zamegljenih kosov čez deset zaslonov, en oster zaslon in mreža
// ploščic.
//
//   razkritje  zaslon Wayfare Studia je nagnjen nazaj in se med prihodom na
//              zaslon zravna (scrub, brez pripenjanja); ko je raven, ga enkrat
//              preleti odsev stekla. Z miško se rahlo nagiba.
//   predogledi videi z data-predogled se naložijo blizu zaslona in tečejo le,
//              ko so vidni (v predogledu okna teče pravi vlog).
//   ploščice   priletijo, ko pridejo na zaslon; sij sledi kazalcu.
//   kup        posnetki s kupa poletijo v sled časovnice, po času snemanja.
//   ukaz       stavek se natipka, posnetek 14 se skrajša, pride potrdilo.
//
// Pri prefers-reduced-motion (mirno) je vse v končnem stanju, videi ne tečejo
// sami. Brez JS prav tako: CSS skrije kup in prazen ukaz le pod razredom .gibanje.

export function aplikacija({ gsap, ScrollTrigger, mirno }) {
  const odsek = document.querySelector("#aplikacija");
  if (!odsek) return;
  predogledi(odsek, mirno);
  ploscice(odsek, mirno);
  kup(odsek.querySelector("[data-kup]"), { ScrollTrigger, mirno });
  ukaz(odsek.querySelector("[data-ukaz-prizor]"), { ScrollTrigger, mirno });
  if (!mirno) razkritje(odsek, { gsap });
}

function razkritje(odsek, { gsap }) {
  const ovoj = odsek.querySelector("[data-razkritje-ovoj]");
  const okno = odsek.querySelector("[data-okno]");
  const sij = odsek.querySelector(".razkritje-sij");
  const ozko = matchMedia("(max-width: 640px)").matches;
  gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: odsek.querySelector("[data-razkritje]"), start: "top 92%", end: ozko ? "top 40%" : "top 18%", scrub: 0.7,
      onUpdate: (st) => { if (st.progress > 0.94 && !okno.hasAttribute("data-sij")) okno.setAttribute("data-sij", ""); },
    },
  })
    .fromTo(ovoj, { rotationX: ozko ? 22 : 30, scale: 0.86, yPercent: 8, transformPerspective: 1800 },
      { rotationX: 0, scale: 1, yPercent: 0, ease: "power2.out" }, 0)
    .fromTo(sij, { opacity: 0, scale: 0.7 }, { opacity: 0.55, scale: 1 }, 0);

  // rahel nagib za kazalcem, ko je okno že ravno (ločen element od scrub)
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const rx = gsap.quickTo(okno, "rotationX", { duration: 0.8, ease: "power3.out" });
  const ry = gsap.quickTo(okno, "rotationY", { duration: 0.8, ease: "power3.out" });
  gsap.set(okno, { transformPerspective: 2400 });
  const obmocje = odsek.querySelector("[data-razkritje]");
  obmocje.addEventListener("pointermove", (e) => {
    const r = obmocje.getBoundingClientRect();
    ry(((e.clientX - r.left) / r.width - 0.5) * 4);
    rx(-((e.clientY - r.top) / r.height - 0.5) * 3);
  }, { passive: true });
  obmocje.addEventListener("pointerleave", () => { rx(0); ry(0); });
}

// Videi tečejo le na zaslonu; naložijo se 400 px prej. Pri mirno ostane plakat.
function predogledi(odsek, mirno) {
  const videi = [...odsek.querySelectorAll("video[data-predogled]")];
  if (mirno || !("IntersectionObserver" in window)) return;
  const blizu = new IntersectionObserver((vnosi) => {
    for (const v of vnosi) {
      if (!v.isIntersecting) continue;
      const video = v.target;
      if (!video.src) { video.src = video.dataset.src; video.load(); }
      blizu.unobserve(video);
    }
  }, { rootMargin: "400px 0px" });
  const vidno = new IntersectionObserver((vnosi) => {
    for (const v of vnosi) {
      const video = v.target;
      if (v.isIntersecting) {
        if (!video.src) { video.src = video.dataset.src; video.load(); }
        video.play().catch(() => {});
      } else video.pause();
    }
  }, { threshold: 0.25 });
  for (const v of videi) { blizu.observe(v); vidno.observe(v); }
}

function ploscice(odsek, mirno) {
  const vse = [...odsek.querySelectorAll("[data-ploscica]")];
  if (!mirno && "IntersectionObserver" in window) {
    const opazovalec = new IntersectionObserver((vnosi) => {
      // ploščice, ki pridejo hkrati, priletijo ena za drugo
      vnosi.filter((v) => v.isIntersecting).forEach((v, i) => {
        v.target.style.setProperty("--zamik", i);
        v.target.setAttribute("data-vidna", "");
        opazovalec.unobserve(v.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    vse.forEach((p) => opazovalec.observe(p));
  } else vse.forEach((p) => p.setAttribute("data-vidna", ""));

  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const p of vse) {
    p.addEventListener("pointermove", (e) => {
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", `${e.clientX - r.left}px`);
      p.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  }
}

// Kup posnetkov: ob vsakem prihodu na zaslon se razsuje in znova zloži.
function kup(prizor, { ScrollTrigger, mirno }) {
  if (!prizor) return;
  if (mirno) { prizor.setAttribute("data-zlozeno", ""); return; }
  let cas = 0;
  const zlozi = () => {
    clearTimeout(cas);
    prizor.removeAttribute("data-zlozeno");
    cas = setTimeout(() => prizor.setAttribute("data-zlozeno", ""), 650);
  };
  ScrollTrigger.create({ trigger: prizor, start: "top 78%", end: "bottom 10%", onEnter: zlozi, onEnterBack: zlozi });
}

// Ukaz z enim stavkom: natipka se, nato se posnetek 14 skrajša in pride potrdilo.
function ukaz(prizor, { ScrollTrigger, mirno }) {
  if (!prizor) return;
  const polje = prizor.querySelector("[data-ukaz]");
  const tekst = prizor.querySelector("[data-ukaz-tekst]");
  const namig = prizor.querySelector("[data-ukaz-namig]");
  const besedilo = polje.dataset.besedilo;
  if (mirno) {
    namig.hidden = true; tekst.textContent = besedilo; prizor.setAttribute("data-narejeno", "");
    return;
  }
  let tek = 0;
  const pocakaj = (ms) => new Promise((r) => setTimeout(r, ms));
  async function predvajaj() {
    const moj = ++tek;
    prizor.removeAttribute("data-narejeno");
    tekst.textContent = ""; namig.hidden = false;
    await pocakaj(700);
    if (moj !== tek) return;
    namig.hidden = true;
    for (const crka of besedilo) {
      tekst.textContent += crka;
      await pocakaj(45 + Math.random() * 45);
      if (moj !== tek) return;
    }
    await pocakaj(450);
    if (moj === tek) prizor.setAttribute("data-narejeno", "");
  }
  ScrollTrigger.create({ trigger: prizor, start: "top 80%", end: "bottom 10%", onEnter: predvajaj, onEnterBack: predvajaj });
}
