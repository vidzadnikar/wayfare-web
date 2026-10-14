// Član izbriše svoj račun: vsi njegovi podatki (tudi ogledi in vrsta) gredo
// iz baze, seja se izbriše. Admin sebe ne more izbrisati.
import { Napaka, json, istiIzvor } from "../../../zaledje/osnova.js";
import { clanIzSeje, izbrisSeje, jeAdmin } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const c = await clanIzSeje(env, request);
  if (!c) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  if (jeAdmin(env, c)) throw new Napaka(400, "admin", "Admin računa ni mogoče izbrisati tukaj.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM vrsta WHERE clan_id = ?").bind(c.id),
    env.DB.prepare("DELETE FROM ogledi WHERE clan_id = ?").bind(c.id),
    env.DB.prepare("DELETE FROM zetoni WHERE email = ?").bind(c.email),
    env.DB.prepare("DELETE FROM clani WHERE id = ?").bind(c.id),
  ]);
  return json({ stanje: "izbrisan" }, 200, { "Set-Cookie": izbrisSeje(request) });
});
