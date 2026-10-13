// Primer 3 »Globus«: 3D globus s senčenim reliefom (Natural Earth Gray Earth,
// obarvan v barve strani), obalami in mejami držav kot črtami, zvezdami in potjo
// med kraji. Vrti se sam, z miško ali prstom ga vlečeš, približaš s koleščkom,
// prsti ali gumboma; klik na kraj ga obrne in približa. Vse gibanje gre skozi
// dušenje (damp), zato je gladko tudi ob sunkovitem vnosu.
import * as THREE from "../stran/js/knjiznice/three/three.module.min.js";
import { podatki, zatici, pokaziFilme } from "./skupno.js";

const [{ kraji }, glava, meje] = await Promise.all([
  podatki({ pike: false }),
  fetch("globus.json").then((r) => r.json()),
  fetch("meje.json").then((r) => r.json()),
]);
const obmocje = document.querySelector("[data-zemljevid]");
const canvas = obmocje.querySelector("canvas");
const filmi = document.querySelector("[data-filmi]");
const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;
const telefon = () => W < 640;
const { damp, clamp, smoothstep } = THREE.MathUtils;

// ---------------------------------------------------------------- prizor
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
const NAGIB = 0.61; // kamera gleda s severa (35°), da je Evropa na sredini
const globus = new THREE.Group();
scene.add(globus);

// relief: senčena karta sveta v barvah strani (ocean temen, kopno svetlejše), na telefonu manjša
const relief = new THREE.TextureLoader().load(innerWidth < 640 ? "relief-2048.webp" : "relief-4096.webp");
relief.colorSpace = THREE.SRGBColorSpace; relief.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const krogla = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), new THREE.MeshStandardMaterial({ map: relief, roughness: 1, metalness: 0 }));
globus.add(krogla); // UV krogle v Three.js se ujema s karto: lon −180 na −x, lon 0 na +x, kot tocka()
const luc = new THREE.DirectionalLight(0xffffff, 1.5); luc.position.set(-2, 2.5, 3); scene.add(luc);
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

// sij ob robu (fresnel na zadnji strani malo večje krogle)
globus.add(new THREE.Mesh(new THREE.SphereGeometry(1.07, 96, 64), new THREE.ShaderMaterial({
  transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { barva: { value: new THREE.Color(0x64e2d6) } },
  vertexShader: `varying vec3 n; varying vec3 p; void main(){ n = normalize(normalMatrix * normal); p = (modelViewMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * vec4(p,1.0); }`,
  fragmentShader: `uniform vec3 barva; varying vec3 n; varying vec3 p; void main(){ float f = pow(1.0 - abs(dot(normalize(-p), n)), 3.2); gl_FragColor = vec4(barva, f * 0.5); }`,
})));

const tocka = (lon, lat, r = 1) => {
  const fi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(fi) * Math.cos(th), r * Math.cos(fi), r * Math.sin(fi) * Math.sin(th));
};
const sprite = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(32, 32, 28, 0, 6.2832); x.fill();
  return new THREE.CanvasTexture(c);
})();

// meje držav: lomljenke po krogli, dolgi odseki razdeljeni, da sledijo ukrivljenosti
function crte(seznam, r, opacity) {
  const pos = [];
  for (const l of seznam) {
    for (let i = 2; i < l.length; i += 2) {
      const a = tocka(l[i - 2], l[i - 1], r), b = tocka(l[i], l[i + 1], r);
      const kot = a.angleTo(b), delov = Math.max(1, Math.ceil(kot / 0.02));
      let prej = a;
      for (let k = 1; k <= delov; k++) {
        const t = new THREE.Vector3().copy(a).lerp(b, k / delov).normalize().multiplyScalar(r);
        pos.push(prej.x, prej.y, prej.z, t.x, t.y, t.z); prej = t;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xefe9df, transparent: true, opacity });
  const o = new THREE.LineSegments(g, m);
  globus.add(o);
  return o;
}
const [okLon0, okLon1, okLat0, okLat1] = glava.okvir;
const vOkviru = (l) => { for (let i = 0; i < l.length; i += 2) if (l[i] >= okLon0 && l[i] <= okLon1 && l[i + 1] >= okLat0 && l[i + 1] <= okLat1) return true; return false; };
const obaleZunaj = crte(meje.obale.filter((l) => !vOkviru(l)), 1.003, 0.55);
const obaleZnotraj = crte(meje.obale.filter(vOkviru), 1.003, 0.55);
const obaleFino = crte(meje.obale_fino, 1.003, 0);
const mejeZunaj = crte(meje.svet.filter((l) => !vOkviru(l)), 1.003, 0.26);
const mejeZnotraj = crte(meje.svet.filter(vOkviru), 1.003, 0.26);
const mejeFino = crte(meje.fino, 1.003, 0);

// zvezde daleč zadaj, počasi plavajo
const zvezde = (() => {
  const n = 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, map: sprite, color: 0xefe9df, transparent: true, opacity: 0.55, alphaTest: 0.3, depthWrite: false }));
  scene.add(p);
  return p;
})();

