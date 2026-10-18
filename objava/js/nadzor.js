// Nadzor strani (/nadzor): vse podatke da /api/nadzor/clani v enem klicu.
// Dejanja: člani (/api/nadzor/clan), zadržana obvestila (/api/nadzor/obvestilo),
// vlogi z YouTuba (/api/nadzor/youtube), komentarji (/api/komentarji/izbrisi),
// odzivi (/api/nadzor/odziv),
// novica (/api/nadzor/novica), vrsta
// (/api/nadzor/vrsta) in nastavitve (/api/nadzor/nastavitve). Izvoz je
// navadna povezava. Imena vlogov pridejo iz /vlogi/seznam.json.
const koren = document.querySelector("[data-nadzor]");
const $ = (izbirnik) => koren.querySelector(izbirnik);
const povzetek = $("[data-povzetek]");
const sporocilo = $("[data-sporocilo]");
const gumbVrsta = $("[data-vrsta-poslji]");
const novica = $("[data-novica]");
const youtube = $("[data-youtube]");
const nastavitve = $("[data-nastavitve]");
let stanje = null;
let imenaVlogov = {};
let osvezevanje = null;

const datum = (iso) => (iso ? new Date(iso).toLocaleString("sl-SI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const dan = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
const el = (oznaka, lastnosti = {}, ...otroci) => {
  const e = document.createElement(oznaka);
  for (const [k, v] of Object.entries(lastnosti)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, "");
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
  }
  for (const o of otroci) if (o !== null && o !== undefined) e.append(o);
  return e;
};
const prazno = (stolpcev, besedilo) => el("tr", {}, el("td", { colspan: stolpcev, class: "naslov prazno" }, besedilo));
const imeVloga = (oznaka) => imenaVlogov[oznaka] || oznaka;

function povej(besedilo, napaka = false) {
  sporocilo.textContent = besedilo;
  sporocilo.classList.toggle("napaka", napaka);
  sporocilo.hidden = false;
}

async function klic(url, telo) {
  const r = await fetch(url, telo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(telo) } : { headers: { Accept: "application/json" } });
  const odg = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(odg.sporocilo || odg.napaka || `napaka ${r.status}`);
  return odg;
}

// ---------------------------------------------------------------- člani
function stanjeClana(c) {
  if (c.blokiran) return ["blokiran", "blokiran"];
  if (c.odjavljen_at) return ["odjavljen", "odjavljen"];
  if (!c.potrjen_at) return ["nepotrjen", "nepotrjen"];
  return ["aktiven", "aktiven"];
}

function vrsticaClana(c) {
  const [oznaka, razred] = stanjeClana(c);
  const jaz = c.id === stanje.admin.id;
  const ime = el("td", { class: "naslov" });
  if (c.slika_url) ime.append(el("img", { class: "clan-majhna", src: c.slika_url, alt: "", width: 24, height: 24, referrerpolicy: "no-referrer" }));
  ime.append(c.ime || "—", jaz ? " (ti)" : "");
  const zeli = [c.zeli_vlogi && "vlogi", c.zeli_izdaje && "aplikacija", c.zeli_novice && "novice"].filter(Boolean).join(", ") || "nič";
  const dejanja = el("td");
  if (!jaz) {
    dejanja.append(
      el("button", { type: "button", class: "tabela-gumb", onclick: () => dejanjeClana(c, c.blokiran ? "odblokiraj" : "blokiraj") }, c.blokiran ? "Odblokiraj" : "Blokiraj"),
      " ",
      el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => dejanjeClana(c, "izbrisi") }, "Izbriši"),
    );
  }
  return el("tr", {},
    ime,
    el("td", {}, c.email),
    el("td", {}, c.vir === "google" ? "Google" : "e-pošta"),
    el("td", {}, c.jezik.toUpperCase()),
    el("td", {}, zeli),
    el("td", {}, datum(c.ustvarjen_at)),
    el("td", {}, datum(c.zadnji_obisk_at)),
    el("td", {}, String(c.obiskov)),
    el("td", {}, c.ogledanih ? `${c.ogledanih} ${c.ogledanih === 1 ? "film" : c.ogledanih === 2 ? "filma" : c.ogledanih < 5 ? "filme" : "filmov"}` : "—"),
    el("td", { class: `stanje-${razred}` }, oznaka),
    dejanja,
  );
}

