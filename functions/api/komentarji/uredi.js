// Uredi svoj komentar.  POST { id, besedilo }
import { Napaka, json, telo, istiIzvor, zdaj } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { cistoBesedilo } from "../../../zaledje/komentarji.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const jaz = await clanIzSeje(env, request);
  if (!jaz) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const besedilo = cistoBesedilo(podatki.besedilo);
  const t = zdaj();
  const r = await env.DB.prepare("UPDATE komentarji SET besedilo = ?1, urejeno_at = ?2 WHERE id = ?3 AND clan_id = ?4")
    .bind(besedilo, t, Number(podatki.id), jaz.id).run();
  if (!(r.meta?.changes ?? 0)) throw new Napaka(404, "komentar", "Tega komentarja ne moreš urediti.");
  return json({ stanje: "urejen", besedilo, urejeno_at: t });
});
