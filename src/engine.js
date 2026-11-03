// Motore di Folder Scan Machine portato fuori da p5: stessa pipeline WebGL2 (shaders.js, alla lettera),
// stessi seed, stessa casualita' e stesso rumore di p5 per i segni vettoriali (righe, strisce, polvere).
// Ingresso: un'immagine (ImageBitmap/canvas) e le impostazioni; uscita: un canvas con la scansione.

const FINAL_RENDER_RANDOM_SEED = 18473;
const FINAL_RENDER_NOISE_SEED = 9271;

// ---------- p5: random(), noise(), map() con lo stesso LCG ----------
function p5Lcg(seed) {
  let z = seed >>> 0;
  return () => {
    z = (1664525 * z + 1013904223) % 4294967296;
    return z / 4294967296;
  };
}

function p5Random(seed) {
  const rand = p5Lcg(seed);
  return function random(min, max) {
    const r = rand();
    if (min === undefined) return r;
    if (max === undefined) return Array.isArray(min) ? min[Math.floor(r * min.length)] : r * min;
    if (min > max) [min, max] = [max, min];
    return r * (max - min) + min;
  };
}

function p5Noise(seed) {
  const SIZE = 4095, YWRAPB = 4, YWRAP = 1 << YWRAPB, ZWRAPB = 8, ZWRAP = 1 << ZWRAPB;
  const rand = p5Lcg(seed), perlin = new Float64Array(SIZE + 1);
  for (let i = 0; i < SIZE + 1; i++) perlin[i] = rand();
  const cosine = (i) => 0.5 * (1.0 - Math.cos(i * Math.PI));
  return function noise(x, y = 0, z = 0) {
    x = Math.abs(x); y = Math.abs(y); z = Math.abs(z);
    let xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let xf = x - xi, yf = y - yi, zf = z - zi;
    let r = 0, ampl = 0.5;
    for (let o = 0; o < 4; o++) {
      let of = xi + (yi << YWRAPB) + (zi << ZWRAPB);
      const rxf = cosine(xf), ryf = cosine(yf);
      let n1 = perlin[of & SIZE];
      n1 += rxf * (perlin[(of + 1) & SIZE] - n1);
      let n2 = perlin[(of + YWRAP) & SIZE];
      n2 += rxf * (perlin[(of + YWRAP + 1) & SIZE] - n2);
      n1 += ryf * (n2 - n1);
      of += ZWRAP;
      n2 = perlin[of & SIZE];
      n2 += rxf * (perlin[(of + 1) & SIZE] - n2);
      let n3 = perlin[(of + YWRAP) & SIZE];
      n3 += rxf * (perlin[(of + YWRAP + 1) & SIZE] - n3);
      n2 += ryf * (n3 - n2);
      n1 += cosine(zf) * (n2 - n1);
      r += n1 * ampl;
      ampl *= 0.5;
      xi <<= 1; xf *= 2; yi <<= 1; yf *= 2; zi <<= 1; zf *= 2;
      if (xf >= 1.0) { xi++; xf--; }
      if (yf >= 1.0) { yi++; yf--; }
      if (zf >= 1.0) { zi++; zf--; }
    }
    return r;
  };
}

