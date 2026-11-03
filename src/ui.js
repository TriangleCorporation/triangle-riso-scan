// Pannello del plugin: anteprima dal vivo (il render finale, non una versione ridotta), preset, applica.

const FIGMA_MAX_IMAGE = 4096; // Figma riduce ogni immagine oltre 4096 px di lato
const TEXTURE_SOURCES = window.FSM_TEXTURES || {
  texture1: "../assets/texture-1.jpg",
  texture2: "../assets/texture-2.jpg",
  texture3: "../assets/texture-3.jpg",
  texture4: "../assets/texture-4.jpg",
};

const $ = (id) => document.getElementById(id);
const post = (msg) => parent.postMessage({ pluginMessage: msg }, "*");

let settings = defaultSettings();
let activePreset = "standard";
let userPresets = [];
let selection = [];
let sourceCache = new Map(); // id -> { longEdge, bitmap }
let lastResult = null; // { canvas, id, name }
let renderSeq = 0;
let renderQueue = Promise.resolve();
let renderTimer = null;
let applying = false;
const textures = {};
const textureLoads = {};

// ---------- richieste al lato documento ----------
let reqCounter = 0;
const pending = new Map();
function request(msg) {
  const reqId = ++reqCounter;
  return new Promise((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    post({ ...msg, reqId });
  });
}

window.onmessage = (event) => {
  const msg = event.data && event.data.pluginMessage;
  if (!msg) return;
  if (msg.reqId && pending.has(msg.reqId)) {
    const p = pending.get(msg.reqId);
    pending.delete(msg.reqId);
    if (msg.type === "error") p.reject(new Error(msg.message));
    else p.resolve(msg);
    return;
  }
  if (msg.type === "selection") onSelection(msg.items);
};

// ---------- texture ----------
function loadTexture(key) {
  if (key === "off" || textures[key]) return Promise.resolve();
  if (!textureLoads[key]) {
    textureLoads[key] = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { textures[key] = img; resolve(); };
      img.onerror = () => reject(new Error("Texture non caricata: " + key));
      img.src = TEXTURE_SOURCES[key];
    });
  }
  return textureLoads[key];
}

// ---------- sorgente ----------
async function getSource(item, needLong) {
  const want = Math.min(FIGMA_MAX_IMAGE, Math.ceil(needLong));
  const cached = sourceCache.get(item.id);
  if (cached && cached.longEdge >= want * 0.98) return cached.bitmap;
  const msg = await request({ type: "export", id: item.id, longEdge: want });
  const bitmap = await createImageBitmap(new Blob([msg.bytes], { type: "image/png" }));
  sourceCache.set(item.id, { longEdge: want, bitmap });
  return bitmap;
}

function finalDimsFor(item, s = settings) {
  return ScanEngine.scanGeometry(item.w, item.h, s).finalDims;
}

// ---------- render ----------
function scheduleRender(delay = 140) {
  clearTimeout(renderTimer);
  renderSeq++;
  if (!selection.length) return;
  renderTimer = setTimeout(() => queueRender(renderSeq), delay);
}

function queueRender(seq) {
  renderQueue = renderQueue.catch(() => {}).then(() => runPreview(seq));
}

function jobFor(seq) {
  return { check() { if (seq !== renderSeq) throw new ScanEngine.AbortedRender(); } };
}

async function renderItem(item, s, job, onProgress) {
  await loadTexture(s.texture);
  const dims = finalDimsFor(item, s);
  const source = await getSource(item, Math.max(dims.w, dims.h));
  job.check();
  return ScanEngine.renderScan(source, s, textures, job, onProgress);
}

async function runPreview(seq) {
  const item = selection[0];
  if (!item || seq !== renderSeq) return;
  const settingsKey = JSON.stringify(settings);
  setBusy(true, "Stampa in corso…");
  try {
    const { canvas } = await renderItem(item, settings, jobFor(seq), setProgress);
    if (seq !== renderSeq) return;
    // settingsKey: «Applica» riusa questa anteprima se nel frattempo non e' cambiato niente.
    lastResult = { canvas, id: item.id, name: item.name, settingsKey };
    drawPreview();
    $("dims").textContent = `${canvas.width} × ${canvas.height} px` + (Math.max(canvas.width, canvas.height) > FIGMA_MAX_IMAGE ? " · in Figma 4096" : "");
    $("downloadBtn").disabled = false;
    setHint("");
  } catch (error) {
    if (error.name !== "AbortError") { console.error(error); setHint(error.message, true); }
  } finally {
    if (seq === renderSeq) { setBusy(false); setProgress(0); }
  }
}

