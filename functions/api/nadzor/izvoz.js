// Nadzor: izvoz v CSV (UTF-8 z BOM, da ga Excel odpre s šumniki).
//   GET /api/nadzor/izvoz            → člani
//   GET /api/nadzor/izvoz?kaj=odzivi → odzivi
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

// Vrednost, ki se začne z =, +, -, @, tabulatorjem ali CR, bi Excel izvedel kot
// formulo (ime in besedilo odziva vpiše uporabnik sam), zato dobi spredaj apostrof.
const polje = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const IZVOZI = {
  clani: {
    sql: "SELECT email, ime, vir, jezik, potrjen_at, odjavljen_at, blokiran, ustvarjen_at, zadnji_obisk_at, obiskov FROM clani ORDER BY ustvarjen_at",
    glava: ["email", "ime", "vir", "jezik", "potrjen", "odjavljen", "blokiran", "prijavljen", "zadnji_obisk", "obiskov"],
    vrstica: (r) => [r.email, r.ime, r.vir, r.jezik, r.potrjen_at, r.odjavljen_at, r.blokiran ? "da" : "", r.ustvarjen_at, r.zadnji_obisk_at, r.obiskov],
  },
  odzivi: {
    sql: `SELECT o.ustvarjeno_at, o.vrsta, o.besedilo, COALESCE(o.email, c.email) AS email, c.ime, o.vir, o.razlicica, o.sistem, o.jezik, o.resen_at
          FROM odzivi o LEFT JOIN clani c ON c.id = o.clan_id ORDER BY o.ustvarjeno_at`,
    glava: ["poslano", "vrsta", "besedilo", "email", "clan", "vir", "razlicica", "sistem", "jezik", "resen"],
    vrstica: (r) => [r.ustvarjeno_at, r.vrsta, r.besedilo, r.email, r.ime, r.vir, r.razlicica, r.sistem, r.jezik, r.resen_at],
  },
};

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  const kaj = new URL(request.url).searchParams.get("kaj") === "odzivi" ? "odzivi" : "clani";
  const izvoz = IZVOZI[kaj];
  const { results } = await env.DB.prepare(izvoz.sql).all();
  const vrstice = results.map((r) => izvoz.vrstica(r).map(polje).join(","));
  const csv = "﻿" + [izvoz.glava.join(","), ...vrstice].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="wayfare-${kaj}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
