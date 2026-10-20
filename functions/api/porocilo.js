// Tedensko poročilo o objavah na TikToku in Instagramu, ki ga sestavi urnik v
// aplikaciji (`wayfare.py urnik tek`, wayfare/urnik.py). Pošta gre naslovom v
// POROCILO_PREJEMNIKI (z vejico ločeni; skrivnost v Pages, ker je repozitorij
// javen), brez njih adminu. Drugih naslovov klic ne more določiti.
//   POST /api/porocilo  Authorization: Bearer <POROCILO_SECRET>
//   { "kljuc": "porocilo:2026-W44", "zadeva": "…", "naslov": "…", "besedilo": "…",
//     "html"?: "<vsebina kartice z {{slika:tiktok}}>", "slike"?: [{ "ime": "tiktok", "png": "<base64>" }] }
// Slike (grafi) gredo v R2 pod porocila/<žeton>-<ime>.png; /api/graf/<žeton>-<ime>.png
// jih da javno (žeton je naključen), v html pa namesto {{slika:<ime>}} pride ta naslov.
// Isti ključ gre vsakemu prejemniku največ enkrat (po tabeli posta), zato
// ponovljen klic ne podvoji pošte.
import { Napaka, json, telo, enakaSkrivnost, stranUrl, zahtevaj } from "../../zaledje/osnova.js";
import { posljiPosto, sestaviPorocilo } from "../../zaledje/posta.js";
import { VELJAVEN_EMAIL } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";

const SLIKA = /^[a-z]{2,20}$/;
const NAJ_SLIK = 4, NAJ_BAJTOV = 2 * 1024 * 1024;

// Grafi v R2; vrne html z naslovi slik namesto {{slika:<ime>}}.
async function shraniSlike(env, koren, vsebina, slike) {
  if (!Array.isArray(slike) || !slike.length) return vsebina;
  if (slike.length > NAJ_SLIK) throw new Napaka(400, "porocilo", `Največ ${NAJ_SLIK} slike.`);
  if (!env.VIDEI) throw new Error("Manjka vezava R2 VIDEI (wrangler.toml).");
  const zeton = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  for (const s of slike) {
    if (!s || !SLIKA.test(String(s.ime || ""))) throw new Napaka(400, "porocilo", "Ime slike ni veljavno.");
    let bajti;
    try { bajti = Uint8Array.from(atob(String(s.png || "")), (c) => c.charCodeAt(0)); } catch { throw new Napaka(400, "porocilo", "Slika ni base64."); }
    if (bajti.length > NAJ_BAJTOV || bajti[0] !== 0x89 || bajti[1] !== 0x50) throw new Napaka(400, "porocilo", "Slika mora biti PNG do 2 MB.");
    const ime = `${zeton}-${s.ime}.png`;
    await env.VIDEI.put(`porocila/${ime}`, bajti, { httpMetadata: { contentType: "image/png" } });
    vsebina = vsebina.split(`{{slika:${s.ime}}}`).join(`${koren}/api/graf/${ime}`);
  }
  return vsebina;
}

function niz(v, najvec, ime) {
  if (typeof v !== "string" || !v.trim()) throw new Napaka(400, "porocilo", `${ime} manjka.`);
  return v.trim().slice(0, najvec);
}

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "POROCILO_SECRET", "ADMIN_EMAIL");
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await enakaSkrivnost(auth, env.POROCILO_SECRET))) throw new Napaka(401, "dostop");
  const { podatki } = await telo(request);
  const kljuc = niz(podatki.kljuc, 100, "kljuc");
  if (!/^porocilo:[\w.-]+$/.test(kljuc)) throw new Napaka(400, "porocilo", "kljuc mora biti porocilo:<oznaka>.");
  const zadeva = niz(podatki.zadeva, 150, "zadeva");
  const besedilo = niz(podatki.besedilo, 20000, "besedilo");
  const naslov = typeof podatki.naslov === "string" ? podatki.naslov.trim().slice(0, 100) : "";
  const vsebina = typeof podatki.html === "string" ? podatki.html.slice(0, 100000) : "";

  const cisti = (naslovi) => [...new Set(naslovi.map((e) => String(e || "").trim().toLowerCase()).filter((e) => VELJAVEN_EMAIL.test(e)))];
  const nastavljeni = cisti(String(env.POROCILO_PREJEMNIKI || "").split(","));
  const prejemniki = nastavljeni.length ? nastavljeni : cisti([env.ADMIN_EMAIL]);
  const { results } = await env.DB.prepare("SELECT prejemnik FROM posta WHERE vrsta = 'porocilo' AND kljuc = ?1").bind(kljuc).all();
  const ze = new Set((results || []).map((r) => String(r.prejemnik).toLowerCase()));
  const novi = prejemniki.filter((e) => !ze.has(e));
  if (!novi.length) return json({ stanje: "ze_poslano" });
  const koren = stranUrl(env, request);
  const vsebinaHtml = vsebina ? await shraniSlike(env, koren, vsebina, podatki.slike) : "";
  const posta = sestaviPorocilo({ zadeva, naslov, besedilo, vsebinaHtml, koren });
  await posljiPosto(env, env.DB, novi.map((za) => ({ za, vrsta: "porocilo", kljuc, ...posta })));
  return json({ stanje: "poslano", prejemnikov: novi.length });
});
