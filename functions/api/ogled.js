// Ogled vloga: stran pokliče, ko se film začne predvajati. Prijavljen član
// se zapiše (enkrat na film na dan), gost le kot število brez podatkov.
//   POST { oznaka }
import { Napaka, json, telo, istiIzvor, ip } from "../../zaledje/osnova.js";
import { clanIzSeje } from "../../zaledje/seja.js";
import { omeji } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const oznaka = String(podatki.oznaka || "");
  if (!/^[a-z0-9-]{2,60}$/.test(oznaka)) throw new Napaka(400, "oznaka");
  if (!(await omeji(env.DB, "ogled:" + ip(request), 60))) return json({ stanje: "omejitev" }, 429);
  const clan = await clanIzSeje(env, request);
  const dan = new Date().toISOString().slice(0, 10);
  await env.DB.prepare("INSERT OR IGNORE INTO ogledi (oznaka, clan_id, dan) VALUES (?1, ?2, ?3)").bind(oznaka, clan?.id ?? null, dan).run();
  return json({ stanje: "ok" });
});
