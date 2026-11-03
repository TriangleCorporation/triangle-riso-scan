// Controlli e preset di Folder Scan Machine (sketch.js), con le stesse regole di applyPreset().

const SLIDERS = [
  // chiave, etichetta, min, max, default, passo, gruppo
  ["contrast", "Contrasto", 0, 220, 126, 1, "Immagine"],
  ["brightness", "Luminosità", -90, 90, -5, 1, "Immagine"],
  ["luminosity", "Luminanza", -100, 100, -10, 1, "Immagine"],
  ["vibrance", "Vividezza", -100, 100, 0, 1, "Immagine"],
  ["blackLift", "Neri grigi", 0, 100, 0, 1, "Immagine"],
  ["threshold", "Soglia (B/N)", 0, 255, 103, 1, "Immagine"],
  ["cmykScreen", "Retino 4 colori", 0, 100, 100, 1, "Stampa"],
  ["inkSmear", "Sbavatura inchiostro", 0, 100, 0, 1, "Stampa"],
  ["printBlacks", "Neri di stampa", 0, 100, 0, 1, "Stampa"],
  ["miniPrint", "Mini print", 0, 100, 1, 1, "Stampa"],
  ["exposure", "Esposizione", -1, 1, 0.02, 0.01, "Esposizione"],
  ["offset", "Offset", -0.5, 0.5, -0.04, 0.01, "Esposizione"],
  ["gamma", "Gamma", 0.1, 3, 2.14, 0.01, "Esposizione"],
  ["blur", "Sfocatura", 0, 5, 0.6, 0.1, "Esposizione"],
  ["noise", "Rumore e polvere", 0, 120, 0, 1, "Scanner"],
  ["scanLines", "Righe di scansione", 0, 100, 3, 1, "Scanner"],
  ["scannerStreaks", "Strisce dello scanner", 0, 100, 2, 1, "Scanner"],
  ["distortion", "Distorsione", 0, 60, 0, 1, "Scanner"],
  ["scale", "Scala", 50, 150, 100, 1, "Carta"],
  ["textureOpacity", "Opacità texture", 0, 100, 77, 1, "Carta"],
  ["whiteCleanup", "Pulizia dei bianchi", 0, 100, 100, 1, "Carta"],
];

const PRINT_MODES = [
  ["v1", "v1 · punti offset"],
  ["v2", "v2 · grana grossa"],
  ["v3", "v3 · rosetta"],
  ["v4", "v4 · stampa profonda"],
  ["v5", "v5 · neri laser"],
  ["inkjet", "Inkjet · inchiostro pieno"],
];

const CLOUD_MODES = [
  ["off", "Nessuna"],
  ["c1", "C1 · carta morbida"],
  ["c2", "C2 · grana fine"],
  ["c3", "C3 · bande a nuvola"],
];

const BLEND_MODES = [
  ["screen", "Scolora (Screen)"],
  ["lighten", "Schiarisci (Lighten)"],
  ["add", "Aggiungi (Add)"],
  ["overlay", "Sovrapponi (Overlay)"],
  ["multiply", "Moltiplica (Multiply)"],
  ["textureOnly", "Solo texture"],
];

const TEXTURES = ["off", "texture1", "texture2", "texture3", "texture4"];

const BUILTIN_PRESETS = {
  standard: {
    label: "Standard",
    sliders: { contrast: 126, brightness: -5, luminosity: -10, vibrance: 0, noise: 0, scanLines: 0, scannerStreaks: 2, distortion: 0, threshold: 103, scale: 100, blackLift: 0, cmykScreen: 100, inkSmear: 0, printBlacks: 0, exposure: 0.02, offset: -0.04, gamma: 2.14, miniPrint: 1, blur: 0.6, textureOpacity: 77, whiteCleanup: 100 },
    bw: false, finalBW: false, cmykMode: "v4", cloudMode: "off", textureMode: "texture2", textureBlend: "screen", exportResolution: "low",
  },
  graphicBW: {
    label: "Grafica 1 colore",
    sliders: { contrast: 126, brightness: -5, luminosity: -10, vibrance: 0, noise: 3, scanLines: 0, scannerStreaks: 5, distortion: 0, threshold: 103, scale: 100, blackLift: 0, cmykScreen: 100, inkSmear: 0, printBlacks: 0, exposure: 0.02, offset: -0.04, gamma: 2.14, miniPrint: 1, blur: 0.6, textureOpacity: 100, whiteCleanup: 100 },
    bw: false, finalBW: true, cmykMode: "v4", cloudMode: "off", textureMode: "texture2", textureBlend: "screen", exportResolution: "low",
  },
  graphicColors: {
    label: "Grafica a colori",
    sliders: { contrast: 126, brightness: 0, luminosity: 0, vibrance: 0, noise: 1, scanLines: 0, scannerStreaks: 0, distortion: 0, threshold: 118, scale: 100, blackLift: 0, cmykScreen: 100, inkSmear: 0, printBlacks: 0, exposure: 0.03, offset: -0.04, gamma: 1.95, miniPrint: 1, blur: 0.6, textureOpacity: 75, whiteCleanup: 100 },
    bw: false, finalBW: false, cmykMode: "v4", cloudMode: "off", textureMode: "texture2", textureBlend: "screen", exportResolution: "high",
  },
  imageBW: {
    label: "Foto in bianco e nero",
    sliders: { contrast: 126, brightness: -5, luminosity: -10, vibrance: 0, noise: 0, scanLines: 3, scannerStreaks: 2, distortion: 0, threshold: 103, scale: 100, blackLift: 0, cmykScreen: 100, inkSmear: 0, printBlacks: 0, exposure: 0.02, offset: -0.04, gamma: 2.14, miniPrint: 1, blur: 0.6, textureOpacity: 100, whiteCleanup: 100 },
    bw: false, finalBW: true, cmykMode: "v4", cloudMode: "off", textureMode: "texture1", textureBlend: "screen", exportResolution: "low",
  },
  custom5: {
    label: "Sovraesposta", scope: "editor",
    sliders: { cmykScreen: 74, inkSmear: 39, printBlacks: 34, textureOpacity: 87, whiteCleanup: 100, miniPrint: 1, scanLines: 38, distortion: 0, offset: 0.5, contrast: 86 },
    cmykMode: "inkjet",
  },
  custom6: {
    label: "Morbida", scope: "full",
    sliders: { contrast: 111, brightness: -5, luminosity: -10, vibrance: -33, noise: 0, scanLines: 0, scannerStreaks: 2, distortion: 0, threshold: 103, scale: 150, blackLift: 0, cmykScreen: 100, inkSmear: 0, printBlacks: 0, exposure: 0.02, offset: 0.09, gamma: 2.14, miniPrint: 1, blur: 0.6, textureOpacity: 38, whiteCleanup: 100 },
    bw: false, finalBW: false, cloudMode: "off", cmykMode: "inkjet",
    scanSetup: { dpi: 600, scale: 150, printer: "inkjet", texture: "texture4", textureBlend: "screen" },
  },
};

