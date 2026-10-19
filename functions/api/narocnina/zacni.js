// Začetek naročnine: prijavljen član s soglasjem (pogoji, takojšen začetek)
// gre na Stripe Checkout. Obrazec s strani dobi preusmeritev, JSON pa { url }.
import { Napaka, json, preusmeri, telo, istiIzvor, varnaPot, jezikIz, stranUrl } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { narocninaNaVoljo, dostopClana, ustvariCheckout } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki, obrazec } = await telo(request);
  const jezik = jezikIz(podatki.jezik, request);
  const nazaj = varnaPot(podatki.nazaj, jezik === "sl" ? "/sl/vlogi/" : "/vlogi/");
  const odgovor = (koda, status) => (obrazec ? preusmeri(`${nazaj}?narocnina=${koda}`) : json({ napaka: koda }, status));
  const clan = await clanIzSeje(env, request);
  if (!clan) return odgovor("prijava", 401);
  if (!narocninaNaVoljo(env)) return odgovor("ni_na_voljo", 503);
  const soglasje = podatki.soglasje;
  if (!(soglasje === true || soglasje === "da" || soglasje === "on")) return odgovor("soglasje", 400);
  const d = await dostopClana(env, env.DB, clan);
  if (d.vrsta === "narocnina") return odgovor("ze", 400);
  const seja = await ustvariCheckout(env, { clan, jezik, stran: stranUrl(env, request), nazaj });
  if (!seja?.url) throw new Napaka(502, "stripe", "Stripe ni vrnil povezave.");
  return obrazec ? preusmeri(seja.url) : json({ url: seja.url });
});
