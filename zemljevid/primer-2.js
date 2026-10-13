// Primer 2 »Pot«: zemljevid Evrope iz pik, čez njega se nariše pot med kraji
// po vrsti potovanj; postaje so oštevilčene, pod zemljevidom je trak postaj.
import { podatki, risalnik, zatici, pokaziFilme, mnozina, obdobje } from "./skupno.js";

const { pike, kraji } = await podatki();
const vrstni = [...kraji].sort((a, b) => (a.od < b.od ? -1 : 1)); // prvo potovanje prvo
const obmocje = document.querySelector("[data-zemljevid]");
const r = risalnik(obmocje, pike);
const filmi = document.querySelector("[data-filmi]");
const pot = obmocje.querySelector("[data-pot]");
const senca = obmocje.querySelector("[data-pot-senca]");
const postaje = document.querySelector("[data-postaje]");
const z = zatici(obmocje, vrstni, r, izberi, { stevilke: true });
const EVROPA = [-14, 34, 35, 56];

// trak postaj
postaje.innerHTML = vrstni.map((k, i) =>
  `<li><button type="button" class="postaja" aria-pressed="false"><span class="postaja-st">${i + 1}</span>` +
  `<span class="postaja-kraj serif">${k.ime}</span><span class="postaja-cas">${obdobje(k.od, k.do)} · ${mnozina(k.filmi.length)}</span></button></li>`).join("");
const gumbi = [...postaje.querySelectorAll(".postaja")];
gumbi.forEach((g, i) => g.addEventListener("click", () => izberi(vrstni[i])));

function izberi(kraj) {
  z.aktiven(kraj);
  gumbi.forEach((g, i) => g.setAttribute("aria-pressed", String(vrstni[i] === kraj)));
  pokaziFilme(kraj, filmi);
}

// pot: lok med zaporednima krajema (kontrolna točka pravokotno na zveznico)
function narisiPot() {
  const t = vrstni.map((k) => r.zaslon(k.lon, k.lat));
  let d = `M ${t[0][0]} ${t[0][1]}`;
  for (let i = 1; i < t.length; i++) {
    const [x0, y0] = t[i - 1], [x1, y1] = t[i];
    const l = Math.hypot(x1 - x0, y1 - y0);
    // lok izmenično navzgor in navzdol, da se zaporedne poti ne prekrivajo
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + (i % 2 ? 0.26 : -0.26) * l;
    d += ` Q ${cx} ${cy} ${x1} ${y1}`;
  }
  pot.setAttribute("d", d); senca.setAttribute("d", d);
}
obmocje.addEventListener("narisano", narisiPot);

function postavi() { r.velikost(); Object.assign(r.pogled, r.okvir(...EVROPA)); r.narisi(); }
postavi();
addEventListener("resize", postavi);

// pot se nariše ob prihodu, postaje pridejo ena za drugo
const dolzina = pot.getTotalLength();
const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!mirno) {
  gsap.set([pot, senca], { strokeDasharray: dolzina, strokeDashoffset: dolzina });
  gsap.to([pot, senca], { strokeDashoffset: 0, duration: 2.8, ease: "power2.inOut", delay: 0.4 });
  gsap.from(z.elementi.map((e) => e.el), { autoAlpha: 0, scale: 0.6, transformOrigin: "7px 50%", duration: 0.8, ease: "expo.out", stagger: 0.7, delay: 0.5 });
  gsap.from(gumbi, { autoAlpha: 0, y: 12, duration: 0.8, ease: "expo.out", stagger: 0.1, delay: 0.8 });
}
izberi(vrstni[vrstni.length - 1]);
