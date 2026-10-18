// Nadzor: blokiraj, odblokiraj ali izbriši člana. Blokiran član ne more
// v sejo in ne dobi pošte; njegovi čakajoči zapisi v vrsti se izbrišejo, seje
// prekličejo. Izbris odstrani člana z vsemi podatki (komentarji, ogledi ...).
import { Napaka, json, telo, istiIzvor } from "../../../zaledje/osnova.js";
import { zahtevajAdmina, preklicSej } from "../../../zaledje/seja.js";
import { izbrisiClana } from "../../../zaledje/clani.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const admin = await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const id = Number(podatki.id);
  const dejanje = podatki.dejanje;
  if (!Number.isInteger(id) || id <= 0) throw new Napaka(400, "clan", "id manjka.");
  if (!["blokiraj", "odblokiraj", "izbrisi"].includes(dejanje)) throw new Napaka(400, "dejanje", "Neznano dejanje.");
  if (id === admin.id && dejanje !== "odblokiraj") throw new Napaka(400, "sam", "Sebe ne moreš blokirati ali izbrisati.");
  const db = env.DB;
  if (dejanje === "izbrisi") {
    const c = await db.prepare("SELECT id, email FROM clani WHERE id = ?").bind(id).first();
    if (!c) throw new Napaka(404, "clan", "Člana ni.");
    await izbrisiClana(db, c);
  } else {
    const r = await db.prepare("UPDATE clani SET blokiran = ?1 WHERE id = ?2").bind(dejanje === "blokiraj" ? 1 : 0, id).run();
    if (!(r.meta?.changes ?? 0)) throw new Napaka(404, "clan", "Člana ni.");
    if (dejanje === "blokiraj") {
      await db.prepare("DELETE FROM vrsta WHERE clan_id = ?1 AND poslano_at IS NULL").bind(id).run();
      await preklicSej(db, id);
    }
  }
  return json({ stanje: "ok", id, dejanje });
});