// pot med kraji po vrsti potovanj: loki po velikem krogu, malo dvignjeni, po njih potuje iskra
const vrstni = [...kraji].sort((a, b) => (a.od < b.od ? -1 : 1));
const iskre = [];
for (let i = 1; i < vrstni.length; i++) {
  const a = tocka(vrstni[i - 1].lon, vrstni[i - 1].lat), b = tocka(vrstni[i].lon, vrstni[i].lat);
  const kot = a.angleTo(b), tocke = [];
  for (let k = 0; k <= 64; k++) {
    const t = k / 64;
    const v = new THREE.Vector3().copy(a).lerp(b, t).normalize().multiplyScalar(1.006 + Math.sin(t * Math.PI) * kot * 0.12);
    tocke.push(v);
  }
  globus.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tocke), new THREE.LineBasicMaterial({ color: 0x64e2d6, transparent: true, opacity: 0.45 })));
  const iskra = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), new THREE.MeshBasicMaterial({ color: 0x64e2d6 }));
  globus.add(iskra);
  iskre.push({ tocke, iskra, zamik: i * 0.33 });
}

// kraji: krogla in utripajoč obroč
const zaticiSvet = kraji.map((k) => {
  const p = tocka(k.lon, k.lat, 1.008);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 16), new THREE.MeshBasicMaterial({ color: 0x64e2d6 }));
  m.position.copy(p); globus.add(m);
  const o = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.023, 40), new THREE.MeshBasicMaterial({ color: 0x64e2d6, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  o.position.copy(p); o.lookAt(p.clone().multiplyScalar(2)); globus.add(o);
  return { kraj: k, p, krogla: m, obroc: o, faza: Math.random() * 3 };
});

// ---------------------------------------------------------------- oznake (HTML)
let W = 0, H = 0;
const r = { pogled: { k: 1000 }, zaslon(lon, lat) {
  const v = tocka(lon, lat, 1.01).applyMatrix4(globus.matrixWorld);
  const vidno = v.clone().normalize().dot(camera.position.clone().normalize()) > 0.18;
  const s = v.project(camera);
  return [(s.x + 1) / 2 * W, (1 - s.y) / 2 * H, vidno];
} };
const z = zatici(obmocje, kraji, r, izberi);
for (const e of z.elementi) { e.el.style.left = "0"; e.el.style.top = "0"; }
function postaviOznake() {
  // od daleč so kraji preblizu skupaj za imena: ime nosi le izbrani kraj (drugi ob kazalcu)
  const imena = d < 2.7;
  for (const e of z.elementi) {
    const [x, y, vidno] = r.zaslon(e.kraj.lon, e.kraj.lat);
    e.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    if (vidno) delete e.el.dataset.skrit; else e.el.dataset.skrit = "";
    if (imena || e.el.getAttribute("aria-pressed") === "true") delete e.el.dataset.brezImena; else e.el.dataset.brezImena = "";
  }
}

