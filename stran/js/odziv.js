// Stran z obrazcem za odziv (odziv/): isti svet, glava in naslov kot strani z
// besedilom. Obrazec pošlje JSON na /api/odziv in pokaže zahvalo na mestu.
// Aplikacija stran odpre s ?iz=app&v=<različica>&os=<sistem>&vrsta=<vrsta>;
// to gre v skrita polja, da odziv nosi različico in sistem.
import { zazeniDrsenje, besede, mirno, svet } from "./gibanje.js";
import { prenos } from "./prenos.js";
import { clan } from "./clan.js";

const { gsap } = zazeniDrsenje();
if (!mirno) {
  document.documentElement.classList.add("gibanje");
  const h1 = document.querySelector("[data-naslov-uvod]");
  const deli = besede(h1);
  gsap.timeline({ defaults: { ease: "expo.out" } })
    .set(h1, { autoAlpha: 1 }, 0)
    .from(deli, { yPercent: 110, duration: 1.1, stagger: 0.05 }, 0.1)
    .fromTo("[data-uvod]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.0, stagger: 0.09 }, 0.3);
  svet({ gsap });
}

for (const a of document.querySelectorAll("[data-jezik]")) {
  a.addEventListener("click", () => { try { localStorage.setItem("wayfare-jezik", a.dataset.jezik); } catch (e) {} });
}

const obrazec = document.querySelector("[data-odziv]");
const hvala = document.querySelector("[data-odziv-hvala]");
const napaka = obrazec.querySelector("[data-odziv-napaka]");
const gumb = obrazec.querySelector('button[type="submit"]');

// Podatki iz aplikacije (ali iz povezave za preizkus); strežnik jih še enkrat preveri.
const iskanje = new URLSearchParams(location.search);
if (iskanje.get("iz") === "app") obrazec.querySelector("[data-odziv-vir]").value = "app";
// prošnja za dostop do filmov (zaklep na strani ogleda): besedilo je že vpisano
if (iskanje.get("iz") === "dostop") {
  const polje = obrazec.querySelector('[name="besedilo"]');
  if (polje && !polje.value) polje.value = obrazec.dataset.besediloDostop || "";
}
obrazec.querySelector("[data-odziv-razlicica]").value = (iskanje.get("v") || "").slice(0, 30);
obrazec.querySelector("[data-odziv-sistem]").value = (iskanje.get("os") || "").slice(0, 80);
const vrsta = obrazec.querySelector(`input[name="vrsta"][value="${CSS.escape(iskanje.get("vrsta") || "")}"]`);
if (vrsta) vrsta.checked = true;

function pokaziNapako(koda) {
  napaka.textContent = obrazec.dataset[koda] || obrazec.dataset.splosno;
  napaka.hidden = false;
}

obrazec.addEventListener("submit", async (e) => {
  e.preventDefault();
  napaka.hidden = true;
  gumb.disabled = true;
  try {
    const r = await fetch(obrazec.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(obrazec))),
    });
    const odg = await r.json().catch(() => ({}));
    if (!r.ok) { pokaziNapako(odg.napaka); return; }
    obrazec.hidden = true;
    hvala.classList.add("vidno");
    hvala.focus();
  } catch {
    pokaziNapako("splosno");
  } finally {
    gumb.disabled = false;
  }
});

prenos();
clan();
