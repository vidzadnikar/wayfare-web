// Stripov portal za stranke: preklic, menjava kartice, računi. Le za člana,
// ki ima pri Stripu stranko (je že kdaj plačal).
import { Napaka, json, preusmeri, telo, istiIzvor, jezikIz, stranUrl } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { narocninaNaVoljo, ustvariPortal } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki, obrazec } = await telo(request);
  const jezik = jezikIz(podatki.jezik, request);
  const clan = await clanIzSeje(env, request);
  if (!clan) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!narocninaNaVoljo(env)) throw new Napaka(503, "ni_na_voljo", "Naročnine še niso na voljo.");
  const seja = await ustvariPortal(env, { clan, jezik, stran: stranUrl(env, request), nazaj: podatki.nazaj });
  if (!seja?.url) throw new Napaka(502, "stripe", "Stripe ni vrnil povezave.");
  return obrazec ? preusmeri(seja.url) : json({ url: seja.url });
});
