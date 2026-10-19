// Prijava članov in stanje v glavi. Gumb Prijava odpre okno z dvema potema:
// Google (navadna povezava na /api/google, ki preusmeri na Googlovo prijavo)
// in e-naslov (/api/prijava pošlje povezavo za potrditev). /api/jaz pove,
// kdo je prijavljen; /api/izpis izpiše. Po vrnitvi z zaledja (?prijava=…)
// se pod glavo pokaže kratko sporočilo in naslov se počisti. Nastavitve
// (jezik pošte, katera obvestila, izbris računa) gredo prek /api/jaz/nastavitve.
// Naročnina na vloge: po vrnitvi s Stripa (?narocnina=ok&seja=…) stran prek
// /api/narocnina/preveri takoj uskladi dostop in to javi (wayfare:narocnina);
// član s Stripovo stranko ima v meniju »Naročnina« (portal: preklic, kartica).
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
  const portal = mesto.querySelector("[data-clan-portal]");
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
  const narocnina = url.searchParams.get("narocnina");
  const sejaStripe = url.searchParams.get("seja");
  if (koda || narocnina) {
    for (const k of ["prijava", "narocnina", "seja"]) url.searchParams.delete(k);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (koda) pokaziSporocilo(koda);
  }
  const javiNarocnino = () => document.dispatchEvent(new CustomEvent("wayfare:narocnina"));
  if (narocnina === "ok") {
    // dostop uskladi takoj (webhook lahko pride šele čez nekaj sekund); če
    // še ni odklenjeno, še nekajkrat preveri, nato pove, naj osveži stran
    (async () => {
      let odklenjeno = false;
      for (let poskus = 0; poskus < 4 && !odklenjeno; poskus++) {
        if (poskus) await new Promise((r) => setTimeout(r, 3000));
        try {
          const r = sejaStripe && poskus === 0
            ? await fetch(`/api/narocnina/preveri?seja=${encodeURIComponent(sejaStripe)}`, { headers: { Accept: "application/json" } })
            : await fetch("/api/jaz", { headers: { Accept: "application/json" } });
          if (r.ok) odklenjeno = !!(await r.json()).dostop;
        } catch (e) {}
      }
      pokaziSporocilo(odklenjeno ? "narocninaOk" : "narocninaCaka");
      await osvezi();
      javiNarocnino();
    })();
  } else if (narocnina) {
    pokaziSporocilo("narocnina" + narocnina.charAt(0).toUpperCase() + narocnina.slice(1).replace(/_(\w)/g, (m, c) => c.toUpperCase()));
  }

  function prikaziGosta() { podrobnosti.hidden = true; gumbPrijava.hidden = false; }
  function prikaziClana(c) {
    const kratko = String(c.ime || c.email).split(/[\s@]/)[0];
    ime.textContent = kratko;
    email.textContent = c.email;
    zacetnica.textContent = kratko.slice(0, 1).toUpperCase();
    if (c.slika) { slika.src = c.slika; slika.hidden = false; } else { slika.removeAttribute("src"); slika.hidden = true; }
    nadzor.hidden = !c.admin;
    if (portal) {
      portal.hidden = !c.portal;
      const nazaj = portal.querySelector("[data-portal-nazaj]");
      if (nazaj) nazaj.value = location.pathname;
    }
    gumbPrijava.hidden = true;
    podrobnosti.hidden = false;
  }
  // drugi deli strani (komentarji) izvejo za prijavo ali izpis prek dogodka
  const javi = (c) => document.dispatchEvent(new CustomEvent("wayfare:clan", { detail: c }));
  let prijavljen = null;
  async function osvezi() {
    let c = null;
    try {
      const r = await fetch("/api/jaz", { headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (r.ok) { const j = await r.json(); c = j.prijavljen ? j : null; }
    } catch (e) { c = null; }
    if (c) prikaziClana(c); else prikaziGosta();
    if (!!c !== prijavljen) { prijavljen = !!c; javi(c); }
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

  // ---------------------------------------------------------------- nastavitve člana
  const racun = document.querySelector("[data-racun]");
  const racunObrazec = racun?.querySelector("[data-racun-obrazec]");
  const racunSporocilo = racun?.querySelector("[data-racun-sporocilo]");
  const zelje = racun?.querySelector("[data-racun-zelje]");
  const povejRacun = (besedilo, napaka = false) => {
    racunSporocilo.textContent = besedilo;
    racunSporocilo.classList.toggle("racun-ok", !napaka);
    racunSporocilo.hidden = false;
  };
  const izpolni = (n) => {
    for (const r of racunObrazec.elements.jezik) r.checked = r.value === n.jezik;
    racunObrazec.elements.obvestila.checked = n.obvestila;
    for (const k of ["vlogi", "izdaje", "novice"]) racunObrazec.elements[k].checked = n[k];
    zelje.disabled = !n.obvestila;
  };
  if (racun && racunObrazec) {
    mesto.querySelector("[data-racun-odpri]")?.addEventListener("click", async () => {
      podrobnosti.open = false;
      racunSporocilo.hidden = true;
      try {
        const r = await fetch("/api/jaz/nastavitve", { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error();
        izpolni(await r.json());
      } catch (e) { povejRacun(racunObrazec.dataset.napaka, true); }
      racun.showModal();
      racun.querySelector("#racun-naslov")?.focus({ preventScroll: true });
    });
    racun.querySelector("[data-racun-zapri]").addEventListener("click", () => racun.close());
    racun.addEventListener("click", (e) => { if (e.target === racun) racun.close(); });
    racunObrazec.elements.obvestila.addEventListener("change", (e) => { zelje.disabled = !e.target.checked; });
    racunObrazec.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = racunObrazec.elements;
      const telo = { jezik: f.jezik.value || undefined, obvestila: f.obvestila.checked, vlogi: f.vlogi.checked, izdaje: f.izdaje.checked, novice: f.novice.checked };
      try {
        const r = await fetch("/api/jaz/nastavitve", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(telo) });
        if (!r.ok) throw new Error();
        izpolni(await r.json());
        povejRacun(racunObrazec.dataset.shranjeno);
      } catch (e2) { povejRacun(racunObrazec.dataset.napaka, true); }
    });
    racun.querySelector("[data-racun-izbrisi]").addEventListener("click", async () => {
      if (!confirm(racunObrazec.dataset.izbrisiVprasanje)) return;
      try {
        const r = await fetch("/api/jaz/izbrisi", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) throw new Error();
        racun.close();
        prikaziGosta();
        prijavljen = false;
        javi(null);
        pokaziSporocilo("izbrisan");
      } catch (e) { povejRacun(racunObrazec.dataset.napaka, true); }
    });
  }

  izpis.addEventListener("click", async () => {
    try { await fetch("/api/izpis", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch (e) {}
    podrobnosti.open = false;
    prikaziGosta();
    prijavljen = false;
    javi(null);
    pokaziSporocilo("izpis");
  });
  document.addEventListener("click", (e) => { if (podrobnosti.open && !podrobnosti.contains(e.target)) podrobnosti.open = false; });
}
