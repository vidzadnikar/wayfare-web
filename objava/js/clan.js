// Prijava članov in stanje v glavi. Gumb Prijava odpre okno z dvema potema:
// Google (navadna povezava na /api/google, ki preusmeri na Googlovo prijavo)
// in e-naslov (/api/prijava pošlje povezavo za potrditev). /api/jaz pove,
// kdo je prijavljen; /api/izpis izpiše. Po vrnitvi z zaledja (?prijava=…)
// se pod glavo pokaže kratko sporočilo in naslov se počisti.
export function clan() {
  const mesto = document.querySelector("[data-clan-mesto]");
  const okno = document.querySelector("[data-prijava]");
  const sporocilo = document.querySelector("[data-sporocilo]");
  if (!mesto || !okno) return;
  const gumbPrijava = mesto.querySelector("[data-prijava-odpri]");
  const podrobnosti = mesto.querySelector("[data-clan]");
  const slika = mesto.querySelector("[data-clan-slika]");
  const zacetnica = mesto.querySelector("[data-clan-zacetnica]");
  const ime = mesto.querySelector("[data-clan-ime]");
  const email = mesto.querySelector("[data-clan-email]");
  const nadzor = mesto.querySelector("[data-clan-nadzor]");
  const izpis = mesto.querySelector("[data-izpis]");
  const obrazec = okno.querySelector("[data-prijava-obrazec]");
  const napaka = okno.querySelector("[data-prijava-napaka]");
  const google = okno.querySelector("[data-prijava-google]");
  const koraki = { izbira: okno.querySelector('[data-korak="izbira"]'), poslano: okno.querySelector('[data-korak="poslano"]') };
  let casSporocila;

  function pokaziSporocilo(koda) {
    const besedilo = sporocilo?.dataset[koda];
    if (!besedilo) return;
    sporocilo.textContent = besedilo;
    sporocilo.hidden = false;
    clearTimeout(casSporocila);
    casSporocila = setTimeout(() => { sporocilo.hidden = true; }, 7000);
  }
  const url = new URL(location.href);
  const koda = url.searchParams.get("prijava");
  if (koda) {
    url.searchParams.delete("prijava");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    pokaziSporocilo(koda);
  }

  function prikaziGosta() { podrobnosti.hidden = true; gumbPrijava.hidden = false; }
  function prikaziClana(c) {
    const kratko = String(c.ime || c.email).split(/[\s@]/)[0];
    ime.textContent = kratko;
    email.textContent = c.email;
    zacetnica.textContent = kratko.slice(0, 1).toUpperCase();
    if (c.slika) { slika.src = c.slika; slika.hidden = false; } else { slika.removeAttribute("src"); slika.hidden = true; }
    nadzor.hidden = !c.admin;
    gumbPrijava.hidden = true;
    podrobnosti.hidden = false;
  }
  async function osvezi() {
    try {
      const r = await fetch("/api/jaz", { headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (r.ok) prikaziClana(await r.json()); else prikaziGosta();
    } catch (e) { prikaziGosta(); }
  }
  osvezi();

  // okno: pot za vrnitev je trenutna stran (brez JS velja domača stran)
  function pokaziKorak(k) { for (const [n, el] of Object.entries(koraki)) el.hidden = n !== k; }
  function odpri() {
    pokaziKorak("izbira");
    napaka.hidden = true;
    obrazec.reset();
    const nazaj = location.pathname;
    obrazec.querySelector("[data-nazaj]").value = nazaj;
    const g = new URL(google.getAttribute("href"), location.origin);
    g.searchParams.set("nazaj", nazaj);
    google.href = g.pathname + g.search;
    okno.showModal();
    okno.querySelector("#prijava-naslov")?.focus({ preventScroll: true });
  }
  gumbPrijava.addEventListener("click", odpri);
  okno.querySelector("[data-prijava-zapri]").addEventListener("click", () => okno.close());
  okno.addEventListener("click", (e) => { if (e.target === okno) okno.close(); }); // klik na ozadje
  obrazec.addEventListener("submit", async (e) => {
    e.preventDefault();
    const gumb = obrazec.querySelector('button[type="submit"]');
    gumb.disabled = true;
    napaka.hidden = true;
    const podatki = Object.fromEntries(new FormData(obrazec));
    try {
      const r = await fetch("/api/prijava", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(podatki),
      });
      const odg = await r.json().catch(() => ({}));
      if (r.ok) {
        koraki.poslano.querySelector("[data-prijava-poslano-opis]").textContent = koraki.poslano.dataset.opis.replace("%email%", podatki.email);
        pokaziKorak("poslano");
        koraki.poslano.querySelector("[tabindex='-1']")?.focus({ preventScroll: true });
      } else {
        napaka.textContent = napaka.dataset[odg.napaka] || napaka.dataset.splosno;
        napaka.hidden = false;
      }
    } catch (e2) {
      napaka.textContent = napaka.dataset.splosno;
      napaka.hidden = false;
    }
    gumb.disabled = false;
  });

  izpis.addEventListener("click", async () => {
    try { await fetch("/api/izpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch (e) {}
    podrobnosti.open = false;
    prikaziGosta();
    pokaziSporocilo("izpis");
  });
  document.addEventListener("click", (e) => { if (podrobnosti.open && !podrobnosti.contains(e.target)) podrobnosti.open = false; });
}
