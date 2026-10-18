// Odziv testerja: obrazec na /odziv/ (s skripto JSON, brez nje navaden
// obrazec) in okno Pošlji odziv v aplikaciji (strežnik studia pošlje JSON).
//   POST /api/odziv { vrsta, besedilo, email?, vir?, razlicica?, sistem?, jezik? }
// Prijava ni potrebna; prijavljenemu se zapiše še član. Omejitev: 10 odzivov
// na uro z enega naslova IP. Polje spletna_stran je past za robote: ljudje ga
// ne vidijo, robot ga izpolni in dobi »poslano«, v bazo pa ne gre nič.
import { Napaka, json, preusmeri, telo, istiIzvor, ip, jezikIz, stranUrl, zdaj } from "../../zaledje/osnova.js";
import { clanIzSeje } from "../../zaledje/seja.js";
import { omeji, VELJAVEN_EMAIL, normalizirajEmail } from "../../zaledje/clani.js";
import { obravnavaj } from "../../zaledje/strani.js";
import { nastavitev } from "../../zaledje/nastavitve.js";
import { posljiPosto, sestaviOdzivAdminu } from "../../zaledje/posta.js";
import { VRSTE, cistOdziv, cistaRazlicica, cistSistem } from "../../zaledje/odzivi.js";

const potOdziva = (jezik) => (jezik === "sl" ? "/sl/odziv/" : "/odziv/");

export const onRequestPost = async (ctx) => {
  const { request } = ctx;
  let obrazec = false, jezik = "en";
  try {
    const t = await telo(request);
    obrazec = t.obrazec;
    jezik = jezikIz(t.podatki.jezik, request);
    const odg = await sprejmi(ctx, t.podatki, jezik);
    return obrazec ? preusmeri(`${potOdziva(jezik)}?poslano=1#hvala`) : json(odg, 201);
  } catch (e) {
    if (!obrazec) return obravnavaj(() => { throw e; })(ctx);
    if (!(e instanceof Napaka)) console.error(e);
    return preusmeri(`${potOdziva(jezik)}?napaka=${e instanceof Napaka ? e.koda : "streznik"}#napaka`);
  }
};

async function sprejmi({ request, env, waitUntil }, podatki, jezik) {
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const db = env.DB;
  if (String(podatki.spletna_stran || "").trim()) return { stanje: "poslano" };
  if (!(await nastavitev(db, "odzivi_odprti"))) throw new Napaka(403, "zaprto", "Odzivi so ta trenutek izklopljeni.");
  const vrsta = String(podatki.vrsta || "");
  if (!VRSTE.includes(vrsta)) throw new Napaka(400, "vrsta", "Izberi, ali gre za napako, predlog ali pohvalo.");
  const besedilo = cistOdziv(podatki.besedilo);
  let email = null;
  if (podatki.email) {
    email = normalizirajEmail(podatki.email);
    if (!VELJAVEN_EMAIL.test(email) || email.length > 200) throw new Napaka(400, "email", "E-naslov ni veljaven.");
  }
  if (!(await omeji(db, "odziv:" + ip(request), 10))) throw new Napaka(429, "omejitev", "Preveč odzivov v kratkem času. Poskusi čez eno uro.");
  const vir = podatki.vir === "app" ? "app" : "stran";
  const razlicica = cistaRazlicica(podatki.razlicica);
  const sistem = cistSistem(podatki.sistem);
  const clan = await clanIzSeje(env, request);
  await db.prepare(
    "INSERT INTO odzivi (vrsta, besedilo, email, clan_id, vir, razlicica, sistem, jezik, ustvarjeno_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  ).bind(vrsta, besedilo, email, clan?.id ?? null, vir, razlicica, sistem, jezik, zdaj()).run();

  // pošta adminu; ne zadrži odgovora
  if (env.ADMIN_EMAIL) {
    const poslji = (async () => {
      try {
        if (!(await nastavitev(db, "obvesti_me_odziv"))) return;
        await posljiPosto(env, db, [{
          za: String(env.ADMIN_EMAIL).trim(), vrsta: "admin",
          ...sestaviOdzivAdminu({ vrsta, besedilo, email: email || clan?.email || null, vir, razlicica, sistem, koren: stranUrl(env, request) }),
        }]);
      } catch (e) { console.error("pošta adminu o odzivu:", e); }
    })();
    if (typeof waitUntil === "function") waitUntil(poslji); else await poslji;
  }
  return { stanje: "poslano" };
}
