// Primer 1 »Pike«: ravni zemljevid iz pik; ob prihodu se svet približa na
// Evropo, kraji se pokažejo, ko je približanje končano.
import { podatki, risalnik, zatici, pokaziFilme } from "./skupno.js";

const { pike, kraji } = await podatki();
const obmocje = document.querySelector("[data-zemljevid]");
const r = risalnik(obmocje, pike);
const filmi = document.querySelector("[data-filmi]");
const EVROPA = [-14, 34, 35, 56];
// zatiči se pokažejo, ko je približanje skoraj končano (meja je relativna, da velja pri vsaki velikosti)
const z = zatici(obmocje, kraji, r, izberi, { skrijPod: () => r.okvir(...EVROPA).k * 0.85 });

function izberi(kraj) { z.aktiven(kraj); pokaziFilme(kraj, filmi); }

Object.assign(r.pogled, r.okvir(-170, 170, -55, 72));
r.narisi();
const mirno = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (mirno) { Object.assign(r.pogled, r.okvir(...EVROPA)); r.narisi(); }
else gsap.to(r.pogled, { ...r.okvir(...EVROPA), duration: 2.6, ease: "expo.inOut", delay: 0.5, onUpdate: r.narisi });

addEventListener("resize", () => { r.velikost(); Object.assign(r.pogled, r.okvir(...EVROPA)); r.narisi(); });
izberi(kraji[0]);
