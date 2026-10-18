// Vmesnik Wayfare Studia se sestavlja med drsenjem po strani — kot en film.
//
// Nič ni pripeto: poglavja z napisi tečejo navzdol kot običajna vsebina, ob njih
// se riše črta poti skozi žebljičke poglavij. Vmesnik plava ob besedilu (oder je
// sticky, dokler je razdelek na zaslonu) na nasprotni strani od napisa; kamera
// se približa delu, o katerem govori napis, kosi pa priletijo na svoja mesta.
//
// Pravila (veščina video-storytelling): en svet (zamegljena slika končanega
// urejevalnika je vidna od začetka), kadri so izseki okna, prilegani prostoru
// ob napisu, reflektor na aktivnem delu, premik kamere in prihod kosa sta ena
// kretnja.
//
// Časovni potek ima 7 enot (ena na poglavje); napis poglavja k je na sredini
// zaslona pri času k + 0,6, ko so kosi tega koraka že na mestu:
//   0  oblak 24 surovih posnetkov pred zamegljenim urejevalnikom
//   1  posnetki poletijo v sled V1; kamera na časovnico
//   2  predogled in ukaz z enim stavkom; kamera na predogled
//   3  okno z glasbo, nato se skrči v zvočno sled; kamera mu sledi
//   4  v predogledu teče 3D zemljevid; kamera tesno na zaslon
//   5  pregled kakovosti, nato zgornja vrstica z gumbom Izvozi
//   6  končano: kamera se odmakne na cel urejevalnik

// izseki okna (x0, y0, x1, y1 v deležih)
const SVET = [0, 0, 1, 1];
const CASOVNICA = [0.01, 0.69, 0.62, 0.985];   // levi del; desno sled sega čez rob kadra
const PREDOGLED = [0.01, 0.06, 0.76, 0.69];
const GLASBA_IZSEK = [0.19, 0.16, 0.81, 0.83];
const ZASLON = [0.113, 0.068, 0.65, 0.602];
const PREGLED = [0.3, 0.086, 0.7, 0.909];
const DESNI_ROB = [0.6, 0.0, 1.0, 0.7];

// prostor za kader na zaslonu (deleži pripetega prizora), glede na stran napisa
const SIROKO = {
  zacetek: [0.4, 0.1, 1.04, 0.9],
  levo: [0.38, 0.12, 0.97, 0.86],      // napis levo, kader desno
  desno: [0.03, 0.12, 0.62, 0.86],     // napis desno, kader levo
  konec: [0.08, 0.3, 0.92, 0.88],
};
// pokončna tablica: napis zasede manj višine kot na telefonu, kader je višje
const TABLICA = {
  zacetek: [0.04, 0.3, 0.96, 0.88],
  levo: [0.04, 0.3, 0.96, 0.88],
  desno: [0.04, 0.3, 0.96, 0.88],
  konec: [0.04, 0.3, 0.96, 0.88],
};
const OZKO = {
  zacetek: [0.03, 0.44, 0.97, 0.9],
  levo: [0.03, 0.44, 0.97, 0.9],
  desno: [0.03, 0.44, 0.97, 0.9],
  konec: [0.03, 0.44, 0.97, 0.9],
};

// sredini zvočne sledi A1 in okna z glasbo; sled V1
const A1 = { x: 0.5315, y: 0.8755 };
const GLASBA = { x: 0.19219, y: 0.16481, w: 2364 / 3840, h: 1446 / 2160 };
const V1 = { y: 0.784, h: 0.047 };
const TIHO = 0.42;

import { besede } from "./gibanje.js";

