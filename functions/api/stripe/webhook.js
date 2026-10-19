// Stripov webhook: ob plačilu, podaljšanju, neuspelem plačilu ali preklicu
// uskladi naročnino člana. Preveri podpis (STRIPE_WEBHOOK_SECRET); vsak
// dogodek se obdela enkrat (tabela stripe_dogodki); ob napaki se zapis
// umakne, da Stripe dogodek pošlje znova.
import { json } from "../../../zaledje/osnova.js";
import { preveriWebhook, uskladiNarocnino, stripe, poveziStranko } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

const NAROCNINA = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed"]);

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const dogodek = await preveriWebhook(env, request);
  const db = env.DB;
  const r = await db.prepare("INSERT OR IGNORE INTO stripe_dogodki (id, vrsta) VALUES (?1, ?2)").bind(String(dogodek.id), String(dogodek.type)).run();
  if (!(r.meta?.changes ?? 0)) return json({ prejeto: true, ponovljen: true });
  const obj = dogodek.data?.object || {};
  const cas = Number(dogodek.created) || Math.floor(Date.now() / 1000);
  try {
    if (dogodek.type === "checkout.session.completed" && obj.mode === "subscription" && obj.subscription) {
      const clanId = Number(obj.client_reference_id) || Number(obj.metadata?.clan_id) || null;
      const customer = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (clanId && customer) await poveziStranko(db, clanId, customer);
      const sub = typeof obj.subscription === "object" ? obj.subscription : await stripe(env, "GET", `subscriptions/${encodeURIComponent(obj.subscription)}`);
      await uskladiNarocnino(db, sub, clanId, cas);
    } else if (NAROCNINA.has(dogodek.type)) {
      await uskladiNarocnino(db, obj, null, cas);
    }
  } catch (e) {
    await db.prepare("DELETE FROM stripe_dogodki WHERE id = ?").bind(String(dogodek.id)).run();
    throw e;
  }
  if (Math.random() < 0.02) {
    await db.prepare("DELETE FROM stripe_dogodki WHERE prejeto_at < ?").bind(new Date(Date.now() - 30 * 86400e3).toISOString()).run();
  }
  return json({ prejeto: true });
});
