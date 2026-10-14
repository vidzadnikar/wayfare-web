// Nadzor: vlog z YouTuba na stran. GET ?url= vrne predlog (naslov in kraj iz
// naslova na YouTubu), POST ga da v vrsto, ki jo GitHub Actions vsakih
// nekaj minut doda na stran in pošlje obvestilo (vlogi/samodejno.py).
//   POST { url, naslov_sl, naslov_en, kraj_sl, kraj_en, datum? }
//   POST { dejanje: "izbrisi" | "znova", id }
import { Napaka, json, telo, istiIzvor, zdaj } from "../../../zaledje/osnova.js";
import { zahtevajAdmina } from "../../../zaledje/seja.js";
import { obravnavaj } from "../../../zaledje/strani.js";
import { idIzUrl, oembed, razcleni } from "../../../zaledje/youtube.js";

export const onRequestGet = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  const id = idIzUrl(new URL(request.url).searchParams.get("url"));
  if (!id) throw new Napaka(400, "url", "To ni povezava na video YouTube.");
  const { naslov } = await oembed(id);
  const obstojec = await env.DB.prepare("SELECT stanje, oznaka FROM youtube WHERE id = ?").bind(id).first();
  return json({ id, naslov_youtube: naslov, ...razcleni(naslov), obstojec });
});

const besedilo = (v, ime, najvec) => {
  const s = String(v ?? "").trim().slice(0, najvec);
  if (!s) throw new Napaka(400, ime, `${ime} manjka.`);
  return s;
};

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  await zahtevajAdmina(env, request);
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki } = await telo(request);
  const db = env.DB;
  if (podatki.dejanje === "izbrisi" || podatki.dejanje === "znova") {
    const id = idIzUrl(podatki.id);
    if (!id) throw new Napaka(400, "id", "id manjka.");
    const r = podatki.dejanje === "izbrisi"
      ? await db.prepare("DELETE FROM youtube WHERE id = ? AND stanje IN ('caka', 'napaka')").bind(id).run()
      : await db.prepare("UPDATE youtube SET stanje = 'caka', napaka = NULL WHERE id = ? AND stanje = 'napaka'").bind(id).run();
    if (!(r.meta?.changes ?? 0)) throw new Napaka(409, "stanje", "Tega videa zdaj ni mogoče spremeniti.");
    return json({ stanje: "ok" });
  }
  const id = idIzUrl(podatki.url);
  if (!id) throw new Napaka(400, "url", "To ni povezava na video YouTube.");
  await oembed(id); // video obstaja in ni zaseben
  const datum = podatki.datum ? String(podatki.datum) : null;
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Napaka(400, "datum", "Datum mora biti LLLL-MM-DD.");
  const predlog = razcleni(String(podatki.kraj_en || "")); // koordinate znanega kraja
  const lon = Number.isFinite(Number(podatki.lon)) && podatki.lon !== null && podatki.lon !== "" ? Number(podatki.lon) : predlog.lon;
  const lat = Number.isFinite(Number(podatki.lat)) && podatki.lat !== null && podatki.lat !== "" ? Number(podatki.lat) : predlog.lat;
  const r = await db.prepare(
    `INSERT INTO youtube (id, naslov_sl, naslov_en, kraj_sl, kraj_en, lon, lat, datum, vir) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'nadzor')
     ON CONFLICT (id) DO UPDATE SET naslov_sl = excluded.naslov_sl, naslov_en = excluded.naslov_en, kraj_sl = excluded.kraj_sl,
       kraj_en = excluded.kraj_en, lon = excluded.lon, lat = excluded.lat, datum = excluded.datum, stanje = 'caka', napaka = NULL, ustvarjeno_at = ?9
     WHERE youtube.stanje IN ('caka', 'napaka')`,
  ).bind(id, besedilo(podatki.naslov_sl, "naslov_sl", 120), besedilo(podatki.naslov_en, "naslov_en", 120),
    besedilo(podatki.kraj_sl, "kraj_sl", 80), besedilo(podatki.kraj_en, "kraj_en", 80), lon ?? null, lat ?? null, datum, zdaj()).run();
  if (!(r.meta?.changes ?? 0)) throw new Napaka(409, "ze", "Ta video je že na strani ali se ravno dodaja.");
  return json({ stanje: "caka", id });
});
