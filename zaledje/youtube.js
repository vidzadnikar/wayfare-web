// Vlogi z YouTuba: oznaka videa iz povezave, naslov prek oEmbed (deluje tudi
// za neobjavljene videe) in predlog naslova ter kraja iz naslova, kot ga piše
// Vid ("Rome day 1", "Budimpešta day 2 3", "Madrid recap").
import { Napaka } from "./osnova.js";

// Znani kraji: slovensko in angleško ime, država, koordinate za globus in
// imena, po katerih jih prepoznamo v naslovu (brez šumnikov, male črke).
const KRAJI = [
  { sl: "Rim", en: "Rome", d: ["Italija", "Italy"], lon: 12.496, lat: 41.903, imena: ["rim", "rome", "roma"] },
  { sl: "Milano", en: "Milan", d: ["Italija", "Italy"], lon: 9.19, lat: 45.464, imena: ["milano", "milan"] },
  { sl: "Benetke", en: "Venice", d: ["Italija", "Italy"], lon: 12.316, lat: 45.441, imena: ["benetke", "venice", "venezia"] },
  { sl: "Firence", en: "Florence", d: ["Italija", "Italy"], lon: 11.256, lat: 43.77, imena: ["firence", "florence", "firenze"] },
  { sl: "Neapelj", en: "Naples", d: ["Italija", "Italy"], lon: 14.268, lat: 40.852, imena: ["neapelj", "naples", "napoli"] },
  { sl: "Madrid", en: "Madrid", d: ["Španija", "Spain"], lon: -3.704, lat: 40.417, imena: ["madrid"] },
  { sl: "Barcelona", en: "Barcelona", d: ["Španija", "Spain"], lon: 2.173, lat: 41.385, imena: ["barcelona"] },
  { sl: "Budimpešta", en: "Budapest", d: ["Madžarska", "Hungary"], lon: 19.04, lat: 47.498, imena: ["budimpesta", "budapest"] },
  { sl: "Dunaj", en: "Vienna", d: ["Avstrija", "Austria"], lon: 16.373, lat: 48.208, imena: ["dunaj", "vienna", "wien"] },
  { sl: "Praga", en: "Prague", d: ["Češka", "Czechia"], lon: 14.437, lat: 50.075, imena: ["praga", "prague", "praha"] },
  { sl: "Pariz", en: "Paris", d: ["Francija", "France"], lon: 2.352, lat: 48.857, imena: ["pariz", "paris"] },
  { sl: "Lizbona", en: "Lisbon", d: ["Portugalska", "Portugal"], lon: -9.139, lat: 38.722, imena: ["lizbona", "lisbon", "lisboa"] },
  { sl: "Amsterdam", en: "Amsterdam", d: ["Nizozemska", "Netherlands"], lon: 4.904, lat: 52.367, imena: ["amsterdam"] },
  { sl: "London", en: "London", d: ["Združeno kraljestvo", "United Kingdom"], lon: -0.128, lat: 51.507, imena: ["london"] },
  { sl: "Berlin", en: "Berlin", d: ["Nemčija", "Germany"], lon: 13.405, lat: 52.52, imena: ["berlin"] },
  { sl: "München", en: "Munich", d: ["Nemčija", "Germany"], lon: 11.582, lat: 48.135, imena: ["munchen", "munich", "monakovo"] },
  { sl: "Atene", en: "Athens", d: ["Grčija", "Greece"], lon: 23.728, lat: 37.984, imena: ["atene", "athens"] },
  { sl: "Istanbul", en: "Istanbul", d: ["Turčija", "Türkiye"], lon: 28.978, lat: 41.008, imena: ["istanbul", "carigrad"] },
  { sl: "Dubrovnik", en: "Dubrovnik", d: ["Hrvaška", "Croatia"], lon: 18.094, lat: 42.65, imena: ["dubrovnik"] },
  { sl: "Zagreb", en: "Zagreb", d: ["Hrvaška", "Croatia"], lon: 15.982, lat: 45.815, imena: ["zagreb"] },
  { sl: "Ljubljana", en: "Ljubljana", d: ["Slovenija", "Slovenia"], lon: 14.506, lat: 46.056, imena: ["ljubljana"] },
  { sl: "Rifnik", en: "Rifnik", d: ["Slovenija", "Slovenia"], lon: 15.42, lat: 46.22, imena: ["rifnik"] },
  { sl: "Malta", en: "Malta", d: null, lon: 14.51, lat: 35.9, imena: ["malta"] },
];

const brezSumnikov = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Oznaka videa iz povezave (youtu.be, watch?v=, shorts/, embed/) ali gola oznaka.
export function idIzUrl(vnos) {
  const s = String(vnos || "").trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return /^[\w-]{11}/.exec(u.pathname.slice(1))?.[0] || null;
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    return /\/(?:shorts|embed|live)\/([\w-]{11})/.exec(u.pathname)?.[1] || null;
  }
  return null;
}

// Naslov videa prek oEmbed; 401/404 pomeni zaseben ali izbrisan video.
export async function oembed(id) {
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, {
    headers: { "User-Agent": "wayfare-studio/1.0 (+https://wayfarestudio.pages.dev)" },
  });
  if (r.status === 401 || r.status === 403 || r.status === 404) throw new Napaka(400, "youtube", "Videa ni ali je zaseben. Vidnost mora biti Javno ali Neobjavljeno.");
  if (!r.ok) throw new Error(`oEmbed ${r.status}`);
  const d = await r.json();
  return { naslov: String(d.title || "").trim(), avtor: d.author_name || "" };
}

// Predlog naslova in kraja iz naslova na YouTubu.
export function razcleni(naslov) {
  const izvirnik = String(naslov || "").trim();
  const n = brezSumnikov(izvirnik);
  const besede = n.split(/[^a-z0-9]+/).filter(Boolean);
  const kraj = KRAJI.find((k) => k.imena.some((i) => besede.includes(i)));
  const dan = /\b(?:day|dan|days)\s*(\d{1,2})(?:\s*(?:-|–|—|in|and|&|\+|\s)\s*(\d{1,2}))?/.exec(n);
  const povzetek = /\b(recap|povzetek|highlights)\b/.test(n);
  // ime kraja: znano ali besedilo pred "day"/"recap" (prva črka velika)
  let sl, en;
  if (kraj) ({ sl, en } = kraj);
  else {
    const pred = izvirnik.split(/\s+(?:day|dan|days|recap|povzetek|vlog)\b/i)[0].trim();
    sl = en = pred ? pred.charAt(0).toUpperCase() + pred.slice(1) : izvirnik;
  }
  let naslov_sl = izvirnik, naslov_en = izvirnik;
  if (dan) {
    const [a, b] = [Number(dan[1]), dan[2] ? Number(dan[2]) : null];
    naslov_sl = b ? `${sl} — ${a}. in ${b}. dan` : `${sl} — ${a}. dan`;
    naslov_en = b ? `${en} — Days ${a}–${b}` : `${en} — Day ${a}`;
  } else if (povzetek) {
    naslov_sl = `${sl} — povzetek`;
    naslov_en = `${en} — Recap`;
  }
  return {
    naslov_sl, naslov_en,
    kraj_sl: kraj?.d ? `${kraj.sl}, ${kraj.d[0]}` : sl,
    kraj_en: kraj?.d ? `${kraj.en}, ${kraj.d[1]}` : en,
    lon: kraj?.lon ?? null, lat: kraj?.lat ?? null,
    znan_kraj: !!kraj,
    vlog: !!(dan || povzetek),
  };
}
