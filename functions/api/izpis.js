// Izpis: izbriše piškotek seje. Član ostane v bazi in še dobiva obvestila;
// odjava od obvestil je povezava v pošti.
import { Napaka, json, preusmeri, telo, istiIzvor, varnaPot } from "../../zaledje/osnova.js";
import { izbrisSeje } from "../../zaledje/seja.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request }) => {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki, obrazec } = await telo(request);
  const piskotek = izbrisSeje(request);
  if (obrazec) return preusmeri(`${varnaPot(podatki.nazaj, "/")}?prijava=izpis`, { piskotki: [piskotek] });
  return json({ stanje: "izpisan" }, 200, { "Set-Cookie": piskotek });
});
