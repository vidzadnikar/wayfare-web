// 3D znak Wayfare za hero.
//
// - Kjer gre kazalec, se kosi znaka razmaknejo (le tisti blizu kazalca) in se z
//   vzmetjo vrnejo, ko kazalec odide. Znak se nikoli ne razleti v celoti.
// - Z vlečenjem znak vrtiš; po spustu se z vztrajnostjo umiri in se čez nekaj
//   sekund mehko vrne v mirovanje.
// - Ob nalaganju kosi priletijo skupaj v znak.
//
// Model (model/wayfare-znak-kosi.glb, iz logo-3d/razbij_znak.py, stisnjen z meshopt):
//   Razbitje/Znak  cel znak, viden, dokler se nič ne premika
//   Razbitje/Kosi  kosi; prostor skupine: x desno, y gor, z proti gledalcu

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const PRIVZETO = {
  notranjost: null,       // null = barvna notranjost iz modela; { barva, sij } = svetleča
  velikost: 0.4,          // delež vsebnika, ki ga znak zapolni; lahko (širina, višina) => delež
  zamik: [0, 0],          // premik znaka v deležih vsebnika (x desno, y gor); lahko funkcija
  uvod: true,
  polmer: 0.32,           // doseg kazalca v ravnini znaka (m; znak je širok 1,55 m)
  razmik: 0.16,           // kako daleč se kos pri kazalcu odmakne
  razmikZ: 0.14,          // in koliko proti gledalcu
  zasuk: 0.7,             // največji zasuk kosa (rad)
  izkoristekZaslona: 2,
};

