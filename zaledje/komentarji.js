// Komentarji pod vlogi: seznam objavljenih vlogov (za preverjanje oznake in
// naslov v pošti), oblika komentarja za stran in čiščenje besedila.
import { Napaka } from "./osnova.js";

export const NAJVEC_ZNAKOV = 2000;

// Objavljeni vlogi iz /vlogi/seznam.json (zgradi ga stran/zgradi.py).
export async function seznamVlogov(env, request) {
  try {
    const odg = await env.ASSETS.fetch(new URL("/vlogi/seznam.json", request.url));
    if (!odg.ok) return [];
    return await odg.json();
  } catch {
    return [];
  }
}

export async function vlogIzOznake(env, request, oznaka) {
  if (!/^[a-z0-9-]{2,60}$/.test(String(oznaka || ""))) throw new Napaka(400, "oznaka", "Neznan vlog.");
  const vlog = (await seznamVlogov(env, request)).find((v) => v.oznaka === oznaka);
  if (!vlog) throw new Napaka(404, "oznaka", "Neznan vlog.");
  return vlog;
}

// Besedilo: obrezano, brez nevidnih znakov, največ dve prazni vrstici zapored.
export function cistoBesedilo(vnos) {
  const s = String(vnos ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) throw new Napaka(400, "besedilo", "Komentar je prazen.");
  if (s.length > NAJVEC_ZNAKOV) throw new Napaka(400, "predolgo", `Komentar je daljši od ${NAJVEC_ZNAKOV} znakov.`);
  return s;
}

export function cistoIme(vnos) {
  const s = String(vnos ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (s.length < 2) throw new Napaka(400, "ime", "Vpiši ime, ki ga drugi vidijo ob komentarju.");
  return s;
}

// Komentar, kot ga vidi stran: brez e-naslovov, z avtorjem in všečki.
export function zaStran(r, jaz, adminId) {
  return {
    id: r.id, odgovor_na: r.odgovor_na, besedilo: r.besedilo,
    ustvarjeno_at: r.ustvarjeno_at, urejeno_at: r.urejeno_at,
    avtor: { ime: r.ime || null, slika: r.slika_url || null, avtor_strani: r.clan_id === adminId },
    vseckov: r.vseckov || 0, vsec_mi: !!r.vsec_mi, moj: !!jaz && r.clan_id === jaz.id,
  };
}

export const SELECT_KOMENTARJEV = `
  SELECT k.id, k.oznaka, k.clan_id, k.odgovor_na, k.besedilo, k.ustvarjeno_at, k.urejeno_at, c.ime, c.slika_url,
         (SELECT COUNT(*) FROM komentarji_vsecki v WHERE v.komentar_id = k.id) AS vseckov,
         EXISTS (SELECT 1 FROM komentarji_vsecki v WHERE v.komentar_id = k.id AND v.clan_id = ?2) AS vsec_mi
  FROM komentarji k JOIN clani c ON c.id = k.clan_id
  WHERE c.blokiran = 0`;
