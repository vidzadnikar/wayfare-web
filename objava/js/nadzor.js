// Nadzor članov (/nadzor): seznam iz /api/nadzor/clani, blokiranje in
// brisanje prek /api/nadzor/clan, novica prek /api/nadzor/novica, ročno
// pošiljanje vrste prek /api/nadzor/vrsta, izvoz je navadna povezava.
const koren = document.querySelector("[data-nadzor]");
const povzetek = koren.querySelector("[data-povzetek]");
const sporocilo = koren.querySelector("[data-sporocilo]");
const teloClanov = koren.querySelector("[data-clani] tbody");
const teloObvestil = koren.querySelector("[data-obvestila] tbody");
const gumbVrsta = koren.querySelector("[data-vrsta-poslji]");
const novica = koren.querySelector("[data-novica]");
let stanje = null;

const datum = (iso) => (iso ? new Date(iso).toLocaleString("sl-SI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const el = (oznaka, lastnosti = {}, ...otroci) => {
  const e = document.createElement(oznaka);
  for (const [k, v] of Object.entries(lastnosti)) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== null && v !== undefined) e.setAttribute(k, v); }
  for (const o of otroci) e.append(o);
  return e;
};

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
  const dejanja = el("td");
  if (!jaz) {
    dejanja.append(
      el("button", { type: "button", class: "tabela-gumb", onclick: () => dejanje(c, c.blokiran ? "odblokiraj" : "blokiraj") }, c.blokiran ? "Odblokiraj" : "Blokiraj"),
      " ",
      el("button", { type: "button", class: "tabela-gumb tabela-gumb-rdec", onclick: () => dejanje(c, "izbrisi") }, "Izbriši"),
    );
  }
  return el("tr", {},
    ime,
    el("td", {}, c.email),
    el("td", {}, c.vir === "google" ? "Google" : "e-pošta"),
    el("td", {}, c.jezik.toUpperCase()),
    el("td", {}, datum(c.ustvarjen_at)),
    el("td", {}, datum(c.zadnji_obisk_at)),
    el("td", {}, String(c.obiskov)),
    el("td", { class: `stanje-${razred}` }, oznaka),
    dejanja,
  );
}

async function dejanje(c, kaj) {
  const vprasanje = { blokiraj: `Blokiram ${c.email}? Ne bo več dobival pošte in se ne bo mogel prijaviti.`, odblokiraj: `Odblokiram ${c.email}?`, izbrisi: `Izbrišem ${c.email}? Vsi njegovi podatki izginejo.` }[kaj];
  if (!confirm(vprasanje)) return;
  try {
    await klic("/api/nadzor/clan", { id: c.id, dejanje: kaj });
    povej(`${kaj === "izbrisi" ? "Izbrisan" : kaj === "blokiraj" ? "Blokiran" : "Odblokiran"}: ${c.email}`);
    await nalozi();
  } catch (e) { povej(e.message, true); }
}

function vrsticaObvestila(o) {
  return el("tr", {},
    el("td", {}, o.kljuc),
    el("td", {}, o.vrsta),
    el("td", { class: "naslov" }, o.naslov_sl || o.naslov_en || ""),
    el("td", {}, datum(o.ustvarjeno_at)),
    el("td", {}, String(o.prejemnikov)),
    el("td", { class: o.napaka ? "stanje-blokiran" : "" }, o.caka ? `${o.caka}${o.napaka ? ` (napaka: ${o.napaka})` : ""}` : "—"),
  );
}

async function nalozi() {
  try {
    stanje = await klic("/api/nadzor/clani");
  } catch (e) {
    povzetek.textContent = `Ni šlo: ${e.message}`;
    return;
  }
  const { clani, obvestila, vrsta } = stanje;
  const st = (f) => clani.filter(f).length;
  povzetek.textContent = `${clani.length} članov · ${st((c) => stanjeClana(c)[0] === "aktiven")} aktivnih · ${st((c) => c.odjavljen_at && !c.blokiran)} odjavljenih · ${st((c) => c.blokiran)} blokiranih · danes poslanih ${vrsta.dnevno.poslanih} od ${vrsta.dnevno.meja} · v vrsti čaka ${vrsta.caka}`;
  gumbVrsta.hidden = !vrsta.caka;
  teloClanov.replaceChildren(...clani.map(vrsticaClana));
  if (!clani.length) teloClanov.append(el("tr", {}, el("td", { colspan: 9, class: "naslov" }, "Še nihče.")));
  teloObvestil.replaceChildren(...obvestila.map(vrsticaObvestila));
  if (!obvestila.length) teloObvestil.append(el("tr", {}, el("td", { colspan: 6, class: "naslov" }, "Še nič.")));
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
koren.querySelector("[data-osvezi]").addEventListener("click", nalozi);

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
    const n = stanje ? stanje.clani.filter((c) => stanjeClana(c)[0] === "aktiven").length : "?";
    if (!confirm(`Pošljem novico vsem ${n} aktivnim članom? Tega se ne da preklicati.`)) return;
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
