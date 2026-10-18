// Delo s člani v bazi D1: iskanje, prijava (upsert), obiski, omejitve
// zahtev in žetoni za potrditev e-naslova.
import { zdaj, nakljucno, sha256 } from "./osnova.js";

export const VELJAVEN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normalizirajEmail = (e) => String(e || "").trim().toLowerCase();

export function clanPoEmailu(db, email) {
  return db.prepare("SELECT * FROM clani WHERE email = ?").bind(email).first();
}

// Prijava potrdi člana: nov član je potrjen takoj, obstoječemu se potrdi
// e-naslov, prekliče odjava in osvežijo ime, slika in jezik (jezik ne, če ga
// je član izbral sam v nastavitvah). Vir ostane tisti od prve prijave.
// Blokiranega preveri klicatelj pred tem.
export async function prijaviClana(db, { email, ime = null, slika = null, vir, jezik }) {
  await db.prepare(
    `INSERT INTO clani (email, ime, slika_url, vir, jezik, potrjen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (email) DO UPDATE SET
       ime = COALESCE(excluded.ime, clani.ime),
       slika_url = COALESCE(excluded.slika_url, clani.slika_url),
       jezik = CASE WHEN clani.jezik_rocno = 1 THEN clani.jezik ELSE excluded.jezik END,
       potrjen_at = COALESCE(clani.potrjen_at, excluded.potrjen_at),
       odjavljen_at = NULL`,
  ).bind(email, ime, slika, vir, jezik, zdaj()).run();
  return clanPoEmailu(db, email);
}

// Obisk se zapiše največ enkrat na uro, da stran ne piše v bazo ob vsakem
// nalaganju.
export function zabeleziObisk(db, id) {
  const predUro = new Date(Date.now() - 3600e3).toISOString();
  return db.prepare(
    "UPDATE clani SET zadnji_obisk_at = ?1, obiskov = obiskov + 1 WHERE id = ?2 AND (zadnji_obisk_at IS NULL OR zadnji_obisk_at < ?3)",
  ).bind(zdaj(), id, predUro).run();
}

// Omejitev: največ `meja` zahtev na ključ v tekoči uri. Ključ je
// <vrsta>:<vrednost>; vrednost (naslov IP, e-naslov, id) se shrani le kot
// zgoščena vrednost, da tabela omejitev ne hrani osebnih podatkov. Stare
// vrstice se občasno počistijo (in vsak dan v pocisti()).
export async function omeji(db, kljuc, meja) {
  const i = kljuc.indexOf(":");
  kljuc = i < 0 ? (await sha256(kljuc)).slice(0, 32) : kljuc.slice(0, i + 1) + (await sha256(kljuc.slice(i + 1))).slice(0, 32);
  const okno = new Date().toISOString().slice(0, 13);
  const r = await db.prepare(
    "INSERT INTO omejitve (kljuc, okno, stevilo) VALUES (?1, ?2, 1) ON CONFLICT (kljuc, okno) DO UPDATE SET stevilo = stevilo + 1 RETURNING stevilo",
  ).bind(kljuc, okno).first();
  if (Math.random() < 0.05) {
    const vceraj = new Date(Date.now() - 86400e3).toISOString().slice(0, 13);
    await db.prepare("DELETE FROM omejitve WHERE okno < ?").bind(vceraj).run();
  }
  return (r?.stevilo ?? 1) <= meja;
}

const ZETON_VELJA = 3600e3; // povezava za prijavo velja eno uro

// Žeton za potrditev: v bazi je le zgoščena vrednost, v pošti pa žeton sam.
export async function ustvariZeton(db, { email, jezik, nazaj }) {
  const zeton = nakljucno(32);
  const potece = new Date(Date.now() + ZETON_VELJA).toISOString();
  await db.prepare(
    "INSERT INTO zetoni (hash, email, namen, jezik, nazaj, potece_at) VALUES (?1, ?2, 'potrditev', ?3, ?4, ?5)",
  ).bind(await sha256(zeton), email, jezik, nazaj, potece).run();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM zetoni WHERE potece_at < ?").bind(zdaj()).run();
  return zeton;
}

// Ali žeton velja (ni porabljen, ni potekel), brez porabe: za stran z gumbom.
export async function preveriZeton(db, zeton) {
  if (!/^[\w-]{20,}$/.test(zeton || "")) return null;
  return db.prepare("SELECT email, jezik, nazaj FROM zetoni WHERE hash = ?1 AND porabljen_at IS NULL AND potece_at > ?2")
    .bind(await sha256(zeton), zdaj()).first();
}

// Porabi žeton (enkrat, pred potekom) in vrne, za koga je bil.
export async function porabiZeton(db, zeton) {
  if (!/^[\w-]{20,}$/.test(zeton || "")) return null;
  const t = zdaj();
  return db.prepare(
    "UPDATE zetoni SET porabljen_at = ?1 WHERE hash = ?2 AND porabljen_at IS NULL AND potece_at > ?1 RETURNING email, jezik, nazaj",
  ).bind(t, await sha256(zeton)).first();
}

// Izbriše člana z vsemi podatki: ogledi, komentarji (z odgovori drugih nanje),
// všečki, vrsta pošte in žetoni. Enako za izbris v nastavitvah in v nadzoru.
export function izbrisiClana(db, c) {
  return db.batch([
    db.prepare("DELETE FROM vrsta WHERE clan_id = ?").bind(c.id),
    db.prepare("DELETE FROM ogledi WHERE clan_id = ?").bind(c.id),
    db.prepare("DELETE FROM komentarji_vsecki WHERE clan_id = ?1 OR komentar_id IN (SELECT id FROM komentarji WHERE clan_id = ?1 OR odgovor_na IN (SELECT id FROM komentarji WHERE clan_id = ?1))").bind(c.id),
    db.prepare("DELETE FROM komentarji WHERE odgovor_na IN (SELECT id FROM komentarji WHERE clan_id = ?1)").bind(c.id),
    db.prepare("DELETE FROM komentarji WHERE clan_id = ?").bind(c.id),
    db.prepare("DELETE FROM zetoni WHERE email = ?").bind(c.email),
    // odzivi ostanejo (pomagajo izboljšati aplikacijo), a brez člana in e-naslova
    db.prepare("UPDATE odzivi SET clan_id = NULL, email = NULL WHERE clan_id = ?1 OR email = ?2").bind(c.id, c.email),
    db.prepare("DELETE FROM clani WHERE id = ?").bind(c.id),
  ]);
}

// Dnevno čiščenje (klic /api/obvesti iz GitHub Actions): potečeni in porabljeni
// žetoni (v njih je e-naslov) ter omejitve, starejše od dneva.
export function pocisti(db) {
  const dan = new Date(Date.now() - 86400e3);
  return db.batch([
    db.prepare("DELETE FROM zetoni WHERE potece_at < ?1 OR porabljen_at IS NOT NULL").bind(zdaj()),
    db.prepare("DELETE FROM omejitve WHERE okno < ?").bind(dan.toISOString().slice(0, 13)),
  ]);
}
