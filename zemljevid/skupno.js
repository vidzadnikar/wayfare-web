// Skupno trem primerom: kraji s koordinatami, filmi iz vlogi.json po krajih,
// risanje pik na platno (Mercator), zatiči in seznam filmov izbranega kraja.

export const KRAJI = {
  "Milan, Italy":      { ime: "Milano",     lon: 9.19,   lat: 45.464, stran: "levo" }, // ime levo, da ne prekrije Rifnika
  "Madrid, Spain":     { ime: "Madrid",     lon: -3.704, lat: 40.417 },
  "Rifnik, Slovenia":  { ime: "Rifnik",     lon: 15.42,  lat: 46.22, stran: "spodaj" }, // ime pod piko, med Milanom in Budimpešto
  "Budapest, Hungary": { ime: "Budimpešta", lon: 19.04,  lat: 47.498 },
};

const MESECI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

export async function podatki({ pike: sPikami = true } = {}) {
  const [pike, vlogi] = await Promise.all([
    sPikami ? fetch("pike.json").then((r) => r.json()) : null,
    fetch("../stran/vlogi.json").then((r) => r.json()),
  ]);
  const kraji = []; // v vrstnem redu prvega pojava: najnovejše potovanje prvo
  for (const v of vlogi.vlogi) {
    const k = KRAJI[v.kraj.en];
    if (!k) continue;
    let z = kraji.find((x) => x.kljuc === v.kraj.en);
    if (!z) { z = { kljuc: v.kraj.en, ...k, filmi: [] }; kraji.push(z); }
    z.filmi.push(v);
  }
  for (const z of kraji) {
    const od = z.filmi.map((v) => v.datum).sort()[0];
    const do_ = z.filmi.map((v) => v.datum_do || v.datum).sort().at(-1);
    z.od = od; z.do = do_;
  }
  return { pike, kraji };
}

export const cas = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const varno = (t) => t.replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z]));

export function mnozina(n) {
  const r = n % 100;
  return `${n} ${r === 1 ? "film" : r === 2 ? "filma" : r === 3 || r === 4 ? "filmi" : "filmov"}`;
}

export function obdobje(od, do_) {
  const [l1, m1, d1] = od.split("-").map(Number);
  const [l2, m2, d2] = do_.split("-").map(Number);
  if (od === do_) return `${d1}. ${MESECI[m1 - 1]} ${l1}`;
  if (l1 === l2 && m1 === m2) return `${d1}.–${d2}. ${MESECI[m1 - 1]} ${l1}`;
  return `${d1}. ${MESECI[m1 - 1]} – ${d2}. ${MESECI[m2 - 1]} ${l2}`;
}

