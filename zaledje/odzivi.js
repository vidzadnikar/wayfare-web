// Odzivi testerjev: dovoljene vrste in čiščenje vnosa (besedilo, različica
// aplikacije, opis sistema). Uporabljata jih /api/odziv in nadzor.
import { Napaka } from "./osnova.js";

export const VRSTE = ["napaka", "predlog", "pohvala"];
export const NAJVEC_ZNAKOV = 4000;

// Besedilo: obrezano, brez nevidnih znakov, največ dve prazni vrstici zapored.
export function cistOdziv(vnos) {
  const s = String(vnos ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length < 3) throw new Napaka(400, "besedilo", "Napiši vsaj nekaj besed.");
  if (s.length > NAJVEC_ZNAKOV) throw new Napaka(400, "predolgo", `Odziv je daljši od ${NAJVEC_ZNAKOV} znakov.`);
  return s;
}

// Različica aplikacije, npr. 0.2.0 ali 0.2.0-beta.1; drugače nič.
export function cistaRazlicica(vnos) {
  const s = String(vnos ?? "").trim();
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][\w.]{1,20})?$/.test(s) ? s : null;
}

// Opis sistema (»macOS 15.1 arm64«): le berljivi znaki, največ 80.
export function cistSistem(vnos) {
  const s = String(vnos ?? "").replace(/[^\w .,()/+-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return s || null;
}
