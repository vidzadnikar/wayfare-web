// Grafi tedenskega poročila (functions/api/porocilo.js) iz R2: javno, ker jih
// odpre poštni odjemalec; ime ima naključen žeton, zato se ga ne da uganiti.
import { Napaka } from "../../../zaledje/osnova.js";
import { obravnavaj } from "../../../zaledje/strani.js";

const IME = /^[0-9a-f]{32}-[a-z]{2,20}\.png$/;

export const onRequestGet = obravnavaj(async ({ params, env }) => {
  const ime = String(params.ime || "");
  if (!IME.test(ime)) throw new Napaka(404, "ni");
  const obj = env.VIDEI ? await env.VIDEI.get(`porocila/${ime}`) : null;
  if (!obj) throw new Napaka(404, "ni");
  return new Response(obj.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});
