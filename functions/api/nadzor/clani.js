// Nadzor: seznam članov, zadnja obvestila in stanje vrste (JSON za /nadzor).
import { json } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { dnevnoStanje, stanjeVrste } from "../../../zaledje/posta.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const admin = await zahtevajAdmina(env, request);
  const { results: clani } = await env.DB.prepare(
    "SELECT id, email, ime, slika_url, vir, jezik, potrjen_at, odjavljen_at, blokiran, ustvarjen_at, zadnji_obisk_at, obiskov FROM clani ORDER BY ustvarjen_at DESC",
  ).all();
  const { results: obvestila } = await env.DB.prepare(
    `SELECT kljuc, vrsta, naslov_sl, naslov_en, ustvarjeno_at, poslano_at, prejemnikov,
            (SELECT COUNT(*) FROM vrsta v WHERE v.kljuc = p.kljuc AND v.poslano_at IS NULL) AS caka,
            (SELECT napaka FROM vrsta v WHERE v.kljuc = p.kljuc AND v.napaka IS NOT NULL AND v.poslano_at IS NULL LIMIT 1) AS napaka
     FROM poslano p ORDER BY ustvarjeno_at DESC LIMIT 30`,
  ).all();
  return json({
    admin: { id: admin.id, email: admin.email },
    clani, obvestila,
    vrsta: { caka: await stanjeVrste(env.DB), dnevno: await dnevnoStanje(env, env.DB) },
  });
});
