// Naročnine in dostop do plačljivih vlogov: Stripe (Checkout, Customer
// Portal, webhook) in podarjen dostop iz nadzora.
//
// Dostop ima admin, član s podarjenim dostopom (do roka ali brez) in član z
// veljavno naročnino: active ali trialing (tudi s preklicem ob koncu
// obdobja: Stripe jo pusti active do konca), past_due še 7 dni po koncu
// obdobja (Stripe plačilo ponavlja), canceled do konca plačanega obdobja.
import { Napaka, zdaj, enakaSkrivnost, varnaPot, domacaPot, zahtevaj } from "./osnova.js";
import { jeAdmin } from "./seja.js";

export const narocninaNaVoljo = (env) => !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
// STRIPE_API_URL je le za domači preizkus z lažnim strežnikom
const stripeUrl = (env) => (env.STRIPE_API_URL || "https://api.stripe.com").replace(/\/$/, "");

// Klic Stripe REST: telo kot obrazec (ključi a[b][c]); vrne JSON ali vrže
// napako s Stripovim sporočilom (502, da stran ve, da ni kriva ona).
export async function stripe(env, metoda, pot, telo = null) {
  zahtevaj(env, "STRIPE_SECRET_KEY");
  const glave = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  let body;
  if (telo) {
    glave["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(telo).toString();
  }
  const odg = await fetch(`${stripeUrl(env)}/v1/${pot}`, { method: metoda, headers: glave, body });
  const podatki = await odg.json().catch(() => ({}));
  if (!odg.ok) {
    const sporocilo = podatki?.error?.message || `Stripe ${odg.status}`;
    console.error("Stripe:", metoda, pot, odg.status, sporocilo);
    throw new Napaka(502, "stripe", sporocilo);
  }
  return podatki;
}

// ---------------------------------------------------------------- dostop

const AKTIVNA = new Set(["active", "trialing"]);
const MILOST_MS = 7 * 86400e3;

export function narocninaVelja(n, t = Date.now()) {
  if (!n) return false;
  const konec = n.obdobje_do ? Date.parse(n.obdobje_do) : 0;
  if (AKTIVNA.has(n.stanje)) return true;
  if (n.stanje === "past_due") return konec + MILOST_MS > t;
  if (n.stanje === "canceled") return konec > t;
  return false;
}

export const povzetekNarocnine = (n) => (n
  ? { id: n.id, stanje: n.stanje, obdobje_do: n.obdobje_do, preklic_ob_koncu: !!n.preklic_ob_koncu, velja: narocninaVelja(n) }
  : null);

// Najpomembnejša naročnina člana: veljavna pred potečeno, novejša pred starejšo.
export function zadnjaNarocnina(db, clanId) {
  return db.prepare(
    `SELECT * FROM narocnine WHERE clan_id = ?1
     ORDER BY (stanje IN ('active', 'trialing')) DESC, (stanje = 'past_due') DESC, obdobje_do DESC, posodobljeno_at DESC LIMIT 1`,
  ).bind(clanId).first();
}

export const podarjenVelja = (clan, t = Date.now()) =>
  !!clan && clan.dostop_vrsta === "podarjen" && (!clan.dostop_do || Date.parse(clan.dostop_do) > t);

export async function dostopClana(env, db, clan) {
  if (!clan) return { dostop: false, vrsta: null, do: null, narocnina: null };
  const n = await zadnjaNarocnina(db, clan.id);
  const narocnina = povzetekNarocnine(n);
  if (jeAdmin(env, clan)) return { dostop: true, vrsta: "admin", do: null, narocnina };
  if (narocninaVelja(n)) return { dostop: true, vrsta: "narocnina", do: n.obdobje_do, narocnina };
  if (podarjenVelja(clan)) return { dostop: true, vrsta: "podarjen", do: clan.dostop_do || null, narocnina };
  return { dostop: false, vrsta: null, do: null, narocnina };
}

// ---------------------------------------------------------------- Stripe Checkout in portal

const potVlogov = (jezik) => (jezik === "sl" ? "/sl/vlogi/" : "/vlogi/");

// Seja Checkout: naročnina na STRIPE_PRICE_ID, član je v client_reference_id in
// metapodatkih (po njih webhook najde člana). Po plačilu Stripe vrne na isto
// stran z ?narocnina=ok&seja=…, ob preklicu z ?narocnina=preklic.
export async function ustvariCheckout(env, { clan, jezik, stran, nazaj }) {
  zahtevaj(env, "STRIPE_SECRET_KEY", "STRIPE_PRICE_ID");
  const pot = varnaPot(nazaj, potVlogov(jezik));
  const telo = {
    mode: "subscription",
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    client_reference_id: String(clan.id),
    "metadata[clan_id]": String(clan.id),
    "subscription_data[metadata][clan_id]": String(clan.id),
    success_url: `${stran}${pot}?narocnina=ok&seja={CHECKOUT_SESSION_ID}`,
    cancel_url: `${stran}${pot}?narocnina=preklic`,
    locale: "auto",
    allow_promotion_codes: "true",
  };
  if (clan.stripe_customer_id) telo.customer = clan.stripe_customer_id;
  else telo.customer_email = clan.email;
  return stripe(env, "POST", "checkout/sessions", telo);
}

export async function ustvariPortal(env, { clan, jezik, stran, nazaj }) {
  if (!clan.stripe_customer_id) throw new Napaka(400, "brez_stranke", "Ta račun še nima naročnine.");
  return stripe(env, "POST", "billing_portal/sessions", {
    customer: clan.stripe_customer_id,
    return_url: `${stran}${varnaPot(nazaj, domacaPot(jezik))}`,
    locale: "auto",
  });
}

// ---------------------------------------------------------------- usklajevanje s Stripom

// Konec obdobja: v novejših različicah API-ja je na postavki naročnine, v starejših na naročnini.
export const obdobjeDo = (sub) => {
  const s = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;
  return s ? new Date(s * 1000).toISOString() : null;
};
const idStranke = (sub) => (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) || null;

// Stripova stranka k članu: ostane prva; druga stranka z isto oznako ni mogoča
// (enolični indeks), zato se tuja oznaka preskoči z zapisom v dnevnik.
export async function poveziStranko(db, clanId, customer) {
  if (!customer || !clanId) return;
  const r = await db.prepare(
    `UPDATE clani SET stripe_customer_id = ?1 WHERE id = ?2 AND stripe_customer_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM clani WHERE stripe_customer_id = ?1 AND id != ?2)`,
  ).bind(customer, clanId).run();
  const c = await db.prepare("SELECT stripe_customer_id FROM clani WHERE id = ?").bind(clanId).first();
  if (c && c.stripe_customer_id !== customer) console.warn("Stripe stranka", customer, "ni povezana s članom", clanId, "(ima", c.stripe_customer_id, ")");
  return r;
}

// Zapiše Stripovo naročnino k članu (po metapodatkih, namigu ali stranki).
// dogodekAt je čas dogodka: starejši dogodek novejšega stanja ne povozi.
export async function uskladiNarocnino(db, sub, clanIdNamig = null, dogodekAt = Math.floor(Date.now() / 1000)) {
  if (!sub || typeof sub !== "object" || !sub.id) return null;
  const customer = idStranke(sub);
  let clanId = Number(sub.metadata?.clan_id) || Number(clanIdNamig) || null;
  if (!clanId && customer) {
    const c = await db.prepare("SELECT id FROM clani WHERE stripe_customer_id = ?").bind(customer).first();
    clanId = c?.id || null;
  }
  if (!clanId) { console.warn("Stripe naročnina brez člana:", sub.id, customer); return null; }
  const obstaja = await db.prepare("SELECT id FROM clani WHERE id = ?").bind(clanId).first();
  if (!obstaja) { console.warn("Stripe naročnina za člana, ki ga ni:", sub.id, clanId); return null; }
  if (customer) await poveziStranko(db, clanId, customer);
  const stavki = [];
  stavki.push(db.prepare(
    `INSERT INTO narocnine (id, clan_id, stanje, obdobje_do, preklic_ob_koncu, cena_id, dogodek_at, posodobljeno_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (id) DO UPDATE SET clan_id = excluded.clan_id, stanje = excluded.stanje, obdobje_do = excluded.obdobje_do,
       preklic_ob_koncu = excluded.preklic_ob_koncu, cena_id = excluded.cena_id, dogodek_at = excluded.dogodek_at,
       posodobljeno_at = excluded.posodobljeno_at
     WHERE excluded.dogodek_at >= narocnine.dogodek_at`,
  ).bind(sub.id, clanId, String(sub.status || "neznano"), obdobjeDo(sub), sub.cancel_at_period_end ? 1 : 0,
    sub.items?.data?.[0]?.price?.id ?? null, dogodekAt, zdaj()));
  await db.batch(stavki);
  return clanId;
}

// Ob izbrisu člana (sam ali v nadzoru) se njegove naročnine pri Stripu prekličejo
// takoj, da ne plačuje naprej. Napaka pri Stripu izbrisa ne ustavi (gre v dnevnik).
export async function prekliciNarocnine(env, db, clanId) {
  if (!env.STRIPE_SECRET_KEY) return;
  const { results } = await db.prepare(
    "SELECT id FROM narocnine WHERE clan_id = ?1 AND stanje NOT IN ('canceled', 'incomplete_expired')",
  ).bind(clanId).all();
  for (const n of results) {
    try { await stripe(env, "DELETE", `subscriptions/${n.id}`); } catch (e) { console.error("preklic naročnine", n.id, e?.message || e); }
  }
}

// ---------------------------------------------------------------- webhook

async function hmacHex(skrivnost, sporocilo) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(skrivnost), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, enc.encode(sporocilo));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Preveri glavo Stripe-Signature (t=…,v1=…): HMAC-SHA256 s STRIPE_WEBHOOK_SECRET
// prek "<t>.<telo>", največ 5 minut star. Vrne dogodek.
export async function preveriWebhook(env, request) {
  zahtevaj(env, "STRIPE_WEBHOOK_SECRET");
  const telo = await request.text();
  const glava = request.headers.get("Stripe-Signature") || "";
  let t = 0;
  const podpisi = [];
  for (const del of glava.split(",")) {
    const i = del.indexOf("=");
    if (i < 0) continue;
    const k = del.slice(0, i).trim(), v = del.slice(i + 1).trim();
    if (k === "t") t = Number(v);
    else if (k === "v1" && v) podpisi.push(v);
  }
  if (!t || !podpisi.length) throw new Napaka(400, "podpis", "Manjka podpis Stripe.");
  if (Math.abs(Date.now() / 1000 - t) > 300) throw new Napaka(400, "podpis", "Podpis je prestar.");
  const pricakovan = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${telo}`);
  let ok = false;
  for (const p of podpisi) if (await enakaSkrivnost(p, pricakovan)) ok = true;
  if (!ok) throw new Napaka(400, "podpis", "Podpis ni veljaven.");
  try { return JSON.parse(telo); } catch { throw new Napaka(400, "telo", "Telo ni JSON."); }
}
