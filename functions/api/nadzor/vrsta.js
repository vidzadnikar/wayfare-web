// Nadzor: ročno pošlje, kar čaka v vrsti (do dnevne meje).
import { Napaka, json, istiIzvor, stranUrl } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { posljiIzVrste } from "../../../zaledje/posta.js";
import { obravnavaj } from "../../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  return json(await posljiIzVrste(env, env.DB, stranUrl(env, request)));
});
