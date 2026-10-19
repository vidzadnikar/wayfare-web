// Film za naročnike iz zasebnega vedra R2 (vezava VIDEI): le za prijavljenega
// člana z dostopom. Podpira Range (iskanje po filmu) in HEAD.
import { Napaka, json } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { dostopClana } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

const IME = /^[a-z0-9-]{2,60}-(1080|720)\.mp4$/;

// "bytes=a-b", "bytes=a-" ali "bytes=-n" → { offset, length } ali 416.
function obseg(glava, velikost) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(glava || "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const n = Math.min(Number(m[2]), velikost);
    return n ? { offset: velikost - n, length: n } : { napaka: 416 };
  }
  const zacetek = Number(m[1]);
  if (zacetek >= velikost) return { napaka: 416 };
  const konec = m[2] === "" ? velikost - 1 : Math.min(Number(m[2]), velikost - 1);
  if (konec < zacetek) return { napaka: 416 };
  return { offset: zacetek, length: konec - zacetek + 1 };
}

async function obdelaj({ request, env, params }, samoGlava) {
  const ime = String(params.datoteka || "");
  if (!IME.test(ime)) throw new Napaka(404, "ni");
  if (!env.VIDEI) throw new Error("Manjka vezava R2 VIDEI (wrangler.toml).");
  const clan = await clanIzSeje(env, request);
  const d = await dostopClana(env, env.DB, clan);
  if (!d.dostop) return json({ napaka: clan ? "brez_dostopa" : "prijava" }, clan ? 403 : 401);
  const glava = await env.VIDEI.head(ime);
  if (!glava) throw new Napaka(404, "ni", "Filma še ni.");
  const velikost = glava.size;
  const skupne = {
    "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600",
    "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", ETag: glava.httpEtag,
  };
  const r = obseg(request.headers.get("Range"), velikost);
  if (r?.napaka) return new Response(null, { status: 416, headers: { ...skupne, "Content-Range": `bytes */${velikost}` } });
  if (samoGlava) return new Response(null, { status: 200, headers: { ...skupne, "Content-Length": String(velikost) } });
  if (!r) {
    const obj = await env.VIDEI.get(ime);
    if (!obj) throw new Napaka(404, "ni");
    return new Response(obj.body, { status: 200, headers: { ...skupne, "Content-Length": String(velikost) } });
  }
  const obj = await env.VIDEI.get(ime, { range: { offset: r.offset, length: r.length } });
  if (!obj) throw new Napaka(404, "ni");
  return new Response(obj.body, {
    status: 206,
    headers: { ...skupne, "Content-Length": String(r.length), "Content-Range": `bytes ${r.offset}-${r.offset + r.length - 1}/${velikost}` },
  });
}

export const onRequestGet = obravnavaj((ctx) => obdelaj(ctx, false));
export const onRequestHead = obravnavaj((ctx) => obdelaj(ctx, true));
