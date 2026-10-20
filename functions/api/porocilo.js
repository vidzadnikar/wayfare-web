// Tedensko poročilo o objavah na TikToku in Instagramu, ki ga sestavi urnik v
// aplikaciji (`wayfare.py urnik tek`, wayfare/urnik.py). Pošta gre adminu in
// naslovom v POROCILO_PREJEMNIKI (z vejico ločeni; skrivnost v Pages, ker je
// repozitorij javen). Drugih naslovov klic ne more določiti.
//   POST /api/porocilo  Authorization: Bearer <POROCILO_SECRET>
//   { "kljuc": "porocilo:2026-W44", "zadeva": "…", "naslov": "…", "besedilo": "…" }
// Isti ključ gre vsakemu prejemniku največ enkrat (po tabeli posta), zato
// ponovljen klic ne podvoji pošte, nov prejemnik pa jo še dobi.
import { Napaka, json, telo, enakaSkrivnost, stranUrl, zahtevaj } from "../../zaledje/osnova.js";
import { posljiPosto, sestaviPorocilo } from "../../zaledje/posta.js";
import { VELJAVEN_EMAIL } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";

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

  const prejemniki = [...new Set([env.ADMIN_EMAIL, ...String(env.POROCILO_PREJEMNIKI || "").split(",")]
    .map((e) => String(e || "").trim().toLowerCase()).filter((e) => VELJAVEN_EMAIL.test(e)))];
  const { results } = await env.DB.prepare("SELECT prejemnik FROM posta WHERE vrsta = 'porocilo' AND kljuc = ?1").bind(kljuc).all();
  const ze = new Set((results || []).map((r) => String(r.prejemnik).toLowerCase()));
  const novi = prejemniki.filter((e) => !ze.has(e));
  if (!novi.length) return json({ stanje: "ze_poslano" });
  const posta = sestaviPorocilo({ zadeva, naslov, besedilo, koren: stranUrl(env, request) });
  await posljiPosto(env, env.DB, novi.map((za) => ({ za, vrsta: "porocilo", kljuc, ...posta })));
  return json({ stanje: "poslano", prejemnikov: novi.length });
});
