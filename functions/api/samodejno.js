// Za GitHub Actions (.github/workflows/youtube.yml in vlogi/samodejno.py),
// Authorization: Bearer <OBVESTI_SECRET>.
//   GET  → vlogi, ki čakajo, da jih skript doda na stran. Ob klicu pregleda
//          še javni vir kanala (če je vklopljeno v nastavitvah) in doda nove
//          javne videe z naslovom vloga ("… day 3", "… recap").
//   POST { id, stanje: "v_delu"|"dodan"|"napaka", oznaka?, napaka? }
import { Napaka, json, telo, zdaj, zahtevajSkrivnost } from "../../zaledje/osnova.js";
import { obravnavaj } from "../../zaledje/strani.js";
import { nastavitev, youtubeKanalOd } from "../../zaledje/nastavitve.js";
import { razcleni } from "../../zaledje/youtube.js";

const KANAL = "UCphbDrDFuDNs79Qmn10WtXA"; // Vid Zadnikar
const odXml = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Javni videi kanala (vir Atom ima zadnjih 15; neobjavljenih ne pokaže).
async function javniVidei() {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${KANAL}`, { headers: { "User-Agent": "wayfare-studio/1.0" }, cf: { cacheTtl: 300 } });
  if (!r.ok) return [];
  const xml = await r.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(e)?.[1],
    naslov: odXml(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] || ""),
    objavljeno: /<published>([^<]+)<\/published>/.exec(e)?.[1] || "",
  })).filter((v) => v.id);
}

async function pregledKanala(db) {
  if (!(await nastavitev(db, "youtube_kanal"))) return;
  const od = await youtubeKanalOd(db);
  let videi = [];
  try { videi = await javniVidei(); } catch (e) { console.error("vir kanala:", e); return; }
  for (const v of videi) {
    if (new Date(v.objavljeno) < new Date(od)) continue; // le objavljeno po vklopu
    const p = razcleni(v.naslov);
    if (!p.vlog) continue;
    await db.prepare(
      "INSERT OR IGNORE INTO youtube (id, naslov_sl, naslov_en, kraj_sl, kraj_en, lon, lat, datum, vir) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, 'kanal')",
    ).bind(v.id, p.naslov_sl, p.naslov_en, p.kraj_sl, p.kraj_en, p.lon, p.lat).run();
  }
}

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  await zahtevajSkrivnost(env, request);
  const db = env.DB;
  await pregledKanala(db);
  // obstal zapis (v_delu več kot 30 minut) gre nazaj v čakanje
  await db.prepare("UPDATE youtube SET stanje = 'caka' WHERE stanje = 'v_delu' AND obdelano_at < ?").bind(new Date(Date.now() - 1800e3).toISOString()).run();
  const { results: cakajo } = await db.prepare("SELECT * FROM youtube WHERE stanje = 'caka' ORDER BY ustvarjeno_at").all();
  return json({ cakajo });
});

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajSkrivnost(env, request);
  const { podatki } = await telo(request);
  if (!["v_delu", "dodan", "napaka"].includes(podatki.stanje)) throw new Napaka(400, "stanje");
  await env.DB.prepare("UPDATE youtube SET stanje = ?1, oznaka = COALESCE(?2, oznaka), napaka = ?3, obdelano_at = ?4 WHERE id = ?5")
    .bind(podatki.stanje, podatki.oznaka || null, podatki.napaka ? String(podatki.napaka).slice(0, 500) : null, zdaj(), String(podatki.id || "")).run();
  return json({ stanje: "ok" });
});
