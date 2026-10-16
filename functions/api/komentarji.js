// Komentarji pod vlogom.
//   GET  /api/komentarji?oznaka=rim-1  → { odprti, jaz, komentarji }  (javno)
//   POST /api/komentarji { oznaka, besedilo, odgovor_na?, ime? }       (prijavljen član)
// Odgovor je vedno na komentar prvega nivoja (odgovor na odgovor gre k istemu
// staršu). Član brez imena (prijava z e-naslovom) ga pošlje ob prvem komentarju.
import { Napaka, json, telo, istiIzvor, stranUrl, zdaj } from "../../zaledje/osnova.js";
import { clanIzSeje, jeAdmin } from "../../zaledje/seja.js";
import { omeji, clanPoEmailu } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";
import { nastavitev } from "../../zaledje/nastavitve.js";
import { posljiPosto, sestaviKomentarAdminu } from "../../zaledje/posta.js";
import { vlogIzOznake, cistoBesedilo, cistoIme, zaStran, SELECT_KOMENTARJEV } from "../../zaledje/komentarji.js";

async function adminId(env) {
  if (!env.ADMIN_EMAIL) return null;
  const a = await clanPoEmailu(env.DB, String(env.ADMIN_EMAIL).trim().toLowerCase());
  return a?.id ?? null;
}

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const oznaka = new URL(request.url).searchParams.get("oznaka");
  await vlogIzOznake(env, request, oznaka);
  const jaz = await clanIzSeje(env, request);
  const [{ results }, odprti, aId] = await Promise.all([
    env.DB.prepare(`${SELECT_KOMENTARJEV} AND k.oznaka = ?1 ORDER BY k.ustvarjeno_at`).bind(oznaka, jaz?.id ?? 0).all(),
    nastavitev(env.DB, "komentarji_odprti"),
    adminId(env),
  ]);
  return json({
    odprti,
    jaz: jaz ? { ime: jaz.ime, slika: jaz.slika_url, admin: jeAdmin(env, jaz) } : null,
    komentarji: results.map((r) => zaStran(r, jaz, aId)),
  }, 200, { "Cache-Control": "no-store" });
});

export const onRequestPost = obravnavaj(async ({ request, env, waitUntil }) => {
  const jaz = await clanIzSeje(env, request);
  if (!jaz) throw new Napaka(401, "prijava", "Za komentar se prijavi.");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const db = env.DB;
  if (!(await nastavitev(db, "komentarji_odprti"))) throw new Napaka(403, "zaprto", "Komentarji so izklopljeni.");
  const { podatki } = await telo(request);
  const vlog = await vlogIzOznake(env, request, podatki.oznaka);
  const besedilo = cistoBesedilo(podatki.besedilo);
  if (!(await omeji(db, "komentar:" + jaz.id, 20))) throw new Napaka(429, "omejitev", "Preveč komentarjev v kratkem času. Poskusi čez eno uro.");
  if (!jaz.ime) {
    const ime = cistoIme(podatki.ime);
    await db.prepare("UPDATE clani SET ime = ?1 WHERE id = ?2").bind(ime, jaz.id).run();
    jaz.ime = ime;
  }
  let stars = null;
  if (podatki.odgovor_na) {
    const k = await db.prepare("SELECT id, odgovor_na, oznaka FROM komentarji WHERE id = ?").bind(Number(podatki.odgovor_na)).first();
    if (!k || k.oznaka !== vlog.oznaka) throw new Napaka(404, "komentar", "Komentarja, na katerega odgovarjaš, ni več.");
    stars = k.odgovor_na || k.id;
  }
  const r = await db.prepare("INSERT INTO komentarji (oznaka, clan_id, odgovor_na, besedilo, ustvarjeno_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id")
    .bind(vlog.oznaka, jaz.id, stars, besedilo, zdaj()).first();
  const { results } = await db.prepare(`${SELECT_KOMENTARJEV} AND k.id = ?1`).bind(r.id, jaz.id).all();
  const komentar = zaStran(results[0], jaz, await adminId(env));

  // pošta adminu (razen za njegove komentarje); ne zadrži odgovora
  if (!jeAdmin(env, jaz)) {
    const poslji = (async () => {
      try {
        if (!(await nastavitev(db, "obvesti_me_komentar"))) return;
        const koren = stranUrl(env, request);
        await posljiPosto(env, db, [{
          za: String(env.ADMIN_EMAIL).trim(), vrsta: "admin",
          ...sestaviKomentarAdminu({ ime: jaz.ime, vlog: vlog.naslov, besedilo, odgovor: !!stars, url: `${koren}/sl/vlogi/${vlog.oznaka}/#komentar-${r.id}`, koren }),
        }]);
      } catch (e) { console.error("pošta adminu o komentarju:", e); }
    })();
    if (typeof waitUntil === "function") waitUntil(poslji); else await poslji;
  }
  return json({ komentar, ime: jaz.ime }, 201);
});
