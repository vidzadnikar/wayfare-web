// Zajem kosov vmesnika za film na domači strani (stran/media/kosi/<jezik>/*.webp).
// Uporaba (21. 10. 2026): zaženi studio v jeziku zajema na svojih vratih, npr.
//   WAYFARE_JEZIK=sl wayfare.py studio -p 8441 --no-reload --no-open
// (v .claude/launch.json: »Wayfare studio zajem sl« in »… en«), nato
//   node paket/zajem-kosov.mjs 8441 /pot/do/izhoda
// in skopiraj *.webp v stran/media/kosi/sl/. Okni glasba in pregled imata mere v
// mere.json; če se spremenijo, popravi style v predloga.html in GLASBA v
// js/sestavljanje.js. puppeteer-core je iz predpomnilnika npx (pot spodaj).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const puppeteer = require("/Users/vidzadnikar/.npm/_npx/110f701c48e68d66/node_modules/puppeteer-core");

const [vrata, izhod] = process.argv.slice(2);
fs.mkdirSync(izhod, { recursive: true });
const URL = `http://127.0.0.1:${vrata}/`;
const PROJEKT = "/Users/vidzadnikar/Video/Madrid day 1";

const brskalnik = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "--force-color-profile=srgb"],
});
const stran = await brskalnik.newPage();
await stran.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1.2 });
stran.on("pageerror", (e) => console.log("napaka strani:", e.message));
const pocakaj = (ms) => new Promise((r) => setTimeout(r, ms));

// Pro z začetno postavitvijo (prazen zapis mer pomeni »že imel mere« = Pro).
await stran.goto(URL, { waitUntil: "networkidle2" });
await stran.evaluate(() => { localStorage.clear(); localStorage.setItem("vlog.mere.v2", "{}"); });
await stran.goto(URL, { waitUntil: "networkidle2" });
await stran.evaluate((p) => odpriProjekt(p, "Madrid day 1"), PROJEKT);
await stran.waitForFunction(() => !document.querySelector("#app").hidden && typeof S !== "undefined" && S.ed && S.ed.video && S.ed.video.length, { timeout: 120000 });
await pocakaj(4000);

// Kader 055 izbran, kazalec na 0:30,59 (kot na prejšnjih kosih).
// Postavitev Montaža (predogled velik, material in lastnosti desno), Claude zaprt.
await stran.evaluate(() => { MERE.plosce.claude.odprta = false; uporabiPostavitev("montaza"); });
await pocakaj(2500);
const info = await stran.evaluate(() => {
  const i = S.ed.video.findIndex((v) => /(^|\D)055(\D|$)/.test(String(v.clip)));
  S.sel = { type: "video", i }; S.selm = [S.sel];
  S.ph = 30.65; seekTo(30.65); draw(); insp();
  return { i, n: S.ed.video.length, clip: i >= 0 ? S.ed.video[i].clip : null };
});
await pocakaj(3000);
console.log("kazalec:", await stran.evaluate(() => [S.ph, S.cur, V.currentTime, V.readyState]));
console.log("izbran:", JSON.stringify(info));
await stran.mouse.move(5, 1075);
await pocakaj(5000);

const shrani = async (ime, clip) => {
  const opt = { path: `${izhod}/${ime}.webp`, type: "webp", quality: 88 };
  if (clip) opt.clip = clip;
  await stran.screenshot(opt);
  console.log("zajeto:", ime);
};
// Izrezi v pikah 3840x2160 (x, y, w, h), v CSS pikah polovica.
const izrez = (x, y, w, h) => ({ x: x / 2, y: y / 2, width: w / 2, height: h / 2 });
await shrani("osnova");
await shrani("vrstica", izrez(0, 20, 3840, 108));
await shrani("predogled", izrez(40, 144, 2850, 1162));
await shrani("podatki", izrez(40, 1320, 2850, 160));
await shrani("katalog", izrez(2920, 144, 880, 776));
await shrani("lastnosti", izrez(2920, 950, 880, 519));
await shrani("casovnica", izrez(40, 1500, 3760, 625));

// Okni: glasba in pregled. Položaj vzamemo iz okna samega.
const okvir = async (sel) => stran.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, sel);
const mere = {};
await stran.evaluate(() => odpriGlasbo());
await stran.waitForSelector("#gl .box", { visible: true });
await pocakaj(3500);
mere.glasba = await okvir("#gl .box");
await shrani("glasba", mere.glasba);
await stran.keyboard.press("Escape");
await pocakaj(800);
await stran.evaluate(() => { const g = document.querySelector("#gl"); if (g && !g.hidden) g.hidden = true; });
await stran.evaluate(() => odpriPregled());
await stran.waitForSelector("#modal .box", { visible: true });
await pocakaj(1500);
// Hitri pregled (montaža in posnetki), da okno kaže rezultate.
await stran.evaluate(() => pgZazeni(true));
await stran.waitForFunction(() => !PG.tece && (PG.izid || PG.napaka), { timeout: 240000, polling: 1000 });
console.log("pregled:", await stran.evaluate(() => PG.napaka || "ok"));
await pocakaj(2000);
mere.pregled = await okvir("#modal .box");
await shrani("pregled", mere.pregled);
await stran.keyboard.press("Escape");
await pocakaj(800);

// Mehka osnova: isti zaslon v 1280x720.
await stran.evaluate(() => { const m = document.querySelector("#modal"); if (m) m.hidden = true; });
await stran.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 / 3 });
await pocakaj(2500);
await shrani("osnova-mehka");
fs.writeFileSync(`${izhod}/mere.json`, JSON.stringify(mere, null, 1));
console.log("okna (CSS px pri 1920x1080):", JSON.stringify(mere));
await brskalnik.close();
