// Triangle Riso Scan (Folder Scan Machine per Figma): lato documento.
// Esporta il livello scelto, riceve la scansione fatta dall'interfaccia (WebGL2) e la mette in un livello
// «Scan · nome» sopra o accanto all'originale. Le impostazioni restano nel livello (pluginData), cosi' la
// scansione si rifa' in qualunque file; i preset dell'utente stanno in clientStorage, uguali in tutti i progetti.

const DATA_KEY = "fsm";
const UI_SIZE = { width: 400, height: 760 };

figma.showUI(__html__, { ...UI_SIZE, themeColors: true, title: "Triangle Riso Scan" });

function readData(node) {
  try {
    const raw = node && "getPluginData" in node ? node.getPluginData(DATA_KEY) : "";
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function exportable(node) {
  return node && "exportAsync" in node && node.type !== "PAGE" && node.type !== "DOCUMENT";
}

// La scansione gia' fatta per un originale: un fratello con i nostri dati che punta a lui.
function findScanFor(source) {
  const parent = source.parent;
  if (!parent || !("children" in parent)) return null;
  return parent.children.find((n) => n.id !== source.id && readData(n)?.sourceId === source.id) || null;
}

async function resolve(node) {
  const data = readData(node);
  if (data) {
    const source = data.sourceId ? await figma.getNodeByIdAsync(data.sourceId) : null;
    return { scan: node, source: exportable(source) ? source : null, settings: data.settings || null };
  }
  const scan = findScanFor(node);
  return { scan, source: node, settings: scan ? readData(scan)?.settings || null : null };
}

async function describeSelection() {
  const items = [];
  for (const node of figma.currentPage.selection) {
    if (!exportable(node)) continue;
    const { scan, source, settings } = await resolve(node);
    const box = (source || node).absoluteBoundingBox;
    items.push({
      id: node.id,
      name: (source || node).name,
      w: box ? Math.round(box.width) : Math.round(node.width),
      h: box ? Math.round(box.height) : Math.round(node.height),
      hasScan: !!scan,
      isScan: scan === node,
      sourceMissing: scan === node && !source,
      settings,
    });
  }
  figma.ui.postMessage({ type: "selection", items });
}

let selectionTimer = null;
figma.on("selectionchange", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(describeSelection, 120);
});
figma.on("currentpagechange", describeSelection);

async function exportSource(id, longEdge) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error("Il livello non esiste piu'.");
  const { source } = await resolve(node);
  if (!source) throw new Error("L'originale di questa scansione e' stato cancellato.");
  const box = source.absoluteBoundingBox || { width: source.width, height: source.height };
  if (!box.width || !box.height) throw new Error("Il livello ha dimensione zero.");
  const wasHidden = source.visible === false;
  if (wasHidden) source.visible = true;
  try {
    const constraint = box.width >= box.height ? { type: "WIDTH", value: longEdge } : { type: "HEIGHT", value: longEdge };
    const bytes = await source.exportAsync({ format: "PNG", constraint, useAbsoluteBounds: true });
    return { bytes, w: box.width, h: box.height };
  } finally {
    if (wasHidden) source.visible = false;
  }
}

// Coordinate assolute -> coordinate del genitore (solo traslazione e scala: i genitori ruotati sono rari).
function toParent(parent, x, y) {
  // I gruppi non hanno coordinate proprie: x/y dei figli sono quelle del primo antenato vero.
  while (parent && (parent.type === "GROUP" || parent.type === "BOOLEAN_OPERATION")) parent = parent.parent;
  if (!parent || parent.type === "PAGE" || !("absoluteTransform" in parent)) return { x, y };
  const [[a, c, e], [b, d, f]] = parent.absoluteTransform;
  const det = a * d - b * c || 1;
  const dx = x - e, dy = y - f;
  return { x: (d * dx - c * dy) / det, y: (a * dy - b * dx) / det };
}

function canHost(parent) {
  if (!parent || !("insertChild" in parent)) return false;
  for (let p = parent; p && p.type !== "PAGE"; p = p.parent) if (p.type === "INSTANCE") return false;
  return true;
}

function placeNewScan(source, placement) {
  const rect = figma.createRectangle();
  const box = source.absoluteBoundingBox || { x: 0, y: 0, width: source.width, height: source.height };
  rect.resize(Math.max(0.01, box.width), Math.max(0.01, box.height));
  let parent = source.parent;
  if (canHost(parent) && !source.id.includes(";")) {
    parent.insertChild(parent.children.indexOf(source) + 1, rect);
    if ("layoutMode" in parent && parent.layoutMode !== "NONE") rect.layoutPositioning = "ABSOLUTE";
  } else {
    parent = figma.currentPage;
    parent.appendChild(rect);
  }
  const shift = placement === "beside" ? box.width + 40 : 0;
  const p = toParent(parent, box.x + shift, box.y);
  rect.x = p.x;
  rect.y = p.y;
  return rect;
}

async function applyScan(msg) {
  const node = await figma.getNodeByIdAsync(msg.id);
  if (!node) throw new Error("Il livello non esiste piu'.");
  const resolved = await resolve(node);
  const source = resolved.source;
  if (!source) throw new Error("L'originale di questa scansione e' stato cancellato.");
  let scan = resolved.scan;
  if (scan && msg.placement === "new") scan = null;
  if (!scan) scan = placeNewScan(source, msg.placement === "new" ? "beside" : msg.placement);
  const image = figma.createImage(msg.bytes);
  scan.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
  scan.name = "Scan · " + source.name;
  scan.setPluginData(DATA_KEY, JSON.stringify({ v: 1, sourceId: source.id, settings: msg.settings, at: Date.now() }));
  return scan;
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "ready") {
      await describeSelection();
    } else if (msg.type === "export") {
      const out = await exportSource(msg.id, msg.longEdge);
      figma.ui.postMessage({ type: "source", reqId: msg.reqId, ...out });
    } else if (msg.type === "apply") {
      const scan = await applyScan(msg);
      figma.ui.postMessage({ type: "applied", reqId: msg.reqId, layerId: scan.id });
      if (msg.last) {
        figma.notify(msg.count > 1 ? `Scansione applicata a ${msg.count} livelli` : "Scansione applicata");
        await describeSelection();
      }
    } else if (msg.type === "select") {
      const node = await figma.getNodeByIdAsync(msg.id);
      if (node) { figma.currentPage.selection = [node]; figma.viewport.scrollAndZoomIntoView([node]); }
    } else if (msg.type === "storage-get") {
      figma.ui.postMessage({ type: "storage", reqId: msg.reqId, value: await figma.clientStorage.getAsync(msg.key) });
    } else if (msg.type === "storage-set") {
      await figma.clientStorage.setAsync(msg.key, msg.value);
    } else if (msg.type === "notify") {
      figma.notify(msg.text, { error: !!msg.error });
    } else if (msg.type === "resize") {
      figma.ui.resize(Math.max(340, Math.min(900, msg.width)), Math.max(480, Math.min(1400, msg.height)));
    }
  } catch (error) {
    const text = (error && error.message) || String(error);
    if (msg.reqId) figma.ui.postMessage({ type: "error", reqId: msg.reqId, message: text });
    else figma.notify(text, { error: true });
  }
};