function defaultSettings() {
  const values = Object.fromEntries(SLIDERS.map((s) => [s[0], s[4]]));
  const settings = { values, bw: false, finalBW: false, cloud: "off", mode: "v4", texture: "off", blend: "screen", dpi: 300 };
  return applyPreset(settings, BUILTIN_PRESETS.standard, { initializeTexture: true });
}

// Stesse regole del sito: i preset di base non toccano texture, opacita' e DPI; «editor» non tocca B/N e carta.
function applyPreset(current, preset, { initializeTexture = false } = {}) {
  const next = JSON.parse(JSON.stringify(current));
  for (const key in preset.sliders || {}) {
    const def = SLIDERS.find((s) => s[0] === key);
    if (!def) continue;
    if (key !== "textureOpacity" || initializeTexture || preset.scope === "editor" || preset.scope === "full") {
      next.values[key] = Math.min(Math.max(Number(preset.sliders[key]), def[2]), def[3]);
    }
  }
  if (preset.scope !== "editor") {
    if ("bw" in preset) next.bw = !!preset.bw;
    if ("finalBW" in preset) next.finalBW = !!preset.finalBW;
    if (preset.cloudMode) next.cloud = preset.cloudMode;
  }
  if (preset.cmykMode) next.mode = preset.cmykMode;
  if (initializeTexture) {
    next.texture = preset.textureMode || "off";
    next.blend = preset.textureBlend || "screen";
  }
  if (preset.scanSetup) {
    const s = preset.scanSetup;
    if (s.scale != null) next.values.scale = s.scale;
    if ([300, 600, 900].includes(Number(s.dpi))) next.dpi = Number(s.dpi);
    if (s.texture) next.texture = s.texture;
    if (s.textureBlend) next.blend = s.textureBlend;
  }
  return next;
}

// Un preset salvato dal plugin e' una fotografia completa (scope «full» con scanSetup),
// nello stesso formato dei preset del sito: si puo' incollare in un altro file o progetto.
function presetFromSettings(label, settings) {
  return {
    label, scope: "full",
    sliders: { ...settings.values },
    bw: settings.bw, finalBW: settings.finalBW, cloudMode: settings.cloud, cmykMode: settings.mode,
    scanSetup: { dpi: settings.dpi, scale: settings.values.scale, printer: settings.mode, texture: settings.texture, textureBlend: settings.blend },
  };
}

function normalizeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  const out = { ...base, values: { ...base.values } };
  for (const [k, , min, max] of SLIDERS) if (raw.values && Number.isFinite(Number(raw.values[k]))) out.values[k] = Math.min(Math.max(Number(raw.values[k]), min), max);
  if (typeof raw.bw === "boolean") out.bw = raw.bw;
  if (typeof raw.finalBW === "boolean") out.finalBW = raw.finalBW;
  if (CLOUD_MODES.some((m) => m[0] === raw.cloud)) out.cloud = raw.cloud;
  if (PRINT_MODES.some((m) => m[0] === raw.mode)) out.mode = raw.mode;
  if (TEXTURES.includes(raw.texture)) out.texture = raw.texture;
  if (BLEND_MODES.some((m) => m[0] === raw.blend)) out.blend = raw.blend;
  if ([300, 600, 900].includes(Number(raw.dpi))) out.dpi = Number(raw.dpi);
  return out;
}