export async function ustvariZnak(nastavitve) {
  const o = { ...PRIVZETO, ...nastavitve };
  const vsebnik = o.vsebnik;
  const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, o.izkoristekZaslona));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const platno = renderer.domElement;
  platno.setAttribute("aria-hidden", "true");
  platno.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y";
  vsebnik.appendChild(platno);

  const scena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scena.environment = pmrem.fromScene(studio(), 0.02).texture;
  luci(scena);
  const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // model je stisnjen z meshopt (gltf-transform meshopt --level high): 0,6 MB namesto 1,8 MB
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(o.model);
  const koren = gltf.scene;
  const cel = koren.getObjectByName("Znak");
  const skupina = koren.getObjectByName("Kosi");
  const kosi = [...skupina.children];

  const obseg = new THREE.Box3().setFromObject(cel);
  const velikostZnaka = obseg.getSize(new THREE.Vector3());
  koren.position.sub(obseg.getCenter(new THREE.Vector3()));
  const nosilec = new THREE.Group();
  nosilec.add(koren);
  scena.add(nosilec);

  if (o.notranjost) {
    const sij = new THREE.MeshStandardMaterial({
      color: o.notranjost.barva, emissive: o.notranjost.barva,
      emissiveIntensity: o.notranjost.sij ?? 1.2, roughness: 0.4,
    });
    for (const k of kosi) k.traverse((m) => {
      if (m.isMesh && m.material.name.startsWith("Notranjost")) m.material = sij;
    });
  }

  // središče kosov v prostoru skupine (za smer odmika, kadar je kazalec točno na kosu)
  const srediscaKosov = kosi.reduce((v, k) => v.add(k.position), new THREE.Vector3()).divideScalar(kosi.length);
  const stanje = kosi.map((k) => ({
    k,
    mirovanje: k.position.clone(),
    odmik: new THREE.Vector3(), hitrost: new THREE.Vector3(),
    kot: 0, kotHitrost: 0,
    os: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * 0.4).normalize(),
    smer: Math.random() < 0.5 ? -1 : 1,
    z: 0.6 + Math.random() * 0.4,
    zakasnitev: 0,
  }));

  // -------------------------------------------------- velikost in kamera
  function umeri() {
    const w = vsebnik.clientWidth || 1;
    const h = vsebnik.clientHeight || 1;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    const delez = typeof o.velikost === "function" ? o.velikost(w, h) : o.velikost;
    const zamik = typeof o.zamik === "function" ? o.zamik(w, h) : o.zamik;
    const navp = THREE.MathUtils.degToRad(kamera.fov) / 2;
    const potrebnaVisina = Math.max(velikostZnaka.y, velikostZnaka.x / kamera.aspect) / delez;
    kamera.position.z = potrebnaVisina / 2 / Math.tan(navp);
    kamera.near = kamera.position.z / 40;
    kamera.far = kamera.position.z * 4;
    const visinaPogleda = 2 * Math.tan(navp) * kamera.position.z;
    kamera.position.x = -zamik[0] * visinaPogleda * kamera.aspect;
    kamera.position.y = -zamik[1] * visinaPogleda;
    kamera.updateProjectionMatrix();
    if (mirno) narisi();
  }
  const opazovalec = new ResizeObserver(umeri);
  opazovalec.observe(vsebnik);
  umeri();

  // -------------------------------------------------- kazalec
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ravnina = new THREE.Plane();
  const tocka = new THREE.Vector3();
  const normala = new THREE.Vector3();
  const svetQ = new THREE.Quaternion();
  const svetP = new THREE.Vector3();
  let kazalec = null;          // {x, y} v px znotraj vsebnika
  let dotikDo = 0;             // dotik velja še kratek čas po spustu

  function vVsebniku(e) {
    const r = vsebnik.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function nastaviZarek(p) {
    ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
    raycaster.setFromCamera(ndc, kamera);
  }
  function zadeneZnak(p) {
    nastaviZarek(p);
    return raycaster.intersectObject(cel, true).length > 0;
  }
  // točka kazalca v ravnini znaka, v prostoru skupine kosov
  function tockaVZnaku(p) {
    nastaviZarek(p);
    skupina.getWorldQuaternion(svetQ);
    normala.set(0, 0, 1).applyQuaternion(svetQ);
    ravnina.setFromNormalAndCoplanarPoint(normala, skupina.getWorldPosition(svetP));
    if (!raycaster.ray.intersectPlane(ravnina, tocka)) return null;
    return skupina.worldToLocal(tocka.clone());
  }

  // -------------------------------------------------- vrtenje z vlečenjem
  const vrtenje = { y: 0, x: 0, hy: 0, hx: 0, vleka: false, zadnji: null, mir: 0 };

  function obPritisku(e) {
    const p = vVsebniku(e);
    kazalec = { ...p, pointerType: e.pointerType };
    if (e.pointerType === "touch") dotikDo = performance.now() + 900;
    if (!zadeneZnak(p)) return;
    vrtenje.vleka = true;
    vrtenje.zadnji = { x: e.clientX, y: e.clientY, t: performance.now() };
    vrtenje.hy = vrtenje.hx = 0;
    platno.setPointerCapture(e.pointerId);
    platno.style.cursor = "grabbing";
  }
  function obPremiku(e) {
    const p = vVsebniku(e);
    kazalec = { ...p, pointerType: e.pointerType };
    if (e.pointerType === "touch") dotikDo = performance.now() + 900;
    if (vrtenje.vleka) {
      const zdaj = performance.now();
      const dt = Math.max((zdaj - vrtenje.zadnji.t) / 1000, 1 / 240);
      const dx = e.clientX - vrtenje.zadnji.x;
      const dy = e.clientY - vrtenje.zadnji.y;
      vrtenje.y += dx * 0.0085;
      vrtenje.x = THREE.MathUtils.clamp(vrtenje.x + dy * 0.006, -0.8, 0.8);
      // hitrost za vztrajnost, omejena: hiter zamah zavrti, a ne za več obratov
      vrtenje.hy = THREE.MathUtils.clamp((dx * 0.0085) / dt, -8, 8);
      vrtenje.hx = THREE.MathUtils.clamp((dy * 0.006) / dt, -4, 4);
      vrtenje.zadnji = { x: e.clientX, y: e.clientY, t: zdaj };
      vrtenje.mir = 0;
      if (mirno) narisi();
    } else if (e.pointerType === "mouse") {
      platno.style.cursor = zadeneZnak(p) ? "grab" : "";
    }
  }
  function obSpustu(e) {
    if (!vrtenje.vleka) return;
    vrtenje.vleka = false;
    // vztrajnost le, če se je roka ob spustu še premikala
    if (performance.now() - vrtenje.zadnji.t > 80) vrtenje.hy = vrtenje.hx = 0;
    if (mirno) vrtenje.hy = vrtenje.hx = 0;
    if (platno.hasPointerCapture?.(e.pointerId)) platno.releasePointerCapture(e.pointerId);
    platno.style.cursor = e.pointerType === "mouse" ? "grab" : "";
  }
  function obOdhodu() { kazalec = null; }

  platno.addEventListener("pointerdown", obPritisku);
  addEventListener("pointermove", obPremiku, { passive: true });
  addEventListener("pointerup", obSpustu);
  addEventListener("pointercancel", obSpustu);
  addEventListener("blur", obOdhodu);
  const obIzhodu = (e) => { if (!e.relatedTarget) obOdhodu(); };
  addEventListener("pointerout", obIzhodu);

  // -------------------------------------------------- uvod
  let casUvoda = mirno || !o.uvod ? Infinity : 0;
  if (casUvoda === 0) {
    for (const s of stanje) {
      const smer = s.mirovanje.clone().sub(srediscaKosov).setZ(0);
      if (smer.lengthSq() < 1e-6) smer.set(1, 0, 0);
      smer.normalize();
      s.odmik.copy(smer).multiplyScalar(0.35 + Math.random() * 0.5).add(new THREE.Vector3(0, 0, -0.2 + Math.random() * 0.7));
      s.kot = (Math.random() - 0.5) * 5;
      s.zakasnitev = Math.random() * 0.45;
    }
  }

  // -------------------------------------------------- zanka
  const ura = new THREE.Clock();
  let cas = 0;
  let moc = 0;                  // prisotnost kazalca, mehko 0..1
  let razstavljen = true;       // kosi vidni namesto celega znaka
  const nagib = new THREE.Vector2();
  const zacasna = new THREE.Quaternion();
  const cilj = new THREE.Vector3();
  const v2 = new THREE.Vector2();

  function prikazi(kosiVidni, vedno = false) {
    if (kosiVidni === razstavljen && !vedno) return;
    razstavljen = kosiVidni;
    cel.visible = !kosiVidni;
    skupina.visible = kosiVidni;
  }
  // začetno stanje nastavi vedno: model pride z obema skupinama vidnima, zato bi
  // brez tega med uvodom za letečimi kosi ves čas stal še cel znak
  prikazi(casUvoda === 0, true);

  function simuliraj(dt) {
    cas += dt;
    if (casUvoda !== Infinity) casUvoda += dt;
    const vUvodu = casUvoda < 2.6;

    // točka kazalca v znaku; med vlečenjem znaka kosi ostanejo skupaj
    const dotik = performance.now() < dotikDo;
    const p = kazalec && !vrtenje.vleka && (kazalec.pointerType !== "touch" || dotik) ? tockaVZnaku(kazalec) : null;
    moc += ((p && !vUvodu ? 1 : 0) - moc) * (1 - Math.exp(-dt * 10));

    // vrtenje: vztrajnost po spustu, nato mehka vrnitev v mirovanje
    if (!vrtenje.vleka) {
      vrtenje.y += vrtenje.hy * dt;
      vrtenje.x = THREE.MathUtils.clamp(vrtenje.x + vrtenje.hx * dt, -0.8, 0.8);
      vrtenje.hy *= Math.exp(-dt * 3.5);
      vrtenje.hx *= Math.exp(-dt * 3.5);
      vrtenje.mir += dt;
      if (vrtenje.mir > 2.5) {
        vrtenje.y = Math.atan2(Math.sin(vrtenje.y), Math.cos(vrtenje.y)); // ne odvij več obratov
        const f = 1 - Math.exp(-dt * 1.4);
        vrtenje.y -= vrtenje.y * f;
        vrtenje.x -= vrtenje.x * f;
      }
    }

    // nagib proti kazalcu in mirno lebdenje
    if (kazalec && !mirno && !vrtenje.vleka) {
      nagib.lerp(v2.set((THREE.MathUtils.clamp(kazalec.x / kazalec.w, 0, 1) - 0.5) * 0.35,
                        (THREE.MathUtils.clamp(kazalec.y / kazalec.h, 0, 1) - 0.5) * 0.25), 1 - Math.exp(-dt * 3));
    } else nagib.lerp(v2.set(0, 0), 1 - Math.exp(-dt * 3));
    const lebdenje = mirno ? 0 : 1;
    nosilec.rotation.y = lebdenje * Math.sin(cas * 0.45) * 0.2 + nagib.x + vrtenje.y;
    nosilec.rotation.x = lebdenje * Math.sin(cas * 0.32) * 0.05 + nagib.y + vrtenje.x;
    nosilec.position.y = lebdenje * Math.sin(cas * 0.8) * 0.04;

    // kosi: vzmet proti cilju; cilj je odmik stran od kazalca, le blizu njega
    const odziv = vUvodu ? 1.1 : 0.5;
    const w0 = (2 * Math.PI) / odziv;
    const k = w0 * w0;
    const c = 2 * (vUvodu ? 1 : 0.6) * w0;
    let gibanje = false;  // kosi so vidni le, kadar se res premikajo
    for (const s of stanje) {
      let w = 0;
      cilj.set(0, 0, 0);
      let ciljKot = 0;
      if (p && moc > 0.002) {
        const dx = s.mirovanje.x - p.x;
        const dy = s.mirovanje.y - p.y;
        const d = Math.hypot(dx, dy);
        w = moc * (1 - THREE.MathUtils.smoothstep(d, 0, o.polmer));
        if (w > 0) {
          let sx = dx, sy = dy;
          if (d < 1e-4) { sx = s.mirovanje.x - srediscaKosov.x; sy = s.mirovanje.y - srediscaKosov.y; }
          const n = Math.hypot(sx, sy) || 1;
          cilj.set((sx / n) * o.razmik * w, (sy / n) * o.razmik * w, o.razmikZ * w * s.z);
          ciljKot = s.smer * o.zasuk * w;
        }
      }
      if (vUvodu && casUvoda < s.zakasnitev) { gibanje = true; continue; }
      // pospešek vzmeti: k (cilj - odmik) - c hitrost
      s.hitrost.x += (k * (cilj.x - s.odmik.x) - c * s.hitrost.x) * dt;
      s.hitrost.y += (k * (cilj.y - s.odmik.y) - c * s.hitrost.y) * dt;
      s.hitrost.z += (k * (cilj.z - s.odmik.z) - c * s.hitrost.z) * dt;
      s.odmik.addScaledVector(s.hitrost, dt);
      s.kotHitrost += (k * (ciljKot - s.kot) - c * s.kotHitrost) * dt;
      s.kot += s.kotHitrost * dt;
      if (s.odmik.lengthSq() > 1e-8 || Math.abs(s.kot) > 1e-4 || s.hitrost.lengthSq() > 1e-6) gibanje = true;
      s.k.position.copy(s.mirovanje).add(s.odmik);
      s.k.quaternion.copy(zacasna.setFromAxisAngle(s.os, s.kot));
    }
    if (!gibanje && !vUvodu) {
      for (const s of stanje) {
        s.odmik.set(0, 0, 0); s.hitrost.set(0, 0, 0); s.kot = 0; s.kotHitrost = 0;
        s.k.position.copy(s.mirovanje); s.k.quaternion.identity();
      }
    }
    prikazi(gibanje || vUvodu);
  }

  function narisi() { renderer.render(scena, kamera); }
  function korak() { simuliraj(Math.min(ura.getDelta(), 1 / 30)); narisi(); }

  // risanje le, ko je znak viden in zavihek odprt
  let viden = true;
  let tece = false;
  function zazeni() {
    const naj = viden && !document.hidden;
    if (naj && !tece) { ura.getDelta(); renderer.setAnimationLoop(korak); tece = true; }
    else if (!naj && tece) { renderer.setAnimationLoop(null); tece = false; }
  }
  const vidnost = new IntersectionObserver(([e]) => { viden = e.isIntersecting; zazeni(); });
  vidnost.observe(vsebnik);
  document.addEventListener("visibilitychange", zazeni);
  zazeni();

  platno.addEventListener("webglcontextlost", (e) => { e.preventDefault(); vsebnik.dataset.znak = "napaka"; });
  vsebnik.dataset.znak = "pripravljen";

  return {
    umeri,
    nosilec,
    // za preizkuse brez vidnega okna (brskalnik takrat ustavi requestAnimationFrame)
    simuliraj(sekund, korakov = 1) { for (let i = 0; i < korakov; i++) simuliraj(sekund); narisi(); },
    unici() {
      renderer.setAnimationLoop(null);
      opazovalec.disconnect();
      vidnost.disconnect();
      platno.removeEventListener("pointerdown", obPritisku);
      removeEventListener("pointermove", obPremiku);
      removeEventListener("pointerup", obSpustu);
      removeEventListener("pointercancel", obSpustu);
      removeEventListener("blur", obOdhodu);
      removeEventListener("pointerout", obIzhodu);
      document.removeEventListener("visibilitychange", zazeni);
      scena.traverse((m) => {
        if (m.isMesh) { m.geometry.dispose(); [].concat(m.material).forEach((x) => x.dispose()); }
      });
      scena.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      platno.remove();
    },
  };
}