export function kartica(v) {
  const o = v.oznaka, pokoncno = v.visina > v.sirina, naslov = varno(v.naslov.sl), slika = `../stran/media/vlogi/${o}.jpg`;
  return (
    `<li class="kartica${pokoncno ? " kartica-pokoncna" : ""}" data-vlog="${o}">` +
    `<a class="kartica-povezava" href="../stran/sl/vlogi/#${o}" aria-label="${naslov}, ${cas(v.trajanje)}">` +
    `<span class="kartica-slika">` +
    (pokoncno ? `<img class="kartica-ozadje" src="${slika}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : "") +
    `<img src="${slika}" alt="" width="${v.sirina}" height="${v.visina}" loading="lazy" decoding="async">` +
    `<video class="kartica-zanka" muted playsinline loop preload="none" tabindex="-1" aria-hidden="true" data-zanka-src="../stran/media/vlogi/${o}-zanka.mp4"></video>` +
    `<span class="kartica-cas">${cas(v.trajanje)}</span></span>` +
    `<span class="kartica-naslov serif">${naslov}</span></a></li>`
  );
}

// z miško nad kartico teče nem predogled (kot na strani)
export function zankeKartic(koren) {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  for (const k of koren.querySelectorAll(".kartica")) {
    const povezava = k.querySelector(".kartica-povezava"), zanka = k.querySelector("[data-zanka-src]");
    const zacni = () => { if (!zanka.getAttribute("src")) zanka.src = zanka.dataset.zankaSrc; zanka.play().then(() => { zanka.dataset.tece = ""; }).catch(() => {}); };
    const ustavi = () => { zanka.pause(); delete zanka.dataset.tece; try { zanka.currentTime = 0; } catch (e) {} };
    povezava.addEventListener("pointerenter", zacni); povezava.addEventListener("pointerleave", ustavi);
    povezava.addEventListener("focus", zacni); povezava.addEventListener("blur", ustavi);
  }
}

export function pokaziFilme(kraj, koren) {
  const naslov = koren.querySelector("[data-filmi-naslov]");
  const opis = koren.querySelector("[data-filmi-opis]");
  const seznam = koren.querySelector("[data-filmi-kartice]");
  naslov.textContent = kraj.ime;
  opis.textContent = `${mnozina(kraj.filmi.length)} · ${obdobje(kraj.od, kraj.do)}`;
  seznam.innerHTML = kraj.filmi.map(kartica).join("");
  zankeKartic(seznam);
  gsap.fromTo([naslov, opis, ...seznam.children], { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease: "expo.out", overwrite: true });
}

// ---------------------------------------------------------------- ravni zemljevid
export const merc = (lon, lat) => [lon * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];

export function risalnik(obmocje, pike) {
  const canvas = obmocje.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const pogled = { cx: 0, cy: 0, k: 1 };
  let W = 0, H = 0, dpr = 1;
  function velikost() {
    const r = obmocje.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const zaslon = (lon, lat) => {
    const [mx, my] = merc(lon, lat);
    return [(mx - pogled.cx) * pogled.k + W / 2, (pogled.cy - my) * pogled.k + H / 2];
  };
  function okvir(lon0, lon1, lat0, lat1, rob = 0.1) {
    const [x0, y0] = merc(lon0, lat0), [x1, y1] = merc(lon1, lat1);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: Math.min(W / (x1 - x0), H / (y1 - y0)) * (1 - rob) };
  }
  function pike_(seznam, r, alfa, izpusti) {
    if (alfa <= 0.01) return;
    ctx.fillStyle = `rgba(239, 233, 223, ${alfa})`;
    ctx.beginPath();
    for (let i = 0; i < seznam.length; i += 2) {
      const lon = seznam[i], lat = seznam[i + 1];
      if (lat > 72 || (izpusti && izpusti(lon, lat))) continue;
      const [x, y] = zaslon(lon, lat);
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
    }
    ctx.fill();
  }
  function narisi() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const k = pogled.k;
    const evropa = Math.min(1, Math.max(0, (k - 320) / 480)); // podrobne pike Evrope se prikažejo ob približanju
    const r = Math.min(2.0, Math.max(0.8, k * 0.0022));
    const vEvropi = (lon, lat) => lon > -25 && lon < 45 && lat > 30 && lat < 72;
    pike_(pike.svet, r, 0.32, null);
    if (evropa > 0) {
      // svet v Evropi zbledi, podrobne pike pridejo
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${evropa})`;
      const [ax, ay] = zaslon(-25, 72), [bx, by] = zaslon(45, 30);
      ctx.fillRect(ax, ay, bx - ax, by - ay);
      ctx.globalCompositeOperation = "source-over";
      pike_(pike.evropa, r * 0.92, 0.34 * evropa, (lon, lat) => !vEvropi(lon, lat));
    }
    obmocje.dispatchEvent(new CustomEvent("narisano"));
  }
  velikost();
  return { pogled, zaslon, okvir, narisi, velikost, get W() { return W; }, get H() { return H; } };
}

// zatiči nad platnom; vrne { aktiven(kraj), elementi }
export function zatici(obmocje, kraji, r, obKliku, { stevilke = false, skrijPod = 0 } = {}) {
  const ovoj = obmocje.querySelector(".zatici");
  const elementi = kraji.map((kraj, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "zatic" + (kraj.stran ? ` zatic-${kraj.stran}` : ""); b.setAttribute("aria-pressed", "false");
    const pika = `<span class="zatic-pika">${stevilke ? i + 1 : ""}</span>`, ime = `<span class="zatic-ime">${kraj.ime}</span>`;
    b.innerHTML = kraj.stran === "levo" ? ime + pika : pika + ime;
    b.addEventListener("click", () => obKliku(kraj));
    ovoj.appendChild(b);
    return { kraj, el: b };
  });
  function postavi() {
    for (const z of elementi) {
      const [x, y] = r.zaslon(z.kraj.lon, z.kraj.lat);
      z.el.style.left = `${x}px`; z.el.style.top = `${y}px`;
      const meja = typeof skrijPod === "function" ? skrijPod() : skrijPod;
      if (r.pogled.k < meja) z.el.dataset.skrit = ""; else delete z.el.dataset.skrit;
    }
  }
  obmocje.addEventListener("narisano", postavi);
  return {
    elementi,
    aktiven(kraj) { for (const z of elementi) z.el.setAttribute("aria-pressed", String(z.kraj === kraj)); },
  };
}
