// Izpis: izbriše piškotek seje in prekliče vse seje člana na vseh napravah
// (nova različica seje). Član ostane v bazi in še dobiva obvestila; odjava od
// obvestil je povezava v pošti.
import { Napaka, json, preusmeri, telo, istiIzvor, varnaPot } from "../../zaledje/osnova.js";
import { izbrisSeje, clanIzSeje, preklicSej } from "../../zaledje/seja.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const clan = await clanIzSeje(env, request);
  if (clan) await preklicSej(env.DB, clan.id);
  const { podatki, obrazec } = await telo(request);
  const piskotek = izbrisSeje(request);
  if (obrazec) return preusmeri(`${varnaPot(podatki.nazaj, "/")}?prijava=izpis`, { piskotki: [piskotek] });
  return json({ stanje: "izpisan" }, 200, { "Set-Cookie": piskotek });
});
