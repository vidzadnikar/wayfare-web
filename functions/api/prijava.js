// Prijava z e-pošto: pošlje povezavo za potrditev. Odgovor je vedno enak
// (»poslano«), tudi za blokiran naslov, da obrazec ne izdaja, kdo je član.
// Omejitev: 10 zahtev na uro z enega naslova IP, 3 na e-naslov.
import { Napaka, json, preusmeri, telo, istiIzvor, varnaPot, domacaPot, jezikIz, ip, stranUrl, zahtevaj } from "../../zaledje/osnova.js";
import { VELJAVEN_EMAIL, normalizirajEmail, clanPoEmailu, omeji, ustvariZeton } from "../../zaledje/clani.js";
import { sestaviPotrditev, posljiPosto } from "../../zaledje/posta.js";
import { prijavaDovoljena } from "../../zaledje/dogodki.js";
import { obravnavaj } from "../../zaledje/strani.js";

export const onRequestPost = obravnavaj(async ({ request, env }) => {
  zahtevaj(env, "SESSION_SECRET");
  if (!istiIzvor(request)) throw new Napaka(403, "izvor");
  const { podatki, obrazec } = await telo(request);
  const jezik = jezikIz(podatki.jezik, request);
  const nazaj = varnaPot(podatki.nazaj, domacaPot(jezik));
  const email = normalizirajEmail(podatki.email);
  const odgovor = (koda, status) => (obrazec ? preusmeri(`${nazaj}?prijava=${koda}`) : json(status < 400 ? { stanje: koda } : { napaka: koda }, status));

  if (!VELJAVEN_EMAIL.test(email) || email.length > 254) return odgovor("email", 400);
  if (!(await omeji(env.DB, "ip:" + ip(request), 10)) || !(await omeji(env.DB, "email:" + email, 3))) return odgovor("omejitev", 429);

  const obstojec = await clanPoEmailu(env.DB, email);
  if (obstojec?.blokiran) return odgovor("poslano", 200);
  if (!(await prijavaDovoljena(env.DB, obstojec))) return odgovor("zaprto", 403);
  const zeton = await ustvariZeton(env.DB, { email, jezik, nazaj });
  const povezava = `${stranUrl(env, request)}/api/potrdi?z=${zeton}`;
  await posljiPosto(env, env.DB, [{
    za: email, ime: obstojec?.ime || null, vrsta: "potrditev",
    ...sestaviPotrditev({ jezik, povezava, ime: obstojec?.ime ? String(obstojec.ime).split(" ")[0] : null }),
  }]);
  return odgovor("poslano", 200);
});
