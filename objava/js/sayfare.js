// Stran Sayfare: isti svet, glava in naslov kot strani z besedilom, zraven
// prikaz nareka. Plošča ob zarezi snema (rdeča pika, val, ura), nato piše
// (vrtavka), na koncu kljukica in besedilo se vstavi v sporočilo naenkrat, kot
// v aplikaciji (⌘V). Krog se ponavlja, dokler je prikaz na zaslonu.
import "./besedilo.js";
import { mirno, promoPredvajalnik } from "./gibanje.js";

// Film: naslovna slika in gumb, ob kliku z zvokom. Med prihodom na zaslon se
// platno dvigne iz rahlega nagiba (kot kino na domači strani, le mirneje).
const film = document.querySelector("[data-sf-film]");
if (film) {
  promoPredvajalnik(film);
  if (!mirno && window.gsap) {
    window.gsap.fromTo(film, { scale: 0.88, rotationX: 14, y: 50, transformPerspective: 1600 },
      { scale: 1, rotationX: 0, y: 0, ease: "none",
        scrollTrigger: { trigger: film, start: "top bottom", end: "center 60%", scrub: true } });
  }
}

const prikaz = document.querySelector("[data-prikaz]");
const besedilo = prikaz?.querySelector("[data-prikaz-besedilo]");
const ura = prikaz?.querySelector("[data-otok-cas]");

if (prikaz && besedilo) {
  // besede v svoje razpone, da pridejo ena za drugo
  const celo = besedilo.dataset.celo;
  besedilo.replaceChildren(...celo.split(" ").flatMap((b, i) => {
    const s = document.createElement("span");
    s.className = "sf-beseda";
    s.style.setProperty("--i", i);
    s.textContent = b;
    return i ? [document.createTextNode(" "), s] : [s];
  }));

  const stanje = (s) => { prikaz.dataset.stanje = s; };
  if (mirno) {
    stanje("koncano");
  } else {
    let tece = false, casovniki = [], ozadje = null;
    const pocisti = () => { casovniki.forEach(clearTimeout); casovniki = []; clearInterval(ozadje); };
    const cez = (ms, fn) => casovniki.push(setTimeout(fn, ms));
    const krog = () => {
      pocisti();
      stanje("miruje");
      ura.textContent = "0:00";
      cez(700, () => {
        stanje("snema");
        const zacetek = performance.now();
        ozadje = setInterval(() => {
          const s = Math.floor((performance.now() - zacetek) / 1000);
          ura.textContent = `0:${String(s).padStart(2, "0")}`;
        }, 250);
      });
      cez(4700, () => { clearInterval(ozadje); stanje("pise"); });
      cez(5700, () => stanje("koncano"));
      cez(10500, () => stanje("pocisti"));
      cez(11300, () => { if (tece) krog(); });
    };
    new IntersectionObserver(([v]) => {
      if (v.isIntersecting && !tece) { tece = true; krog(); }
      else if (!v.isIntersecting && tece) { tece = false; pocisti(); stanje("koncano"); }
    }, { threshold: 0.3 }).observe(prikaz);
  }
}
