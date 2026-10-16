// Pošta: besedila (SL in EN), sestava sporočil, pošiljanje prek Brevo ali
// Resend (doma s POSTA_PONUDNIK=dnevnik le izpis), odjavni žeton, vrsta za
// obvestila in dnevna meja. Vsako poslano sporočilo gre v tabelo posta, po
// kateri se šteje dnevna meja POSTA_DNEVNO (Brevo brezplačno: 300 na dan).
import { zdaj, nakljucno, podpisi, preveriPodpis, pobegni, zahtevaj } from "./osnova.js";

export const T = {
  sl: {
    pozdrav: (ime) => (ime ? `Živjo, ${ime}.` : "Živjo."),
    potrditev_zadeva: "Potrdi prijavo na obvestila Wayfare Studia",
    potrditev_naslov: "Še en klik.",
    potrditev_uvod: "Potrdi e-naslov in obveščen boš o vsakem novem filmu in novi različici aplikacije.",
    potrditev_besedilo: "Klikni gumb in e-naslov je potrjen. Potem ti pišemo, ko objavimo nov film ali novo različico aplikacije. Povezava velja en dan.",
    potrditev_gumb: "Potrdi e-naslov",
    potrditev_opomba: "Če tega nisi zahteval ti, pošto prezri: brez klika se ne zgodi nič.",
    potrditev_noga: "To pošto si dobil, ker je bil ta e-naslov vpisan na strani Wayfare Studio.",
    vlog_zadeva: (naslov) => `Nov film: ${naslov}`,
    vlog_gumb: "Poglej film",
    izdaja_gumb: "Prenesi",
    novica_gumb: "Preberi več",
    noga: "To pošto dobiš, ker si prijavljen na obvestila Wayfare Studia.",
    stran: "Spletna stran",
    vlogi: "Vlogi",
    odjava: "Odjava od obvestil",
    gumb_rezerva: "Če gumb ne deluje, odpri to povezavo:",
  },
  en: {
    pozdrav: (ime) => (ime ? `Hi ${ime},` : "Hi,"),
    potrditev_zadeva: "Confirm your Wayfare Studio updates",
    potrditev_naslov: "One more click.",
    potrditev_uvod: "Confirm your email to hear about every new film and app release.",
    potrditev_besedilo: "Click the button to confirm your email. We'll then write when a new film or a new version of the app is out. The link is valid for one day.",
    potrditev_gumb: "Confirm email",
    potrditev_opomba: "If this wasn't you, ignore this email: nothing happens without the click.",
    potrditev_noga: "You're getting this because this address was entered on the Wayfare Studio site.",
    vlog_zadeva: (naslov) => `New film: ${naslov}`,
    vlog_gumb: "Watch the film",
    izdaja_gumb: "Download",
    novica_gumb: "Read more",
    noga: "You're getting this because you signed up for Wayfare Studio updates.",
    stran: "Website",
    vlogi: "Vlogs",
    odjava: "Unsubscribe",
    gumb_rezerva: "If the button doesn't work, open this link:",
  },
};

// Barve in pisave iz strani (stran/css/slog.css): temnomodra podlaga, kremno
// besedilo, turkizna le na gumbu. Pošta je temna kot stran; color-scheme
// "dark" odjemalcem pove, naj je ne obračajo.
const B = {
  bg: "#0b1020", surface: "#121a30", border: "#232c45",
  fg: "#efe9df", muted: "#a3abbe", subtle: "#858ea6",
  accent: "#64e2d6", accentFg: "#0b1020",
};
const SANS = "'Instrument Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "'Instrument Serif','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif";

