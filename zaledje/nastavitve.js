// Nastavitve nadzora v tabeli nastavitve (ključ → besedilo). Vsaka ima vrsto,
// privzeto vrednost in opis za nadzor. Vrednosti so v bazi, zato jih admin
// spreminja brez nove objave strani.
import { Napaka, zdaj } from "./osnova.js";

export const NASTAVITVE = {
  obvestila_vlogi: { vrsta: "da_ne", privzeto: true, opis: "Obvestila o novih vlogih gredo članom sama. Če je izklopljeno, obvestilo počaka v nadzoru, da ga pošlješ ali zavržeš." },
  obvestila_izdaje: { vrsta: "da_ne", privzeto: true, opis: "Obvestila o novih različicah aplikacije gredo članom sama. Če je izklopljeno, počakajo v nadzoru." },
  youtube_kanal: { vrsta: "da_ne", privzeto: true, opis: "Stran sama doda javne videe s tvojega kanala, objavljene po vklopu. Neobjavljene vloge dodaš z obrazcem zgoraj." },
  prijave_odprte: { vrsta: "da_ne", privzeto: true, opis: "Novi obiskovalci se lahko prijavijo. Če je izklopljeno, se prijavijo le obstoječi člani." },
  obvesti_me_novi_clan: { vrsta: "da_ne", privzeto: true, opis: "Ko se prijavi nov član, dobiš e-pošto z njegovim imenom in naslovom." },
  komentarji_odprti: { vrsta: "da_ne", privzeto: true, opis: "Prijavljeni člani lahko pišejo komentarje pod vlogi. Če je izklopljeno, obstoječi komentarji ostanejo vidni." },
  obvesti_me_komentar: { vrsta: "da_ne", privzeto: true, opis: "Ko nekdo napiše komentar ali odgovor, dobiš e-pošto z besedilom in povezavo." },
  odzivi_odprti: { vrsta: "da_ne", privzeto: true, opis: "Obrazec za odziv na strani in v aplikaciji sprejema sporočila. Če je izklopljeno, ju zavrne s prošnjo, naj poskusijo kasneje." },
  obvesti_me_odziv: { vrsta: "da_ne", privzeto: true, opis: "Ko nekdo pošlje odziv, dobiš e-pošto z besedilom. Če je pustil e-naslov, mu odgovoriš kar z Odgovori." },
  posta_dnevno: { vrsta: "stevilo", privzeto: 300, najmanj: 1, najvec: 300, opis: "Največ pošt na dan. Brevo brezplačno dovoli 300; kar je čez, gre naslednji dan." },
  besedilo_vlog_sl: { vrsta: "besedilo", privzeto: "Nov film s potovanja je na strani.", najvec: 300, opis: "Stavek v obvestilu o novem vlogu (slovensko)." },
  besedilo_vlog_en: { vrsta: "besedilo", privzeto: "A new travel film is up on the site.", najvec: 300, opis: "Stavek v obvestilu o novem vlogu (angleško)." },
};

function iz(kljuc, surovo) {
  const n = NASTAVITVE[kljuc];
  if (surovo === undefined || surovo === null) return n.privzeto;
  if (n.vrsta === "da_ne") return surovo === "1";
  if (n.vrsta === "stevilo") {
    const v = Number(surovo);
    return Number.isFinite(v) ? Math.min(n.najvec, Math.max(n.najmanj, Math.round(v))) : n.privzeto;
  }
  return String(surovo);
}

// Vse nastavitve kot { ključ: vrednost } (privzete, kjer v bazi ni zapisa).
export async function preberiNastavitve(db) {
  const { results } = await db.prepare("SELECT kljuc, vrednost FROM nastavitve").all();
  const v = Object.fromEntries(results.map((r) => [r.kljuc, r.vrednost]));
  return Object.fromEntries(Object.keys(NASTAVITVE).map((k) => [k, iz(k, v[k])]));
}

export async function nastavitev(db, kljuc) {
  const r = await db.prepare("SELECT vrednost FROM nastavitve WHERE kljuc = ?").bind(kljuc).first();
  return iz(kljuc, r?.vrednost);
}

// Shrani spremembe iz nadzora; neznan ključ ali napačna vrednost je napaka.
export async function shraniNastavitve(db, spremembe) {
  const stavki = [];
  for (const [kljuc, vrednost] of Object.entries(spremembe || {})) {
    const n = NASTAVITVE[kljuc];
    if (!n) throw new Napaka(400, "nastavitev", `Neznana nastavitev ${kljuc}.`);
    let surovo;
    if (n.vrsta === "da_ne") {
      if (typeof vrednost !== "boolean") throw new Napaka(400, "nastavitev", `${kljuc}: pričakovan je da ali ne.`);
      surovo = vrednost ? "1" : "0";
    } else if (n.vrsta === "stevilo") {
      const v = Number(vrednost);
      if (!Number.isInteger(v) || v < n.najmanj || v > n.najvec) throw new Napaka(400, "nastavitev", `${kljuc}: celo število od ${n.najmanj} do ${n.najvec}.`);
      surovo = String(v);
    } else {
      surovo = String(vrednost ?? "").trim().slice(0, n.najvec);
      if (!surovo) throw new Napaka(400, "nastavitev", `${kljuc}: besedilo ne sme biti prazno.`);
    }
    stavki.push(db.prepare(
      "INSERT INTO nastavitve (kljuc, vrednost, spremenjeno_at) VALUES (?1, ?2, ?3) ON CONFLICT (kljuc) DO UPDATE SET vrednost = excluded.vrednost, spremenjeno_at = excluded.spremenjeno_at",
    ).bind(kljuc, surovo, zdaj()));
  }
  if (stavki.length) await db.batch(stavki);
  // ob vklopu iskanja po kanalu: šteje le, kar je objavljeno od zdaj naprej
  if (spremembe?.youtube_kanal === true) {
    await db.prepare("INSERT INTO nastavitve (kljuc, vrednost) VALUES ('youtube_kanal_od', ?1) ON CONFLICT (kljuc) DO UPDATE SET vrednost = excluded.vrednost").bind(zdaj()).run();
  }
  return preberiNastavitve(db);
}

// Od kdaj šteje iskanje po kanalu (ob prvem branju se zapiše zdaj).
export async function youtubeKanalOd(db) {
  const r = await db.prepare("SELECT vrednost FROM nastavitve WHERE kljuc = 'youtube_kanal_od'").first();
  if (r?.vrednost) return r.vrednost;
  const t = zdaj();
  await db.prepare("INSERT OR IGNORE INTO nastavitve (kljuc, vrednost) VALUES ('youtube_kanal_od', ?1)").bind(t).run();
  return t;
}
