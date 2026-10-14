// Samodejna obvestila (GitHub Actions, .github/workflows/obvesti.yml):
//   POST /api/obvesti  Authorization: Bearer <OBVESTI_SECRET>
//   { "postavke": [ { "vrsta": "vlog|izdaja|novica", "kljuc": "vlog:milano-5",
//       "naslov": {"sl": "…", "en": "…"}, "besedilo": {"sl": "…", "en": "…"}, "url": {"sl": "…", "en": "…"} } ] }
// Vsak ključ gre ven največ enkrat (tabela poslano). Brez postavk le pošlje,
// kar čaka v vrsti (dnevna meja), kar kliče dnevni urnik.
import { Napaka, json, telo, enakaSkrivnost, stranUrl, zahtevaj } from "../../zaledje/osnova.js";
import { napolniVrsto, posljiIzVrste } from "../../zaledje/posta.js";
import { obravnavaj } from "../../zaledje/strani.js";
import { preberiNastavitve } from "../../zaledje/nastavitve.js";

const VRSTE = new Set(["vlog", "izdaja", "novica"]);

function niz(v, najvec) {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new Napaka(400, "postavka", "Pričakovan je niz.");
  return v.trim().slice(0, najvec) || null;
}

export function preveriPostavko(p) {
  if (!p || typeof p !== "object") throw new Napaka(400, "postavka", "Postavka ni objekt.");
  if (!VRSTE.has(p.vrsta)) throw new Napaka(400, "postavka", "vrsta mora biti vlog, izdaja ali novica.");
  const kljuc = niz(p.kljuc, 200);
  if (!kljuc) throw new Napaka(400, "postavka", "kljuc manjka.");
  const naslov = p.naslov || {}, besedilo = p.besedilo || {}, url = p.url || {};
  const naslov_sl = niz(naslov.sl, 200), naslov_en = niz(naslov.en, 200);
  if (!naslov_sl && !naslov_en) throw new Napaka(400, "postavka", "naslov manjka.");
  const veljavenUrl = (u) => { const n = niz(u, 500); if (n && !/^https?:\/\//.test(n)) throw new Napaka(400, "postavka", "url mora biti http(s)."); return n; };
  return {
    kljuc, vrsta: p.vrsta, naslov_sl: naslov_sl || naslov_en, naslov_en: naslov_en || naslov_sl,
    besedilo_sl: niz(besedilo.sl, 5000), besedilo_en: niz(besedilo.en, 5000),
    url_sl: veljavenUrl(url.sl), url_en: veljavenUrl(url.en),
  };
}

// Vstavi obvestilo in napolni vrsto; vrne stanje postavke. Zadržano
// obvestilo (samodejna obvestila za to vrsto so izklopljena) počaka v
// nadzoru brez vrste, dokler ga admin ne pošlje ali zavrže.
export async function ustvariObvestilo(db, p, { zadrzi = false } = {}) {
  const r = await db.prepare(
    "INSERT OR IGNORE INTO poslano (kljuc, vrsta, naslov_sl, naslov_en, besedilo_sl, besedilo_en, url_sl, url_en, zadrzano) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  ).bind(p.kljuc, p.vrsta, p.naslov_sl, p.naslov_en, p.besedilo_sl, p.besedilo_en, p.url_sl, p.url_en, zadrzi ? 1 : 0).run();
  if (!(r.meta?.changes ?? 0)) return { kljuc: p.kljuc, stanje: "ze_poslano" };
  if (zadrzi) return { kljuc: p.kljuc, stanje: "zadrzano" };
  return { kljuc: p.kljuc, stanje: "novo", prejemnikov: await napolniVrsto(db, p.kljuc) };
}

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "OBVESTI_SECRET", "SESSION_SECRET");
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await enakaSkrivnost(auth, env.OBVESTI_SECRET))) throw new Napaka(401, "dostop");
  const { podatki } = await telo(request);
  const postavke = Array.isArray(podatki.postavke) ? podatki.postavke : [];
  if (postavke.length > 50) throw new Napaka(400, "postavka", "Največ 50 postavk na klic.");
  const s = await preberiNastavitve(env.DB);
  const obvestila = [];
  for (const surova of postavke) {
    const p = preveriPostavko(surova);
    if (p.vrsta === "vlog") Object.assign(p, { besedilo_sl: s.besedilo_vlog_sl, besedilo_en: s.besedilo_vlog_en });
    const zadrzi = (p.vrsta === "vlog" && !s.obvestila_vlogi) || (p.vrsta === "izdaja" && !s.obvestila_izdaje);
    obvestila.push(await ustvariObvestilo(env.DB, p, { zadrzi }));
  }
  const vrsta = await posljiIzVrste(env, env.DB, stranUrl(env, request));
  return json({ obvestila, ...vrsta });
});
