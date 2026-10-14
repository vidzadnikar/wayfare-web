// Nadzor: izvoz članov v CSV (UTF-8 z BOM, da ga Excel odpre s šumniki).
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";

const polje = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  const { results } = await env.DB.prepare(
    "SELECT email, ime, vir, jezik, potrjen_at, odjavljen_at, blokiran, ustvarjen_at, zadnji_obisk_at, obiskov FROM clani ORDER BY ustvarjen_at",
  ).all();
  const glava = ["email", "ime", "vir", "jezik", "potrjen", "odjavljen", "blokiran", "prijavljen", "zadnji_obisk", "obiskov"];
  const vrstice = results.map((r) => [r.email, r.ime, r.vir, r.jezik, r.potrjen_at, r.odjavljen_at, r.blokiran ? "da" : "", r.ustvarjen_at, r.zadnji_obisk_at, r.obiskov].map(polje).join(","));
  const csv = "﻿" + [glava.join(","), ...vrstice].join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="wayfare-clani-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
