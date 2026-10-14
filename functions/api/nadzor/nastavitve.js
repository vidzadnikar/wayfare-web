// Nadzor: nastavitve (GET seznam z opisi, POST { ključ: vrednost, … }).
import { Napaka, json, telo, istiIzvor } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { NASTAVITVE, preberiNastavitve, shraniNastavitve } from "../../../zaledje/nastavitve.js";

const opisi = () => Object.fromEntries(Object.entries(NASTAVITVE).map(([k, n]) => [k, { vrsta: n.vrsta, opis: n.opis, najmanj: n.najmanj, najvec: n.najvec, privzeto: n.privzeto }]));

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  return json({ vrednosti: await preberiNastavitve(env.DB), opisi: opisi() });
});

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  return json({ vrednosti: await shraniNastavitve(env.DB, podatki), opisi: opisi() });
});
