// Gibanje strani: en sam gladek drsnik (Lenis), povezan z
// GSAP ScrollTrigger, razbijanje naslovov na besede in predvajanje videov.
// GSAP, ScrollTrigger in Lenis pridejo kot globalni skripti (window.gsap ...).
//
// Pod prefers-reduced-motion ni gladkega drsenja ne vezanih animacij:
// vse se takoj pokaže v končnem stanju.

export const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function zazeniDrsenje() {
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("js");
  if (mirno || !Lenis) return { lenis: null, gsap, ScrollTrigger };
  // wheelMultiplier/touchMultiplier < 1: en zasuk koleščka premakne stran manj (mirnejše drsenje)
  const lenis = new Lenis({
    duration: 1.35, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true,
    wheelMultiplier: 0.7, touchMultiplier: 0.85,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  // povezave na sidra gredo skozi Lenis, da drsenje ostane gladko
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const cilj = document.querySelector(a.getAttribute("href"));
    if (!cilj) return;
    e.preventDefault();
    lenis.resize(); // višina strani se po nalaganju medijev spremeni; brez tega skok obstane prej
    lenis.scrollTo(cilj, { offset: 0 });
    history.replaceState(null, "", a.getAttribute("href"));
  });
  // pisave in mediji spremenijo višine; meritve osveži, ko se naložijo
  document.fonts?.ready.then(() => { lenis.resize(); ScrollTrigger.refresh(); });
  addEventListener("load", () => { lenis.resize(); ScrollTrigger.refresh(); });
  return { lenis, gsap, ScrollTrigger };
}

// Naslov razbije na besede za zamaknjen prikaz. Bralniki zaslona dobijo cel
// stavek (aria-label), razbite besede so zanje skrite. Brez JS ostane besedilo.
export function besede(el) {
  if (el.dataset.razbito) return [...el.querySelectorAll(".beseda > span")];
  const besedilo = el.textContent.trim().replace(/\s+/g, " ");
  el.setAttribute("aria-label", besedilo);
  const deli = [];
  const vrste = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = "";
  vrste.forEach((vrsta, i) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = vrsta;
    // ohrani <em> in podobno okrasno oznako v besedah
    const vozlisca = [...tmp.childNodes];
    for (const v of vozlisca) {
      const ovoj = v.nodeType === 1 ? v.cloneNode(false) : null;
      for (const b of v.textContent.split(/(\s+)/)) {
        if (!b) continue;
        if (/^\s+$/.test(b)) { el.appendChild(document.createTextNode(" ")); continue; }
        const zunaj = document.createElement("span");
        zunaj.className = "beseda";
        zunaj.setAttribute("aria-hidden", "true");
        const notri = document.createElement("span");
        if (ovoj) { const o = ovoj.cloneNode(false); o.textContent = b; notri.appendChild(o); }
        else notri.textContent = b;
        zunaj.appendChild(notri);
        el.appendChild(zunaj);
        deli.push(notri);
      }
    }
    if (i < vrste.length - 1) el.appendChild(document.createElement("br"));
  });
  el.dataset.razbito = "1";
  return deli;
}

// Prikaz naslova po besedah, ko pride v pogled. Odigra se enkrat; namesto
// once: true je toggleActions, ker se ScrollTrigger 3.15 ob ponovnem nalaganju
// sredi strani zlomi, ko se že sproženi sprožilec ubije med osveževanjem.
export function prikaziNaslove(izbirnik, { gsap }, nastavitve = {}) {
  for (const el of document.querySelectorAll(izbirnik)) {
    const deli = besede(el);
    if (mirno) continue;
    gsap.from(deli, {
      yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.045,
      scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
      ...nastavitve,
    });
  }
}

// Utišane zanke tečejo le, ko so v pogledu (varčno z baterijo in procesorjem).
export function zankeVPogledu(izbirnik = "video[data-zanka]") {
  const videi = [...document.querySelectorAll(izbirnik)];
  const opazovalec = new IntersectionObserver((vnosi) => {
    for (const v of vnosi) {
      const el = v.target;
      if (v.isIntersecting) {
        if (!el.src && el.dataset.src) el.src = el.dataset.src;
        if (!mirno) el.play().catch(() => {});
      } else el.pause();
    }
  }, { rootMargin: "200px 0px" });
  videi.forEach((v) => { v.muted = true; v.playsInline = true; v.loop = true; opazovalec.observe(v); });
  return opazovalec;
}

// Promo z zvokom: najprej naslovna slika in gumb, ob kliku video z zvokom.
export function promoPredvajalnik(okvir) {
  const video = okvir.querySelector("video");
  const gumb = okvir.querySelector("[data-predvajaj]");
  if (!video || !gumb) return;
  gumb.addEventListener("click", () => {
    okvir.dataset.stanje = "nalaga";
    video.muted = false;
    video.controls = true;
    video.play().then(() => { okvir.dataset.stanje = "tece"; video.focus({ preventScroll: true }); })
      .catch((napaka) => {
        // brskalnik ni dovolil predvajanja (ni bilo klika): gumb ostane, ni napaka
        okvir.dataset.stanje = napaka?.name === "NotAllowedError" ? "pripravljen" : "napaka";
        if (okvir.dataset.stanje === "pripravljen") video.controls = false;
      });
  });
  video.addEventListener("ended", () => { okvir.dataset.stanje = "konec"; });
  video.addEventListener("error", () => { okvir.dataset.stanje = "napaka"; });
}

// 3D znak naloži lenobno; ob napaki (brez WebGL) ostane statična slika znaka.
export async function znak(vsebnik, nastavitve) {
  try {
    const { ustvariZnak } = await import("./znak.js");
    const z = await ustvariZnak({ vsebnik, ...nastavitve });
    // za preizkuse v skritem oknu (simuliraj); na objavljeni strani ga ni
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__znak = z;
    return z;
  } catch (e) {
    vsebnik.dataset.znak = "napaka";
    console.warn("3D znak ni na voljo:", e);
    return null;
  }
}

// Luči sveta potujejo z drsenjem: na vrhu turkizna levo zgoraj, v aplikaciji
// vijolična, pri cilju se obe zbereta okoli gumba za prenos (kot zora na cilju).
export function svet({ gsap }) {
  const [l1, l2, l3] = document.querySelectorAll("[data-luc]");
  gsap.timeline({
    scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.5 },
    defaults: { ease: "sine.inOut" },
  })
    .to(l1, { x: "70vw", y: "55vh", scale: 1.2, duration: 1 }, 0)
    .to(l2, { x: "12vw", y: "30vh", scale: 1.3, duration: 1 }, 0)
    .to(l3, { x: "45vw", y: "60vh", scale: 0.9, duration: 1 }, 0)
    .to(l1, { x: "30vw", y: "40vh", scale: 0.9, duration: 1 }, 1)
    .to(l2, { x: "80vw", y: "65vh", scale: 1, duration: 1 }, 1)
    .to(l3, { x: "50vw", y: "45vh", scale: 1.6, duration: 1 }, 1);

  // mehka luč sledi kazalcu (samo z miško)
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const kazalec = document.querySelector("[data-kazalec]");
  const x = gsap.quickTo(kazalec, "x", { duration: 1.1, ease: "power3.out" });
  const y = gsap.quickTo(kazalec, "y", { duration: 1.1, ease: "power3.out" });
  addEventListener("pointermove", (e) => { x(e.clientX); y(e.clientY); kazalec.dataset.vidno = ""; }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => delete kazalec.dataset.vidno);
}
