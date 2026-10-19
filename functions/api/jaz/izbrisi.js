// Član izbriše svoj račun: vsi njegovi podatki (tudi ogledi, komentarji in vrsta) gredo
// iz baze, seja se izbriše. Admin sebe ne more izbrisati.
import { Napaka, json, istiIzvor } from "../../../zaledje/osnova.js";
import { clanIzSeje, izbrisSeje, jeAdmin } from "../../../zaledje/seja.js";
import { izbrisiClana } from "../../../zaledje/clani.js";
import { prekliciNarocnine } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const c = await clanIzSeje(env, request);
  if (!c) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  if (jeAdmin(env, c)) throw new Napaka(400, "admin", "Admin računa ni mogoče izbrisati tukaj.");
  await prekliciNarocnine(env, env.DB, c.id);
  await izbrisiClana(env.DB, c);
  return json({ stanje: "izbrisan" }, 200, { "Set-Cookie": izbrisSeje(request) });
});
