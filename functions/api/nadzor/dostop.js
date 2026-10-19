// Nadzor: podari članu brezplačen dostop do vlogov (brez roka ali do dne)
// ali mu ga odvzemi. Naročnine pri Stripu to ne spremeni.
import { Napaka, json, telo, istiIzvor } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const id = Number(podatki.id);
  if (!Number.isInteger(id) || id <= 0) throw new Napaka(400, "clan", "id manjka.");
  const db = env.DB;
  let r;
  if (podatki.dejanje === "podari") {
    let do_ = null;
    if (podatki.do) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(podatki.do))) throw new Napaka(400, "datum", "Datum naj bo v obliki LLLL-MM-DD.");
      do_ = `${podatki.do}T23:59:59.000Z`;
      if (!(Date.parse(do_) > Date.now())) throw new Napaka(400, "datum", "Datum je v preteklosti.");
    }
    const opomba = String(podatki.opomba || "").trim().slice(0, 200) || null;
    r = await db.prepare("UPDATE clani SET dostop_vrsta = 'podarjen', dostop_do = ?1, dostop_opomba = ?2 WHERE id = ?3").bind(do_, opomba, id).run();
  } else if (podatki.dejanje === "odvzemi") {
    r = await db.prepare("UPDATE clani SET dostop_vrsta = NULL, dostop_do = NULL, dostop_opomba = NULL WHERE id = ?1").bind(id).run();
  } else {
    throw new Napaka(400, "dejanje", "Dejanje je podari ali odvzemi.");
  }
  if (!(r.meta?.changes ?? 0)) throw new Napaka(404, "clan", "Člana ni.");
  return json({ stanje: "ok", id, dejanje: podatki.dejanje });
});
