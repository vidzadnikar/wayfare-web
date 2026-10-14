// Nastavitve prijavljenega člana: jezik pošte, katera obvestila hoče in ali
// je prijavljen na obvestila sploh.
//   GET → { jezik, vlogi, izdaje, novice, obvestila }
//   POST { jezik?, vlogi?, izdaje?, novice?, obvestila? }
import { Napaka, json, telo, istiIzvor, zdaj } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

const zelje = (c) => ({ jezik: c.jezik, vlogi: !!c.zeli_vlogi, izdaje: !!c.zeli_izdaje, novice: !!c.zeli_novice, obvestila: !c.odjavljen_at });

async function clan(env, request) {
  const c = await clanIzSeje(env, request);
  if (!c) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  return c;
}

export const onRequestGet = obravnavaj(async ({ request, env }) => json(zelje(await clan(env, request))));

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const c = await clan(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki: p } = await telo(request);
  const db = env.DB;
  const da = (v, staro) => (typeof v === "boolean" ? (v ? 1 : 0) : staro);
  const jezik = p.jezik === "sl" || p.jezik === "en" ? p.jezik : c.jezik;
  let odjavljen = c.odjavljen_at;
  if (p.obvestila === false) odjavljen = c.odjavljen_at || zdaj();
  if (p.obvestila === true) odjavljen = null;
  await db.prepare(
    "UPDATE clani SET jezik = ?1, jezik_rocno = CASE WHEN ?2 THEN 1 ELSE jezik_rocno END, zeli_vlogi = ?3, zeli_izdaje = ?4, zeli_novice = ?5, odjavljen_at = ?6 WHERE id = ?7",
  ).bind(jezik, p.jezik === "sl" || p.jezik === "en" ? 1 : 0, da(p.vlogi, c.zeli_vlogi), da(p.izdaje, c.zeli_izdaje), da(p.novice, c.zeli_novice), odjavljen, c.id).run();
  if (odjavljen) await db.prepare("DELETE FROM vrsta WHERE clan_id = ?1 AND poslano_at IS NULL").bind(c.id).run();
  const nov = await db.prepare("SELECT * FROM clani WHERE id = ?").bind(c.id).first();
  return json(zelje(nov));
});
