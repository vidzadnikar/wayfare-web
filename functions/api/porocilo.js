// Tedensko poročilo o objavah na TikToku in Instagramu, ki ga sestavi urnik v
// aplikaciji (`wayfare.py urnik tek`, wayfare/urnik.py). Pošta gre le adminu.
//   POST /api/porocilo  Authorization: Bearer <POROCILO_SECRET>
//   { "kljuc": "porocilo:2026-W44", "zadeva": "…", "naslov": "…", "besedilo": "…" }
// Isti ključ gre ven največ enkrat (po tabeli posta), zato ponovljen klic ne
// podvoji pošte.
import { Napaka, json, telo, enakaSkrivnost, stranUrl, zahtevaj } from "../../zaledje/osnova.js";
import { posljiPosto, sestaviPorocilo } from "../../zaledje/posta.js";
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

  const ze = await env.DB.prepare("SELECT 1 FROM posta WHERE vrsta = 'porocilo' AND kljuc = ?1").bind(kljuc).first();
  if (ze) return json({ stanje: "ze_poslano" });
  await posljiPosto(env, env.DB, [{
    za: String(env.ADMIN_EMAIL).trim(), vrsta: "porocilo", kljuc,
    ...sestaviPorocilo({ zadeva, naslov, besedilo, koren: stranUrl(env, request) }),
  }]);
  return json({ stanje: "poslano" });
});
