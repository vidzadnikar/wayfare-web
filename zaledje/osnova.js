// Skupne pomožne funkcije zaledja (Pages Functions v functions/): odgovori,
// branje telesa, piškotki, naključne vrednosti, podpisi (HMAC prek WebCrypto),
// preverjanje izvora zahteve in varnih poti za preusmeritev. Brez knjižnic:
// vse je iz Web API-jev, ki jih ima Cloudflare Workers.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const zdaj = () => new Date().toISOString();

// Pričakovana napaka s kodo za odjemalca (status < 500). Vse drugo je napaka
// strežnika in gre v dnevnik.
export class Napaka extends Error {
  constructor(status, koda, sporocilo) {
    super(sporocilo || koda);
    this.status = status;
    this.koda = koda;
  }
}

export function json(telo, status = 200, glave = {}) {
  return new Response(JSON.stringify(telo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...glave },
  });
}

// Preusmeritev 303 (po POST brskalnik nadaljuje z GET). `piskotki` je seznam
// vrstic Set-Cookie; glava se sme ponoviti, zato gre prek Headers.append.
export function preusmeri(cilj, { piskotki = [] } = {}) {
  const glave = new Headers({ Location: cilj, "Cache-Control": "no-store" });
  for (const p of piskotki) glave.append("Set-Cookie", p);
  return new Response(null, { status: 303, headers: glave });
}

// Telo zahteve: JSON (fetch s strani) ali obrazec (brez JS, ali pošta ob
// odjavi z enim klikom). Odgovor po obrazcu je preusmeritev, po JSON pa JSON.
export async function telo(request) {
  const vrsta = request.headers.get("Content-Type") || "";
  if (vrsta.includes("application/json")) {
    try {
      const podatki = await request.json();
      return { podatki: podatki && typeof podatki === "object" ? podatki : {}, obrazec: false };
    } catch {
      throw new Napaka(400, "telo", "Telo ni veljaven JSON.");
    }
  }
  if (vrsta.includes("application/x-www-form-urlencoded") || vrsta.includes("multipart/form-data")) {
    return { podatki: Object.fromEntries(await request.formData()), obrazec: true };
  }
  return { podatki: {}, obrazec: false };
}

// ---------------------------------------------------------------- kodiranje, podpisi

export function b64url(bajti) {
  let s = "";
  for (const b of new Uint8Array(bajti)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function odB64url(niz) {
  const s = String(niz).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const kodirajJson = (vrednost) => b64url(enc.encode(JSON.stringify(vrednost)));
export function dekodirajJson(niz) {
  try { return JSON.parse(dec.decode(odB64url(niz))); } catch { return null; }
}

export const nakljucno = (bajtov = 32) => b64url(crypto.getRandomValues(new Uint8Array(bajtov)));

export async function sha256(niz) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(niz));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sha256b64url = async (niz) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(niz)));

async function kljucHmac(skrivnost) {
  return crypto.subtle.importKey("raw", enc.encode(skrivnost), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function podpisi(skrivnost, sporocilo) {
  return b64url(await crypto.subtle.sign("HMAC", await kljucHmac(skrivnost), enc.encode(sporocilo)));
}

export async function preveriPodpis(skrivnost, sporocilo, podpis) {
  try {
    return await crypto.subtle.verify("HMAC", await kljucHmac(skrivnost), odB64url(podpis), enc.encode(sporocilo));
  } catch {
    return false;
  }
}

// Primerjava skrivnosti brez odvisnosti od časa: primerja podpisa obeh
// vrednosti z istim naključnim ključem (enaka vrednost da enak podpis).
export async function enakaSkrivnost(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const k = nakljucno(16);
  return (await podpisi(k, a)) === (await podpisi(k, b));
}

// ---------------------------------------------------------------- piškotki

export function piskotki(request) {
  const iz = {};
  for (const del of (request.headers.get("Cookie") || "").split(";")) {
    const i = del.indexOf("=");
    if (i < 0) continue;
    try { iz[del.slice(0, i).trim()] = decodeURIComponent(del.slice(i + 1).trim()); } catch { /* pokvarjen piškotek: preskoči */ }
  }
  return iz;
}

export const https = (request) => new URL(request.url).protocol === "https:";

// HttpOnly in SameSite=Lax vedno; Secure le na https, da dela tudi doma
// (npx wrangler pages dev na http://localhost). maxAge 0 piškotek izbriše.
export function piskotek(request, ime, vrednost, maxAge) {
  let s = `${ime}=${encodeURIComponent(vrednost)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (https(request)) s += "; Secure";
  return s;
}

// ---------------------------------------------------------------- zahteva

export const izvor = (request) => new URL(request.url).origin;

// Naslov strani v povezavah v pošti: STRAN_URL, sicer izvor zahteve.
export const stranUrl = (env, request) => (env.STRAN_URL || izvor(request)).replace(/\/$/, "");

// Zahteve, ki kaj spremenijo, sprejme le s svoje strani. Brskalniki pošljejo
// Sec-Fetch-Site ali Origin; brez obeh (curl) odloči piškotek SameSite=Lax,
// ki ga tuj obrazec tako ali tako ne dobi.
export function istiIzvor(request) {
  const sfs = request.headers.get("Sec-Fetch-Site");
  if (sfs) return sfs === "same-origin" || sfs === "none";
  const o = request.headers.get("Origin");
  if (o) return o === izvor(request);
  const r = request.headers.get("Referer");
  if (r) return r.startsWith(izvor(request) + "/");
  return true;
}

// Pot za vrnitev po prijavi: le pot na tej strani (brez drugega gostitelja).
export function varnaPot(p, privzeto = "/") {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || /[\\\r\n]/.test(p)) return privzeto;
  const cista = p.split("#")[0].split("?")[0].slice(0, 200);
  return cista || privzeto;
}

export const domacaPot = (jezik) => (jezik === "sl" ? "/sl/" : "/");

export function jezikIz(vrednost, request) {
  if (vrednost === "sl" || vrednost === "en") return vrednost;
  const al = request?.headers.get("Accept-Language") || "";
  return /^\s*sl\b/i.test(al) ? "sl" : "en";
}

export const ip = (request) => request.headers.get("CF-Connecting-IP") || "lokalno";

export function pobegni(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Manjkajoča nastavitev je napaka strežnika z jasnim sporočilom v dnevniku.
export function zahtevaj(env, ...imena) {
  const manjka = imena.filter((i) => !env[i]);
  if (manjka.length) throw new Error(`Manjkajo nastavitve: ${manjka.join(", ")} (Pages → Settings → Variables and Secrets ali .dev.vars)`);
}

// Klic strojev (GitHub Actions): glava Authorization: Bearer <OBVESTI_SECRET>.
export async function zahtevajSkrivnost(env, request) {
  zahtevaj(env, "OBVESTI_SECRET");
  const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!(await enakaSkrivnost(auth, env.OBVESTI_SECRET))) throw new Napaka(401, "dostop");
}
