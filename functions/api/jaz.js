// Kdo je prijavljen: podatki za glavo strani. Ob klicu se zabeleži obisk
// (največ enkrat na uro).
import { json } from "../../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../../zaledje/seja.js";
import { zabeleziObisk } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const clan = await clanIzSeje(env, request);
  if (!clan) return json({ prijavljen: false }, 401);
  await zabeleziObisk(env.DB, clan.id);
  return json({
    prijavljen: true, ime: clan.ime, email: clan.email, slika: clan.slika_url, jezik: clan.jezik,
    admin: jeAdmin(env, clan), obvestila: !clan.odjavljen_at,
  });
});