function drawPreview(showOriginal = false) {
  const preview = $("preview");
  const src = showOriginal ? sourceCache.get(lastResult?.id)?.bitmap : lastResult?.canvas;
  if (!src) return;
  const stage = $("stage");
  const maxW = stage.clientWidth, maxH = 340;
  const k = Math.min(maxW / src.width, maxH / src.height, 1);
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  preview.width = Math.round(w * dpr); preview.height = Math.round(h * dpr);
  preview.style.width = w + "px"; preview.style.height = h + "px";
  const ctx = preview.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, preview.width, preview.height);
  ctx.drawImage(src, 0, 0, preview.width, preview.height);
  preview.hidden = false; $("empty").hidden = true;
}

function drawLoupe(event) {
  const loupe = $("loupe"), preview = $("preview");
  if (!lastResult) return;
  const r = preview.getBoundingClientRect(), c = lastResult.canvas;
  const fx = (event.clientX - r.left) / r.width, fy = (event.clientY - r.top) / r.height;
  const size = loupe.width;
  const sx = Math.round(fx * c.width - size / 2), sy = Math.round(fy * c.height - size / 2);
  const ctx = loupe.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#202121"; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(c, sx, sy, size, size, 0, 0, size, size);
  loupe.classList.add("on");
}

// ---------- applica ----------
async function canvasToFigmaBytes(canvas) {
  let out = canvas;
  const long = Math.max(canvas.width, canvas.height);
  if (long > FIGMA_MAX_IMAGE) {
    const k = FIGMA_MAX_IMAGE / long;
    out = document.createElement("canvas");
    out.width = Math.round(canvas.width * k); out.height = Math.round(canvas.height * k);
    const ctx = out.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(canvas, 0, 0, out.width, out.height);
  }
  const blob = await new Promise((res) => out.toBlob(res, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function applyAll() {
  if (!selection.length || applying) return;
  applying = true; renderSeq++; clearTimeout(renderTimer);
  const items = selection.slice();
  const placement = $("placement").value;
  const frozen = JSON.parse(JSON.stringify(settings));
  $("applyBtn").disabled = true;
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setBusy(true, items.length > 1 ? `Livello ${i + 1} di ${items.length}…` : "Stampa in corso…");
      const reuse = lastResult && lastResult.id === item.id && lastResult.settingsKey === JSON.stringify(frozen);
      const canvas = reuse ? lastResult.canvas : (await renderItem(item, frozen, { check() {} }, (p) => setProgress(((i + p / 100) / items.length) * 100))).canvas;
      setBusy(true, "Inserisco in Figma…");
      const bytes = await canvasToFigmaBytes(canvas);
      await request({ type: "apply", id: item.id, bytes, settings: frozen, placement, last: i === items.length - 1, count: items.length });
    }
  } catch (error) {
    console.error(error); setHint(error.message, true); post({ type: "notify", text: error.message, error: true });
  } finally {
    applying = false; setBusy(false); setProgress(0); refreshApplyButton();
  }
}

function download() {
  if (!lastResult) return;
  lastResult.canvas.toBlob((blob) => {
    const a = document.createElement("a");
    const safe = (lastResult.name || "scan").replace(/[^\w\-]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "scan";
    a.href = URL.createObjectURL(blob);
    a.download = `scan-${safe}-${lastResult.canvas.width}x${lastResult.canvas.height}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
}

// ---------- selezione ----------
function onSelection(items) {
  const prevId = selection[0]?.id;
  selection = items;
  for (const id of [...sourceCache.keys()]) if (!items.some((i) => i.id === id)) sourceCache.delete(id);
  const first = items[0];
  if (!first) {
    $("selName").textContent = "nessun livello";
    $("preview").hidden = true; $("empty").hidden = false; $("dims").textContent = "";
    $("downloadBtn").disabled = true; lastResult = null;
    refreshApplyButton();
    return;
  }
  $("selName").textContent = items.length > 1 ? `${items.length} livelli` : `${first.name} · ${first.w}×${first.h}`;
  if (first.isScan && first.sourceMissing) setHint("L'originale di questa scansione non c'è più: non si può rifare.", true);
  // Una scansione gia' fatta riporta le sue impostazioni: si riprende da dove si era lasciato.
  if (first.id !== prevId && first.settings) { settings = normalizeSettings(first.settings); activePreset = null; syncControls(); }
  if (first.id !== prevId) sourceCache.delete(first.id);
  refreshApplyButton();
  scheduleRender(first.id !== prevId ? 0 : 140);
}

function refreshApplyButton() {
  const btn = $("applyBtn"), first = selection[0];
  btn.disabled = !first || applying || (first.isScan && first.sourceMissing);
  if (!first) btn.textContent = "Crea scansione";
  else if (selection.length > 1) btn.textContent = `Applica a ${selection.length} livelli`;
  else btn.textContent = first.hasScan ? "Aggiorna scansione" : "Crea scansione";
  $("placement").disabled = !!(first && selection.length === 1 && first.hasScan);
}

// ---------- controlli ----------
function changed(fromPreset = false) {
  if (!fromPreset) activePreset = null;
  syncControls();
  persistLast();
  scheduleRender();
}

let persistTimer = null;
function persistLast() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => post({ type: "storage-set", key: "last", value: settings }), 400);
}

function fmt(value, step) {
  return step < 1 ? Number(value).toFixed(2) : String(Math.round(value));
}

function buildControls() {
  // stampanti, fusioni, fibre
  const fill = (sel, list) => { $(sel).innerHTML = list.map(([v, l]) => `<option value="${v}">${l}</option>`).join(""); };
  fill("mode", PRINT_MODES); fill("blend", BLEND_MODES); fill("cloud", CLOUD_MODES);
  $("mode").onchange = (e) => { settings.mode = e.target.value; changed(); };
  $("blend").onchange = (e) => { settings.blend = e.target.value; changed(); };
  $("cloud").onchange = (e) => { settings.cloud = e.target.value; changed(); };
  $("bw").onchange = (e) => { settings.bw = e.target.checked; changed(); };
  $("finalBW").onchange = (e) => { settings.finalBW = e.target.checked; changed(); };

  // texture
  $("textures").innerHTML = TEXTURES.map((k, i) => `<button data-tex="${k}" title="${k === "off" ? "Nessuna texture" : "Texture " + i}">${k === "off" ? "Off" : ""}</button>`).join("");
  for (const btn of $("textures").children) {
    const key = btn.dataset.tex;
    if (key !== "off") btn.style.backgroundImage = `url("${TEXTURE_SOURCES[key]}")`;
    btn.onclick = () => {
      settings.texture = key;
      if (key !== "off" && settings.values.textureOpacity === 0) settings.values.textureOpacity = 75;
      changed();
    };
  }

  // DPI
  for (const btn of $("dpi").children) btn.onclick = () => { settings.dpi = Number(btn.dataset.dpi); changed(); };

  // cursori
  let html = "", group = "";
  for (const [key, label, min, max, , step, g] of SLIDERS) {
    if (g !== group) { html += `<div class="group-title">${g}</div>`; group = g; }
    html += `<div class="slider"><span id="l-${key}">${label}</span><input type="range" id="r-${key}" min="${min}" max="${max}" step="${step}"><input type="number" id="n-${key}" min="${min}" max="${max}" step="${step}"></div>`;
  }
  $("sliders").innerHTML = html;
  for (const [key, , min, max, def, step] of SLIDERS) {
    const set = (v) => { const n = Number(v); if (!Number.isFinite(n)) return; settings.values[key] = Math.min(Math.max(n, min), max); changed(); };
    $("r-" + key).oninput = (e) => set(e.target.value);
    $("n-" + key).onchange = (e) => set(e.target.value);
    $("l-" + key).ondblclick = () => set(def);
    $("l-" + key).title = "Doppio clic: valore di partenza";
  }
}

function syncControls() {
  $("mode").value = settings.mode; $("blend").value = settings.blend; $("cloud").value = settings.cloud;
  $("bw").checked = settings.bw; $("finalBW").checked = settings.finalBW;
  for (const btn of $("textures").children) btn.classList.toggle("on", btn.dataset.tex === settings.texture);
  for (const btn of $("dpi").children) btn.classList.toggle("on", Number(btn.dataset.dpi) === settings.dpi);
  for (const [key, , , , def, step] of SLIDERS) {
    const v = settings.values[key];
    $("r-" + key).value = v; $("n-" + key).value = fmt(v, step);
    $("l-" + key).classList.toggle("changed", Math.abs(v - def) > 1e-9);
  }
  renderPresetChips();
}

// ---------- preset ----------
function renderPresetChips() {
  const chips = [];
  for (const [key, p] of Object.entries(BUILTIN_PRESETS)) chips.push(`<button class="chip${activePreset === key ? " on" : ""}" data-p="${key}">${p.label}</button>`);
  userPresets.forEach((p, i) => chips.push(`<button class="chip${activePreset === "u" + i ? " on" : ""}" data-u="${i}">${escapeHtml(p.label)}<span class="x" data-del="${i}" title="Elimina">×</span></button>`));
  $("presets").innerHTML = chips.join("");
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

$("presets").onclick = (e) => {
  const del = e.target.closest("[data-del]");
  if (del) { userPresets.splice(Number(del.dataset.del), 1); saveUserPresets(); activePreset = null; renderPresetChips(); return; }
  const chip = e.target.closest(".chip");
  if (!chip) return;
  if (chip.dataset.p) { settings = applyPreset(settings, BUILTIN_PRESETS[chip.dataset.p]); activePreset = chip.dataset.p; }
  else { settings = applyPreset(settings, userPresets[Number(chip.dataset.u)], { initializeTexture: true }); activePreset = "u" + chip.dataset.u; }
  changed(true);
};

function saveUserPresets() { post({ type: "storage-set", key: "presets", value: userPresets }); }

$("savePresetBtn").onclick = () => { $("saveRow").hidden = false; $("presetName").value = ""; $("presetName").focus(); };
$("presetCancel").onclick = () => { $("saveRow").hidden = true; };
$("presetOk").onclick = () => {
  const name = $("presetName").value.trim();
  if (!name) return;
  const existing = userPresets.findIndex((p) => p.label === name);
  const preset = presetFromSettings(name, settings);
  if (existing >= 0) userPresets[existing] = preset; else userPresets.push(preset);
  activePreset = "u" + (existing >= 0 ? existing : userPresets.length - 1);
  saveUserPresets(); $("saveRow").hidden = true; renderPresetChips();
  post({ type: "notify", text: `Preset «${name}» salvato: lo trovi in ogni file` });
};
$("presetName").onkeydown = (e) => { if (e.key === "Enter") $("presetOk").click(); if (e.key === "Escape") $("presetCancel").click(); };

$("copyJson").onclick = () => {
  const ta = $("json");
  ta.value = JSON.stringify(presetFromSettings("Preset Figma", settings), null, 2);
  ta.select();
  try { document.execCommand("copy"); post({ type: "notify", text: "Preset copiato negli appunti" }); } catch (e) { /* resta selezionato */ }
};

$("importJson").onclick = () => {
  let data;
  try { data = JSON.parse($("json").value); } catch (e) { setHint("JSON non valido", true); return; }
  // Accetta un preset singolo o un gruppo { custom5: {...}, ... } come quelli del sito.
  const list = data && (data.sliders || data.values) ? [data] : Object.values(data || {}).filter((p) => p && p.sliders);
  if (!list.length) { setHint("Nessun preset riconosciuto nel JSON", true); return; }
  for (const p of list) {
    const preset = p.values ? presetFromSettings(p.label || "Importato", normalizeSettings(p)) : { ...p, label: p.label || "Importato" };
    userPresets.push(preset);
  }
  saveUserPresets();
  settings = applyPreset(settings, userPresets[userPresets.length - 1], { initializeTexture: true });
  activePreset = "u" + (userPresets.length - 1);
  changed(true);
  post({ type: "notify", text: list.length > 1 ? `${list.length} preset importati` : "Preset importato" });
};

$("resetBtn").onclick = () => { settings = defaultSettings(); activePreset = "standard"; changed(true); };

// ---------- stato e piccoli aiuti ----------
function setBusy(on, text) { $("busy").classList.toggle("on", on); if (text) $("busyText").textContent = text; }
function setProgress(p) { $("progress").style.width = Math.max(0, Math.min(100, p)) + "%"; }
function setHint(text, error = false) {
  const hint = $("hint");
  if (!text) { hint.textContent = "Passa sopra l'anteprima: dettaglio 1:1 · tieni premuto: originale"; hint.className = ""; return; }
  hint.textContent = text; hint.className = error ? "err" : "";
}

$("preview").onmousemove = drawLoupe;
$("preview").onmouseleave = () => { $("loupe").classList.remove("on"); drawPreview(false); };
$("preview").onmousedown = () => drawPreview(true);
$("preview").onmouseup = () => drawPreview(false);
$("applyBtn").onclick = applyAll;
$("downloadBtn").onclick = download;
window.addEventListener("resize", () => drawPreview(false));

// Ridimensionare il pannello trascinando l'angolo.
$("resize").onpointerdown = (e) => {
  const el = e.target; el.setPointerCapture(e.pointerId);
  el.onpointermove = (m) => post({ type: "resize", width: Math.round(m.clientX + 8), height: Math.round(m.clientY + 8) });
  el.onpointerup = () => { el.onpointermove = null; };
};

// ---------- avvio ----------
(async function start() {
  buildControls();
  syncControls();
  try {
    const [presets, last] = await Promise.all([
      request({ type: "storage-get", key: "presets" }),
      request({ type: "storage-get", key: "last" }),
    ]);
    if (Array.isArray(presets.value)) userPresets = presets.value;
    if (last.value) { settings = normalizeSettings(last.value); activePreset = null; }
  } catch (e) { /* fuori da Figma (prove nel browser) */ }
  syncControls();
  for (const key of TEXTURES) loadTexture(key).catch(() => {});
  post({ type: "ready" });
})();
