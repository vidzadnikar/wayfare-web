// Seja prijavljenega člana: podpisan piškotek `wayfare_seja` z vrednostjo
// <id člana>.<različica>.<potek>.<podpis>. Podpis je HMAC s SESSION_SECRET,
// zato strežnik ne hrani sej. Član se vsakič prebere iz baze: blokiran ali
// izbrisan član sejo izgubi takoj, izpis poveča različico in tako prekliče vse
// seje tega člana na vseh napravah (tudi ukraden piškotek).
// Stari piškotki brez različice (<id>.<potek>.<podpis>) veljajo, dokler je
// različica člana 0, torej do njegovega prvega izpisa.
import { Napaka, piskotki, piskotek, podpisi, preveriPodpis, zahtevaj } from "./osnova.js";

export const SEJA = "wayfare_seja";
const TRAJANJE = 365 * 24 * 3600; // eno leto
// Nadzor (osebni podatki vseh članov) zahteva prijavo v zadnjih 14 dneh.
export const SEJA_ADMINA = 14 * 24 * 3600;

export async function sejaPiskotek(env, request, clan) {
  zahtevaj(env, "SESSION_SECRET");
  const potece = Math.floor(Date.now() / 1000) + TRAJANJE;
  const jedro = `${clan.id}.${clan.seja_verzija || 0}.${potece}`;
  const podpis = await podpisi(env.SESSION_SECRET, "seja:" + jedro);
  return piskotek(request, SEJA, `${jedro}.${podpis}`, TRAJANJE);
}

export const izbrisSeje = (request) => piskotek(request, SEJA, "", 0);

// Vrne člana s sejo ali null. Član dobi še _seja_izdana (sekunde od 1970),
// po kateri nadzor preveri starost seje.
export async function clanIzSeje(env, request) {
  zahtevaj(env, "SESSION_SECRET");
  const v = piskotki(request)[SEJA];
  if (!v) return null;
  const deli = v.split(".");
  let id, verzija, potece, podpis, jedro;
  if (deli.length === 4) {
    [id, verzija, potece, podpis] = deli;
    jedro = `${id}.${verzija}.${potece}`;
  } else if (deli.length === 3) {
    [id, potece, podpis] = deli;
    verzija = "0";
    jedro = `${id}.${potece}`;
  } else return null;
  if (!/^\d+$/.test(id || "") || !/^\d+$/.test(verzija || "") || !/^\d+$/.test(potece || "") || !podpis) return null;
  if (Number(potece) < Date.now() / 1000) return null;
  if (!(await preveriPodpis(env.SESSION_SECRET, `seja:${jedro}`, podpis))) return null;
  const clan = await env.DB.prepare("SELECT * FROM clani WHERE id = ?").bind(Number(id)).first();
  if (!clan || clan.blokiran || Number(verzija) !== (clan.seja_verzija || 0)) return null;
  clan._seja_izdana = Number(potece) - TRAJANJE;
  return clan;
}

// Izpis povsod: nova različica, vse obstoječe seje člana nehajo veljati.
export const preklicSej = (db, clanId) =>
  db.prepare("UPDATE clani SET seja_verzija = seja_verzija + 1 WHERE id = ?").bind(clanId).run();

export const jeAdmin = (env, clan) =>
  !!clan && !!env.ADMIN_EMAIL && clan.email === String(env.ADMIN_EMAIL).trim().toLowerCase();

export const svezaSejaAdmina = (clan) => !!clan && Date.now() / 1000 - (clan._seja_izdana || 0) <= SEJA_ADMINA;

// Nadzor sme le prijavljeni član z e-naslovom ADMIN_EMAIL in s sejo, mlajšo od
// 14 dni (starejša seja zadošča za komentarje, za nadzor pa je treba znova v prijavo).
export async function zahtevajAdmina(env, request) {
  const clan = await clanIzSeje(env, request);
  if (!clan) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!jeAdmin(env, clan)) throw new Napaka(403, "dostop", "Ni dostopa.");
  if (!svezaSejaAdmina(clan)) throw new Napaka(401, "prijava_znova", "Za nadzor se prijavi znova (seja skrbnika velja 14 dni).");
  return clan;
}
