// Povezava iz potrditvene pošte: porabi žeton, potrdi (ali ustvari) člana,
// odpre sejo in vrne na stran, s katere je prišla prijava.
import { preusmeri, varnaPot, domacaPot, jezikIz, zahtevaj } from "../../zaledje/osnova.js";
import { sejaPiskotek } from "../../zaledje/seja.js";
import { clanPoEmailu, prijaviClana, porabiZeton } from "../../zaledje/clani.js";
import { obravnavaj, stranNapake } from "../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "SESSION_SECRET");
  const z = new URL(request.url).searchParams.get("z") || "";
  const zeton = await porabiZeton(env.DB, z);
  if (!zeton) return stranNapake(jezikIz(null, request), "neveljavna", 400);
  const jezik = jezikIz(zeton.jezik, request);
  const obstojec = await clanPoEmailu(env.DB, zeton.email);
  if (obstojec?.blokiran) return stranNapake(jezik, "blokiran", 403);
  const clan = await prijaviClana(env.DB, { email: zeton.email, vir: "eposta", jezik });
  return preusmeri(`${varnaPot(zeton.nazaj, domacaPot(jezik))}?prijava=potrjeno`, { piskotki: [await sejaPiskotek(env, request, clan.id)] });
}, { html: true });