const map = (v, a, b, c, d) => ((v - a) / (b - a)) * (d - c) + c;
const radians = (deg) => (deg * Math.PI) / 180;
const constrain = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ---------- Profili (sketch.js) ----------
function getCMYKScreenProfile(mode, amount, exportScale) {
  if (mode === "v5") {
    return {
      spacing: map(amount, 0, 100, 13, 4.6) * exportScale, softness: map(amount, 0, 100, 0.16, 0.048),
      misregister: map(amount, 0, 100, 0.08, 1.1) * exportScale,
      cAngle: radians(15), mAngle: radians(75), yAngle: radians(0), kAngle: radians(45),
      mSpacing: 1, ySpacing: 1.02, kSpacing: 0.9, cInk: 198, mInk: 206, yInk: 188, kInk: 220,
      shadowPress: 58, solidBlackThreshold: 0.58, solidBlackValue: 18, noiseScale: 0.038, paperNoise: 8,
    };
  }
  if (mode === "v4") {
    return {
      spacing: map(amount, 0, 100, 12, 3.7) * exportScale, softness: map(amount, 0, 100, 0.14, 0.038),
      misregister: map(amount, 0, 100, 0.08, 0.9) * exportScale,
      cAngle: radians(12), mAngle: radians(72), yAngle: radians(3), kAngle: radians(43),
      mSpacing: 1, ySpacing: 1.02, kSpacing: 0.88, cInk: 198, mInk: 210, yInk: 184, kInk: 230,
      shadowPress: 72, solidBlackThreshold: 0, solidBlackValue: 18, noiseScale: 0.032, paperNoise: 7,
    };
  }
  if (mode === "v2") {
    return {
      spacing: map(amount, 0, 100, 18, 3.2) * exportScale, softness: map(amount, 0, 100, 0.28, 0.035),
      misregister: map(amount, 0, 100, 0.4, 3.8) * exportScale,
      cAngle: radians(22), mAngle: radians(67), yAngle: radians(4), kAngle: radians(47),
      mSpacing: 0.94, ySpacing: 1.08, kSpacing: 0.86, cInk: 224, mInk: 216, yInk: 206, kInk: 205,
      shadowPress: 36, solidBlackThreshold: 0, solidBlackValue: 18, noiseScale: 0.12, paperNoise: 20,
    };
  }
  if (mode === "v3") {
    return {
      spacing: map(amount, 0, 100, 16, 5.2) * exportScale, softness: map(amount, 0, 100, 0.18, 0.045),
      misregister: map(amount, 0, 100, 0.1, 1.4) * exportScale,
      cAngle: radians(15), mAngle: radians(75), yAngle: radians(0), kAngle: radians(45),
      mSpacing: 1, ySpacing: 1, kSpacing: 1, cInk: 205, mInk: 208, yInk: 196, kInk: 176,
      shadowPress: 22, solidBlackThreshold: 0, solidBlackValue: 18, noiseScale: 0.045, paperNoise: 9,
    };
  }
  // v1 e inkjet (l'inkjet usa solo il profilo per il rumore, lo shader ha la sua strada)
  return {
    spacing: map(amount, 0, 100, 14, 4.4) * exportScale, softness: map(amount, 0, 100, 0.2, 0.06),
    misregister: map(amount, 0, 100, 0.2, 2.2) * exportScale,
    cAngle: radians(15), mAngle: radians(75), yAngle: radians(0), kAngle: radians(45),
    mSpacing: 1, ySpacing: 1, kSpacing: 0.92, cInk: 214, mInk: 204, yInk: 198, kInk: 188,
    shadowPress: 28, solidBlackThreshold: 0, solidBlackValue: 18, noiseScale: 0.07, paperNoise: 12,
  };
}

function getCloudNoiseProfile(mode) {
  if (mode === "c2") return { fiberScale: 0.09, fiberAmount: 18, textureScale: 0.05, textureMix: 0.28, fineMin: 225, fineMax: 255, textureAlpha: 36 };
  if (mode === "c3") return { fiberScale: 0.018, fiberAmount: 46, textureScale: 0.012, textureMix: 0.48, fineMin: 205, fineMax: 255, textureAlpha: 62 };
  return { fiberScale: 0.045, fiberAmount: 34, textureScale: 0.022, textureMix: 0.36, fineMin: 210, fineMax: 255, textureAlpha: 52 };
}

function exposureValue(value, exposureGain, offset, gamma) {
  let v = value / 255;
  v = v * exposureGain + offset;
  v = constrain(v, 0, 1);
  v = Math.pow(v, gamma);
  return constrain(v * 255, 0, 255);
}

function fitImage(srcW, srcH, maxW, maxH, margin = 34) {
  const scale = Math.min((maxW - margin * 2) / srcW, (maxH - margin * 2) / srcH);
  const w = srcW * scale, h = srcH * scale;
  return { x: (maxW - w) / 2, y: (maxH - h) / 2, w, h };
}

// ---------- Geometria: DPI e scala come getFinalRenderGeometry() ----------
// 300 DPI = la pagina «attuale» del sito (lato lungo 2800), 600 = 3500, 900 = 4500.
const DPI_LONG_EDGE = { 300: 0, 600: 3500, 900: 4500 };
const EXPORT_MAX_LONG_EDGE = 2800;
const EXPORT_DPI_MAX_OUTPUT_LONG_EDGE = 12000;

