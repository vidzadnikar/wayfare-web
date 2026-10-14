// Kdo je prijavljen: podatki za glavo strani. Ob klicu se zabeleži obisk
// (član največ enkrat na uro) in dnevno število nalaganj strani (brez
// podatkov o osebi: le gost ali član).
import { json } from "../../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../../zaledje/seja.js";
import { zabeleziObisk } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";

const prestej = (db, kljuc) => db.prepare(
  "INSERT INTO statistika (dan, kljuc, stevilo) VALUES (?1, ?2, 1) ON CONFLICT (dan, kljuc) DO UPDATE SET stevilo = stevilo + 1",
).bind(new Date().toISOString().slice(0, 10), kljuc).run().catch(() => {});

export const onRequestGet = obravnavaj(async ({ request, env, waitUntil }) => {
  const clan = await clanIzSeje(env, request);
  const stej = prestej(env.DB, clan ? "obisk_clan" : "obisk_gost");
  if (typeof waitUntil === "function") waitUntil(stej); else await stej;
  if (!clan) return json({ prijavljen: false }, 401);
  await zabeleziObisk(env.DB, clan.id);
  return json({
    prijavljen: true, ime: clan.ime, email: clan.email, slika: clan.slika_url, jezik: clan.jezik,
    admin: jeAdmin(env, clan), obvestila: !clan.odjavljen_at,
  });
});
