// Všeček na komentar (vklopi ali izklopi).  POST { id } → { vsec_mi, vseckov }
import { Napaka, json, telo, istiIzvor } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { omeji } from "../../../zaledje/clani.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const jaz = await clanIzSeje(env, request);
  if (!jaz) throw new Napaka(401, "prijava", "Za všeček se prijavi.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const id = Number(podatki.id);
  if (!(await omeji(env.DB, "vsec:" + jaz.id, 200))) throw new Napaka(429, "omejitev");
  const k = await env.DB.prepare("SELECT id FROM komentarji WHERE id = ?").bind(id).first();
  if (!k) throw new Napaka(404, "komentar", "Komentarja ni.");
  const odstrani = await env.DB.prepare("DELETE FROM komentarji_vsecki WHERE komentar_id = ?1 AND clan_id = ?2").bind(id, jaz.id).run();
  const vsecMi = !(odstrani.meta?.changes ?? 0);
  if (vsecMi) await env.DB.prepare("INSERT OR IGNORE INTO komentarji_vsecki (komentar_id, clan_id) VALUES (?1, ?2)").bind(id, jaz.id).run();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM komentarji_vsecki WHERE komentar_id = ?").bind(id).first();
  return json({ vsec_mi: vsecMi, vseckov: n?.n ?? 0 });
});