async function dejanjeClana(c, kaj) {
  const vprasanje = { blokiraj: `Blokiram ${c.email}? Ne bo več dobival pošte in se ne bo mogel prijaviti.`, odblokiraj: `Odblokiram ${c.email}?`, izbrisi: `Izbrišem ${c.email}? Vsi njegovi podatki izginejo.` }[kaj];
  if (!confirm(vprasanje)) return;
  try {
    await klic("/api/nadzor/clan", { id: c.id, dejanje: kaj });
    povej(`${kaj === "izbrisi" ? "Izbrisan" : kaj === "blokiraj" ? "Blokiran" : "Odblokiran"}: ${c.email}`);
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

// ---------------------------------------------------------------- pregled
function ploscica(vrednost, oznaka, dodatek) {
  return el("div", { class: "ploscica" }, el("p", { class: "ploscica-vrednost serif" }, String(vrednost)), el("p", { class: "ploscica-oznaka" }, oznaka), dodatek ? el("p", { class: "ploscica-dodatek" }, dodatek) : null);
}

function narisiPregled() {
  const { clani, ogledi, obiski, vrsta } = stanje;
  const aktivnih = clani.filter((c) => stanjeClana(c)[0] === "aktiven").length;
  const danes = new Date().toISOString().slice(0, 10);
  const obiskDanes = (k) => obiski.find((o) => o.dan === danes && o.kljuc === k)?.stevilo || 0;
  const vsehOgledov = ogledi.reduce((s, o) => s + o.ogledov, 0);
  const odzivi = stanje.odzivi || [];
  const neresenih = odzivi.filter((o) => !o.resen_at).length;
  $("[data-ploscice]").replaceChildren(
    ploscica(aktivnih, "aktivnih članov", `${clani.length} skupaj`),
    ploscica(neresenih, "nerešenih odzivov", `${odzivi.length} skupaj`),
    ploscica(obiskDanes("obisk_gost") + obiskDanes("obisk_clan"), "nalaganj strani danes", `${obiskDanes("obisk_clan")} od članov`),
    ploscica(vsehOgledov, "ogledov vlogov", `${ogledi.length} različnih filmov`),
    ploscica(`${vrsta.dnevno.poslanih}/${vrsta.dnevno.meja}`, "pošt danes", vrsta.caka ? `${vrsta.caka} čaka v vrsti` : "vrsta je prazna"),
  );
  // graf: zadnjih 14 dni, gostje in člani
  const dnevi = [];
  for (let i = 13; i >= 0; i--) dnevi.push(new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10));
  const st = (d, k) => obiski.find((o) => o.dan === d && o.kljuc === k)?.stevilo || 0;
  const najvec = Math.max(1, ...dnevi.map((d) => st(d, "obisk_gost") + st(d, "obisk_clan")));
  $("[data-graf]").replaceChildren(...dnevi.map((d) => {
    const g = st(d, "obisk_gost"), c = st(d, "obisk_clan");
    const palica = el("span", { class: "graf-palica" });
    // slog prek CSSOM: CSP strani ne dovoli atributa style
    palica.style.setProperty("--v", ((g + c) / najvec).toFixed(3));
    palica.style.setProperty("--c", (c / Math.max(1, g + c)).toFixed(3));
    return el("div", { class: "graf-stolpec", title: `${dan(d)}: ${g + c} (${c} od članov)` },
      el("span", { class: "graf-vrednost" }, g + c ? String(g + c) : ""),
      palica,
      el("span", { class: "graf-dan" }, dan(d)),
    );
  }));
}

// ---------------------------------------------------------------- čaka tebe
function narisiCakajo() {
  const zadrzana = stanje.obvestila.filter((o) => o.zadrzano === 1);
  const napake = stanje.youtube.filter((y) => y.stanje === "napaka");
  const vrstice = [
    ...zadrzana.map((o) => el("tr", {},
      el("td", {}, `obvestilo (${o.vrsta})`),
      el("td", { class: "naslov" }, o.naslov_sl || o.naslov_en),
      el("td", {}, datum(o.ustvarjeno_at)),
      el("td", {},
        el("button", { type: "button", class: "tabela-gumb", onclick: () => obvestilo(o, "poslji") }, "Pošlji"), " ",
        el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => obvestilo(o, "zavrzi") }, "Zavrzi")),
    )),
    ...napake.map((y) => el("tr", {},
      el("td", {}, "vlog ni dodan"),
      el("td", { class: "naslov" }, `${y.naslov_sl} — ${y.napaka || "napaka"}`),
      el("td", {}, datum(y.ustvarjeno_at)),
      el("td", {},
        el("button", { type: "button", class: "tabela-gumb", onclick: () => youtubeDejanje(y, "znova") }, "Poskusi znova"), " ",
        el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => youtubeDejanje(y, "izbrisi") }, "Izbriši")),
    )),
  ];
  $("[data-cakajo-odsek]").hidden = !vrstice.length;
  $("[data-cakajo] tbody").replaceChildren(...vrstice);
}

