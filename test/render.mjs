// Prova il pannello in Chrome headless con un finto Figma (test/host.html): anteprima, preset, «Applica».
// Uso: npm test (serve puppeteer-core e Chrome; CHROME_PATH se non e' quello di puppeteer).
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = join(homedir(), ".cache/puppeteer/chrome");
  const v = readdirSync(base).filter((d) => d.startsWith("mac_arm")).sort().pop();
  return join(base, v, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
}

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args: ["--allow-file-access-from-files", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 780 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("file://" + join(root, "test/host.html"));
const frame = await (await page.$("iframe")).contentFrame();

async function waitRender(label) {
  const t = Date.now();
  await new Promise((r) => setTimeout(r, 400));
  await frame.waitForFunction(() => typeof lastResult !== "undefined" && lastResult && !document.getElementById("busy").classList.contains("on"), { timeout: 120000, polling: 100 });
  const info = await frame.evaluate(() => ({ w: lastResult.canvas.width, h: lastResult.canvas.height, data: lastResult.canvas.toDataURL("image/png") }));
  writeFileSync(join(out, label + ".png"), Buffer.from(info.data.split(",")[1], "base64"));
  console.log(`${label}: ${info.w}x${info.h} in ${Date.now() - t} ms`);
}

await waitRender("standard");
await page.screenshot({ path: join(out, "panel.png") });

for (const key of ["graphicBW", "custom5", "custom6"]) {
  await frame.click(`.chip[data-p="${key}"]`);
  await waitRender(key);
}

await frame.click('.tex button[data-tex="texture4"]');
await frame.click('#dpi button[data-dpi="300"]');
await frame.select("#mode", "v2");
await waitRender("v2-texture4");

await frame.click("#applyBtn");
await page.waitForFunction(() => window.applied.length === 1, { timeout: 120000 });
const applied = await page.evaluate(() => window.applied[0]);
console.log(`applica: PNG ${(applied.size / 1048576).toFixed(1)} MB, stampante ${applied.settings.mode}, ${applied.placement}`);

const source = await page.evaluate(() => scene(2800, 1925).toDataURL("image/png"));
writeFileSync(join(out, "source-2800.png"), Buffer.from(source.split(",")[1], "base64"));

await browser.close();
if (errors.length) { console.error("Errori nella pagina:\n" + errors.join("\n")); process.exit(1); }
console.log("ok");
