// Komentarji pod vlogom (stran ogleda). Bere jih vsak obiskovalec, piše,
// odgovarja, všečka, ureja in briše svoje le prijavljen član (admin briše vse).
// Zaledje: /api/komentarji (GET seznam, POST nov), /api/komentarji/vsec,
// /api/komentarji/uredi, /api/komentarji/izbrisi. Vse besedilo gre v stran
// kot besedilo (textContent), nikoli kot HTML. Časi v komentarju (1:23)
// skočijo v film, povezave so klikljive. Besedila strani so v data-*.
const NAJVEC = 2000;
const BARVE = ["#64e2d6", "#9d8cff", "#f2b880", "#7cc4f6", "#f2919f", "#a9d98f"];

export function komentarji(koren, { skoci } = {}) {
  if (!koren) return;
  const b = koren.dataset;
  const jezik = b.jezik === "sl" ? "sl" : "en";
  const oznaka = b.oznaka;
  const naslov = koren.querySelector("[data-komentarji-naslov]");
  const pisanje = koren.querySelector("[data-komentarji-pisanje]");
  const stanjeEl = koren.querySelector("[data-komentarji-stanje]");
  const seznam = koren.querySelector("[data-komentarji-seznam]");
  const osnovniNaslov = naslov.textContent;
  let podatki = { odprti: true, jaz: null, komentarji: [] };
  const rtf = new Intl.RelativeTimeFormat(jezik, { numeric: "auto" });
  const datumF = new Intl.DateTimeFormat(jezik === "sl" ? "sl-SI" : "en-GB", { dateStyle: "long", timeStyle: "short" });

  // ---------------------------------------------------------------- pomočniki
  const el = (oznakaEl, lastnosti = {}, ...otroci) => {
    const e = document.createElement(oznakaEl);
    for (const [k, v] of Object.entries(lastnosti)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const o of otroci) if (o !== null && o !== undefined && o !== false) e.append(o);
    return e;
  };
  const svg = (pot, razred = "komentar-ikona") => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", razred);
    s.innerHTML = pot; // stalne poti ikon, nikoli podatki
    return s;
  };
  const SRCE = '<path d="M12 20.3s-7.5-4.6-9.2-9.4C1.6 7.4 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.4 4.4 6.9-1.7 4.8-9.2 9.4-9.2 9.4z"/>';

  function stevilo(n) {
    if (!n) return osnovniNaslov;
    if (jezik === "en") return `${n} ${n === 1 ? "comment" : "comments"}`;
    const r = n % 100;
    return `${n} ${r === 1 ? "komentar" : r === 2 ? "komentarja" : r === 3 || r === 4 ? "komentarji" : "komentarjev"}`;
  }

  function relativno(iso) {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const a = Math.abs(s);
    if (a < 45) return rtf.format(0, "second");
    for (const [enota, sek] of [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
      if (a >= sek) return rtf.format(Math.round(s / sek), enota);
    }
    return rtf.format(Math.round(s), "second");
  }

  function avatar(ime, slika, velik = false) {
    const razred = `komentar-avatar${velik ? " komentar-avatar-velik" : ""}`;
    if (slika) return el("img", { class: razred, src: slika, alt: "", width: 40, height: 40, referrerpolicy: "no-referrer", loading: "lazy" });
    const crka = (ime || "?").trim().charAt(0).toUpperCase() || "?";
    let h = 0;
    for (const z of ime || "?") h = (h * 31 + z.charCodeAt(0)) >>> 0;
    const a = el("span", { class: `${razred} komentar-avatar-crka`, "aria-hidden": "true", text: crka });
    a.style.setProperty("--barva", BARVE[h % BARVE.length]);
    return a;
  }

  // besedilo komentarja: časi skočijo v film, povezave so klikljive
  function besedilo(niz) {
    const frag = document.createDocumentFragment();
    const vzorec = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])|\b(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)\b/g;
    let zadnji = 0;
    for (const m of niz.matchAll(vzorec)) {
      frag.append(niz.slice(zadnji, m.index));
      if (m[1]) frag.append(el("a", { href: m[1], rel: "nofollow ugc noopener", target: "_blank", text: m[1] }));
      else {
        const sek = (Number(m[2] || 0) * 3600) + Number(m[3]) * 60 + Number(m[4]);
        frag.append(skoci ? el("button", { type: "button", class: "komentar-skok", text: m[0], onclick: () => skoci(sek) }) : m[0]);
      }
      zadnji = m.index + m[0].length;
    }
    frag.append(niz.slice(zadnji));
    return frag;
  }

  function napakaIz(odg, status) {
    const k = odg?.napaka;
    if (status === 401 || k === "prijava") return b.prijavaBesedilo;
    if (k === "predolgo") return b.predolgo;
    if (k === "omejitev" || status === 429) return b.omejitev;
    if (k === "zaprto") return b.zaprto;
    if (k === "ime") return b.imeNamig;
    return b.napaka;
  }

  async function klic(pot, telo) {
    const r = await fetch(pot, telo
      ? { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(telo), credentials: "same-origin" }
      : { headers: { Accept: "application/json" }, credentials: "same-origin" });
    const odg = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(napakaIz(odg, r.status));
    return odg;
  }

  const odpriPrijavo = () => document.querySelector("[data-prijava-odpri]")?.click();

  function samodejnaVisina(ta) {
    ta.style.height = "auto";
    const h = ta.scrollHeight + 1;
    ta.style.height = `${Math.min(h, 360)}px`;
    ta.style.overflowY = h > 360 ? "auto" : "hidden";
  }

  // ---------------------------------------------------------------- obrazec
  // glavni (zgoraj), odgovor (pod komentarjem) ali urejanje (namesto besedila)
  function obrazec({ vrsta = "glavni", zacetno = "", oddaj, preklic }) {
    const jaz = podatki.jaz;
    const glavni = vrsta === "glavni";
    const f = el("form", { class: `komentar-obrazec komentar-obrazec-${vrsta}`, novalidate: true });
    const ta = el("textarea", {
      class: "komentar-vnos", rows: 1, maxlength: NAJVEC, required: true,
      placeholder: vrsta === "odgovor" ? b.odgovorNamig : b.namig, "aria-label": vrsta === "odgovor" ? b.odgovorNamig : b.namig,
    });
    ta.value = zacetno;
    const ime = !jaz.ime && vrsta !== "uredi"
      ? el("input", { class: "komentar-ime", type: "text", maxlength: 60, autocomplete: "nickname", placeholder: b.ime, "aria-label": b.imeNamig, title: b.imeNamig })
      : null;
    const napaka = el("p", { class: "komentar-napaka", role: "alert", hidden: true });
    const stevec = el("span", { class: "komentar-stevec", "aria-hidden": "true" });
    const gumbOddaj = el("button", { class: "komentar-gumb", type: "submit", disabled: !zacetno.trim(), text: vrsta === "uredi" ? b.shrani : vrsta === "odgovor" ? b.odgovori : b.objavi });
    const gumbPreklic = el("button", { class: "komentar-gumb komentar-gumb-tih", type: "button", text: b.preklici });
    const dejanja = el("div", { class: "komentar-obrazec-dejanja", hidden: glavni }, stevec, gumbPreklic, gumbOddaj);
    const polje = el("div", { class: "komentar-polje" }, ime, ta, napaka, dejanja);
    if (vrsta !== "uredi") f.append(avatar(jaz.ime || b.clan, jaz.slika, glavni));
    f.append(polje);

    const posodobi = () => {
      const n = ta.value.length;
      gumbOddaj.disabled = !ta.value.trim() || n > NAJVEC;
      stevec.textContent = n > NAJVEC - 200 ? `${n}/${NAJVEC}` : "";
      samodejnaVisina(ta);
    };
    ta.addEventListener("input", posodobi);
    ta.addEventListener("focus", () => { dejanja.hidden = false; f.classList.add("aktiven"); });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); f.requestSubmit(); }
      if (e.key === "Escape") gumbPreklic.click();
    });
    gumbPreklic.addEventListener("click", () => {
      if (preklic) return preklic();
      ta.value = "";
      if (ime) ime.value = "";
      napaka.hidden = true;
      dejanja.hidden = true;
      f.classList.remove("aktiven");
      posodobi();
      ta.blur();
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (gumbOddaj.disabled) return;
      gumbOddaj.disabled = true;
      napaka.hidden = true;
      try {
        await oddaj({ besedilo: ta.value, ime: ime?.value });
        if (glavni) { ta.value = ""; posodobi(); dejanja.hidden = true; f.classList.remove("aktiven"); ta.blur(); if (ime) ime.remove(); }
      } catch (e2) {
        napaka.textContent = e2.message;
        napaka.hidden = false;
        gumbOddaj.disabled = false;
      }
    });
    requestAnimationFrame(posodobi);
    return { f, ta };
  }

  function narisiPisanje() {
    pisanje.replaceChildren();
    if (!podatki.odprti) {
      pisanje.append(el("p", { class: "komentarji-zaprto", text: b.zaprto }));
      return;
    }
    if (!podatki.jaz) {
      pisanje.append(el("button", { class: "komentar-gost", type: "button", onclick: odpriPrijavo },
        el("span", { class: "komentar-avatar komentar-avatar-velik komentar-avatar-gost", "aria-hidden": "true" },
          svg('<circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>', "komentar-ikona-gost")),
        el("span", { class: "komentar-gost-besedilo", text: b.prijavaBesedilo })));
      return;
    }
    const { f } = obrazec({ vrsta: "glavni", oddaj: async ({ besedilo: t, ime }) => {
      const r = await klic("/api/komentarji", { oznaka, besedilo: t, ime });
      if (r.ime) podatki.jaz.ime = r.ime;
      podatki.komentarji.push(r.komentar);
      vstavi(r.komentar, { zgoraj: true });
      posodobiStevilo();
    } });
    pisanje.append(f);
  }

  // ---------------------------------------------------------------- komentar
  function komentarEl(k) {
    const odgovor = !!k.odgovor_na;
    const ime = k.avtor.ime || b.clan;
    const li = el("li", { class: `komentar${odgovor ? " komentar-odgovor" : ""}`, id: `komentar-${k.id}`, "data-id": k.id });
    const cas = el("a", { class: "komentar-cas", href: `#komentar-${k.id}`, title: datumF.format(new Date(k.ustvarjeno_at)), text: relativno(k.ustvarjeno_at) });
    const glava = el("p", { class: "komentar-glava" },
      el("span", { class: "komentar-ime-avtorja", text: ime }),
      k.avtor.avtor_strani ? el("span", { class: "komentar-znacka", text: b.avtor }) : null,
      cas,
      k.urejeno_at ? el("span", { class: "komentar-urejeno", text: `(${b.urejeno})` }) : null);
    const tekst = el("div", { class: "komentar-besedilo" });
    tekst.append(besedilo(k.besedilo));

    const vsec = el("button", { class: "komentar-dejanje komentar-vsec", type: "button", "aria-pressed": String(!!k.vsec_mi), "aria-label": b.vsec, title: b.vsec },
      svg(SRCE), el("span", { class: "komentar-vsec-stevilo", text: k.vseckov ? String(k.vseckov) : "" }));
    vsec.addEventListener("click", () => vseckaj(k, vsec));
    const dejanja = el("div", { class: "komentar-dejanja" }, vsec);
    const mestoOdgovora = el("div", { class: "komentar-odgovor-mesto" });
    if (podatki.jaz && podatki.odprti) {
      dejanja.append(el("button", { class: "komentar-dejanje", type: "button", text: b.odgovori, onclick: () => odgovori(k, li, mestoOdgovora, ime) }));
    }
    if (k.moj) dejanja.append(el("button", { class: "komentar-dejanje", type: "button", text: b.uredi, onclick: () => uredi(k, li, tekst, dejanja) }));
    if (k.moj || podatki.jaz?.admin) dejanja.append(el("button", { class: "komentar-dejanje komentar-dejanje-rdece", type: "button", text: b.izbrisi, onclick: () => izbrisi(k, li) }));

    const telo = el("div", { class: "komentar-telo" }, glava, tekst, dejanja, mestoOdgovora);
    if (!odgovor) telo.append(el("ol", { class: "komentar-odgovori" }));
    li.append(avatar(ime, k.avtor.slika, !odgovor), telo);
    return li;
  }

  function vstavi(k, { zgoraj = false, oznaci = true } = {}) {
    const li = komentarEl(k);
    if (k.odgovor_na) {
      const stars = seznam.querySelector(`#komentar-${k.odgovor_na} .komentar-odgovori`);
      if (!stars) return;
      stars.append(li);
    } else if (zgoraj) seznam.prepend(li);
    else seznam.append(li);
    stanjeEl.hidden = true;
    if (oznaci) {
      li.classList.add("komentar-nov");
      li.addEventListener("animationend", () => li.classList.remove("komentar-nov"), { once: true });
    }
  }

  function posodobiStevilo() {
    naslov.textContent = stevilo(podatki.komentarji.length);
    const prazno = !podatki.komentarji.length;
    stanjeEl.textContent = prazno ? b.prazno : "";
    stanjeEl.hidden = !prazno;
  }

  async function vseckaj(k, gumb) {
    if (!podatki.jaz) return odpriPrijavo();
    const prej = { vsec_mi: k.vsec_mi, vseckov: k.vseckov };
    k.vsec_mi = !k.vsec_mi;
    k.vseckov += k.vsec_mi ? 1 : -1;
    const nastavi = () => {
      gumb.setAttribute("aria-pressed", String(k.vsec_mi));
      gumb.querySelector(".komentar-vsec-stevilo").textContent = k.vseckov ? String(k.vseckov) : "";
    };
    nastavi();
    if (k.vsec_mi) { gumb.classList.remove("utrip"); void gumb.offsetWidth; gumb.classList.add("utrip"); }
    try {
      const r = await klic("/api/komentarji/vsec", { id: k.id });
      Object.assign(k, { vsec_mi: r.vsec_mi, vseckov: r.vseckov });
    } catch (e) {
      Object.assign(k, prej);
    }
    nastavi();
  }

  function odgovori(k, li, mesto, ime) {
    if (mesto.firstChild) { mesto.querySelector("textarea")?.focus(); return; }
    const odgovorNa = k.odgovor_na || k.id;
    const { f, ta } = obrazec({
      vrsta: "odgovor",
      zacetno: k.odgovor_na ? `@${ime} ` : "",
      preklic: () => mesto.replaceChildren(),
      oddaj: async ({ besedilo: t, ime: novoIme }) => {
        const r = await klic("/api/komentarji", { oznaka, besedilo: t, odgovor_na: odgovorNa, ime: novoIme });
        if (r.ime) podatki.jaz.ime = r.ime;
        podatki.komentarji.push(r.komentar);
        mesto.replaceChildren();
        vstavi(r.komentar);
        posodobiStevilo();
      },
    });
    mesto.append(f);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function uredi(k, li, tekst, dejanja) {
    if (li.querySelector(".komentar-obrazec-uredi")) return;
    const zapri = () => { f.remove(); tekst.hidden = false; dejanja.hidden = false; };
    const { f, ta } = obrazec({
      vrsta: "uredi", zacetno: k.besedilo, preklic: zapri,
      oddaj: async ({ besedilo: t }) => {
        const r = await klic("/api/komentarji/uredi", { id: k.id, besedilo: t });
        Object.assign(k, { besedilo: r.besedilo, urejeno_at: r.urejeno_at });
        tekst.replaceChildren(besedilo(k.besedilo));
        const glava = li.querySelector(".komentar-glava");
        if (!glava.querySelector(".komentar-urejeno")) glava.append(el("span", { class: "komentar-urejeno", text: `(${b.urejeno})` }));
        zapri();
      },
    });
    tekst.hidden = true;
    dejanja.hidden = true;
    tekst.after(f);
    ta.focus();
    samodejnaVisina(ta);
  }

  async function izbrisi(k, li) {
    if (!confirm(b.izbrisiVprasanje)) return;
    try {
      await klic("/api/komentarji/izbrisi", { id: k.id });
      podatki.komentarji = podatki.komentarji.filter((x) => x.id !== k.id && x.odgovor_na !== k.id);
      li.classList.add("komentar-odhaja");
      const konec = () => { li.remove(); posodobiStevilo(); };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) konec();
      else li.addEventListener("animationend", konec, { once: true });
    } catch (e) {
      alert(e.message);
    }
  }

  // ---------------------------------------------------------------- nalaganje
  function narisiSeznam() {
    seznam.replaceChildren();
    const vrh = podatki.komentarji.filter((k) => !k.odgovor_na).sort((a, c) => c.ustvarjeno_at.localeCompare(a.ustvarjeno_at));
    for (const k of vrh) vstavi(k, { oznaci: false });
    for (const k of podatki.komentarji.filter((x) => x.odgovor_na).sort((a, c) => a.ustvarjeno_at.localeCompare(c.ustvarjeno_at))) vstavi(k, { oznaci: false });
    posodobiStevilo();
  }

  let nalozeno = false;
  async function nalozi() {
    nalozeno = true;
    try {
      podatki = await klic(`/api/komentarji?oznaka=${encodeURIComponent(oznaka)}`);
    } catch (e) {
      stanjeEl.textContent = b.napaka;
      stanjeEl.hidden = false;
      return;
    }
    narisiPisanje();
    narisiSeznam();
    // povezava na komentar (#komentar-12): pokaži in poudari
    const m = /^#komentar-(\d+)$/.exec(location.hash);
    const cilj = m && document.getElementById(`komentar-${m[1]}`);
    if (cilj) {
      cilj.scrollIntoView({ block: "center" });
      cilj.classList.add("komentar-nov");
    }
  }

  // časi se osvežijo vsako minuto; prijava ali izpis v glavi nariše znova
  setInterval(() => {
    for (const a of seznam.querySelectorAll(".komentar-cas")) {
      const k = podatki.komentarji.find((x) => `#komentar-${x.id}` === a.getAttribute("href"));
      if (k) a.textContent = relativno(k.ustvarjeno_at);
    }
  }, 60000);
  document.addEventListener("wayfare:clan", () => { if (nalozeno) nalozi(); });

  // komentarji se naložijo, ko pridejo blizu zaslona (prvi pogled je film)
  if ("IntersectionObserver" in window && !location.hash.startsWith("#komentar")) {
    const io = new IntersectionObserver((vnosi) => {
      if (vnosi.some((v) => v.isIntersecting)) { io.disconnect(); nalozi(); }
    }, { rootMargin: "600px 0px" });
    io.observe(koren);
  } else nalozi();
}