// Temen studio iz svetlobnih plošč. Za kamero (+Z) ni nič svetlega, ker obraz
// odseva prav tisto, kar je za gledalcem; odsevi tečejo po zaobljenih robovih.
function studio() {
  const okolje = new THREE.Scene();
  okolje.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.BackSide })));
  const plosca = (s, v, jakost, barva, x, y, z) => {
    const m = new THREE.MeshBasicMaterial({ color: barva, side: THREE.DoubleSide });
    m.color.multiplyScalar(jakost);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, v), m);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    okolje.add(p);
  };
  plosca(7, 4, 6, 0xffffff, -6, 7, 5);
  plosca(1.2, 10, 4, 0xffffff, 8, 0, 1);
  plosca(10, 2, 3, 0xf3f1ec, 0, 8, -6);
  plosca(5, 5, 1.5, 0xf3e6dc, -8, -2, -4);
  plosca(30, 4, 0.25, 0xffffff, 0, -9, 0);
  return okolje;
}

function luci(scena) {
  // pri fizikalnih enotah da jakost π na beli ploskvi polno barvo
  const kljucna = new THREE.DirectionalLight(0xffffff, 3.2);
  kljucna.position.set(2.5, 3.5, 6);
  const obrobna = new THREE.DirectionalLight(0xfff3ea, 1.8);
  obrobna.position.set(-4, 2.5, -3);
  const zadnja = new THREE.DirectionalLight(0xffffff, 2.0);
  zadnja.position.set(2, 2, -6);
  scena.add(kljucna, obrobna, zadnja);
}