// ---------------------------------------------------------------- gibanje
// vrt: trenutni zasuk, cilj: kam gre; d: oddaljenost kamere, dCilj: kam gre
const vrt = { y: 0, x: 0 }, cilj = { y: 0, x: 0 };
// od daleč je globus visok ~80 % krajše stranice platna (zorni kot 30°)
const DALEC = () => 1 / Math.sin((telefon() ? 0.9 : 0.8) * Math.atan(Math.tan(camera.fov / 360 * Math.PI) * Math.min(1, W / H)));
const BLIZU = 1.3;
let d = 4.5, dCilj = 4.5;
const azimut = (k) => { const p = tocka(k.lon, k.lat); return Math.atan2(p.x, p.z); };
const nagibZa = (k) => k.lat * Math.PI / 180 - NAGIB; // zasuk x, pri katerem je kraj na sredini
cilj.y = vrt.y = -azimut({ lon: 12, lat: 46 }); cilj.x = vrt.x = 0;

let vlecenje = null, hitrost = 0, mirujeOd = 0, samodejno = 0, prsti = new Map(), razmik = 0, usmerjen = null;
const zdaj = () => performance.now();

function velikost() {
  const b = obmocje.getBoundingClientRect(); W = b.width; H = b.height;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
velikost(); addEventListener("resize", () => { velikost(); if (dCilj > 2.8) dCilj = DALEC(); });
dCilj = d = DALEC();

const gumbVse = obmocje.querySelector("[data-zoom='vse']");
function priblizaj(faktor) { dCilj = clamp(dCilj * faktor, BLIZU, DALEC()); mirujeOd = zdaj(); }
obmocje.querySelector("[data-zoom='in']").addEventListener("click", () => priblizaj(0.7));
obmocje.querySelector("[data-zoom='out']").addEventListener("click", () => priblizaj(1 / 0.7));
gumbVse.addEventListener("click", () => { dCilj = DALEC(); usmerjen = null; gsap.to(cilj, { x: 0, duration: 1.2, ease: "expo.inOut", overwrite: true }); mirujeOd = zdaj(); });
// Navaden kolešček drsi po strani naprej, da globus ne ujame obiskovalca; približuje
// le s ⌘/Ctrl + koleščkom (ščip na sledilni ploščici pride kot kolešček s ctrlKey).
const namig = obmocje.querySelector("[data-namig]");
let namigDo = 0;
namig.textContent = `Približaj z ${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} + koleščkom ali s ščipom`;
obmocje.addEventListener("wheel", (e) => {
  if (!(e.ctrlKey || e.metaKey)) { namig.hidden = false; namigDo = zdaj() + 1400; return; }
  e.preventDefault();
  priblizaj(Math.exp(clamp(e.deltaY, -60, 60) * 0.004));
}, { passive: false });

obmocje.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  obmocje.setPointerCapture(e.pointerId);
  prsti.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (prsti.size === 1) { vlecenje = { x: e.clientX, y: e.clientY, cy: cilj.y, cx: cilj.x, t: zdaj(), vy: 0 }; obmocje.dataset.vlecenje = ""; }
  else { vlecenje = null; razmik = razmikPrstov(); }
  gsap.killTweensOf(cilj); usmerjen = null; hitrost = 0; samodejno = 0; mirujeOd = zdaj();
});
function razmikPrstov() { const [a, b] = [...prsti.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
obmocje.addEventListener("pointermove", (e) => {
  if (!prsti.has(e.pointerId)) return;
  prsti.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (prsti.size >= 2) { // ščip
    const nov = razmikPrstov();
    if (razmik > 0) dCilj = clamp(dCilj * razmik / nov, BLIZU, DALEC());
    razmik = nov; return;
  }
  if (!vlecenje) return;
  const obcutljivost = 0.0062 * (d - 1) / 2.1; // bliže je, manj se zavrti na slikovno piko
  const ny = vlecenje.cy + (e.clientX - vlecenje.x) * obcutljivost;
  const t = zdaj(); vlecenje.vy = (ny - cilj.y) / Math.max(1, t - vlecenje.t) * 16; vlecenje.t = t;
  cilj.y = ny;
  cilj.x = clamp(vlecenje.cx + (e.clientY - vlecenje.y) * obcutljivost, -0.7, 0.7);
  mirujeOd = t;
});
function konec(e) {
  prsti.delete(e.pointerId);
  if (vlecenje && zdaj() - vlecenje.t < 80) hitrost = clamp(vlecenje.vy, -0.12, 0.12); // iztek po hitrem vlečenju
  vlecenje = null; delete obmocje.dataset.vlecenje; razmik = 0; mirujeOd = zdaj();
}
obmocje.addEventListener("pointerup", konec); obmocje.addEventListener("pointercancel", konec);

function izberi(kraj) {
  z.aktiven(kraj);
  pokaziFilme(kraj, filmi);
  let ky = -azimut(kraj);
  while (ky - cilj.y > Math.PI) ky -= 2 * Math.PI;
  while (ky - cilj.y < -Math.PI) ky += 2 * Math.PI;
  usmerjen = kraj; hitrost = 0; samodejno = 0;
  gsap.to(cilj, { y: ky, x: nagibZa(kraj), duration: mirno ? 0 : 1.5, ease: "expo.inOut", overwrite: true });
  dCilj = telefon() ? 1.95 : 1.75;
  mirujeOd = zdaj() + 3000;
}

// ---------------------------------------------------------------- sličica
let zadnji = 0;
function slika(t) {
  const dt = Math.min(0.05, (t - zadnji) / 1000 || 0.016); zadnji = t;
  // samodejno vrtenje: po premoru se hitrost mehko dvigne; blizu kraja ga ni
  const prost = !vlecenje && prsti.size === 0 && !usmerjen && t > mirujeOd + 2500 && !mirno;
  const hitrostVrtenja = 0.055 * clamp((d - 1.5) / 1.4, 0, 1);
  samodejno = damp(samodejno, prost ? hitrostVrtenja : 0, 1.5, dt);
  cilj.y += samodejno * dt;
  if (Math.abs(hitrost) > 1e-4) { cilj.y += hitrost; hitrost *= Math.pow(0.08, dt); }
  vrt.y = damp(vrt.y, cilj.y, vlecenje ? 18 : 7, dt);
  vrt.x = damp(vrt.x, cilj.x, vlecenje ? 18 : 7, dt);
  d = damp(d, dCilj, 6, dt);

  globus.rotation.set(vrt.x, vrt.y, 0);
  globus.updateMatrixWorld();
  camera.position.set(0, Math.sin(NAGIB) * d, Math.cos(NAGIB) * d); camera.lookAt(0, 0, 0);
  zvezde.rotation.y += 0.004 * dt;

  // v okvirju krajev ob približanju grobe črte (110m) zamenjajo podrobne (50m)
  const fino = 1 - smoothstep(d, 1.7, 2.2);
  obaleZnotraj.material.opacity = 0.55 * (1 - fino); obaleFino.material.opacity = 0.6 * fino;
  mejeZnotraj.material.opacity = 0.26 * (1 - fino); mejeFino.material.opacity = 0.3 * fino;
  gumbVse.hidden = d > DALEC() * 0.75;
  if (!namig.hidden && t > namigDo) namig.hidden = true;

  // obroči krajev utripajo, iskre potujejo po poti; vse se z bližino manjša, da ostane enako veliko na zaslonu
  const merilo = clamp((d - 1) / 3.2, 0.1, 1);
  for (const o of zaticiSvet) {
    const f = ((t / 1000 + o.faza) % 2.8) / 2.8;
    o.obroc.scale.setScalar((0.6 + f * 2.2) * merilo); o.obroc.material.opacity = 0.8 * (1 - f);
    o.krogla.scale.setScalar(merilo);
  }
  for (const i of iskre) {
    const f = ((t / 1000 * 0.12 + i.zamik) % 1), k = f * 64, a = i.tocke[Math.floor(k)], b = i.tocke[Math.min(64, Math.floor(k) + 1)];
    i.iskra.position.copy(a).lerp(b, k - Math.floor(k)); i.iskra.scale.setScalar(merilo);
  }

  renderer.render(scene, camera);
  postaviOznake();
  requestAnimationFrame(slika);
}
requestAnimationFrame(slika);
izberi(kraji[0]);
dCilj = DALEC(); usmerjen = null; // ob prihodu ostane pogled od daleč, kraj je le izbran
mirujeOd = zdaj();

// za preizkuse doma: ena sličica na ukaz, ko okno ne teče (requestAnimationFrame stoji)
if (location.hostname === "localhost") window.__globus = { slika: () => slika(performance.now()), vrt, cilj, stanje: () => ({ d, dCilj }), priblizaj, kraji };
