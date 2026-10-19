// Plačljiv vlog: ali ga sme prijavljeni gledati in kje so datoteke. Vedno
// 200, da stran gosta ali člana brez dostopa obravnava brez napak v konzoli.
//   { prijavljen, dostop, vrsta, na_voljo, portal, viri: {1080, 720}, kmalu }
import { Napaka, json } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { dostopClana, narocninaNaVoljo } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env, params }) => {
  const oznaka = String(params.oznaka || "");
  if (!/^[a-z0-9-]{2,60}$/.test(oznaka)) throw new Napaka(404, "ni");
  const clan = await clanIzSeje(env, request);
  const d = await dostopClana(env, env.DB, clan);
  const osnova = { prijavljen: !!clan, dostop: d.dostop, vrsta: d.vrsta, na_voljo: narocninaNaVoljo(env), portal: !!clan?.stripe_customer_id };
  if (!d.dostop) return json(osnova);
  const viri = {};
  if (env.VIDEI) {
    for (const k of ["1080", "720"]) {
      if (await env.VIDEI.head(`${oznaka}-${k}.mp4`)) viri[k] = `/api/video/${oznaka}-${k}.mp4`;
    }
  }
  return json({ ...osnova, viri, kmalu: !Object.keys(viri).length });
});
