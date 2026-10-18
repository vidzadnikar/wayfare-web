// Prijava z Googlom, korak 2: Google vrne kodo, zaledje jo s skrivnostjo
// odjemalca zamenja za žetone in iz id_token prebere e-naslov, ime in sliko.
// Žeton pride naravnost od Googla prek TLS, zato se preverijo le trditve
// (izdajatelj, občinstvo, potek, potrjen e-naslov), ne podpis.
import { piskotki, piskotek, preveriPodpis, dekodirajJson, odB64url, domacaPot, jezikIz, izvor, preusmeri, zahtevaj } from "../../../zaledje/osnova.js";
import { sejaPiskotek } from "../../../zaledje/seja.js";
import { normalizirajEmail, clanPoEmailu, prijaviClana } from "../../../zaledje/clani.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { prijavaDovoljena, poPrijavi } from "../../../zaledje/dogodki.js";
import { GOOGLE_PISKOTEK } from "../google.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET");
  const url = new URL(request.url);
  const pobrisi = piskotek(request, GOOGLE_PISKOTEK, "", 0);
  const surovo = piskotki(request)[GOOGLE_PISKOTEK] || "";
  const locilo = surovo.lastIndexOf(".");
  let stanje = null;
  if (locilo > 0) {
    const vrednost = surovo.slice(0, locilo);
    if (await preveriPodpis(env.SESSION_SECRET, "google:" + vrednost, surovo.slice(locilo + 1))) stanje = dekodirajJson(vrednost);
  }
  const jezik = stanje?.jezik || jezikIz(null, request);
  const nazaj = stanje?.nazaj || domacaPot(jezik);
  const napaka = (koda) => preusmeri(`${nazaj}?prijava=${koda}`, { piskotki: [pobrisi] });

  if (url.searchParams.get("error") === "access_denied") return preusmeri(nazaj, { piskotki: [pobrisi] });
  const koda = url.searchParams.get("code");
  if (!stanje || !koda || url.searchParams.get("state") !== stanje.stanje) return napaka("napaka");

  const odg = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: koda, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: izvor(request) + "/api/google/povratek", grant_type: "authorization_code", code_verifier: stanje.preveritev,
    }),
  });
  if (!odg.ok) {
    console.error("Google token:", odg.status, (await odg.text()).slice(0, 300));
    return napaka("napaka");
  }
  const { id_token } = await odg.json();
  let trditve = null;
  try { trditve = JSON.parse(new TextDecoder().decode(odB64url(String(id_token).split(".")[1]))); } catch { trditve = null; }
  const velja = trditve
    && (trditve.iss === "https://accounts.google.com" || trditve.iss === "accounts.google.com")
    && trditve.aud === env.GOOGLE_CLIENT_ID
    && Number(trditve.exp) > Date.now() / 1000
    && typeof trditve.email === "string"
    && (trditve.email_verified === true || trditve.email_verified === "true");
  if (!velja) {
    console.error("Google id_token: neveljavne trditve");
    return napaka("napaka");
  }

  const email = normalizirajEmail(trditve.email);
  const obstojec = await clanPoEmailu(env.DB, email);
  if (obstojec?.blokiran) return napaka("blokiran");
  if (!(await prijavaDovoljena(env.DB, obstojec))) return napaka("zaprto");
  const clan = await prijaviClana(env.DB, {
    email, ime: trditve.name || trditve.given_name || null, slika: trditve.picture || null, vir: "google", jezik,
  });
  await poPrijavi(env, request, clan, !obstojec);
  return preusmeri(`${nazaj}?prijava=google`, { piskotki: [pobrisi, await sejaPiskotek(env, request, clan)] });
}, { html: true });
