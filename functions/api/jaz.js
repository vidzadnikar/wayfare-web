// Kdo je prijavljen: podatki za glavo strani. Ob klicu se zabeleži obisk
// (član največ enkrat na uro) in dnevno število nalaganj strani (brez
// podatkov o osebi: le gost ali član).
import { json } from "../../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../../zaledje/seja.js";
import { zabeleziObisk } from "../../zaledje/clani.js";
import { dostopClana, narocninaNaVoljo } from "../../zaledje/narocnine.js";
import { obravnavaj } from "../../zaledje/strani.js";

const prestej = (db, kljuc) => db.prepare(
  "INSERT INTO statistika (dan, kljuc, stevilo) VALUES (?1, ?2, 1) ON CONFLICT (dan, kljuc) DO UPDATE SET stevilo = stevilo + 1",
).bind(new Date().toISOString().slice(0, 10), kljuc).run().catch(() => {});

export const onRequestGet = obravnavaj(async ({ request, env, waitUntil }) => {
  const clan = await clanIzSeje(env, request);
  const stej = prestej(env.DB, clan ? "obisk_clan" : "obisk_gost");
  if (typeof waitUntil === "function") waitUntil(stej); else await stej;
  // gost dobi 200, ne 401: sicer brskalnik na vsaki strani zabeleži napako
  if (!clan) return json({ prijavljen: false });
  await zabeleziObisk(env.DB, clan.id);
  const d = await dostopClana(env, env.DB, clan);
  return json({
    prijavljen: true, ime: clan.ime, email: clan.email, slika: clan.slika_url, jezik: clan.jezik,
    admin: jeAdmin(env, clan), obvestila: !clan.odjavljen_at,
    // plačljivi vlogi: dostop (naročnina, podarjen, admin), portal za upravljanje naročnine
    dostop: d.dostop, dostop_vrsta: d.vrsta, dostop_do: d.do, narocnina: d.narocnina,
    narocnina_na_voljo: narocninaNaVoljo(env), portal: narocninaNaVoljo(env) && !!clan.stripe_customer_id,
  });
});