async function obvestilo(o, dejanje) {
  const n = stanje.clani.filter((c) => stanjeClana(c)[0] === "aktiven").length;
  if (dejanje === "poslji" && !confirm(`Pošljem »${o.naslov_sl}« članom, ki želijo to vrsto obvestil (aktivnih ${n})?`)) return;
  if (dejanje === "zavrzi" && !confirm(`Zavržem »${o.naslov_sl}«? Članom ne gre nič.`)) return;
  try {
    const r = await klic("/api/nadzor/obvestilo", { kljuc: o.kljuc, dejanje });
    povej(dejanje === "zavrzi" ? "Obvestilo je zavrženo." : `Poslano: ${r.prejemnikov} prejemnikov v vrsti, poslanih zdaj ${r.poslanih}.${r.napaka ? ` Napaka: ${r.napaka}` : ""}`, !!r.napaka);
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

// ---------------------------------------------------------------- YouTube
const OPIS_STANJA = { caka: ["čaka", "Dodal se bo v nekaj minutah."], v_delu: ["dodajam", "Stran se gradi."], dodan: ["na strani", ""], napaka: ["napaka", ""] };

function narisiYoutube() {
  const vrstice = stanje.youtube.map((y) => {
    const [oznaka, namig] = OPIS_STANJA[y.stanje] || [y.stanje, ""];
    const dejanja = el("td");
    if (y.stanje === "caka" || y.stanje === "napaka") dejanja.append(el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => youtubeDejanje(y, "izbrisi") }, "Izbriši"));
    if (y.stanje === "dodan" && y.oznaka) dejanja.append(el("a", { class: "tabela-gumb", href: `/sl/vlogi/${y.oznaka}/` }, "Poglej"));
    return el("tr", {},
      el("td", { class: "naslov" }, el("a", { href: `https://youtu.be/${y.id}`, rel: "noopener", target: "_blank" }, y.naslov_sl)),
      el("td", {}, y.kraj_sl),
      el("td", {}, y.vir === "kanal" ? "kanal" : "nadzor"),
      el("td", { class: y.stanje === "napaka" ? "stanje-blokiran" : y.stanje === "dodan" ? "stanje-aktiven" : "", title: y.napaka || namig }, oznaka),
      el("td", {}, datum(y.ustvarjeno_at)),
      dejanja,
    );
  });
  $("[data-youtube-seznam] tbody").replaceChildren(...vrstice);
  if (!vrstice.length) $("[data-youtube-seznam] tbody").append(prazno(6, "Še noben vlog ni bil dodan od tu."));
  // med dodajanjem osveži sam
  const vTeku = stanje.youtube.some((y) => y.stanje === "caka" || y.stanje === "v_delu");
  clearTimeout(osvezevanje);
  if (vTeku) osvezevanje = setTimeout(nalozi, 30000);
}

