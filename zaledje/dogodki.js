// Dogodki ob prijavi: zaprte prijave in pošta adminu o novem članu. Pošta
// adminu je le obvestilo; če ne gre, prijava vseeno uspe (napaka gre v dnevnik).
import { stranUrl } from "./osnova.js";
import { nastavitev } from "./nastavitve.js";
import { posljiPosto, sestaviNoviClan } from "./posta.js";

// Ali se sme prijaviti ta naslov: obstoječi član vedno, nov le ob odprtih prijavah.
export async function prijavaDovoljena(db, obstojec) {
  if (obstojec) return true;
  return nastavitev(db, "prijave_odprte");
}

export async function poPrijavi(env, request, clan, nov) {
  if (!nov || !env.ADMIN_EMAIL) return;
  if (clan.email === String(env.ADMIN_EMAIL).trim().toLowerCase()) return;
  try {
    if (!(await nastavitev(env.DB, "obvesti_me_novi_clan"))) return;
    await posljiPosto(env, env.DB, [{
      za: String(env.ADMIN_EMAIL).trim(), vrsta: "admin", ...sestaviNoviClan({ clan, stranUrl: stranUrl(env, request) }),
    }]);
  } catch (e) {
    console.error("pošta adminu o novem članu:", e);
  }
}
