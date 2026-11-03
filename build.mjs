// Costruisce dist/ui.html: un file solo (Figma vuole l'interfaccia in un'unica pagina),
// con gli script e le quattro texture della carta dentro come data URI.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = (f) => readFileSync(new URL("./src/" + f, import.meta.url), "utf8");
const textures = Object.fromEntries([1, 2, 3, 4].map((i) => [
  "texture" + i,
  "data:image/jpeg;base64," + readFileSync(new URL(`./assets/texture-${i}.jpg`, import.meta.url)).toString("base64"),
]));

let html = src("ui.html");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) => {
  const code = src(file).replace(/<\/script/gi, "<\\/script");
  const prefix = file === "shaders.js" ? `window.FSM_TEXTURES=${JSON.stringify(textures)};\n` : "";
  return `<script>\n${prefix}${code}\n</script>`;
});

mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/ui.html", import.meta.url), html);
console.log(`dist/ui.html ${(html.length / 1048576).toFixed(1)} MB`);
