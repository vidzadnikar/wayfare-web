// Prijava z Googlom, korak 1: preusmeritev na Googlovo prijavno stran
// (OAuth 2.0 code flow s PKCE). Stanje (state), PKCE preveritev, jezik in
// pot za vrnitev gredo v podpisan piškotek za 10 minut. Na strani ni nobenega
// Googlovega skripta; vse teče prek preusmeritev.
import { nakljucno, sha256b64url, kodirajJson, piskotek, varnaPot, domacaPot, jezikIz, izvor, preusmeri, podpisi, zahtevaj } from "../../zaledje/osnova.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const GOOGLE_PISKOTEK = "wayfare_google";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET");
  const url = new URL(request.url);
  const jezik = jezikIz(url.searchParams.get("jezik"), request);
  const nazaj = varnaPot(url.searchParams.get("nazaj"), domacaPot(jezik));
  const stanje = nakljucno(24);
  const preveritev = nakljucno(48);
  const vrednost = kodirajJson({ stanje, preveritev, jezik, nazaj });
  const podpis = await podpisi(env.SESSION_SECRET, "google:" + vrednost);
  const cilj = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  cilj.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: izvor(request) + "/api/google/povratek",
    response_type: "code",
    scope: "openid email profile",
    state: stanje,
    code_challenge: await sha256b64url(preveritev),
    code_challenge_method: "S256",
    prompt: "select_account",
    hl: jezik,
  }).toString();
  return preusmeri(cilj.toString(), { piskotki: [piskotek(request, GOOGLE_PISKOTEK, `${vrednost}.${podpis}`, 600)] });
}, { html: true });