async function youtubeDejanje(y, dejanje) {
  if (dejanje === "izbrisi" && !confirm(`Odstranim »${y.naslov_sl}« iz vrste?`)) return;
  try {
    await klic("/api/nadzor/youtube", { dejanje, id: y.id });
    povej(dejanje === "izbrisi" ? "Odstranjeno iz vrste." : "Vlog je spet v vrsti.");
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

// predlog iz povezave: polja izpolni, kar admin še ni spremenil
const polja = ["naslov_sl", "naslov_en", "kraj_sl", "kraj_en"];
let zadnjiPredlog = {};
let casPredloga;
async function predlog() {
  const url = youtube.elements.url.value.trim();
  const namig = $("[data-youtube-namig]");
  if (!url) { namig.textContent = ""; return; }
  try {
    const p = await klic(`/api/nadzor/youtube?url=${encodeURIComponent(url)}`);
    for (const ime of polja) {
      const polje = youtube.elements[ime];
      if (!polje.value || polje.value === zadnjiPredlog[ime]) polje.value = p[ime];
    }
    zadnjiPredlog = p;
    const deli = [`Na YouTubu: »${p.naslov_youtube}«.`];
    if (!p.znan_kraj) deli.push("Kraja ne poznam: preveri ime, na globus ga postavim po imenu.");
    if (p.obstojec) deli.push(p.obstojec.stanje === "dodan" ? "Ta video je že na strani." : "Ta video je že v vrsti.");
    namig.textContent = deli.join(" ");
    namig.classList.remove("napaka");
  } catch (e) {
    namig.textContent = e.message;
    namig.classList.add("napaka");
  }
}
youtube.elements.url.addEventListener("input", () => { clearTimeout(casPredloga); casPredloga = setTimeout(predlog, 400); });

youtube.addEventListener("submit", async (e) => {
  e.preventDefault();
  const gumb = youtube.querySelector('button[type="submit"]');
  gumb.disabled = true;
  try {
    const telo = Object.fromEntries(new FormData(youtube));
    if (zadnjiPredlog.kraj_en === telo.kraj_en) Object.assign(telo, { lon: zadnjiPredlog.lon, lat: zadnjiPredlog.lat });
    await klic("/api/nadzor/youtube", telo);
    povej(`»${telo.naslov_sl}« je v vrsti. Na strani bo v nekaj minutah, nato gre obvestilo članom.`);
    youtube.reset();
    zadnjiPredlog = {};
    $("[data-youtube-namig]").textContent = "";
    await nalozi();
  } catch (e2) { povej(e2.message, true); }
  gumb.disabled = false;
});

// ---------------------------------------------------------------- ogledi
function narisiOgledi() {
  const kdo = {};
  for (const o of stanje.ogledi_clanov) (kdo[o.oznaka] ||= []).push(o.kdo);
  const vrstice = stanje.ogledi.map((o) => el("tr", {},
    el("td", { class: "naslov" }, imeVloga(o.oznaka)),
    el("td", {}, String(o.ogledov)),
    el("td", {}, String(o.clanov)),
    el("td", {}, String(o.gostov || 0)),
    el("td", { class: "naslov" }, (kdo[o.oznaka] || []).join(", ") || "—"),
    el("td", {}, datum(o.zadnji)),
  ));
  $("[data-ogledi] tbody").replaceChildren(...vrstice);
  if (!vrstice.length) $("[data-ogledi] tbody").append(prazno(6, "Ogledov še ni. Šteti se začnejo, ko nekdo predvaja film na strani."));
}

// ---------------------------------------------------------------- odzivi
const VRSTE_ODZIVA = { napaka: "Napaka", predlog: "Predlog", pohvala: "Pohvala" };

function narisiOdzive() {
  const vrstice = (stanje.odzivi || []).map((o) => {
    const kdo = o.email ? el("a", { href: `mailto:${o.email}` }, o.ime ? `${o.ime} (${o.email})` : o.email) : (o.ime || "—");
    const odKod = [o.vir === "app" ? "aplikacija" : "stran", o.razlicica, o.sistem, o.jezik?.toUpperCase()].filter(Boolean).join(" · ");
    return el("tr", {},
      el("td", { class: "naslov" }, VRSTE_ODZIVA[o.vrsta] || o.vrsta),
      el("td", { class: "naslov komentar-celica" }, o.besedilo),
      el("td", {}, kdo),
      el("td", {}, odKod),
      el("td", {}, datum(o.ustvarjeno_at)),
      el("td", { class: o.resen_at ? "stanje-odjavljen" : "stanje-aktiven" }, o.resen_at ? `rešeno ${datum(o.resen_at)}` : "odprto"),
      el("td", {},
        el("button", { type: "button", class: "tabela-gumb", onclick: () => dejanjeOdziva(o, o.resen_at ? "odpri" : "resen") }, o.resen_at ? "Odpri znova" : "Rešeno"), " ",
        el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => dejanjeOdziva(o, "izbrisi") }, "Izbriši")),
    );
  });
  $("[data-odzivi] tbody").replaceChildren(...vrstice);
  if (!vrstice.length) $("[data-odzivi] tbody").append(prazno(7, "Odzivov še ni."));
}

