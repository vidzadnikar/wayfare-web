// Odjava od obvestil s povezavo iz pošte. GET pokaže vprašanje z gumbom (da
// odjave ne sproži predogled povezave v odjemalcu pošte), POST odjavi; POST
// sprejme tudi odjavo z enim klikom iz odjemalca (List-Unsubscribe-Post).
import { zdaj, telo, jezikIz, pobegni } from "../../zaledje/osnova.js";
import { clanIzOdjavnegaZetona } from "../../zaledje/posta.js";
import { obravnavaj, stran, stranNapake, gumbDomov, B } from "../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const z = new URL(request.url).searchParams.get("z") || "";
  const clan = await clanIzOdjavnegaZetona(env, env.DB, z);
  if (!clan) return stranNapake(jezikIz(null, request), "neveljavna", 400);
  const jezik = jezikIz(clan.jezik, request);
  const b = B[jezik];
  if (clan.odjavljen_at) return stran({ jezik, naslov: b.ze_odjavljen_naslov, besedilo: b.ze_odjavljen_besedilo, telo: gumbDomov(jezik) });
  return stran({
    jezik, naslov: b.odjava_naslov, besedilo: b.odjava_besedilo(clan.email),
    telo: `<form method="post" action="/api/odjava"><input type="hidden" name="z" value="${pobegni(z)}"><button class="gumb gumb-velik" type="submit">${b.odjava_gumb}</button></form>`,
  });
}, { html: true });

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const { podatki } = await telo(request);
  const z = podatki.z || new URL(request.url).searchParams.get("z") || "";
  const clan = await clanIzOdjavnegaZetona(env, env.DB, z);
  if (!clan) return stranNapake(jezikIz(null, request), "neveljavna", 400);
  const jezik = jezikIz(clan.jezik, request);
  const b = B[jezik];
  await env.DB.prepare("UPDATE clani SET odjavljen_at = COALESCE(odjavljen_at, ?1) WHERE id = ?2").bind(zdaj(), clan.id).run();
  await env.DB.prepare("DELETE FROM vrsta WHERE clan_id = ?1 AND poslano_at IS NULL").bind(clan.id).run();
  return stran({ jezik, naslov: b.odjavljen_naslov, besedilo: b.odjavljen_besedilo, telo: gumbDomov(jezik) });
}, { html: true });
