// Nadzor: vse za stran /nadzor v enem klicu — člani z ogledi, zadržana
// obvestila, zadnja obvestila, vlogi z YouTuba v obdelavi, ogledi po vlogih,
// obiski zadnjih 14 dni, odzivi testerjev, nastavitve in stanje vrste.
import { json } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { dnevnoStanje, stanjeVrste } from "../../../zaledje/posta.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { preberiNastavitve, NASTAVITVE } from "../../../zaledje/nastavitve.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const admin = await zahtevajAdmina(env, request);
  const db = env.DB;
  const pred14 = new Date(Date.now() - 13 * 86400e3).toISOString().slice(0, 10);
  const [clani, obvestila, youtube, ogledi, poClanih, obiski, komentarji, odzivi] = await Promise.all([
    db.prepare(
      `SELECT c.id, c.email, c.ime, c.slika_url, c.vir, c.jezik, c.potrjen_at, c.odjavljen_at, c.blokiran, c.ustvarjen_at,
              c.zadnji_obisk_at, c.obiskov, c.zeli_vlogi, c.zeli_izdaje, c.zeli_novice,
              (SELECT COUNT(DISTINCT o.oznaka) FROM ogledi o WHERE o.clan_id = c.id) AS ogledanih
       FROM clani c ORDER BY c.ustvarjen_at DESC`,
    ).all(),
    db.prepare(
      `SELECT kljuc, vrsta, naslov_sl, naslov_en, ustvarjeno_at, poslano_at, prejemnikov, zadrzano,
              (SELECT COUNT(*) FROM vrsta v WHERE v.kljuc = p.kljuc AND v.poslano_at IS NULL) AS caka,
              (SELECT napaka FROM vrsta v WHERE v.kljuc = p.kljuc AND v.napaka IS NOT NULL AND v.poslano_at IS NULL LIMIT 1) AS napaka
       FROM poslano p ORDER BY (zadrzano = 1) DESC, ustvarjeno_at DESC LIMIT 40`,
    ).all(),
    db.prepare("SELECT * FROM youtube ORDER BY ustvarjeno_at DESC LIMIT 20").all(),
    db.prepare(
      `SELECT oznaka, COUNT(*) AS ogledov, COUNT(DISTINCT clan_id) AS clanov, SUM(clan_id IS NULL) AS gostov, MAX(ustvarjeno_at) AS zadnji
       FROM ogledi GROUP BY oznaka ORDER BY ogledov DESC`,
    ).all(),
    db.prepare(
      `SELECT o.oznaka, c.id AS clan_id, COALESCE(c.ime, c.email) AS kdo, MAX(o.ustvarjeno_at) AS zadnji
       FROM ogledi o JOIN clani c ON c.id = o.clan_id GROUP BY o.oznaka, c.id ORDER BY zadnji DESC LIMIT 300`,
    ).all(),
    db.prepare("SELECT dan, kljuc, stevilo FROM statistika WHERE dan >= ? ORDER BY dan").bind(pred14).all(),
    db.prepare(
      `SELECT k.id, k.oznaka, k.odgovor_na, k.besedilo, k.ustvarjeno_at, COALESCE(c.ime, c.email) AS kdo,
              (SELECT COUNT(*) FROM komentarji_vsecki v WHERE v.komentar_id = k.id) AS vseckov
       FROM komentarji k JOIN clani c ON c.id = k.clan_id ORDER BY k.ustvarjeno_at DESC LIMIT 50`,
    ).all(),
    db.prepare(
      `SELECT o.id, o.vrsta, o.besedilo, COALESCE(o.email, c.email) AS email, c.ime, o.vir, o.razlicica, o.sistem, o.jezik,
              o.resen_at, o.ustvarjeno_at
       FROM odzivi o LEFT JOIN clani c ON c.id = o.clan_id ORDER BY (o.resen_at IS NULL) DESC, o.ustvarjeno_at DESC LIMIT 200`,
    ).all(),
  ]);
  return json({
    admin: { id: admin.id, email: admin.email },
    clani: clani.results, obvestila: obvestila.results, youtube: youtube.results,
    ogledi: ogledi.results, ogledi_clanov: poClanih.results, obiski: obiski.results, komentarji: komentarji.results,
    odzivi: odzivi.results,
    nastavitve: { vrednosti: await preberiNastavitve(db), opisi: Object.fromEntries(Object.entries(NASTAVITVE).map(([k, n]) => [k, { vrsta: n.vrsta, opis: n.opis, najmanj: n.najmanj, najvec: n.najvec }])) },
    vrsta: { caka: await stanjeVrste(db), dnevno: await dnevnoStanje(env, db) },
  });
});
