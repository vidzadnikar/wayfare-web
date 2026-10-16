// Izbriše komentar (z odgovori vred): svoj komentar član, katerikoli admin.
//   POST { id }
import { Napaka, json, telo, istiIzvor } from "../../../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const jaz = await clanIzSeje(env, request);
  if (!jaz) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const k = await env.DB.prepare("SELECT id, clan_id FROM komentarji WHERE id = ?").bind(Number(podatki.id)).first();
  if (!k) throw new Napaka(404, "komentar", "Komentarja ni.");
  if (k.clan_id !== jaz.id && !jeAdmin(env, jaz)) throw new Napaka(403, "dostop", "Tega komentarja ne moreš izbrisati.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM komentarji_vsecki WHERE komentar_id IN (SELECT id FROM komentarji WHERE id = ?1 OR odgovor_na = ?1)").bind(k.id),
    env.DB.prepare("DELETE FROM komentarji WHERE odgovor_na = ?").bind(k.id),
    env.DB.prepare("DELETE FROM komentarji WHERE id = ?").bind(k.id),
  ]);
  return json({ stanje: "izbrisan", id: k.id });
});
