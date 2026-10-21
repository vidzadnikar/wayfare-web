// Zemljevid krajev s filmi: 3D globus (Three.js) kot reliefni globus na papirju
// (od 21. 10. 2026: relief iz višin NASA GEBCO v barvah Svinčnik, zemljevid/relief.py),
// obale in meje držav kot grafitne črte, rdeča pot med kraji po vrsti
// potovanj. Vrti se sam, z miško ali prstom ga vlečeš; približaš z gumboma, s
// ščipom ali s ⌘/Ctrl + koleščkom (navaden kolešček drsi po strani naprej, da
// globus ne ujame obiskovalca); klik na kraj ga obrne in približa ter pod
// zemljevidom pokaže filme od tam. Vse gibanje gre skozi dušenje, zato je gladko.
// Podatki (kraji s koordinatami, filmi kot kartice) so v
// <script type="application/json" id="zemljevid-podatki"> iz zgradi.py; relief in
// črte so v media/zemljevid/. Zažene se šele, ko se odsek približa oknu.
import * as THREE from "three";
import { zankeKartic, nagibKartic } from "./kartice.js";

export function zemljevid(obmocje, { gsap, koren }) {
  if (!obmocje) return;
  const podatki = JSON.parse(document.getElementById("zemljevid-podatki").textContent);
  const kraji = podatki.kraji;
  if (!kraji.length) { obmocje.closest("[data-zemljevid-odsek]").hidden = true; return; }
  const odsek = obmocje.closest("[data-zemljevid-odsek]");
  const filmi = odsek.querySelector("[data-filmi]");
  const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);

  // filmi izbranega kraja (kartice so vnaprej zgrajene v podatkih)
  function pokaziFilme(kraj) {
    const naslov = filmi.querySelector("[data-filmi-naslov]"), opis = filmi.querySelector("[data-filmi-opis]"), seznam = filmi.querySelector("[data-filmi-kartice]");
    naslov.textContent = kraj.ime; opis.textContent = kraj.opis; seznam.innerHTML = kraj.kartice;
    zankeKartic(seznam.querySelectorAll("[data-vlog]"));
    nagibKartic(seznam.querySelectorAll(".kartica-povezava"));
    gsap.fromTo([naslov, opis, ...seznam.children], { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: mirno ? 0 : 0.7, stagger: mirno ? 0 : 0.06, ease: "expo.out", overwrite: true });
  }

  // zatiči: gumb stoji na kraju (pika na točki, ime ob njej)
  const ovoj = obmocje.querySelector(".zatici");
  const zatici = kraji.map((kraj) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "zatic" + (kraj.stran ? ` zatic-${kraj.stran}` : ""); b.setAttribute("aria-pressed", "false");
    const pika = `<span class="zatic-pika"></span>`, ime = `<span class="zatic-ime">${kraj.ime}</span>`;
    b.innerHTML = kraj.stran === "levo" ? ime + pika : pika + ime;
    b.dataset.skrit = "";
    b.addEventListener("click", () => izberi(kraj));
    ovoj.appendChild(b);
    return { kraj, el: b };
  });
  const aktiven = (kraj) => { for (const z of zatici) z.el.setAttribute("aria-pressed", String(z.kraj === kraj)); };

  let izberi = (kraj) => { aktiven(kraj); pokaziFilme(kraj); }; // pred zagonom globusa le seznam
  izberi(kraji[0]);

  // brez WebGL ostane seznam filmov, zemljevid se skrije
  let zagnan = false;
  function zazeni() {
    if (zagnan) return; zagnan = true;
    try { globus(); } catch (e) { obmocje.hidden = true; odsek.querySelector("[data-zemljevid-namig]")?.remove(); }
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((v) => { if (v.some((x) => x.isIntersecting)) { io.disconnect(); zazeni(); } }, { rootMargin: "600px 0px" });
    io.observe(obmocje);
  } else zazeni();

  function globus() {
    const canvas = obmocje.querySelector("canvas");
    const { damp, clamp, smoothstep } = THREE.MathUtils;
    const telefon = () => W < 640;
    const zdaj = () => performance.now();
    let W = 0, H = 0;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    const NAGIB = 0.61; // kamera gleda s severa (35°), da je Evropa na sredini
    const skupina = new THREE.Group();
    scene.add(skupina);

    // relief: senčena karta sveta v barvah strani, na telefonu manjša; UV krogle se ujema s tocka()
    const relief = new THREE.TextureLoader().load(koren + (innerWidth < 640 ? "media/zemljevid/relief-4096.webp" : "media/zemljevid/relief-8192.webp"));
    relief.colorSpace = THREE.SRGBColorSpace; relief.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    skupina.add(new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), new THREE.MeshStandardMaterial({ map: relief, roughness: 1, metalness: 0 })));
    // luč z leve zgoraj kot okno ob mizi; ambient je močan, da ostane tudi senčna stran papirnata
    const luc = new THREE.DirectionalLight(0xfff8ef, 1.35); luc.position.set(-2.2, 2.4, 3); scene.add(luc);
    scene.add(new THREE.AmbientLight(0xffffff, 1.85));

    // mehka senca pod globusom: krog z mehkim robom za kroglo, malo pod njo na zaslonu
    const senca = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true, map: (() => {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const x = c.getContext("2d"), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, "rgba(26,26,28,0.30)"); g.addColorStop(0.72, "rgba(26,26,28,0.20)"); g.addColorStop(1, "rgba(26,26,28,0)");
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })() }));
    senca.scale.setScalar(2.55); senca.renderOrder = -1;
    scene.add(senca);

    const tocka = (lon, lat, r = 1) => {
      const fi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(fi) * Math.cos(th), r * Math.cos(fi), r * Math.sin(fi) * Math.sin(th));
    };

    // črte po krogli: dolgi odseki razdeljeni, da sledijo ukrivljenosti
    function crte(seznam, r, opacity) {
      const pos = [];
      for (const l of seznam) {
        for (let i = 2; i < l.length; i += 2) {
          const a = tocka(l[i - 2], l[i - 1], r), b = tocka(l[i], l[i + 1], r);
          const delov = Math.max(1, Math.ceil(a.angleTo(b) / 0.02));
          let prej = a;
          for (let k = 1; k <= delov; k++) {
            const t = new THREE.Vector3().copy(a).lerp(b, k / delov).normalize().multiplyScalar(r);
            pos.push(prej.x, prej.y, prej.z, t.x, t.y, t.z); prej = t;
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1a1c, transparent: true, opacity }));
      skupina.add(o);
      return o;
    }
    let obaleZnotraj, obaleFino, mejeZnotraj, mejeFino;
    const OBALE = 0.32, MEJE = 0.16;  // grafitne črte na reliefu, meje tišje od obal
    fetch(koren + "media/zemljevid/meje.json").then((r) => r.json()).then((meje) => {
      const [l0, l1, b0, b1] = meje.okvir;
      const vOkviru = (l) => { for (let i = 0; i < l.length; i += 2) if (l[i] >= l0 && l[i] <= l1 && l[i + 1] >= b0 && l[i + 1] <= b1) return true; return false; };
      crte(meje.obale.filter((l) => !vOkviru(l)), 1.003, OBALE);
      obaleZnotraj = crte(meje.obale.filter(vOkviru), 1.003, OBALE);
      obaleFino = crte(meje.obale_fino, 1.003, 0);
      crte(meje.svet.filter((l) => !vOkviru(l)), 1.003, MEJE);
      mejeZnotraj = crte(meje.svet.filter(vOkviru), 1.003, MEJE);
      mejeFino = crte(meje.fino, 1.003, 0);
    }).catch(() => {});

    // pot med kraji po vrsti potovanj: loki po velikem krogu, malo dvignjeni, po njih potuje iskra
    const vrstni = [...kraji].sort((a, b) => (a.od < b.od ? -1 : 1));
    const iskre = [];
    for (let i = 1; i < vrstni.length; i++) {
      const a = tocka(vrstni[i - 1].lon, vrstni[i - 1].lat), b = tocka(vrstni[i].lon, vrstni[i].lat);
      const kot = a.angleTo(b), tocke = [];
      for (let k = 0; k <= 64; k++) { const t = k / 64; tocke.push(new THREE.Vector3().copy(a).lerp(b, t).normalize().multiplyScalar(1.006 + Math.sin(t * Math.PI) * kot * 0.12)); }
      skupina.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tocke), new THREE.LineBasicMaterial({ color: 0xff453a, transparent: true, opacity: 0.75 })));
      const iskra = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff453a }));
      skupina.add(iskra);
      iskre.push({ tocke, iskra, zamik: i * 0.33 });
    }

    // kraji: krogla in utripajoč obroč
    const kroglice = kraji.map((k) => {
      const p = tocka(k.lon, k.lat, 1.008);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff453a }));
      m.position.copy(p); skupina.add(m);
      const o = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.023, 40), new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      o.position.copy(p); o.lookAt(p.clone().multiplyScalar(2)); skupina.add(o);
      return { kraj: k, krogla: m, obroc: o, faza: Math.random() * 3 };
    });

    // oznake: položaj iz projekcije, skrite na zadnji strani; od daleč ima ime le izbrani kraj
    function postaviOznake() {
      const imena = d < 2.7;
      for (const z of zatici) {
        const v = tocka(z.kraj.lon, z.kraj.lat, 1.01).applyMatrix4(skupina.matrixWorld);
        const vidno = v.clone().normalize().dot(camera.position.clone().normalize()) > 0.18;
        const s = v.project(camera);
        z.el.style.translate = `${((s.x + 1) / 2 * W).toFixed(1)}px ${((1 - s.y) / 2 * H).toFixed(1)}px`;
        if (vidno) delete z.el.dataset.skrit; else z.el.dataset.skrit = "";
        if (imena || z.el.getAttribute("aria-pressed") === "true") delete z.el.dataset.brezImena; else z.el.dataset.brezImena = "";
      }
    }

    // gibanje: vrt je trenutni zasuk, cilj kam gre; d oddaljenost kamere, dCilj kam gre
    const vrt = { y: 0, x: 0 }, cilj = { y: 0, x: 0 };
    const DALEC = () => 1 / Math.sin((telefon() ? 0.9 : 0.8) * Math.atan(Math.tan(camera.fov / 360 * Math.PI) * Math.min(1, W / H)));
    const BLIZU = 1.3;
    const azimut = (k) => { const p = tocka(k.lon, k.lat); return Math.atan2(p.x, p.z); };
    const nagibZa = (k) => k.lat * Math.PI / 180 - NAGIB;
    cilj.y = vrt.y = -azimut({ lon: 12, lat: 46 });
    let d = 4.5, dCilj = 4.5, vlecenje = null, hitrost = 0, mirujeOd = 0, samodejno = 0, razmik = 0, usmerjen = null;
    const prsti = new Map();

    function velikost() {
      const b = obmocje.getBoundingClientRect(); W = b.width; H = b.height;
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    velikost(); dCilj = d = DALEC();
    addEventListener("resize", () => { const dalec = dCilj >= DALEC() * 0.95; velikost(); if (dalec) dCilj = DALEC(); });

    const gumbVse = obmocje.querySelector("[data-zoom='vse']");
    const namig = obmocje.querySelector("[data-namig]");
    let namigDo = 0;
    namig.textContent = podatki.besedila.kolescek.replace("%tipka%", mac ? "⌘" : "Ctrl");
    function priblizaj(faktor) { dCilj = clamp(dCilj * faktor, BLIZU, DALEC()); mirujeOd = zdaj(); }
    obmocje.querySelector("[data-zoom='in']").addEventListener("click", () => priblizaj(0.7));
    obmocje.querySelector("[data-zoom='out']").addEventListener("click", () => priblizaj(1 / 0.7));
    gumbVse.addEventListener("click", () => { dCilj = DALEC(); usmerjen = null; gsap.to(cilj, { x: 0, duration: mirno ? 0 : 1.2, ease: "expo.inOut", overwrite: true }); mirujeOd = zdaj(); });
    // navaden kolešček drsi po strani; približuje le s ⌘/Ctrl (ščip na sledilni ploščici pride kot ctrl + kolešček)
    obmocje.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) { namig.hidden = false; namigDo = zdaj() + 1400; return; }
      e.preventDefault();
      priblizaj(Math.exp(clamp(e.deltaY, -60, 60) * 0.004));
    }, { passive: false });

    const razmikPrstov = () => { const [a, b] = [...prsti.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    obmocje.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      obmocje.setPointerCapture(e.pointerId);
      prsti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (prsti.size === 1) { vlecenje = { x: e.clientX, y: e.clientY, cy: cilj.y, cx: cilj.x, t: zdaj(), vy: 0 }; obmocje.dataset.vlecenje = ""; }
      else { vlecenje = null; razmik = razmikPrstov(); }
      gsap.killTweensOf(cilj); usmerjen = null; hitrost = 0; samodejno = 0; mirujeOd = zdaj();
    });
    obmocje.addEventListener("pointermove", (e) => {
      if (!prsti.has(e.pointerId)) return;
      prsti.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (prsti.size >= 2) { const nov = razmikPrstov(); if (razmik > 0) dCilj = clamp(dCilj * razmik / nov, BLIZU, DALEC()); razmik = nov; return; }
      if (!vlecenje) return;
      const obcutljivost = 0.0062 * (d - 1) / 2.1; // bliže je, manj se zavrti na slikovno piko
      const ny = vlecenje.cy + (e.clientX - vlecenje.x) * obcutljivost;
      const t = zdaj(); vlecenje.vy = (ny - cilj.y) / Math.max(1, t - vlecenje.t) * 16; vlecenje.t = t;
      cilj.y = ny;
      cilj.x = clamp(vlecenje.cx + (e.clientY - vlecenje.y) * obcutljivost, -0.7, 0.7);
      mirujeOd = t;
    });
    const konec = (e) => {
      prsti.delete(e.pointerId);
      if (vlecenje && zdaj() - vlecenje.t < 80) hitrost = clamp(vlecenje.vy, -0.12, 0.12); // iztek po hitrem vlečenju
      vlecenje = null; delete obmocje.dataset.vlecenje; razmik = 0; mirujeOd = zdaj();
    };
    obmocje.addEventListener("pointerup", konec); obmocje.addEventListener("pointercancel", konec);

    izberi = (kraj) => {
      aktiven(kraj); pokaziFilme(kraj);
      let ky = -azimut(kraj);
      while (ky - cilj.y > Math.PI) ky -= 2 * Math.PI;
      while (ky - cilj.y < -Math.PI) ky += 2 * Math.PI;
      usmerjen = kraj; hitrost = 0; samodejno = 0;
      gsap.to(cilj, { y: ky, x: nagibZa(kraj), duration: mirno ? 0 : 1.5, ease: "expo.inOut", overwrite: true });
      dCilj = telefon() ? 1.95 : 1.75;
      mirujeOd = zdaj() + 3000;
    };

    let zadnji = 0;
    function korak(t) {
      const dt = Math.min(0.05, (t - zadnji) / 1000 || 0.016); zadnji = t;
      // samodejno vrtenje: po premoru se hitrost mehko dvigne; blizu kraja ga ni
      const prost = !vlecenje && prsti.size === 0 && !usmerjen && t > mirujeOd + 2500 && !mirno;
      samodejno = damp(samodejno, prost ? 0.055 * clamp((d - 1.5) / 1.4, 0, 1) : 0, 1.5, dt);
      cilj.y += samodejno * dt;
      if (Math.abs(hitrost) > 1e-4) { cilj.y += hitrost; hitrost *= Math.pow(0.08, dt); }
      vrt.y = damp(vrt.y, cilj.y, vlecenje ? 18 : 7, dt);
      vrt.x = damp(vrt.x, cilj.x, vlecenje ? 18 : 7, dt);
      d = damp(d, dCilj, 6, dt);

      skupina.rotation.set(vrt.x, vrt.y, 0);
      skupina.updateMatrixWorld();
      camera.position.set(0, Math.sin(NAGIB) * d, Math.cos(NAGIB) * d); camera.lookAt(0, 0, 0);
      // senca ostane pod globusom na zaslonu, ne glede na nagib kamere
      senca.position.set(0, -0.07, 0).applyQuaternion(camera.quaternion).addScaledVector(camera.position, -0.12 / d);

      // v okvirju krajev ob približanju grobe črte (110m) zamenjajo podrobne (50m)
      const fino = 1 - smoothstep(d, 1.7, 2.2);
      if (obaleFino) { obaleZnotraj.material.opacity = OBALE * (1 - fino); obaleFino.material.opacity = (OBALE + 0.05) * fino; mejeZnotraj.material.opacity = MEJE * (1 - fino); mejeFino.material.opacity = (MEJE + 0.04) * fino; }
      gumbVse.hidden = d > DALEC() * 0.75;
      if (!namig.hidden && t > namigDo) namig.hidden = true;

      // obroči krajev utripajo, iskre potujejo po poti; vse se z bližino manjša, da ostane enako veliko na zaslonu
      const merilo = clamp((d - 1) / 3.2, 0.1, 1);
      for (const o of kroglice) {
        const f = ((t / 1000 + o.faza) % 2.8) / 2.8;
        o.obroc.scale.setScalar((0.6 + f * 2.2) * merilo); o.obroc.material.opacity = 0.8 * (1 - f); o.krogla.scale.setScalar(merilo);
      }
      for (const i of iskre) {
        const f = ((t / 1000 * 0.12 + i.zamik) % 1), k = f * 64, a = i.tocke[Math.floor(k)], b = i.tocke[Math.min(64, Math.floor(k) + 1)];
        i.iskra.position.copy(a).lerp(b, k - Math.floor(k)); i.iskra.scale.setScalar(merilo);
      }

      renderer.render(scene, camera);
      postaviOznake();
    }
    const zanka = (t) => { korak(t); requestAnimationFrame(zanka); };
    for (const z of zatici) delete z.el.dataset.skrit;
    requestAnimationFrame(zanka);
    mirujeOd = zdaj();
    // za preizkuse doma: en korak na ukaz (brez nove zanke), ko okno ne teče
    if (location.hostname === "localhost") window.__globus = { slika: () => korak(performance.now()), vrt, cilj, stanje: () => ({ d, dCilj }), priblizaj };
  }
}
