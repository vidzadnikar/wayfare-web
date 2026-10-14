// Seja prijavljenega člana: podpisan piškotek `wayfare_seja` z vrednostjo
// <id člana>.<potek>.<podpis>. Podpis je HMAC s SESSION_SECRET, zato
// strežnik ne hrani sej; blokiran ali izbrisan član sejo izgubi ob naslednji
// zahtevi, ker se član vsakič prebere iz baze.
import { Napaka, piskotki, piskotek, podpisi, preveriPodpis, zahtevaj } from "./osnova.js";

export const SEJA = "wayfare_seja";
const TRAJANJE = 365 * 24 * 3600; // eno leto

export async function sejaPiskotek(env, request, clanId) {
  zahtevaj(env, "SESSION_SECRET");
  const potece = Math.floor(Date.now() / 1000) + TRAJANJE;
  const jedro = `${clanId}.${potece}`;
  const podpis = await podpisi(env.SESSION_SECRET, "seja:" + jedro);
  return piskotek(request, SEJA, `${jedro}.${podpis}`, TRAJANJE);
}

export const izbrisSeje = (request) => piskotek(request, SEJA, "", 0);

export async function clanIzSeje(env, request) {
  zahtevaj(env, "SESSION_SECRET");
  const v = piskotki(request)[SEJA];
  if (!v) return null;
  const [id, potece, podpis] = v.split(".");
  if (!/^\d+$/.test(id || "") || !/^\d+$/.test(potece || "") || !podpis) return null;
  if (Number(potece) < Date.now() / 1000) return null;
  if (!(await preveriPodpis(env.SESSION_SECRET, `seja:${id}.${potece}`, podpis))) return null;
  const clan = await env.DB.prepare("SELECT * FROM clani WHERE id = ?").bind(Number(id)).first();
  if (!clan || clan.blokiran) return null;
  return clan;
}

export const jeAdmin = (env, clan) =>
  !!clan && !!env.ADMIN_EMAIL && clan.email === String(env.ADMIN_EMAIL).trim().toLowerCase();

// Nadzor sme le prijavljeni član z e-naslovom ADMIN_EMAIL.
export async function zahtevajAdmina(env, request) {
  const clan = await clanIzSeje(env, request);
  if (!clan) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!jeAdmin(env, clan)) throw new Napaka(403, "dostop", "Ni dostopa.");
  return clan;
}