function scanGeometry(aspectW, aspectH, settings) {
  const scale = settings.values.scale / 100;
  const target = DPI_LONG_EDGE[settings.dpi] || 0;
  const long = Math.max(aspectW, aspectH);
  const dims = (edge) => ({ w: Math.max(1, Math.floor((aspectW * edge) / long)), h: Math.max(1, Math.floor((aspectH * edge) / long)) });
  const bounds = (pw, ph) => {
    const fit = fitImage(aspectW, aspectH, pw, ph, 0);
    const w = Math.max(1, Math.floor(fit.w * scale)), h = Math.max(1, Math.floor(fit.h * scale));
    return { x: Math.floor((pw - w) / 2), y: Math.floor((ph - h) / 2), w, h };
  };
  if (!target) {
    const page = dims(EXPORT_MAX_LONG_EDGE), crop = bounds(page.w, page.h);
    return { finalDims: { w: crop.w, h: crop.h }, cropOnly: true, cropContext: null };
  }
  const page = dims(Math.min(target / Math.max(scale, 0.01), EXPORT_DPI_MAX_OUTPUT_LONG_EDGE));
  const crop = bounds(page.w, page.h);
  return { finalDims: { w: crop.w, h: crop.h }, cropOnly: false, cropContext: { x: crop.x, y: crop.y, pageW: page.w, pageH: page.h } };
}

// ---------- Segni vettoriali (sketch.js), con il comportamento di p5 sul canvas 2D ----------
function rgba(v, a) { return `rgba(${v},${v},${v},${constrain(a, 0, 255) / 255})`; }