// Odstavki besedila: prazna vrstica loči odstavke, povezave postanejo klikljive.
export const odstavkiIz = (besedilo) => String(besedilo || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map((o) => o.trim()).filter(Boolean);

function odstavekHtml(odstavek) {
  return pobegni(odstavek)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:${B.fg};text-decoration:underline">${u}</a>`)
    .replace(/\n/g, "<br>");
}

// Koren strani za slike in povezave v nogi: iz povezave, ki je v pošti.
const korenIz = (url) => { try { return new URL(url).origin; } catch { return ""; } };

// Slika ob obvestilu: naslovnica vloga, pri izdaji naslovnica promo filma.
function slikaObvestila(o, koren) {
  const vlog = /^vlog:([\w-]+)$/.exec(o.kljuc || "");
  if (vlog) return `${koren}/media/vlogi/${vlog[1]}.jpg`;
  if (o.vrsta === "izdaja") return `${koren}/media/promo-naslovna.jpg`;
  return null;
}

// Gumb, ki deluje tudi v Outlooku (celica z barvo ozadja, povezava v njej).
const gumbHtml = (gumb) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr>
<td bgcolor="${B.accent}" style="border-radius:999px;background:${B.accent}">
<a href="${pobegni(gumb.url)}" style="display:inline-block;padding:14px 28px;font:600 15px/20px ${SANS};color:${B.accentFg};text-decoration:none;border-radius:999px">${pobegni(gumb.besedilo)}&nbsp;&rarr;</a>
</td></tr></table>`;

// Temna pošta v slogu strani. `odstavki` so že HTML (odstavekHtml), drugo se
// pobegne tu. Struktura s tabelami in slogi v vrstici, ker jo tako pokaže
// vsak odjemalec (Gmail, Apple Mail, Outlook).
function ovoj({ jezik, koren, naslov, predogled, slika, slikaUrl, uvod, odstavki, gumb, opomba, noga, odjavaUrl }) {
  const t = T[jezik];
  const domov = `${koren}${jezik === "sl" ? "/sl/" : "/"}`;
  const vlogi = `${koren}${jezik === "sl" ? "/sl/vlogi/" : "/vlogi/"}`;
  const p = (html, barva = B.muted) => `<p style="margin:0 0 16px;font:400 16px/26px ${SANS};color:${barva}">${html}</p>`;
  const povezava = (url, besedilo) => `<a href="${pobegni(url)}" style="color:${B.muted};text-decoration:underline">${pobegni(besedilo)}</a>`;
  const loci = `<span style="color:${B.border}">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`;
  const slikaVrstica = slika ? `<tr><td style="padding:0;line-height:0;font-size:0">
<a href="${pobegni(slikaUrl || gumb?.url || domov)}" style="text-decoration:none"><img src="${pobegni(slika)}" width="560" alt="${pobegni(naslov)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px 12px 0 0;background:${B.border}"></a>
</td></tr>` : "";
  return `<!doctype html>
<html lang="${jezik}" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<meta name="x-apple-disable-message-reformatting">
<title>${pobegni(naslov)}</title>
<style>
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0!important;padding:0!important;-webkit-text-size-adjust:100%}
a{color:${B.fg}}
@media (max-width:600px){
  .ovoj{padding:32px 16px 48px!important}
  .vsebina{padding:32px 24px!important}
  .naslov{font-size:30px!important;line-height:34px!important}
}
</style></head>
<body bgcolor="${B.bg}" style="margin:0;padding:0;background:${B.bg}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${pobegni(predogled || "")}${"&#8199;&#847;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${B.bg}" style="background:${B.bg};background-image:linear-gradient(${B.bg},${B.bg})">
<tr><td align="center" class="ovoj" style="padding:48px 16px 64px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

<tr><td style="padding:0 0 24px">
<a href="${pobegni(domov)}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${koren}/media/posta/logo.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px"></td>
<td style="vertical-align:middle;padding-left:12px;font:600 16px/20px ${SANS};color:${B.fg};letter-spacing:-0.01em">Wayfare Studio</td>
</tr></table></a>
</td></tr>

<tr><td bgcolor="${B.surface}" style="background:${B.surface};border:1px solid ${B.border};border-radius:12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${slikaVrstica}
<tr><td class="vsebina" style="padding:40px">
<h1 class="naslov" style="margin:0 0 20px;font:400 36px/40px ${SERIF};color:${B.fg};letter-spacing:-0.01em">${pobegni(naslov).replace(/ (\S+)$/, "&nbsp;$1")}</h1>
${uvod ? p(pobegni(uvod), B.fg) : ""}
${odstavki.map((o) => p(o)).join("\n")}
${gumb ? gumbHtml(gumb) : ""}
${opomba ? `<p style="margin:32px 0 0;padding:24px 0 0;border-top:1px solid ${B.border};font:400 13px/20px ${SANS};color:${B.subtle}">${opomba}</p>` : ""}
</td></tr>
</table>
</td></tr>

<tr><td style="padding:32px 8px 0;font:400 13px/20px ${SANS};color:${B.subtle}">
<p style="margin:0 0 8px">${pobegni(noga)}</p>
<p style="margin:0">${povezava(domov, t.stran)}${loci}${povezava(vlogi, t.vlogi)}${odjavaUrl ? `${loci}${povezava(odjavaUrl, t.odjava)}` : ""}</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

