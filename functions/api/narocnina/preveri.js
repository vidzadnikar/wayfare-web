// Po vrnitvi s Checkouta (?seja=cs_…): stran takoj uskladi naročnino iz
// Stripa, da ne čaka na webhook. Seja mora pripadati prijavljenemu članu.
import { Napaka, json } from "../../../zaledje/osnova.js";
import { clanIzSeje } from "../../../zaledje/seja.js";
import { stripe, uskladiNarocnino, dostopClana, narocninaNaVoljo, poveziStranko } from "../../../zaledje/narocnine.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  const clan = await clanIzSeje(env, request);
  if (!clan) throw new Napaka(401, "prijava", "Prijava je potrebna.");
  if (!narocninaNaVoljo(env)) throw new Napaka(503, "ni_na_voljo");
  const id = new URL(request.url).searchParams.get("seja") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw new Napaka(400, "seja", "Napačna seja.");
  const s = await stripe(env, "GET", `checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`);
  if (String(s.client_reference_id) !== String(clan.id)) throw new Napaka(403, "tuja_seja");
  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
  if (customer) await poveziStranko(env.DB, clan.id, customer);
  if (s.subscription && typeof s.subscription === "object") await uskladiNarocnino(env.DB, s.subscription, clan.id);
  return json({ seja: s.status || null, ...(await dostopClana(env, env.DB, clan)) });
});