async function dejanjeOdziva(o, dejanje) {
  if (dejanje === "izbrisi" && !confirm(`Izbrišem odziv »${o.besedilo.slice(0, 80)}«?`)) return;
  try {
    await klic("/api/nadzor/odziv", { id: o.id, dejanje });
    povej({ resen: "Odziv je rešen.", odpri: "Odziv je spet odprt.", izbrisi: "Odziv je izbrisan." }[dejanje]);
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

// ---------------------------------------------------------------- komentarji
function narisiKomentarje() {
  const vrstice = (stanje.komentarji || []).map((k) => el("tr", {},
    el("td", { class: "naslov" }, el("a", { href: `/sl/vlogi/${k.oznaka}/#komentar-${k.id}` }, imeVloga(k.oznaka))),
    el("td", {}, k.kdo),
    el("td", { class: "naslov komentar-celica" }, (k.odgovor_na ? "↳ " : "") + k.besedilo),
    el("td", {}, String(k.vseckov)),
    el("td", {}, datum(k.ustvarjeno_at)),
    el("td", {}, el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => izbrisiKomentar(k) }, "Izbriši")),
  ));
  $("[data-komentarji] tbody").replaceChildren(...vrstice);
  if (!vrstice.length) $("[data-komentarji] tbody").append(prazno(6, "Komentarjev še ni."));
}

async function izbrisiKomentar(k) {
  if (!confirm(`Izbrišem komentar »${k.besedilo.slice(0, 80)}«${k.odgovor_na ? "" : " in vse odgovore nanj"}?`)) return;
  try {
    await klic("/api/komentarji/izbrisi", { id: k.id });
    povej("Komentar je izbrisan.");
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

// ---------------------------------------------------------------- obvestila
function vrsticaObvestila(o) {
  let stanjeO = "poslano", razred = "";
  if (o.zadrzano === 1) { stanjeO = "čaka tebe"; razred = "stanje-blokiran"; }
  else if (o.zadrzano === 2) { stanjeO = "zavrženo"; razred = "stanje-odjavljen"; }
  else if (o.caka) { stanjeO = `v vrsti ${o.caka}${o.napaka ? ` (napaka: ${o.napaka})` : ""}`; razred = o.napaka ? "stanje-blokiran" : ""; }
  return el("tr", {},
    el("td", {}, o.kljuc),
    el("td", {}, o.vrsta),
    el("td", { class: "naslov" }, o.naslov_sl || o.naslov_en || ""),
    el("td", {}, datum(o.ustvarjeno_at)),
    el("td", {}, String(o.prejemnikov)),
    el("td", { class: razred }, stanjeO),
  );
}

// ---------------------------------------------------------------- nastavitve
const IMENA_NASTAVITEV = {
  obvestila_vlogi: "Samodejna obvestila o vlogih",
  obvestila_izdaje: "Samodejna obvestila o izdajah aplikacije",
  youtube_kanal: "Javni videi s kanala na stran sami",
  prijave_odprte: "Prijave odprte za nove člane",
  obvesti_me_novi_clan: "Obvesti me ob novem članu",
  komentarji_odprti: "Komentarji odprti",
  obvesti_me_komentar: "Obvesti me ob novem komentarju",
  odzivi_odprti: "Odzivi odprti",
  obvesti_me_odziv: "Obvesti me ob novem odzivu",
  posta_dnevno: "Dnevna meja pošte",
  besedilo_vlog_sl: "Besedilo obvestila o vlogu (SL)",
  besedilo_vlog_en: "Besedilo obvestila o vlogu (EN)",
};

function narisiNastavitve() {
  const { vrednosti, opisi } = stanje.nastavitve;
  $("[data-nastavitve-seznam]").replaceChildren(...Object.entries(opisi).map(([kljuc, n]) => {
    const id = `nastavitev-${kljuc}`;
    let polje;
    if (n.vrsta === "da_ne") polje = el("input", { id, name: kljuc, type: "checkbox", class: "stikalo", role: "switch", checked: vrednosti[kljuc] });
    else if (n.vrsta === "stevilo") polje = el("input", { id, name: kljuc, type: "number", min: n.najmanj, max: n.najvec, step: 1, value: vrednosti[kljuc], class: "nastavitev-stevilo" });
    else polje = el("input", { id, name: kljuc, type: "text", maxlength: n.najvec, value: vrednosti[kljuc], class: "nastavitev-besedilo" });
    return el("div", { class: `nastavitev nastavitev-${n.vrsta}` },
      el("label", { for: id, class: "nastavitev-ime" }, IMENA_NASTAVITEV[kljuc] || kljuc),
      polje,
      el("p", { class: "nastavitev-opis" }, n.opis),
    );
  }));
}

nastavitve.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { vrednosti, opisi } = stanje.nastavitve;
  const spremembe = {};
  for (const [kljuc, n] of Object.entries(opisi)) {
    const polje = nastavitve.elements[kljuc];
    const v = n.vrsta === "da_ne" ? polje.checked : n.vrsta === "stevilo" ? Number(polje.value) : polje.value.trim();
    if (v !== vrednosti[kljuc]) spremembe[kljuc] = v;
  }
  if (!Object.keys(spremembe).length) { povej("Ni sprememb."); return; }
  try {
    stanje.nastavitve = await klic("/api/nadzor/nastavitve", spremembe);
    narisiNastavitve();
    povej(`Shranjeno: ${Object.keys(spremembe).map((k) => IMENA_NASTAVITEV[k] || k).join(", ")}.`);
  } catch (e2) { povej(e2.message, true); }
});