export function sestaviPotrditev({ jezik, povezava, ime = null }) {
  const t = T[jezik];
  const koren = korenIz(povezava);
  const odstavki = [t.pozdrav(ime), t.potrditev_besedilo];
  const opomba = `${pobegni(t.potrditev_opomba)}<br><br>${pobegni(t.gumb_rezerva)}<br><a href="${pobegni(povezava)}" style="color:${B.muted};word-break:break-all">${pobegni(povezava)}</a>`;
  return {
    zadeva: t.potrditev_zadeva,
    html: ovoj({
      jezik, koren, naslov: t.potrditev_naslov, predogled: t.potrditev_uvod,
      odstavki: odstavki.map(odstavekHtml), gumb: { besedilo: t.potrditev_gumb, url: povezava },
      opomba, noga: t.potrditev_noga,
    }),
    besedilo: [t.potrditev_naslov, "", ...odstavki, "", `${t.potrditev_gumb}: ${povezava}`, "", t.potrditev_opomba, "", "— Wayfare Studio"].join("\n"),
  };
}

// Obvestilo (vlog, izdaja, novica) v jeziku člana; manjkajoči jezik vzame drugega.
export function sestaviObvestilo(o, clan, { odjavaUrl }) {
  const jezik = clan.jezik === "sl" ? "sl" : "en";
  const t = T[jezik];
  const koren = korenIz(odjavaUrl);
  const naslov = o[`naslov_${jezik}`] || o.naslov_sl || o.naslov_en || "";
  const besedilo = o[`besedilo_${jezik}`] || o.besedilo_sl || o.besedilo_en || "";
  const url = o[`url_${jezik}`] || o.url_sl || o.url_en || null;
  const zadeva = o.vrsta === "vlog" ? t.vlog_zadeva(naslov) : naslov;
  const gumbBesedilo = { vlog: t.vlog_gumb, izdaja: t.izdaja_gumb, novica: t.novica_gumb }[o.vrsta] || t.novica_gumb;
  const ime = clan.ime ? String(clan.ime).split(" ")[0] : null;
  const odstavki = odstavkiIz(besedilo);
  return {
    zadeva,
    html: ovoj({
      jezik, koren, naslov, predogled: odstavki[0] || naslov,
      slika: slikaObvestila(o, koren), slikaUrl: url,
      odstavki: [t.pozdrav(ime), ...odstavki].map(odstavekHtml),
      gumb: url ? { besedilo: gumbBesedilo, url } : null, noga: t.noga, odjavaUrl,
    }),
    besedilo: [naslov, "", t.pozdrav(ime), ...odstavki, "", url ? `${gumbBesedilo}: ${url}` : "", "", "— Wayfare Studio", "", t.noga, `${t.odjava}: ${odjavaUrl}`].join("\n"),
    glave: { "List-Unsubscribe": `<${odjavaUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

// Pošta adminu: nov član se je prijavil (ime, naslov, pot prijave).
export function sestaviNoviClan({ clan, stranUrl }) {
  const t = T.sl;
  const koren = String(stranUrl || "").replace(/\/$/, "");
  const ime = clan.ime || clan.email;
  const pot = clan.vir === "google" ? "z Googlom" : "z e-naslovom";
  const kdo = clan.ime ? `${clan.ime} (${clan.email})` : clan.email;
  const odstavki = [`${kdo} se je prijavil ${pot}.`, `Jezik: ${clan.jezik === "sl" ? "slovenščina" : "angleščina"}.`];
  return {
    zadeva: `Nov član: ${ime}`,
    html: ovoj({
      jezik: "sl", koren, naslov: "Nov član.", predogled: odstavki[0],
      odstavki: odstavki.map(odstavekHtml), gumb: { besedilo: "Odpri nadzor", url: `${koren}/nadzor` },
      noga: "To pošto dobiš, ker je v nadzoru vklopljeno »Obvesti me ob novem članu«.",
    }),
    besedilo: ["Nov član.", "", ...odstavki, "", `Nadzor: ${koren}/nadzor`].join("\n"),
  };
}

// Pošta adminu: nov komentar ali odgovor pod vlogom.
export function sestaviKomentarAdminu({ ime, vlog, besedilo, odgovor, url, koren }) {
  const naslov = odgovor ? "Nov odgovor." : "Nov komentar.";
  const uvod = `${odgovor ? "Nov odgovor" : "Nov komentar"} pod vlogom »${vlog}«, piše ${ime || "član"}:`;
  return {
    zadeva: `${odgovor ? "Odgovor" : "Komentar"}: ${vlog}`,
    html: ovoj({
      jezik: "sl", koren: String(koren || "").replace(/\/$/, ""), naslov, predogled: besedilo.slice(0, 140),
      odstavki: [pobegni(uvod), ...odstavkiIz(besedilo).map(odstavekHtml)],
      gumb: { besedilo: "Odpri komentar", url },
      noga: "To pošto dobiš, ker je v nadzoru vklopljeno »Obvesti me ob novem komentarju«.",
    }),
    besedilo: [naslov, "", uvod, "", besedilo, "", `Komentar: ${url}`].join("\n"),
  };
}

// Odjavni žeton je podpis (ne zapis v bazi), zato povezava v stari pošti velja
// vedno; z menjavo e-naslova ali SESSION_SECRET neha veljati.
export const odjavaZeton = async (env, clan) => `${clan.id}.${await podpisi(env.SESSION_SECRET, `odjava:${clan.id}:${clan.email}`)}`;

export async function clanIzOdjavnegaZetona(env, db, zeton) {
  const [id, podpis] = String(zeton || "").split(".");
  if (!/^\d+$/.test(id || "") || !podpis) return null;
  const clan = await db.prepare("SELECT * FROM clani WHERE id = ?").bind(Number(id)).first();
  if (!clan) return null;
  return (await preveriPodpis(env.SESSION_SECRET, `odjava:${clan.id}:${clan.email}`, podpis)) ? clan : null;
}

// ---------------------------------------------------------------- pošiljanje

// Ponudnik pošte: brevo (privzeto; brezplačno 300 na dan, brez lastne domene
// Brevo pošiljatelja prepiše v <lokalni-del>@<id>.brevosend.com), resend (ko bo
// lastna domena) ali dnevnik (doma: pošto le izpiše).
export function ponudnik(env) {
  const p = env.POSTA_PONUDNIK || "brevo";
  if (!["brevo", "resend", "dnevnik"].includes(p)) throw new Error(`POSTA_PONUDNIK mora biti brevo, resend ali dnevnik, ne ${p}`);
  return p;
}

// EMAIL_FROM je naslov (vid@…) ali »Ime <naslov>«; ime je privzeto Wayfare Studio.
export function posiljatelj(env) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(env.EMAIL_FROM || "");
  if (m) return { ime: (m[1] || "Wayfare Studio").trim(), email: m[2].trim() };
  return { ime: "Wayfare Studio", email: String(env.EMAIL_FROM || "").trim() };
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const RESEND_URL = "https://api.resend.com/emails/batch";

async function preberiNapako(odg) {
  const besedilo = (await odg.text()).slice(0, 300);
  return `${odg.status}: ${besedilo}`;
}

// Brevo: en klic za več prejemnikov (messageVersions, vsak s svojo vsebino,
// že v jeziku člana in z lastno povezavo za odjavo). Glave List-Unsubscribe
// Brevo ne sprejme (standardna glava), zato je odjava povezava v besedilu.
async function posljiBrevo(env, sporocila) {
  const od = posiljatelj(env);
  const telo = { sender: { name: od.ime, email: od.email }, replyTo: { email: od.email } };
  const naslovnik = (s) => ({ email: s.za, ...(s.ime ? { name: String(s.ime).slice(0, 70) } : {}) });
  if (sporocila.length === 1) {
    const [s] = sporocila;
    Object.assign(telo, { to: [naslovnik(s)], subject: s.zadeva, htmlContent: s.html, textContent: s.besedilo });
  } else {
    Object.assign(telo, {
      subject: sporocila[0].zadeva, htmlContent: sporocila[0].html, textContent: sporocila[0].besedilo,
      messageVersions: sporocila.map((s) => ({ to: [naslovnik(s)], subject: s.zadeva, htmlContent: s.html, textContent: s.besedilo })),
    });
  }
  const odg = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(telo),
  });
  if (!odg.ok) throw new Error(`Brevo ${await preberiNapako(odg)}`);
  const podatki = await odg.json().catch(() => ({}));
  const idji = podatki.messageIds || (podatki.messageId ? [podatki.messageId] : []);
  return sporocila.map((_, i) => idji[i] ?? idji[0] ?? null);
}

async function posljiResend(env, sporocila) {
  const od = posiljatelj(env);
  const odg = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(sporocila.map((s) => ({
      from: `${od.ime} <${od.email}>`, to: [s.za], subject: s.zadeva, html: s.html, text: s.besedilo,
      ...(s.glave ? { headers: s.glave } : {}),
    }))),
  });
  if (!odg.ok) throw new Error(`Resend ${await preberiNapako(odg)}`);
  const { data } = await odg.json();
  return (data || []).map((d) => d.id || null);
}

function posljiDnevnik(sporocila, zamik) {
  return sporocila.map((s, k) => {
    console.log(`[pošta ${s.vrsta}] za: ${s.za} | zadeva: ${s.zadeva}\n${s.besedilo}\n`);
    return `dnevnik-${Date.now()}-${zamik + k}`;
  });
}

const NA_KLIC = { brevo: 100, resend: 100, dnevnik: 100 };

// Sporočilo: { za, ime?, zadeva, html, besedilo, glave?, vrsta, kljuc? }. Pošlje po
// kosih in vsako zapiše v tabelo posta (po njej se šteje dnevna meja).
export async function posljiPosto(env, db, sporocila) {
  if (!sporocila.length) return [];
  const p = ponudnik(env);
  if (p === "brevo") zahtevaj(env, "BREVO_API_KEY", "EMAIL_FROM");
  if (p === "resend") zahtevaj(env, "RESEND_API_KEY", "EMAIL_FROM");
  const idji = [];
  for (let i = 0; i < sporocila.length; i += NA_KLIC[p]) {
    const kos = sporocila.slice(i, i + NA_KLIC[p]);
    const kosIdji = p === "brevo" ? await posljiBrevo(env, kos) : p === "resend" ? await posljiResend(env, kos) : posljiDnevnik(kos, i);
    const t = zdaj();
    await db.batch(kos.map((s, k) => db.prepare(
      "INSERT INTO posta (prejemnik, vrsta, kljuc, nacin, odgovor_id, poslano_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(s.za, s.vrsta, s.kljuc ?? null, p, kosIdji[k] ?? null, t)));
    idji.push(...kosIdji);
  }
  return idji;
}

// ---------------------------------------------------------------- vrsta in dnevna meja

const REZERVA = 10; // dnevne pošte, ki jih vrsta pusti za potrditvene povezave
const KOS = 50;     // vrstic na krog (D1 dovoli največ 100 vezanih vrednosti)

export async function dnevnoStanje(env, db) {
  // nastavitev v nadzoru, sicer POSTA_DNEVNO, sicer 300
  const zapis = await db.prepare("SELECT vrednost FROM nastavitve WHERE kljuc = 'posta_dnevno'").first().catch(() => null);
  const meja = Math.max(1, Number(zapis?.vrednost) || Number(env.POSTA_DNEVNO) || 300);
  const danes = new Date().toISOString().slice(0, 10);
  const r = await db.prepare("SELECT COUNT(*) AS n FROM posta WHERE poslano_at >= ?").bind(danes).first();
  const poslanih = r?.n ?? 0;
  return { meja, poslanih, prosto: Math.max(0, meja - poslanih) };
}

export async function stanjeVrste(db) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM vrsta WHERE poslano_at IS NULL").first();
  return r?.n ?? 0;
}

// V vrsto da vse potrjene, neodjavljene, neblokirane člane, ki to vrsto
// obvestil želijo. Obvestilo brez prejemnikov je takoj poslano.
export async function napolniVrsto(db, kljuc) {
  const r = await db.prepare(
    `INSERT OR IGNORE INTO vrsta (kljuc, clan_id) SELECT ?1, id FROM clani
     WHERE potrjen_at IS NOT NULL AND odjavljen_at IS NULL AND blokiran = 0
       AND (CASE (SELECT vrsta FROM poslano WHERE kljuc = ?1) WHEN 'vlog' THEN zeli_vlogi WHEN 'izdaja' THEN zeli_izdaje ELSE zeli_novice END) = 1`,
  ).bind(kljuc).run();
  const n = r.meta?.changes ?? 0;
  if (!n) await db.prepare("UPDATE poslano SET poslano_at = COALESCE(poslano_at, ?1) WHERE kljuc = ?2").bind(zdaj(), kljuc).run();
  return n;
}

// Pošlje, kar čaka v vrsti, do dnevne meje. Vrstice najprej zasede (v_teku),
// da vzporedni klic ne pošlje istih; zaseg, star več kot 10 minut, velja za
// obstal in se vzame znova. Ob napaki pri pošiljanju vrstice sprosti in neha.
export async function posljiIzVrste(env, db, stranUrl) {
  const dnevno = await dnevnoStanje(env, db);
  let prosto = dnevno.meja > 2 * REZERVA ? Math.max(0, dnevno.prosto - REZERVA) : dnevno.prosto;
  let poslanih = 0;
  let napaka = null;
  while (prosto > 0) {
    const zaseg = nakljucno(8);
    const pred10 = new Date(Date.now() - 600e3).toISOString();
    const { results: zasezene } = await db.prepare(
      `UPDATE vrsta SET v_teku = ?1, v_teku_at = ?2 WHERE id IN (
         SELECT id FROM vrsta WHERE poslano_at IS NULL AND (v_teku IS NULL OR v_teku_at < ?3) ORDER BY id LIMIT ?4
       ) RETURNING id`,
    ).bind(zaseg, zdaj(), pred10, Math.min(KOS, prosto)).all();
    if (!zasezene.length) break;
    const idji = zasezene.map((v) => v.id);
    const vprasaji = idji.map(() => "?").join(",");
    const { results: polne } = await db.prepare(
      `SELECT v.id, v.kljuc, c.id AS clan_id, c.email, c.ime, c.jezik, c.odjavljen_at, c.blokiran,
              p.vrsta, p.naslov_sl, p.naslov_en, p.besedilo_sl, p.besedilo_en, p.url_sl, p.url_en
       FROM vrsta v JOIN clani c ON c.id = v.clan_id JOIN poslano p ON p.kljuc = v.kljuc
       WHERE v.id IN (${vprasaji})`,
    ).bind(...idji).all();
    const preskoci = polne.filter((v) => v.odjavljen_at || v.blokiran);
    const za = polne.filter((v) => !v.odjavljen_at && !v.blokiran);
    const sporocila = [];
    for (const v of za) {
      const odjavaUrl = `${stranUrl}/api/odjava?z=${await odjavaZeton(env, { id: v.clan_id, email: v.email })}`;
      sporocila.push({ za: v.email, ime: v.ime, vrsta: "obvestilo", kljuc: v.kljuc, ...sestaviObvestilo(v, { ime: v.ime, jezik: v.jezik }, { odjavaUrl }) });
    }
    try {
      await posljiPosto(env, db, sporocila);
    } catch (e) {
      console.error("pošiljanje iz vrste:", e);
      napaka = String(e?.message || e).slice(0, 300);
      await db.prepare("UPDATE vrsta SET v_teku = NULL, v_teku_at = NULL, napaka = ?1 WHERE v_teku = ?2").bind(napaka, zaseg).run();
      break;
    }
    const t = zdaj();
    const stavki = [];
    if (za.length) {
      stavki.push(db.prepare(`UPDATE vrsta SET poslano_at = ?1, v_teku = NULL, v_teku_at = NULL, napaka = NULL WHERE id IN (${za.map(() => "?").join(",")})`)
        .bind(t, ...za.map((v) => v.id)));
    }
    if (preskoci.length) {
      stavki.push(db.prepare(`UPDATE vrsta SET poslano_at = ?1, v_teku = NULL, v_teku_at = NULL, napaka = 'preskočeno: odjavljen ali blokiran' WHERE id IN (${preskoci.map(() => "?").join(",")})`)
        .bind(t, ...preskoci.map((v) => v.id)));
    }
    const poKljucu = {};
    for (const v of za) poKljucu[v.kljuc] = (poKljucu[v.kljuc] || 0) + 1;
    for (const [k, n] of Object.entries(poKljucu)) stavki.push(db.prepare("UPDATE poslano SET prejemnikov = prejemnikov + ?1 WHERE kljuc = ?2").bind(n, k));
    await db.batch(stavki);
    poslanih += za.length;
    prosto -= za.length;
  }
  await db.prepare(
    "UPDATE poslano SET poslano_at = ?1 WHERE poslano_at IS NULL AND NOT EXISTS (SELECT 1 FROM vrsta v WHERE v.kljuc = poslano.kljuc AND v.poslano_at IS NULL)",
  ).bind(zdaj()).run();
  return { poslanih, caka: await stanjeVrste(db), napaka, dnevno: await dnevnoStanje(env, db) };
}
