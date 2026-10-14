// Nadzor: novica po meri. komu: "sebi" pošlje preizkus v obeh jezikih na
// ADMIN_EMAIL (ne šteje kot obvestilo), "vsem" ustvari obvestilo in ga da v vrsto.
import { Napaka, json, telo, istiIzvor, stranUrl, zdaj } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { sestaviObvestilo, posljiPosto, posljiIzVrste, odjavaZeton } from "../../../zaledje/posta.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { preveriPostavko, ustvariObvestilo } from "../obvesti.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  const admin = await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const komu = podatki.komu === "vsem" ? "vsem" : "sebi";
  const p = preveriPostavko({
    vrsta: "novica", kljuc: `novica:${zdaj()}`,
    naslov: podatki.naslov, besedilo: podatki.besedilo,
    url: typeof podatki.url === "string" ? { sl: podatki.url, en: podatki.url } : podatki.url,
  });
  const izvorStrani = stranUrl(env, request);
  if (komu === "sebi") {
    const odjavaUrl = `${izvorStrani}/api/odjava?z=${await odjavaZeton(env, admin)}`;
    const sporocila = ["sl", "en"].map((jezik) => ({
      za: admin.email, vrsta: "preizkus",
      ...sestaviObvestilo(p, { ime: admin.ime, jezik }, { odjavaUrl }),
    }));
    await posljiPosto(env, env.DB, sporocila);
    return json({ stanje: "poslano_sebi", za: admin.email });
  }
  const obvestilo = await ustvariObvestilo(env.DB, p);
  const vrsta = await posljiIzVrste(env, env.DB, izvorStrani);
  return json({ stanje: "poslano_vsem", obvestilo, ...vrsta });
});
