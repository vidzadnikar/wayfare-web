// Ozadje začetne strani Wayfare Studia (21. 10. 2026): reliefni globus na papirju.
// Potrebuje lokalni strežnik strani na 8496 (launch »Wayfare objava«), ki postreže
// three.js in relief-8192.webp. Izhod skopiraj v Wayfare/wayfare/static/ozadje/.
//   node izrisi.mjs slika zacetek.png 0        (nato JPEG kakovost 92 → zacetek.jpg)
//   node izrisi.mjs film globus.mp4 24 24      (24 s pri 24 fps, zanka brez šiva)
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const puppeteer = require("/Users/vidzadnikar/.npm/_npx/110f701c48e68d66/node_modules/puppeteer-core");
const [nacin, izhod, a1, a2] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new",
  args: ["--hide-scrollbars", "--force-color-profile=srgb", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const s = await b.newPage();
s.on("console", (m) => console.log("stran:", m.text()));
s.on("pageerror", (e) => console.log("napaka:", e.message));
await s.setViewport({ width: 3840, height: 2160, deviceScaleFactor: 1 });
await s.setBypassCSP(true);
await s.goto("http://127.0.0.1:8496/404.html", { waitUntil: "load" });
await s.setContent(fs.readFileSync(new URL("./prizor.html", import.meta.url), "utf8"), { waitUntil: "load" });
await s.waitForFunction(() => window.pripravljeno === true, { timeout: 60000 });
if (nacin === "slika") {
  await s.evaluate((t) => window.izrisi(t), +(a1 || 0));
  await s.screenshot({ path: izhod });
} else {
  // slike gredo naravnost v ffmpeg (brez 4K PNG na disku)
  const { spawn } = await import("node:child_process");
  const T = +a1, fps = +a2, n = Math.round(T * fps);
  const ff = spawn("/Users/vidzadnikar/Claude/claude/Wayfare/vendor/ffmpeg/bin/ffmpeg", ["-v", "error", "-y",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-x264-params", "aq-mode=3",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "5.1", "-movflags", "+faststart", "-an", izhod], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < n; i++) {
    await s.evaluate((t, T) => window.izrisi(t, T), i / fps, T);
    const slika = await s.screenshot({ type: "png" });
    if (!ff.stdin.write(slika)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 48 === 0) console.log(`slika ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
}
await b.close();
