// Povezava iz potrditvene pošte. GET le pokaže gumb »Prijavi me« (žeton se
// ne porabi), da povezave ne porabi predogled ali pregledovalnik v odjemalcu
// pošte. POST z gumbom porabi žeton, potrdi (ali ustvari) člana, odpre sejo in
// vrne na stran, s katere je prišla prijava.
import { Napaka, preusmeri, telo, istiIzvor, varnaPot, domacaPot, jezikIz, pobegni, zahtevaj } from "../../zaledje/osnova.js";
import { sejaPiskotek } from "../../zaledje/seja.js";
import { clanPoEmailu, prijaviClana, porabiZeton, preveriZeton } from "../../zaledje/clani.js";
import { obravnavaj, stran, stranNapake, B } from "../../zaledje/strani.js";
import { poPrijavi } from "../../zaledje/dogodki.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "SESSION_SECRET");
  const z = new URL(request.url).searchParams.get("z") || "";
  const zeton = await preveriZeton(env.DB, z);
  if (!zeton) return stranNapake(jezikIz(null, request), "neveljavna", 400);
  const jezik = jezikIz(zeton.jezik, request);
  const b = B[jezik];
  return stran({
    jezik, naslov: b.potrdi_naslov, besedilo: b.potrdi_besedilo(zeton.email),
    telo: `<form method="post" action="/api/potrdi"><input type="hidden" name="z" value="${pobegni(z)}"><button class="gumb gumb-velik" type="submit">${b.potrdi_gumb}</button></form>`,
  });
}, { html: true });

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "SESSION_SECRET");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const zeton = await porabiZeton(env.DB, String(podatki.z || ""));
  if (!zeton) return stranNapake(jezikIz(null, request), "neveljavna", 400);
  const jezik = jezikIz(zeton.jezik, request);
  const obstojec = await clanPoEmailu(env.DB, zeton.email);
  if (obstojec?.blokiran) return stranNapake(jezik, "blokiran", 403);
  const clan = await prijaviClana(env.DB, { email: zeton.email, vir: "eposta", jezik });
  await poPrijavi(env, request, clan, !obstojec);
  return preusmeri(`${varnaPot(zeton.nazaj, domacaPot(jezik))}?prijava=potrjeno`, { piskotki: [await sejaPiskotek(env, request, clan)] });
}, { html: true });
