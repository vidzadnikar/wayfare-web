// Nadzor: odziv označi kot rešen, ga znova odpri ali izbriši.
//   POST { id, dejanje: "resen" | "odpri" | "izbrisi" }
import { Napaka, json, telo, istiIzvor, zdaj } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const id = Number(podatki.id);
  const dejanje = podatki.dejanje;
  if (!Number.isInteger(id) || id <= 0) throw new Napaka(400, "odziv", "id manjka.");
  if (!["resen", "odpri", "izbrisi"].includes(dejanje)) throw new Napaka(400, "dejanje", "Neznano dejanje.");
  const db = env.DB;
  const r = dejanje === "izbrisi"
    ? await db.prepare("DELETE FROM odzivi WHERE id = ?").bind(id).run()
    : await db.prepare("UPDATE odzivi SET resen_at = ?1 WHERE id = ?2").bind(dejanje === "resen" ? zdaj() : null, id).run();
  if (!(r.meta?.changes ?? 0)) throw new Napaka(404, "odziv", "Odziva ni.");
  return json({ stanje: "ok", id, dejanje });
});