// ---------------------------------------------------------------- nalaganje
async function nalozi() {
  try {
    const [podatki, seznam] = await Promise.all([
      klic("/api/nadzor/clani"),
      fetch("/vlogi/seznam.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    stanje = podatki;
    imenaVlogov = Object.fromEntries(seznam.map((v) => [v.oznaka, v.naslov]));
  } catch (e) {
    povzetek.textContent = `Ni šlo: ${e.message}`;
    return;
  }
  const { clani, obvestila, vrsta } = stanje;
  const st = (f) => clani.filter(f).length;
  povzetek.textContent = `${clani.length} članov · ${st((c) => stanjeClana(c)[0] === "aktiven")} aktivnih · ${st((c) => c.odjavljen_at && !c.blokiran)} odjavljenih · ${st((c) => c.blokiran)} blokiranih · danes poslanih ${vrsta.dnevno.poslanih} od ${vrsta.dnevno.meja} · v vrsti čaka ${vrsta.caka}`;
  gumbVrsta.hidden = !vrsta.caka;
  narisiPregled();
  narisiCakajo();
  narisiYoutube();
  $("[data-clani] tbody").replaceChildren(...clani.map(vrsticaClana));
  if (!clani.length) $("[data-clani] tbody").append(prazno(11, "Še nihče."));
  narisiOdzive();
  narisiOgledi();
  narisiKomentarje();
  $("[data-obvestila] tbody").replaceChildren(...obvestila.map(vrsticaObvestila));
  if (!obvestila.length) $("[data-obvestila] tbody").append(prazno(6, "Še nič."));
  if (!nastavitve.contains(document.activeElement)) narisiNastavitve();
}

gumbVrsta.addEventListener("click", async () => {
  gumbVrsta.disabled = true;
  try {
    const r = await klic("/api/nadzor/vrsta", {});
    povej(`Poslanih ${r.poslanih}, čaka še ${r.caka}.${r.napaka ? ` Napaka: ${r.napaka}` : ""}`, !!r.napaka);
    await nalozi();
  } catch (e) { povej(e.message, true); }
  gumbVrsta.disabled = false;
});
$("[data-osvezi]").addEventListener("click", nalozi);

novica.addEventListener("submit", async (e) => {
  e.preventDefault();
  const komu = e.submitter?.dataset.komu || "sebi";
  const f = new FormData(novica);
  const telo = {
    komu,
    naslov: { sl: f.get("naslov_sl"), en: f.get("naslov_en") },
    besedilo: { sl: f.get("besedilo_sl"), en: f.get("besedilo_en") },
    url: f.get("url") || null,
  };
  if (komu === "vsem") {
    const n = stanje ? stanje.clani.filter((c) => stanjeClana(c)[0] === "aktiven" && c.zeli_novice).length : "?";
    if (!confirm(`Pošljem novico vsem ${n} članom, ki želijo novice? Tega se ne da preklicati.`)) return;
  }
  for (const g of novica.querySelectorAll("button")) g.disabled = true;
  try {
    const r = await klic("/api/nadzor/novica", telo);
    if (r.stanje === "poslano_sebi") povej(`Preizkus (SL in EN) je poslan na ${r.za}.`);
    else {
      povej(`Novica je v vrsti za ${r.obvestilo.prejemnikov} članov. Poslanih zdaj ${r.poslanih}, čaka še ${r.caka}.${r.napaka ? ` Napaka: ${r.napaka}` : ""}`, !!r.napaka);
      novica.reset();
      await nalozi();
    }
  } catch (e2) { povej(e2.message, true); }
  for (const g of novica.querySelectorAll("button")) g.disabled = false;
});

nalozi();
