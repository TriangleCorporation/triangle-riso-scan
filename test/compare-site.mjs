// Confronto col sito originale: stessa immagine (test/out/source-2800.png) nel Folder Scan Machine vero,
// preset Standard a 300 DPI, e differenza pixel per pixel col render del plugin (test/out/standard.png).
import puppeteer from "puppeteer-core";
import { writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "test/out");
const base = join(homedir(), ".cache/puppeteer/chrome");
const v = readdirSync(base).filter((d) => d.startsWith("mac_arm")).sort().pop();
const executablePath = process.env.CHROME_PATH || join(base, v, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000 });
await page.goto("https://archivefolder.xyz/scanmachine/", { waitUntil: "networkidle2" });
await page.waitForFunction(() => typeof sourceImage !== "undefined" && sourceImage, { timeout: 60000 });
const input = await page.$('input[type="file"][aria-label^="Upload"]');
await input.uploadFile(join(out, "source-2800.png"));
await page.waitForFunction(() => sourceImage && sourceImage.width === 2800, { timeout: 60000 });
await page.waitForFunction(() => typeof machineHighPreviewLayer !== "undefined" && machineHighPreviewLayer && machineHighPreviewVersion === renderVersion && !machineHighPreviewPending, { timeout: 120000, polling: 250 });
const site = await page.evaluate(() => ({ data: machineHighPreviewLayer.canvas.toDataURL("image/png"), w: machineHighPreviewLayer.width, h: machineHighPreviewLayer.height, engine: window.machineLastFastRender }));
writeFileSync(join(out, "site-standard.png"), Buffer.from(site.data.split(",")[1], "base64"));
console.log("sito:", site.w + "x" + site.h, JSON.stringify(site.engine));

// differenza, calcolata in una pagina
const diff = await page.evaluate(async (a, b) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
  const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const da = px(ia), db = px(ib);
  let sum = 0, max = 0, over8 = 0;
  for (let i = 0; i < da.length; i += 4) for (let k = 0; k < 3; k++) { const d = Math.abs(da[i + k] - db[i + k]); sum += d; if (d > max) max = d; if (d > 8) over8++; }
  const n = (da.length / 4) * 3;
  return { mean: sum / n, max, over8: over8 / n };
}, site.data, "data:image/png;base64," + (await import("node:fs")).readFileSync(join(out, "standard.png")).toString("base64"));
console.log("differenza:", JSON.stringify(diff));
await browser.close();