function p5Line(ctx, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function addScanLines(ctx, x, y, w, h, values) {
  const amount = values.scanLines;
  const spacing = map(amount, 0, 100, 18, 3);
  const alpha = map(amount, 0, 100, 0, 54);
  if (alpha <= 0) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(0, alpha);
  for (let yy = y; yy < y + h; yy += spacing) p5Line(ctx, x, yy, x + w, yy);
  ctx.strokeStyle = rgba(255, alpha * 0.45);
  for (let yy = y + spacing * 0.5; yy < y + h; yy += spacing * 2.2) p5Line(ctx, x, yy, x + w, yy);
  ctx.restore();
}

function addScannerStreaks(ctx, x, y, w, h, values, random, noise) {
  const amount = values.scannerStreaks;
  if (amount <= 0) return;
  const bands = Math.floor(map(amount, 0, 100, 2, 18));
  const maxAlpha = map(amount, 0, 100, 0, 48);
  ctx.save(); ctx.lineCap = "round";
  for (let i = 0; i < bands; i++) {
    const bx = x + noise(i * 8.7, amount * 0.03) * w;
    const bw = random(w * 0.018, w * 0.12);
    const light = random() > 0.45;
    ctx.fillStyle = rgba(light ? 255 : 0, random(maxAlpha * 0.25, maxAlpha));
    ctx.fillRect(bx, y, bw, h);
  }
  const thinLines = Math.floor(map(amount, 0, 100, 6, 52));
  for (let i = 0; i < thinLines; i++) {
    const lx = random(x, x + w);
    const tone = random([0, 255]);
    ctx.strokeStyle = rgba(tone, random(8, maxAlpha));
    ctx.lineWidth = random(0.4, 1.8);
    p5Line(ctx, lx, y, lx + random(-6, 6), y + h);
  }
  ctx.restore();
}

function addEdgeFrame(ctx, w, h) {
  // Esposizione irregolare sui bordi, come una fotocopia.
  ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = rgba(0, 5);
  for (let i = 0; i < 18; i++) ctx.strokeRect(i, i, w - i * 2, h - i * 2);
  ctx.restore();
}

function addDustAndScratches(ctx, x, y, w, h, values, random) {
  const amount = values.noise;
  const marks = Math.floor(map(amount, 0, 120, 12, 180));
  ctx.save(); ctx.lineCap = "round";
  for (let i = 0; i < marks; i++) {
    const px = random(x, x + w), py = random(y, y + h), size = random(0.4, 2.7);
    const tone = random([0, 255]);
    ctx.fillStyle = rgba(tone, random(20, 95));
    ctx.beginPath(); ctx.arc(px, py, size / 2, 0, Math.PI * 2); ctx.fill();
  }
  const scratches = Math.floor(map(amount, 0, 120, 1, 16));
  for (let i = 0; i < scratches; i++) {
    const sx = random(x, x + w), sy = random(y, y + h);
    const tone = random([0, 255]);
    ctx.strokeStyle = rgba(tone, random(20, 65));
    ctx.lineWidth = random(0.4, 1.1);
    p5Line(ctx, sx, sy, sx + random(-18, 18), sy + random(25, 120));
  }
  ctx.restore();
}

// ---------- WebGL2 (machine-gpu.js) ----------
class AbortedRender extends Error { constructor() { super("Render superato"); this.name = "AbortError"; } }

class ScanGPU {
  constructor() {
    this.canvas = document.createElement("canvas"); this.canvas.width = this.canvas.height = 2;
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 non disponibile");
    this.gl = gl; this.programs = {}; this.targets = new Map(); this.fields = new Map(); this.overlaySource = null;
    this.staging = document.createElement("canvas"); this.ctx = this.staging.getContext("2d", { alpha: false });
    this.input = this.texture(); this.overlay = this.texture(); this.curve = this.texture(); this.noise = this.texture(false);
    gl.bindTexture(gl.TEXTURE_2D, this.overlay);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    const values = new Float32Array(4096); let state = FINAL_RENDER_NOISE_SEED >>> 0;
    for (let i = 0; i < 4096; i++) { state = (Math.imul(1664525, state) + 1013904223) >>> 0; values[i] = state / 4294967296; }
    gl.bindTexture(gl.TEXTURE_2D, this.noise); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 256, 16, 0, gl.RED, gl.FLOAT, values);
    for (const [name, fragment] of Object.entries(machineGPUShaders)) this.programs[name] = this.program(fragment);
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; });
  }
  texture(linear = true) {
    const g = this.gl, t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, linear ? g.LINEAR : g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, linear ? g.LINEAR : g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); return t;
  }
  program(fragment) {
    const g = this.gl;
    const compile = (type, code) => { const s = g.createShader(type); g.shaderSource(s, code); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { const m = g.getShaderInfoLog(s); g.deleteShader(s); throw new Error(m); } return s; };
    const v = compile(g.VERTEX_SHADER, machineGPUVertex), f = compile(g.FRAGMENT_SHADER, fragment), p = g.createProgram();
    g.attachShader(p, v); g.attachShader(p, f); g.linkProgram(p); g.deleteShader(v); g.deleteShader(f);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    return { p, locations: new Map() };
  }
  target(key, w, h) {
    let t = this.targets.get(key); const g = this.gl; if (t && t.w === w && t.h === h) return t;
    if (t) { g.deleteTexture(t.tex); g.deleteFramebuffer(t.fbo); }
    t = { w, h, tex: this.texture(), fbo: g.createFramebuffer() };
    g.bindTexture(g.TEXTURE_2D, t.tex); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t.tex, 0);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error("Buffer GPU non disponibile");
    this.targets.set(key, t); return t;
  }
  upload(tex, canvas) {
    const g = this.gl; g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, canvas); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
  }
  pass(name, target, inputs, uniforms) {
    const g = this.gl, program = this.programs[name]; g.useProgram(program.p);
    g.bindFramebuffer(g.FRAMEBUFFER, target?.fbo || null); g.viewport(0, 0, target?.w || this.canvas.width, target?.h || this.canvas.height);
    const loc = (k) => { if (!program.locations.has(k)) program.locations.set(k, g.getUniformLocation(program.p, k)); return program.locations.get(k); };
    let unit = 0;
    for (const [k, t] of Object.entries({ ...inputs, noiseTex: this.noise })) { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, t); g.uniform1i(loc(k), unit++); }
    for (const [k, value] of Object.entries(uniforms)) {
      const l = loc(k); if (l === null) continue;
      if (Array.isArray(value)) g["uniform" + value.length + "fv"](l, value);
      else if (["mode", "bw", "cloud", "blend", "finalBW", "nearestSample", "blurKind"].includes(k)) g.uniform1i(l, value);
      else g.uniform1f(l, value);
    }
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  async wait(job) {
    const g = this.gl, sync = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0); g.flush(); const start = performance.now();
    try {
      while (true) {
        job.check(); if (this.lost) throw new Error("Contesto GPU perso");
        const state = g.clientWaitSync(sync, 0, 0);
        if (state === g.ALREADY_SIGNALED || state === g.CONDITION_SATISFIED) return;
        if (state === g.WAIT_FAILED || performance.now() - start > 15000) throw new Error("Render GPU interrotto");
        await new Promise((r) => setTimeout(r, 4));
      }
    } finally { g.deleteSync(sync); }
  }
  setup(settings, geometry, textures) {
    const v = settings.values, profile = getCMYKScreenProfile(settings.mode, v.cmykScreen, Math.max(1, geometry.finalDims.w / 2250)), cloud = getCloudNoiseProfile(settings.cloud);
    this.common = { fullSize: [geometry.finalDims.w, geometry.finalDims.h], seed: FINAL_RENDER_RANDOM_SEED, cloud: settings.cloud === "off" ? 0 : 1 };
    this.base = { contrast: v.contrast / 100, brightness: (v.brightness + v.luminosity) / 255, vibrance: v.vibrance / 100, grain: v.noise, threshold: v.threshold, blackLift: v.blackLift / 100, fiberAmount: settings.cloud === "off" ? 0 : cloud.fiberAmount, bw: settings.bw ? 1 : 0 };
    this.print = { ...profile, angles: [profile.cAngle, profile.mAngle, profile.yAngle, profile.kAngle], ink: [profile.cInk, profile.mInk, profile.yInk, profile.kInk], amount: v.cmykScreen / 100, blacks: v.printBlacks / 100, smear: v.inkSmear / 100, mode: settings.mode === "inkjet" ? 1 : 0, bw: settings.bw ? 1 : 0, solidThreshold: profile.solidBlackThreshold, solidValue: profile.solidBlackValue };
    this.field = { printNoiseScale: settings.mode === "inkjet" ? 0.028 : profile.noiseScale, fiberScale: cloud.fiberScale };
    const curve = new Uint8Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.round(exposureValue(i, 2 ** v.exposure, v.offset, v.gamma));
    const g = this.gl; g.bindTexture(g.TEXTURE_2D, this.curve); g.texImage2D(g.TEXTURE_2D, 0, g.R8, 256, 1, 0, g.RED, g.UNSIGNED_BYTE, curve);
    const texture = settings.texture === "off" ? null : textures[settings.texture];
    let opacity = v.textureOpacity / 100, overlayRect = [0, 0, 1, 1];
    if (!texture) opacity = 0;
    else {
      if (this.overlaySource !== texture) { this.upload(this.overlay, texture); this.overlaySource = texture; }
      const tw = texture.naturalWidth || texture.width, th = texture.naturalHeight || texture.height, { w, h } = geometry.finalDims, crop = geometry.cropContext;
      const targetW = Math.max(crop?.pageW || 0, w), targetH = Math.max(crop?.pageH || 0, h), scale = Math.max(targetW / tw, targetH / th), sw = w / scale, sh = h / scale;
      const sx = Math.max(0, Math.min(tw - sw, (tw - targetW / scale) / 2 + (crop?.x || 0) / scale)), sy = Math.max(0, Math.min(th - sh, (th - targetH / scale) / 2 + (crop?.y || 0) / scale));
      overlayRect = [sx / tw, 1 - (sy + sh) / th, sw / tw, sh / th];
    }
    this.finish = { cloudScale: cloud.textureScale, cloudMix: cloud.textureMix, cloudFineMin: cloud.fineMin, cloudFineMax: cloud.fineMax, cloudAlpha: cloud.textureAlpha / 255, opacity, overlayRect, blend: Math.max(0, ["screen", "lighten", "add", "overlay", "multiply", "textureOnly"].indexOf(settings.blend)), cleanup: v.whiteCleanup / 100, finalBW: settings.finalBW || v.vibrance === -100 ? 1 : 0 };
  }
  stage(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.staging.width !== w || this.staging.height !== h) { this.staging.width = w; this.staging.height = h; }
  }
  sourceTile(source, geometry, tile, scaleValue) {
    const { w, h, x, y } = tile; this.stage(w, h); const ctx = this.ctx; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    const page = geometry.cropContext ? { w: geometry.cropContext.pageW, h: geometry.cropContext.pageH } : geometry.finalDims;
    const fit = fitImage(source.width, source.height, page.w, page.h, 0), scale = geometry.cropOnly ? 1 : scaleValue / 100;
    const sw = fit.w * scale, sh = fit.h * scale, sx = (page.w - sw) / 2 - (geometry.cropContext?.x || 0) - x, sy = (page.h - sh) / 2 - (geometry.cropContext?.y || 0) - y;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, sw, sh); this.upload(this.input, this.staging);
  }
  blur(input, tmp, output, sigma, w, h, common, blurKind = 1) {
    this.pass("blur", tmp, { imageTex: input }, { ...common, axis: [1 / w, 0], sigma, blurKind });
    this.pass("blur", output, { imageTex: tmp.tex }, { ...common, axis: [0, 1 / h], sigma, blurKind });
  }
  async core(source, targetCtx, geometry, settings, tile, job) {
    this.sourceTile(source, geometry, tile, settings.values.scale); const { w, h, x, y } = tile;
    // Coordinate GL dal basso; lo shader tiene la y dall'alto dell'originale.
    const common = { ...this.common, tileOrigin: [x, geometry.finalDims.h - y - h], tileSize: [w, h] };
    const a = this.target("a", w, h), b = this.target("b", w, h), c = this.target("c", w, h);
    const key = [w, h, x, y, this.field.printNoiseScale, this.field.fiberScale, this.common.cloud].join(":"); let field = this.fields.get(key);
    if (!field) {
      field = this.target("field:" + key, w, h); this.pass("field", field, {}, { ...common, ...this.field }); this.fields.set(key, field);
      while (this.fields.size > 6) { const old = this.fields.keys().next().value, t = this.fields.get(old); this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fbo); this.targets.delete("field:" + old); this.fields.delete(old); }
    }
    this.pass("base", a, { imageTex: this.input, fieldTex: field.tex }, { ...common, ...this.base });
    this.pass("print", b, { imageTex: a.tex, fieldTex: field.tex }, { ...common, ...this.print });
    const mini = settings.values.miniPrint / 100;
    if (mini > 0) {
      const scale = 0.9 - 0.81 * mini, stepX = geometry.finalDims.w / Math.max(18, Math.floor(geometry.finalDims.w * scale)), stepY = geometry.finalDims.h / Math.max(18, Math.floor(geometry.finalDims.h * scale));
      const startX = Math.floor(x / stepX), startY = Math.floor(common.tileOrigin[1] / stepY), sw = Math.ceil((x + w) / stepX) - startX, sh = Math.ceil((common.tileOrigin[1] + h) / stepY) - startY;
      const sa = this.target("small-a", sw, sh), sb = this.target("small-b", sw, sh); const rect = [(startX * stepX - x) / w, (startY * stepY - common.tileOrigin[1]) / h, (sw * stepX) / w, (sh * stepY) / h];
      const g = this.gl;
      g.bindTexture(g.TEXTURE_2D, b.tex); g.generateMipmap(g.TEXTURE_2D); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
      this.pass("copy", sa, { imageTex: b.tex }, { rect, nearestSample: 0 });
      g.bindTexture(g.TEXTURE_2D, b.tex); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      this.blur(sa.tex, sb, sa, 0.2 + 1.2 * mini, sw, sh, common);
      this.pass("copy", a, { imageTex: sa.tex }, { rect: [(x / stepX - startX) / sw, (common.tileOrigin[1] / stepY - startY) / sh, w / stepX / sw, h / stepY / sh], nearestSample: 1 });
      this.blur(a.tex, b, a, 0.15 + 0.65 * mini, w, h, common);
    } else this.pass("copy", a, { imageTex: b.tex }, { rect: [0, 0, 1, 1], nearestSample: 0 });
    this.pass("exposure", b, { imageTex: a.tex, fieldTex: field.tex, curveTex: this.curve }, { ...common, mini });
    if (settings.values.blur > 0) this.blur(b.tex, c, b, settings.values.blur, w, h, common, 0);
    this.pass("warp", null, { imageTex: b.tex }, { ...common, distortion: settings.values.distortion });
    await this.wait(job);
    targetCtx.drawImage(this.canvas, tile.left, tile.top, tile.copyW, tile.copyH, tile.copyX, tile.copyY, tile.copyW, tile.copyH);
  }
  async finishTile(targetCanvas, targetCtx, geometry, tile, job) {
    const { copyX: x, copyY: y, copyW: w, copyH: h } = tile; this.stage(w, h);
    this.ctx.drawImage(targetCanvas, x, y, w, h, 0, 0, w, h); this.upload(this.input, this.staging);
    this.pass("finish", null, { imageTex: this.input, overlayTex: this.overlay }, { ...this.common, ...this.finish, tileOrigin: [x, geometry.finalDims.h - y - h], tileSize: [w, h] });
    await this.wait(job); targetCtx.drawImage(this.canvas, x, y);
  }
  trim() {
    const g = this.gl;
    for (const [key, t] of this.targets) if (key.startsWith("field:")) { g.deleteTexture(t.tex); g.deleteFramebuffer(t.fbo); this.targets.delete(key); }
    this.fields.clear();
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; const g = this.gl;
    for (const t of this.targets.values()) { g.deleteTexture(t.tex); g.deleteFramebuffer(t.fbo); }
    this.targets.clear(); this.fields.clear();
    for (const t of [this.input, this.overlay, this.curve, this.noise]) g.deleteTexture(t);
    for (const p of Object.values(this.programs)) g.deleteProgram(p.p);
    g.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function scanTiles(width, height, values) {
  const tiles = [], mini = (values.miniPrint || 0) / 100, miniScale = 0.9 - 0.81 * mini;
  const halo = Math.max(48, Math.min(256, Math.ceil(((values.inkSmear || 0) / 100) * 21 * Math.max(1, width / 2250) + (mini > 0 ? 4 / miniScale + 3 : 0) + (values.blur || 0) * 3.5 + (values.distortion || 0) * 0.26 + 4))), edge = 1024;
  for (let y = 0; y < height; y += edge) for (let x = 0; x < width; x += edge) {
    const left = Math.min(halo, x), top = Math.min(halo, y), copyW = Math.min(edge, width - x), copyH = Math.min(edge, height - y);
    tiles.push({ x: x - left, y: y - top, w: copyW + left + Math.min(halo, width - x - copyW), h: copyH + top + Math.min(halo, height - y - copyH), left, top, copyX: x, copyY: y, copyW, copyH });
  }
  return tiles;
}

let scanGPUInstance = null;
function scanGPU() {
  if (scanGPUInstance && !scanGPUInstance.lost && !scanGPUInstance.disposed) return scanGPUInstance;
  scanGPUInstance?.dispose();
  scanGPUInstance = new ScanGPU();
  return scanGPUInstance;
}

// Una scansione completa. `job.check()` lancia AbortError se il render e' stato superato.
async function renderScan(source, settings, textures, job = { check() {} }, onProgress = () => {}) {
  const gpu = scanGPU();
  const geometry = scanGeometry(source.width, source.height, settings);
  const { w, h } = geometry.finalDims;
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  gpu.setup(settings, geometry, textures);
  const tiles = scanTiles(w, h, settings.values);
  ctx.fillStyle = "rgb(248,248,248)"; ctx.fillRect(0, 0, w, h);
  try {
    for (let i = 0; i < tiles.length; i++) { job.check(); onProgress(Math.round((i / tiles.length) * 65)); await gpu.core(source, ctx, geometry, settings, tiles[i], job); }
    const random = p5Random(FINAL_RENDER_RANDOM_SEED), noise = p5Noise(FINAL_RENDER_NOISE_SEED);
    addScanLines(ctx, 0, 0, w, h, settings.values);
    addScannerStreaks(ctx, 0, 0, w, h, settings.values, random, noise);
    addEdgeFrame(ctx, w, h);
    addDustAndScratches(ctx, 0, 0, w, h, settings.values, random);
    for (let i = 0; i < tiles.length; i++) { job.check(); onProgress(65 + Math.round((i / tiles.length) * 35)); await gpu.finishTile(canvas, ctx, geometry, tiles[i], job); }
  } catch (error) {
    if (error.name !== "AbortError") { scanGPUInstance = null; gpu.dispose(); }
    throw error;
  }
  if (w * h > 16e6) gpu.trim();
  onProgress(100);
  return { canvas, geometry };
}

const ScanEngine = { renderScan, scanGeometry, AbortedRender };
