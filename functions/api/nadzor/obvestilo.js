// Nadzor: zadržano obvestilo pošlji (v vrsto vsem, ki ga želijo) ali zavrzi.
//   POST { kljuc, dejanje: "poslji" | "zavrzi" }
import { Napaka, json, telo, istiIzvor, stranUrl, zdaj } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { napolniVrsto, posljiIzVrste } from "../../../zaledje/posta.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const kljuc = String(podatki.kljuc || "");
  const db = env.DB;
  const o = await db.prepare("SELECT kljuc, zadrzano FROM poslano WHERE kljuc = ?").bind(kljuc).first();
  if (!o) throw new Napaka(404, "obvestilo", "Obvestila ni.");
  if (o.zadrzano !== 1) throw new Napaka(409, "obvestilo", "Obvestilo ne čaka.");
  if (podatki.dejanje === "zavrzi") {
    await db.prepare("UPDATE poslano SET zadrzano = 2, poslano_at = ?1 WHERE kljuc = ?2").bind(zdaj(), kljuc).run();
    return json({ stanje: "zavrzeno" });
  }
  if (podatki.dejanje !== "poslji") throw new Napaka(400, "dejanje");
  await db.prepare("UPDATE poslano SET zadrzano = 0 WHERE kljuc = ?").bind(kljuc).run();
  const prejemnikov = await napolniVrsto(db, kljuc);
  const vrsta = await posljiIzVrste(env, db, stranUrl(env, request));
  return json({ stanje: "poslano", prejemnikov, ...vrsta });
});