export function sestavljanje({ gsap, ScrollTrigger }) {
  const odsek = document.querySelector("[data-sestavljanje]");
  const oder = odsek.querySelector("[data-oder]");
  const kamera = odsek.querySelector("[data-kamera]");
  const okno = odsek.querySelector("[data-okno]");
  const poglavja = [...odsek.querySelectorAll(".poglavje")];
  const kos = (ime) => okno.querySelector(`[data-kos="${ime}"]`);
  const kosi = ["casovnica", "katalog", "predogled", "podatki", "lastnosti", "vrstica"].map((ime) => [ime, kos(ime)]);
  kosi.push(["zaslon", odsek.querySelector("[data-prek-video]")]);
  const slicice = [...okno.querySelectorAll(".oblak .sl")];
  const mehka = okno.querySelector("[data-osnova-mehka]");
  const cista = okno.querySelector("[data-osnova-cista]");
  const prekVideo = okno.querySelector("[data-prek-video]");
  const video = prekVideo.querySelector("video");
  const ukaz = okno.querySelector("[data-ukaz]");
  const tekst = okno.querySelector("[data-ukaz-tekst]");
  const namig = okno.querySelector("[data-ukaz-namig]");
  const potrdilo = okno.querySelector("[data-ukaz-potrdilo]");
  const besedilo = ukaz.dataset.besedilo;

  // kamera: izsek okna naj se prilega prostoru na zaslonu
  function kader(izsek, prostor) {
    const W = kamera.offsetWidth, H = kamera.offsetHeight;
    const VW = oder.clientWidth, VH = oder.clientHeight;
    const [x0, y0, x1, y1] = izsek;
    const [p0, q0, p1, q1] = prostor;
    const s = Math.min(((p1 - p0) * VW) / ((x1 - x0) * W), ((q1 - q0) * VH) / ((y1 - y0) * H), 2.4);
    const rx = ((x0 + x1) / 2 - 0.5) * W, ry = ((y0 + y1) / 2 - 0.5) * H;
    const tx = ((p0 + p1) / 2 - 0.5) * VW, ty = ((q0 + q1) / 2 - 0.5) * VH;
    return { x: tx - rx * s, y: ty - ry * s, s };
  }
  const kam = (izsek, prostor, rotY = 0, rotX = 0) => ({
    x: () => kader(izsek, prostor()).x,
    y: () => kader(izsek, prostor()).y,
    scale: () => kader(izsek, prostor()).s,
    rotationY: rotY, rotationX: rotX,
  });

  let tece = false;
  const mm = gsap.matchMedia();
  // ozka postavitev le pokončno; telefon in tablica na ležeče sta široka (enako v slog.css)
  mm.add({
    siroko: "(min-width: 900px), (min-width: 640px) and (orientation: landscape)",
    ozko: "(max-width: 899px) and (orientation: portrait), (max-width: 639px)",
    tablica: "(min-width: 640px) and (max-width: 899px) and (orientation: portrait)",
  }, (ctx) => {
    const P = ctx.conditions.siroko ? SIROKO : ctx.conditions.tablica ? TABLICA : OZKO;
    const nagib = ctx.conditions.siroko ? 1 : 0.5;
    const prostor = (ime) => () => P[ime];
    let seme = 11;
    const nakljucno = () => (seme = (seme * 16807) % 2147483647) / 2147483647;

    // razdelek je visok 7 poglavij; časovni potek teče, dokler gre skozi zaslon
    const tl = gsap.timeline({
      defaults: { ease: "power3.out", duration: 0.5 },
      scrollTrigger: {
        trigger: odsek, start: "top 60%", end: "bottom 60%",
        scrub: 1.2, invalidateOnRefresh: true,
        onUpdate: () => stanje(tl),
      },
    });

    // reflektor: polno le aktivni kosi, ostali tiho
    const osvetli = (t, aktivni) => {
      for (const [ime, el] of kosi) {
        tl.to(el, { "--svetlost": aktivni === "vsi" || aktivni.includes(ime) ? 1 : TIHO, duration: 0.35, ease: "power1.inOut" }, t);
      }
    };

    // 0: kamera vidi zamegljen urejevalnik postrani, pred njim oblak posnetkov
    tl.set(kamera, kam(SVET, prostor("zacetek"), -22 * nagib, 6 * nagib), 0);
    slicice.forEach((s) => {
      const levo = parseFloat(s.style.left) / 100;
      const sirina = parseFloat(s.style.width) / 100;
      const x = 0.04 + nakljucno() * 0.92;
      const y = 0.0 + nakljucno() * 0.62;
      gsap.set(s, {
        xPercent: ((x - levo) / sirina) * 100,
        yPercent: ((y - V1.y) / V1.h) * 100,
        z: -500 + nakljucno() * 800,
        rotationX: (nakljucno() - 0.5) * 60,
        rotationY: (nakljucno() - 0.5) * 80,
        rotationZ: (nakljucno() - 0.5) * 24,
        scale: 2.2 + nakljucno() * 1.2,
        autoAlpha: 1,
      });
    });
    gsap.set(mehka, { autoAlpha: 0.6 });
    tl.to(slicice, { rotationY: "+=24", z: "+=140", yPercent: "-=40", duration: 1, ease: "none" }, 0);

    // 1: posnetki v sled V1 po vrsti, kamera na časovnico — ena kretnja
    tl.to(kamera, { ...kam(CASOVNICA, prostor("levo"), -8 * nagib, 10 * nagib), duration: 0.8, ease: "power2.inOut" }, 0.9)
      .to(slicice, {
        xPercent: 0, yPercent: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
        duration: 0.75, ease: "power3.inOut", stagger: { each: 0.012 },
      }, 0.95)
      .to(slicice, { autoAlpha: 0, duration: 0.15, ease: "none" }, 1.85)
      .to(mehka, { autoAlpha: 1, duration: 0.5, ease: "power1.inOut" }, 0.95)
      .fromTo(kos("casovnica"), { yPercent: 140, rotationX: -40, z: -300, autoAlpha: 0 },
        { yPercent: 0, rotationX: 0, z: 0, autoAlpha: 1, duration: 0.6 }, 1.3)
      .fromTo(kos("katalog"), { xPercent: 120, rotationY: -35, z: -400, autoAlpha: 0 },
        { xPercent: 0, rotationY: 0, z: 0, autoAlpha: 1, duration: 0.6 }, 1.5);
    osvetli(1.0, ["casovnica"]);

    // 2: predogled in ukaz, kamera na predogled
    const pisava = { n: 0 };
    const natipkaj = () => {
      const n = Math.round(pisava.n);
      tekst.textContent = besedilo.slice(0, n);
      namig.hidden = n > 0;
    };
    tl.to(kamera, { ...kam(PREDOGLED, prostor("desno"), 8 * nagib, 3 * nagib), duration: 0.75, ease: "power2.inOut" }, 1.85)
      .fromTo(kos("predogled"), { yPercent: -30, z: 400, scale: 1.08, autoAlpha: 0 },
        { yPercent: 0, z: 0, scale: 1, autoAlpha: 1, duration: 0.6 }, 1.95)
      .fromTo(kos("podatki"), { xPercent: -25, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.4 }, 2.2)
      .fromTo(ukaz, { autoAlpha: 0, y: 20, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.15 }, 2.45)
      .to(pisava, { n: besedilo.length, duration: 0.3, ease: "none", onUpdate: natipkaj }, 2.6)
      .fromTo(potrdilo, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.12 }, 2.92)
      .to([ukaz, potrdilo], { autoAlpha: 0, y: -10, duration: 0.12, ease: "power2.in" }, 3.25);
    osvetli(1.95, ["predogled", "podatki"]);

    // 3: glasba; okno se skrči v zvočno sled in kamera mu sledi na časovnico
    const glasba = kos("glasba");
    tl.to(kamera, { ...kam(GLASBA_IZSEK, prostor("levo"), -7 * nagib, 3 * nagib), duration: 0.6, ease: "power2.inOut" }, 2.95)
      .fromTo(glasba, { autoAlpha: 0, scale: 0.82, z: 200, yPercent: 6 },
        { autoAlpha: 1, scale: 1, z: 0, yPercent: 0, duration: 0.4 }, 3.05)
      .to(glasba, {
        xPercent: ((A1.x - (GLASBA.x + GLASBA.w / 2)) / GLASBA.w) * 100,
        yPercent: ((A1.y - (GLASBA.y + GLASBA.h / 2)) / GLASBA.h) * 100,
        scale: 0.12, autoAlpha: 0, duration: 0.45, ease: "power2.inOut",
      }, 3.55)
      .to(kamera, { ...kam(CASOVNICA, prostor("levo"), -8 * nagib, 10 * nagib), duration: 0.45, ease: "power2.inOut" }, 3.55)
      .fromTo("[data-poudarek-a1]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 3.9)
      .to("[data-poudarek-a1]", { autoAlpha: 0, duration: 0.2 }, 4.3);
    osvetli(2.95, []);
    osvetli(3.6, ["casovnica"]);

    // 4: grafika v predogledu, kamera tesno na zaslon
    tl.to(kamera, { ...kam(ZASLON, prostor("desno"), 7 * nagib, 2 * nagib), duration: 0.8, ease: "power2.inOut" }, 3.95)
      .fromTo(prekVideo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 4.15)
      .fromTo(kos("lastnosti"), { xPercent: 110, rotationY: -30, z: -300, autoAlpha: 0 },
        { xPercent: 0, rotationY: 0, z: 0, autoAlpha: 1, duration: 0.6 }, 4.35);
    osvetli(4.0, ["predogled", "zaslon"]);

    // 5: pregled kakovosti, nato zgornja vrstica in gumb Izvozi
    const pregled = kos("pregled");
    tl.to(kamera, { ...kam(PREGLED, prostor("levo"), -7 * nagib, 3 * nagib), duration: 0.65, ease: "power2.inOut" }, 4.95)
      .fromTo(pregled, { autoAlpha: 0, yPercent: 30, z: 150 }, { autoAlpha: 1, yPercent: 0, z: 0, duration: 0.4 }, 5.05)
      .to(pregled, { autoAlpha: 0, yPercent: 20, scale: 0.96, duration: 0.3, ease: "power2.in" }, 5.55)
      .to(kamera, { ...kam(DESNI_ROB, prostor("levo"), -6 * nagib, 4 * nagib), duration: 0.45, ease: "power2.inOut" }, 5.55)
      .fromTo(kos("vrstica"), { yPercent: -400, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4 }, 5.6)
      .fromTo("[data-poudarek-izvoz]", { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.15 }, 5.9)
      .to("[data-poudarek-izvoz]", { autoAlpha: 0, duration: 0.2 }, 6.25);
    osvetli(4.95, []);
    osvetli(5.6, ["vrstica", "lastnosti", "katalog"]);

    // 6: končano — kamera se odmakne na cel urejevalnik, ostra slika zamenja zamegljeno
    tl.to(kamera, { ...kam(SVET, prostor("konec"), 0, 0), duration: 0.8, ease: "power2.inOut" }, 5.95)
      .to(cista, { autoAlpha: 1, duration: 0.3, ease: "none" }, 6.2)
      .to({}, { duration: 0.4 }, 6.6);
    osvetli(6.0, "vsi");

    stanje(tl);
    return () => { video.pause(); };
  });

  // črta poti skozi žebljičke poglavij; od žebljička gre navpično ob napisu
  // navzdol in prečka šele pod njim, da nikoli ne seka besedila
  const svg = odsek.querySelector("[data-pot]");
  const sled = svg.querySelector(".pot-sled");
  const crta = svg.querySelector(".pot-pot");
  let dolzina = 1;
  let delezi = [];
  function narisiPot() {
    const r = odsek.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    const tocke = [{ x: r.width / 2, y: 0 }];
    const indeksi = [];
    for (const p of poglavja) {
      const pin = p.querySelector(".napis-pin").getBoundingClientRect();
      const napis = p.querySelector(".napis").getBoundingClientRect();
      const x = pin.left + pin.width / 2 - r.left;
      indeksi.push(tocke.length);
      tocke.push({ x, y: pin.top + pin.height / 2 - r.top });
      tocke.push({ x, y: napis.bottom - r.top + 48 });
    }
    tocke.push({ x: r.width / 2, y: r.height });
    let d = `M ${tocke[0].x} ${tocke[0].y}`;
    const kosiPoti = [];
    for (let i = 1; i < tocke.length; i++) {
      const a = tocke[i - 1], b = tocke[i];
      const dy = (b.y - a.y) * 0.55;
      d += ` C ${a.x} ${a.y + dy}, ${b.x} ${b.y - dy}, ${b.x} ${b.y}`;
      kosiPoti.push(d);
    }
    sled.setAttribute("d", d);
    crta.setAttribute("d", d);
    dolzina = crta.getTotalLength() || 1;
    const merilo = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(merilo);
    delezi = indeksi.map((k) => { merilo.setAttribute("d", kosiPoti[k - 1]); return merilo.getTotalLength() / dolzina; });
    merilo.remove();
    crta.style.strokeDasharray = `${dolzina}`;
  }
  function napredek(delez) {
    crta.style.strokeDashoffset = `${dolzina * (1 - delez)}`;
    poglavja.forEach((p, i) => p.toggleAttribute("data-dosezeno", delez >= delezi[i] - 0.002));
  }
  narisiPot();
  napredek(0);
  ScrollTrigger.create({
    trigger: odsek, start: "top 55%", end: "bottom 55%", scrub: 0.75,
    onRefresh: () => { narisiPot(); },
    onUpdate: (st) => napredek(st.progress),
  });

  // napisi: besede pridejo, ko poglavje pride v pogled; stavek za njimi
  for (const n of odsek.querySelectorAll(".napis")) {
    const deli = besede(n.querySelector("h2"));
    gsap.timeline({ scrollTrigger: { trigger: n, start: "top 80%", toggleActions: "play none none none" } })
      .from(deli, { yPercent: 110, duration: 1.0, ease: "expo.out", stagger: 0.05 })
      .from(n.querySelector("p"), { y: 16, autoAlpha: 0, duration: 0.8, ease: "expo.out" }, 0.2);
  }

  // predvajanje grafike glede na trenutni korak
  function stanje(tl) {
    const t = tl.time();
    const naj = t >= 4.0;
    if (naj && !tece) {
      if (!video.src) video.src = video.dataset.src;
      video.play().catch(() => {});
      tece = true;
    } else if (!naj && tece) {
      video.pause();
      tece = false;
    }
  }
}
