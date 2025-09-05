(function() {
  const e = document.createElement("link").relList;
  if (e && e.supports && e.supports("modulepreload")) return;
  for (const r of document.querySelectorAll('link[rel="modulepreload"]')) i(r);
  new MutationObserver((r) => {
    for (const n of r) if (n.type === "childList") for (const a of n.addedNodes) a.tagName === "LINK" && a.rel === "modulepreload" && i(a);
  }).observe(document, { childList: true, subtree: true });
  function t(r) {
    const n = {};
    return r.integrity && (n.integrity = r.integrity), r.referrerPolicy && (n.referrerPolicy = r.referrerPolicy), r.crossOrigin === "use-credentials" ? n.credentials = "include" : r.crossOrigin === "anonymous" ? n.credentials = "omit" : n.credentials = "same-origin", n;
  }
  function i(r) {
    if (r.ep) return;
    r.ep = true;
    const n = t(r);
    fetch(r.href, n);
  }
})();
class C {
  currentState = "BOOT";
  transitions = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Map();
  constructor() {
    this.transitions.set("BOOT", ["IDLE"]), this.transitions.set("IDLE", ["FADE_IN"]), this.transitions.set("FADE_IN", ["RUN"]), this.transitions.set("RUN", ["TRANSITION", "FADE_OUT"]), this.transitions.set("TRANSITION", ["RUN", "FADE_OUT"]), this.transitions.set("FADE_OUT", ["BLACK"]), this.transitions.set("BLACK", ["FADE_IN"]);
  }
  getCurrentState() {
    return this.currentState;
  }
  canTransition(e) {
    const t = this.transitions.get(this.currentState);
    return t ? t.includes(e) : false;
  }
  transitionTo(e) {
    if (!this.canTransition(e)) return console.warn(`Invalid transition from ${this.currentState} to ${e}`), false;
    const t = this.currentState;
    this.currentState = e, console.log(`State transition: ${t} -> ${e}`);
    const i = this.listeners.get(e);
    return i && i.forEach((r) => r()), true;
  }
  onStateEnter(e, t) {
    this.listeners.has(e) || this.listeners.set(e, []), this.listeners.get(e).push(t);
  }
  reset() {
    this.currentState = "BOOT";
  }
}
const U = { cycleSeconds: 30, gridTileSize: 32, fadeInMs: 1200, transitionMs: 2e3, fadeOutMs: 600, fftSize: 2048, silenceRms: 0.01, silenceHoldMs: 3e3, resumeHoldMs: 500, distortionStrength: 1, lowBand: [20, 200], midBand: [200, 2e3], highBand: [2e3, 8e3] };
function y(s, e, t) {
  return Math.min(Math.max(s, e), t);
}
function S(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
}
class I {
  constructor(e) {
    this.config = e, this.fftBuffer = new Float32Array(new ArrayBuffer(e.fftSize / 2 * 4)), this.timeBuffer = new Float32Array(new ArrayBuffer(e.fftSize * 4));
  }
  audioContext = null;
  analyser = null;
  gainNode = null;
  source = null;
  fftBuffer;
  timeBuffer;
  isActive = false;
  silenceStartTime = null;
  soundStartTime = null;
  lastRms = 0;
  lowEma = 0;
  midEma = 0;
  highEma = 0;
  emaAlpha = 0.1;
  async initialize(e) {
    try {
      this.audioContext = new AudioContext(), this.source = this.audioContext.createMediaStreamSource(e), this.gainNode = this.audioContext.createGain(), this.analyser = this.audioContext.createAnalyser(), this.analyser.fftSize = this.config.fftSize, this.analyser.smoothingTimeConstant = 0.75, this.analyser.minDecibels = -90, this.analyser.maxDecibels = -10, this.source.connect(this.gainNode), this.gainNode.connect(this.analyser), this.isActive = true, console.log("Audio analyzer initialized");
    } catch (t) {
      throw console.error("Error initializing audio analyzer:", t), t;
    }
  }
  getAudioBands() {
    if (!this.analyser || !this.isActive) return { low: 0, mid: 0, high: 0 };
    const e = new Float32Array(this.fftBuffer.length);
    this.analyser.getFloatFrequencyData(e);
    const t = this.audioContext.sampleRate, i = e.length, r = t / 2 / i, n = Math.floor(this.config.lowBand[0] / r), a = Math.floor(this.config.lowBand[1] / r), o = Math.floor(this.config.midBand[0] / r), l = Math.floor(this.config.midBand[1] / r), u = Math.floor(this.config.highBand[0] / r), h = Math.floor(this.config.highBand[1] / r);
    let d = 0, f = 0, g = 0, m = 0, p = 0, x = 0;
    for (let c = n; c <= a && c < i; c++) d += Math.pow(10, e[c] / 20), m++;
    for (let c = o; c <= l && c < i; c++) f += Math.pow(10, e[c] / 20), p++;
    for (let c = u; c <= h && c < i; c++) g += Math.pow(10, e[c] / 20), x++;
    const B = m > 0 ? d / m : 0, b = p > 0 ? f / p : 0, E = x > 0 ? g / x : 0;
    this.lowEma = this.lowEma * (1 - this.emaAlpha) + B * this.emaAlpha, this.midEma = this.midEma * (1 - this.emaAlpha) + b * this.emaAlpha, this.highEma = this.highEma * (1 - this.emaAlpha) + E * this.emaAlpha;
    const T = (c) => c / (1 + Math.abs(c));
    return { low: T(this.lowEma), mid: T(this.midEma), high: T(this.highEma) };
  }
  getRMS() {
    if (!this.analyser || !this.isActive) return 0;
    const e = new Float32Array(this.timeBuffer.length);
    this.analyser.getFloatTimeDomainData(e);
    let t = 0;
    for (let i = 0; i < e.length; i++) {
      const r = e[i];
      t += r * r;
    }
    return this.lastRms = Math.sqrt(t / e.length), this.lastRms;
  }
  checkSilence() {
    const e = this.getRMS(), t = performance.now();
    return e < this.config.silenceRms ? (this.silenceStartTime === null && (this.silenceStartTime = t), this.soundStartTime = null, { isSilent: t - this.silenceStartTime >= this.config.silenceHoldMs, shouldResume: false }) : e > this.config.silenceRms * 1.25 ? (this.soundStartTime === null && (this.soundStartTime = t), this.silenceStartTime = null, { isSilent: false, shouldResume: t - this.soundStartTime >= this.config.resumeHoldMs }) : { isSilent: this.silenceStartTime !== null, shouldResume: this.soundStartTime !== null };
  }
  setGain(e) {
    this.gainNode && this.gainNode.gain.setValueAtTime(e, this.audioContext.currentTime);
  }
  destroy() {
    this.isActive = false, this.source && (this.source.disconnect(), this.source = null), this.gainNode && (this.gainNode.disconnect(), this.gainNode = null), this.analyser && (this.analyser.disconnect(), this.analyser = null), this.audioContext && this.audioContext.state !== "closed" && (this.audioContext.close(), this.audioContext = null), console.log("Audio analyzer destroyed");
  }
}
async function R() {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((e) => e.kind === "audioinput").map((e) => ({ deviceId: e.deviceId, label: e.label || `Microphone ${e.deviceId.slice(0, 8)}`, kind: e.kind }));
  } catch (s) {
    return console.error("Error enumerating audio devices:", s), [];
  }
}
async function A(s) {
  const e = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
  try {
    return await navigator.mediaDevices.getUserMedia(e);
  } catch (t) {
    throw console.error("Error getting audio stream:", t), t;
  }
}
async function _() {
  try {
    return (await A()).getTracks().forEach((e) => e.stop()), true;
  } catch (s) {
    return console.error("Audio permission denied:", s), false;
  }
}
function w(s) {
  s.getTracks().forEach((e) => e.stop());
}
class M {
  imageUrls = [];
  cache = /* @__PURE__ */ new Map();
  currentIndex = 0;
  async initialize() {
    try {
      const e = await fetch("./images.json");
      this.imageUrls = await e.json(), console.log(`Loaded ${this.imageUrls.length} image URLs`);
    } catch (e) {
      console.error("Error loading image URLs:", e), this.imageUrls = ["https://picsum.photos/1920/1080?random=1", "https://picsum.photos/1920/1080?random=2", "https://picsum.photos/1920/1080?random=3"];
    }
  }
  async loadImage(e) {
    if (this.cache.has(e)) return this.cache.get(e);
    try {
      console.log(`Loading image: ${e}`);
      const t = await fetch(e);
      if (!t.ok) throw new Error(`HTTP ${t.status}: ${t.statusText}`);
      const i = await t.blob(), r = await createImageBitmap(i, { premultiplyAlpha: "premultiply", colorSpaceConversion: "default" }), n = { bitmap: r, url: e, width: r.width, height: r.height };
      return this.cache.set(e, n), console.log(`Image loaded: ${e} (${r.width}x${r.height})`), n;
    } catch (t) {
      throw console.error(`Error loading image ${e}:`, t), t;
    }
  }
  async loadRandomImage() {
    if (this.imageUrls.length === 0) throw new Error("No image URLs available");
    const e = Math.floor(Math.random() * this.imageUrls.length), t = this.imageUrls[e];
    return this.loadImage(t);
  }
  async loadNextImage() {
    if (this.imageUrls.length === 0) throw new Error("No image URLs available");
    this.currentIndex = (this.currentIndex + 1) % this.imageUrls.length;
    const e = this.imageUrls[this.currentIndex];
    return this.loadImage(e);
  }
  async preloadNextImage() {
    if (this.imageUrls.length === 0) throw new Error("No image URLs available");
    const e = (this.currentIndex + 1) % this.imageUrls.length, t = this.imageUrls[e];
    return this.loadImage(t);
  }
  clearCache() {
    for (const [e, t] of this.cache) t.bitmap.close();
    this.cache.clear(), console.log("Image cache cleared");
  }
  getCacheSize() {
    return this.cache.size;
  }
  getImageCount() {
    return this.imageUrls.length;
  }
}
async function G(s) {
  try {
    if (!navigator.gpu) return console.warn("WebGPU not supported"), null;
    const e = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!e) return console.warn("No WebGPU adapter found"), null;
    console.log("WebGPU adapter info:", { vendor: e.info?.vendor || "Unknown", architecture: e.info?.architecture || "Unknown", device: e.info?.device || "Unknown" });
    const t = await e.requestDevice({ requiredFeatures: [], requiredLimits: { maxTextureDimension2D: 2048, maxBindGroups: 4 } }), i = s.getContext("webgpu");
    if (!i) return console.error("Failed to get WebGPU context"), null;
    const r = navigator.gpu.getPreferredCanvasFormat();
    return i.configure({ device: t, format: r, alphaMode: "premultiplied" }), t.addEventListener("uncapturederror", (n) => {
      console.error("WebGPU uncaptured error:", n.error);
    }), console.log("WebGPU initialized successfully"), console.log("Canvas format:", r), console.log("Device limits:", t.limits), { adapter: e, device: t, context: i, format: r, canvas: s };
  } catch (e) {
    return console.error("Error initializing WebGPU:", e), null;
  }
}
async function z() {
  if (!navigator.gpu) return { supported: false, features: [], limits: {} };
  try {
    const s = await navigator.gpu.requestAdapter();
    if (!s) return { supported: false, features: [], limits: {} };
    const e = await s.requestDevice();
    return { supported: true, features: Array.from(e.features), limits: { maxTextureDimension2D: e.limits.maxTextureDimension2D, maxBindGroups: e.limits.maxBindGroups, maxBufferSize: e.limits.maxBufferSize, maxComputeWorkgroupSizeX: e.limits.maxComputeWorkgroupSizeX, maxComputeWorkgroupSizeY: e.limits.maxComputeWorkgroupSizeY } };
  } catch (s) {
    return console.error("Error checking WebGPU features:", s), { supported: false, features: [], limits: {} };
  }
}
class P {
  device;
  currentTexture = null;
  nextTexture = null;
  grayscaleTexture = null;
  fftTexture = null;
  constructor(e) {
    this.device = e.device, this.initializeFftTexture();
  }
  initializeFftTexture() {
    this.fftTexture = this.device.createTexture({ size: [1, 1, 1], format: "rgba32float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  }
  createTextureFromImage(e) {
    const t = this.device.createTexture({ size: [e.width, e.height, 1], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    return this.device.queue.copyExternalImageToTexture({ source: e.bitmap }, { texture: t }, [e.width, e.height, 1]), t;
  }
  createGrayscaleTexture(e, t) {
    return this.device.createTexture({ size: [e, t, 1], format: "rgba8unorm", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
  }
  setCurrentImage(e) {
    this.currentTexture && this.currentTexture.destroy(), this.currentTexture = this.createTextureFromImage(e), this.grayscaleTexture && this.grayscaleTexture.destroy(), this.grayscaleTexture = this.createGrayscaleTexture(e.width, e.height);
  }
  setNextImage(e) {
    this.nextTexture && this.nextTexture.destroy(), this.nextTexture = this.createTextureFromImage(e);
  }
  swapTextures() {
    const e = this.currentTexture;
    this.currentTexture = this.nextTexture, this.nextTexture = e;
  }
  updateFftData(e, t, i) {
    if (!this.fftTexture) return;
    const r = new Float32Array([e, t, i, 1]);
    this.device.queue.writeTexture({ texture: this.fftTexture }, r, { bytesPerRow: 4 * 4 }, { width: 1, height: 1, depthOrArrayLayers: 1 });
  }
  getCurrentTexture() {
    return this.currentTexture;
  }
  getNextTexture() {
    return this.nextTexture;
  }
  getGrayscaleTexture() {
    return this.grayscaleTexture;
  }
  getFftTexture() {
    return this.fftTexture;
  }
  destroy() {
    this.currentTexture && (this.currentTexture.destroy(), this.currentTexture = null), this.nextTexture && (this.nextTexture.destroy(), this.nextTexture = null), this.grayscaleTexture && (this.grayscaleTexture.destroy(), this.grayscaleTexture = null), this.fftTexture && (this.fftTexture.destroy(), this.fftTexture = null);
  }
}
class F {
  device;
  vertexBuffer = null;
  instanceBuffer = null;
  uniformBuffer = null;
  currentCols = 0;
  currentRows = 0;
  constructor(e) {
    this.device = e.device, this.createVertexBuffer(), this.createUniformBuffer();
  }
  createVertexBuffer() {
    const e = new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, 1, 1, 1, 0, -1, -1, 0, 1, 1, 1, 1, 0, -1, 1, 0, 0]);
    this.vertexBuffer = this.device.createBuffer({ size: e.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true }), new Float32Array(this.vertexBuffer.getMappedRange()).set(e), this.vertexBuffer.unmap();
  }
  createUniformBuffer() {
    this.uniformBuffer = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }
  createInstanceBuffer(e, t, i, r) {
    const n = e * t;
    if (this.currentCols !== e || this.currentRows !== t) {
      this.instanceBuffer && this.instanceBuffer.destroy();
      const a = n * 16;
      this.instanceBuffer = this.device.createBuffer({ size: a, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
      const o = new Float32Array(this.instanceBuffer.getMappedRange());
      for (let l = 0; l < t; l++) for (let u = 0; u < e; u++) {
        const h = (l * e + u) * 4, d = u, f = l, g = 0.5 + 0.5 * Math.sin((u + l) * 0.1);
        o[h + 0] = d, o[h + 1] = f, o[h + 2] = g, o[h + 3] = 0;
      }
      this.instanceBuffer.unmap(), this.currentCols = e, this.currentRows = t;
    }
  }
  updateUniforms(e) {
    if (!this.uniformBuffer) return;
    const t = new Float32Array([e.time, e.alpha, e.cols, e.rows, e.imgW, e.imgH, e.strength, e.pad]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, t);
  }
  updateInstanceBrightness(e, t, i) {
    if (!this.instanceBuffer || this.currentCols !== e || this.currentRows !== t) return;
    const r = e * t, n = new Float32Array(r * 4);
    for (let a = 0; a < t; a++) for (let o = 0; o < e; o++) {
      const l = (a * e + o) * 4;
      n[l + 0] = o, n[l + 1] = a;
      const u = i(o / e, a / t);
      n[l + 2] = u, n[l + 3] = 0;
    }
    this.device.queue.writeBuffer(this.instanceBuffer, 0, n);
  }
  getVertexBuffer() {
    return this.vertexBuffer;
  }
  getInstanceBuffer() {
    return this.instanceBuffer;
  }
  getUniformBuffer() {
    return this.uniformBuffer;
  }
  getTileCount() {
    return this.currentCols * this.currentRows;
  }
  destroy() {
    this.vertexBuffer && (this.vertexBuffer.destroy(), this.vertexBuffer = null), this.instanceBuffer && (this.instanceBuffer.destroy(), this.instanceBuffer = null), this.uniformBuffer && (this.uniformBuffer.destroy(), this.uniformBuffer = null);
  }
}
async function v(s) {
  return (await fetch(s)).text();
}
async function D(s) {
  const { device: e, format: t } = s, i = await v("/src/gpu/shaders/grayscale.comp.wgsl"), r = await v("/src/gpu/shaders/mosaic.vert.wgsl"), n = await v("/src/gpu/shaders/mosaic.frag.wgsl"), a = e.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" }), o = e.createBindGroupLayout({ label: "Uniform Bind Group Layout", entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }, { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } }] }), l = e.createBindGroupLayout({ label: "Texture Bind Group Layout", entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} }, { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }, { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }, { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } }] }), u = e.createBindGroupLayout({ label: "Grayscale Compute Bind Group Layout", entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: "float" } }, { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rgba8unorm" } }] }), h = e.createComputePipeline({ label: "Grayscale Compute Pipeline", layout: e.createPipelineLayout({ bindGroupLayouts: [u] }), compute: { module: e.createShaderModule({ label: "Grayscale Compute Shader", code: i }), entryPoint: "main" } }), d = e.createRenderPipeline({ label: "Mosaic Render Pipeline", layout: e.createPipelineLayout({ bindGroupLayouts: [o, l] }), vertex: { module: e.createShaderModule({ label: "Mosaic Vertex Shader", code: r }), entryPoint: "main", buffers: [{ arrayStride: 16, attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }, { format: "float32x2", offset: 8, shaderLocation: 1 }] }] }, fragment: { module: e.createShaderModule({ label: "Mosaic Fragment Shader", code: n }), entryPoint: "main", targets: [{ format: t, blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } } }] }, primitive: { topology: "triangle-list", cullMode: "back" } });
  return { grayscaleComputePipeline: h, mosaicRenderPipeline: d, sampler: a, uniformBindGroupLayout: o, textureBindGroupLayout: l, grayscaleBindGroupLayout: u };
}
class L {
  deviceInfo;
  textureManager;
  bufferManager;
  pipelines = null;
  uniformBindGroup = null;
  textureBindGroup = null;
  grayscaleBindGroup = null;
  constructor(e) {
    this.deviceInfo = e, this.textureManager = new P(e), this.bufferManager = new F(e);
  }
  async initialize() {
    try {
      this.pipelines = await D(this.deviceInfo), console.log("WebGPU renderer initialized");
    } catch (e) {
      throw console.error("Error initializing WebGPU renderer:", e), e;
    }
  }
  setCurrentImage(e, t) {
    this.textureManager.setCurrentImage(e), this.updateTileGrid(e, t), this.updateBindGroups();
  }
  setNextImage(e) {
    this.textureManager.setNextImage(e), this.updateBindGroups();
  }
  updateTileGrid(e, t) {
    const i = Math.ceil(e.width / t), r = Math.ceil(e.height / t);
    this.bufferManager.createInstanceBuffer(i, r, e.width, e.height);
  }
  updateBindGroups() {
    if (!this.pipelines) return;
    const e = this.bufferManager.getUniformBuffer(), t = this.bufferManager.getInstanceBuffer(), i = this.textureManager.getCurrentTexture(), r = this.textureManager.getNextTexture(), n = this.textureManager.getFftTexture(), a = this.textureManager.getGrayscaleTexture();
    !e || !t || !i || !n || (this.uniformBindGroup = this.deviceInfo.device.createBindGroup({ label: "Uniform Bind Group", layout: this.pipelines.uniformBindGroupLayout, entries: [{ binding: 0, resource: { buffer: e } }, { binding: 1, resource: { buffer: t } }] }), r && (this.textureBindGroup = this.deviceInfo.device.createBindGroup({ label: "Texture Bind Group", layout: this.pipelines.textureBindGroupLayout, entries: [{ binding: 0, resource: this.pipelines.sampler }, { binding: 1, resource: i.createView() }, { binding: 2, resource: r.createView() }, { binding: 3, resource: n.createView() }] })), a && (this.grayscaleBindGroup = this.deviceInfo.device.createBindGroup({ label: "Grayscale Bind Group", layout: this.pipelines.grayscaleBindGroupLayout, entries: [{ binding: 0, resource: i.createView() }, { binding: 1, resource: a.createView() }] })));
  }
  render(e, t) {
    if (!this.pipelines || !this.uniformBindGroup || !this.textureBindGroup) return;
    this.bufferManager.updateUniforms(e), this.textureManager.updateFftData(t.low, t.mid, t.high);
    const i = this.deviceInfo.device.createCommandEncoder({ label: "Render Command Encoder" });
    if (this.grayscaleBindGroup) {
      const a = i.beginComputePass({ label: "Grayscale Compute Pass" });
      a.setPipeline(this.pipelines.grayscaleComputePipeline), a.setBindGroup(0, this.grayscaleBindGroup);
      const o = Math.ceil(e.imgW / 16), l = Math.ceil(e.imgH / 16);
      a.dispatchWorkgroups(o, l), a.end();
    }
    const r = i.beginRenderPass({ label: "Mosaic Render Pass", colorAttachments: [{ view: this.deviceInfo.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }] });
    r.setPipeline(this.pipelines.mosaicRenderPipeline), r.setBindGroup(0, this.uniformBindGroup), r.setBindGroup(1, this.textureBindGroup);
    const n = this.bufferManager.getVertexBuffer();
    if (n) {
      r.setVertexBuffer(0, n);
      const a = this.bufferManager.getTileCount();
      r.draw(6, a);
    }
    r.end(), this.deviceInfo.device.queue.submit([i.finish()]);
  }
  swapTextures() {
    this.textureManager.swapTextures(), this.updateBindGroups();
  }
  resize(e, t) {
    this.deviceInfo.canvas.width = e, this.deviceInfo.canvas.height = t, this.deviceInfo.context.configure({ device: this.deviceInfo.device, format: this.deviceInfo.format, alphaMode: "premultiplied" });
  }
  destroy() {
    this.textureManager.destroy(), this.bufferManager.destroy(), console.log("WebGPU renderer destroyed");
  }
}
const N = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_alpha;
uniform float u_cols;
uniform float u_rows;
uniform float u_imgW;
uniform float u_imgH;
uniform float u_strength;

in vec2 a_position;
in vec2 a_uv;
in vec4 a_instance; // x, y, brightness, pad

out vec2 v_uv;
out vec2 v_tileUV;
out float v_brightness;

void main() {
  // Calculate tile position
  vec2 tileSize = 2.0 / vec2(u_cols, u_rows);
  vec2 tilePos = a_instance.xy * tileSize - 1.0 + tileSize * 0.5;
  
  // Scale vertex position to tile size
  vec2 localPos = a_position * tileSize * 0.5;
  vec2 worldPos = tilePos + localPos;
  
  // Calculate UV coordinates for the tile
  vec2 tileUV = a_instance.xy / vec2(u_cols, u_rows);
  vec2 localUV = a_uv / vec2(u_cols, u_rows);
  vec2 finalUV = tileUV + localUV;
  
  gl_Position = vec4(worldPos, 0.0, 1.0);
  v_uv = finalUV;
  v_tileUV = a_uv;
  v_brightness = a_instance.z;
}`, O = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_alpha;
uniform float u_strength;
uniform sampler2D u_currentTex;
uniform sampler2D u_nextTex;
uniform vec3 u_audioBands; // low, mid, high

in vec2 v_uv;
in vec2 v_tileUV;
in float v_brightness;

out vec4 fragColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 curlNoise(vec2 p) {
  float eps = 0.001;
  float x = hash(p + vec2(eps, 0.0)) - hash(p - vec2(eps, 0.0));
  float y = hash(p + vec2(0.0, eps)) - hash(p - vec2(0.0, eps));
  return vec2(y, -x) / (2.0 * eps);
}

void main() {
  vec3 bands = u_audioBands;
  float low = bands.r;
  float mid = bands.g;
  float high = bands.b;
  
  float brightness = v_brightness;
  
  // Flow field for smooth motion
  vec2 flow = curlNoise(v_uv * 2.0 + u_time * 0.2) * 0.002;
  
  // Audio-reactive distortion
  float dx = u_strength * ((0.6 * low + 0.2 * mid) * mix(0.3, 1.0, brightness)) * 0.01;
  float dy = u_strength * ((0.6 * mid + 0.2 * high) * mix(1.0, 0.4, brightness)) * 0.01;
  
  // Apply distortion and flow
  vec2 distortedUV = v_uv + vec2(dx, dy) + flow;
  distortedUV = clamp(distortedUV, vec2(0.0), vec2(1.0));
  
  // Sample textures with grayscale conversion
  vec4 currentColor = texture(u_currentTex, distortedUV);
  vec4 nextColor = texture(u_nextTex, distortedUV);
  
  // Convert to grayscale
  float currentLum = dot(currentColor.rgb, vec3(0.299, 0.587, 0.114));
  float nextLum = dot(nextColor.rgb, vec3(0.299, 0.587, 0.114));
  
  vec3 currentGray = vec3(currentLum);
  vec3 nextGray = vec3(nextLum);
  
  // Transition blend
  vec3 blendedColor = mix(currentGray, nextGray, u_alpha);
  
  // Apply global alpha for fade in/out
  fragColor = vec4(blendedColor, 1.0) * u_alpha;
}`;
class V {
  gl;
  program = null;
  vao = null;
  vertexBuffer = null;
  instanceBuffer = null;
  currentTexture = null;
  nextTexture = null;
  uniforms = {};
  currentCols = 0;
  currentRows = 0;
  constructor(e) {
    const t = e.getContext("webgl2", { alpha: true, premultipliedAlpha: true });
    if (!t) throw new Error("WebGL2 not supported");
    this.gl = t;
  }
  async initialize() {
    const e = this.gl, t = this.createShader(e.VERTEX_SHADER, N), i = this.createShader(e.FRAGMENT_SHADER, O);
    if (!t || !i) throw new Error("Failed to create shaders");
    if (this.program = e.createProgram(), !this.program) throw new Error("Failed to create shader program");
    if (e.attachShader(this.program, t), e.attachShader(this.program, i), e.linkProgram(this.program), !e.getProgramParameter(this.program, e.LINK_STATUS)) {
      const r = e.getProgramInfoLog(this.program);
      throw new Error(`Shader program link error: ${r}`);
    }
    this.uniforms = { u_time: e.getUniformLocation(this.program, "u_time"), u_alpha: e.getUniformLocation(this.program, "u_alpha"), u_cols: e.getUniformLocation(this.program, "u_cols"), u_rows: e.getUniformLocation(this.program, "u_rows"), u_imgW: e.getUniformLocation(this.program, "u_imgW"), u_imgH: e.getUniformLocation(this.program, "u_imgH"), u_strength: e.getUniformLocation(this.program, "u_strength"), u_currentTex: e.getUniformLocation(this.program, "u_currentTex"), u_nextTex: e.getUniformLocation(this.program, "u_nextTex"), u_audioBands: e.getUniformLocation(this.program, "u_audioBands") }, this.createBuffers(), e.enable(e.BLEND), e.blendFunc(e.SRC_ALPHA, e.ONE_MINUS_SRC_ALPHA), console.log("WebGL2 renderer initialized");
  }
  createShader(e, t) {
    const i = this.gl, r = i.createShader(e);
    if (!r) return null;
    if (i.shaderSource(r, t), i.compileShader(r), !i.getShaderParameter(r, i.COMPILE_STATUS)) {
      const n = i.getShaderInfoLog(r);
      return console.error(`Shader compile error: ${n}`), i.deleteShader(r), null;
    }
    return r;
  }
  createBuffers() {
    const e = this.gl;
    this.vao = e.createVertexArray(), e.bindVertexArray(this.vao);
    const t = new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, 1, 1, 1, 0, -1, -1, 0, 1, 1, 1, 1, 0, -1, 1, 0, 0]);
    this.vertexBuffer = e.createBuffer(), e.bindBuffer(e.ARRAY_BUFFER, this.vertexBuffer), e.bufferData(e.ARRAY_BUFFER, t, e.STATIC_DRAW), e.enableVertexAttribArray(0), e.vertexAttribPointer(0, 2, e.FLOAT, false, 16, 0), e.enableVertexAttribArray(1), e.vertexAttribPointer(1, 2, e.FLOAT, false, 16, 8), e.bindVertexArray(null);
  }
  createTextureFromImage(e) {
    const t = this.gl, i = t.createTexture();
    if (!i) throw new Error("Failed to create texture");
    return t.bindTexture(t.TEXTURE_2D, i), t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, t.RGBA, t.UNSIGNED_BYTE, e.bitmap), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.CLAMP_TO_EDGE), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR), t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR), i;
  }
  setCurrentImage(e, t) {
    this.currentTexture && this.gl.deleteTexture(this.currentTexture), this.currentTexture = this.createTextureFromImage(e), this.updateTileGrid(e, t);
  }
  setNextImage(e) {
    this.nextTexture && this.gl.deleteTexture(this.nextTexture), this.nextTexture = this.createTextureFromImage(e);
  }
  updateTileGrid(e, t) {
    const i = Math.ceil(e.width / t), r = Math.ceil(e.height / t);
    this.currentCols = i, this.currentRows = r;
    const n = i * r, a = new Float32Array(n * 4);
    for (let o = 0; o < r; o++) for (let l = 0; l < i; l++) {
      const u = (o * i + l) * 4, h = 0.5 + 0.5 * Math.sin((l + o) * 0.1);
      a[u + 0] = l, a[u + 1] = o, a[u + 2] = h, a[u + 3] = 0;
    }
    this.instanceBuffer && this.gl.deleteBuffer(this.instanceBuffer), this.instanceBuffer = this.gl.createBuffer(), this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer), this.gl.bufferData(this.gl.ARRAY_BUFFER, a, this.gl.DYNAMIC_DRAW);
  }
  render(e, t) {
    const i = this.gl;
    if (!this.program || !this.vao || !this.currentTexture) return;
    i.useProgram(this.program), i.bindVertexArray(this.vao), i.uniform1f(this.uniforms.u_time, e.time), i.uniform1f(this.uniforms.u_alpha, e.alpha), i.uniform1f(this.uniforms.u_cols, e.cols), i.uniform1f(this.uniforms.u_rows, e.rows), i.uniform1f(this.uniforms.u_imgW, e.imgW), i.uniform1f(this.uniforms.u_imgH, e.imgH), i.uniform1f(this.uniforms.u_strength, e.strength), i.uniform3f(this.uniforms.u_audioBands, t.low, t.mid, t.high), i.activeTexture(i.TEXTURE0), i.bindTexture(i.TEXTURE_2D, this.currentTexture), i.uniform1i(this.uniforms.u_currentTex, 0), this.nextTexture && (i.activeTexture(i.TEXTURE1), i.bindTexture(i.TEXTURE_2D, this.nextTexture), i.uniform1i(this.uniforms.u_nextTex, 1)), i.clearColor(0, 0, 0, 1), i.clear(i.COLOR_BUFFER_BIT);
    const r = this.currentCols * this.currentRows;
    for (let n = 0; n < r; n++) i.drawArrays(i.TRIANGLES, 0, 6);
  }
  swapTextures() {
    const e = this.currentTexture;
    this.currentTexture = this.nextTexture, this.nextTexture = e;
  }
  resize(e, t) {
    this.gl.canvas.width = e, this.gl.canvas.height = t, this.gl.viewport(0, 0, e, t);
  }
  destroy() {
    const e = this.gl;
    this.currentTexture && e.deleteTexture(this.currentTexture), this.nextTexture && e.deleteTexture(this.nextTexture), this.vertexBuffer && e.deleteBuffer(this.vertexBuffer), this.instanceBuffer && e.deleteBuffer(this.instanceBuffer), this.vao && e.deleteVertexArray(this.vao), this.program && e.deleteProgram(this.program), console.log("WebGL2 renderer destroyed");
  }
}
class W {
  elements;
  config;
  listeners = {};
  constructor(e) {
    this.config = e, this.elements = this.getUIElements(), this.initializeControls(), this.setupEventListeners();
  }
  getUIElements() {
    const e = (t) => {
      const i = document.getElementById(t);
      if (!i) throw new Error(`UI element not found: ${t}`);
      return i;
    };
    return { audioInputSelect: e("audio-input-select"), startAudioBtn: e("start-audio"), stopAudioBtn: e("stop-audio"), tileSizeSlider: e("tile-size"), distortionStrengthSlider: e("distortion-strength"), cycleDurationSlider: e("cycle-duration"), silenceThresholdSlider: e("silence-threshold"), nextImageBtn: e("next-image"), freezeAudioBtn: e("freeze-audio"), overlay: e("overlay"), enableAudioBtn: e("enable-audio"), visualizeWithoutAudioBtn: e("visualize-without-audio"), fpsDisplay: e("fps"), rmsDisplay: e("rms"), stateDisplay: e("state"), lowBandDisplay: e("low-band"), midBandDisplay: e("mid-band"), highBandDisplay: e("high-band"), tileSizeValue: e("tile-size-value"), distortionStrengthValue: e("distortion-strength-value"), cycleDurationValue: e("cycle-duration-value"), silenceThresholdValue: e("silence-threshold-value") };
  }
  initializeControls() {
    this.elements.tileSizeSlider.value = this.config.gridTileSize.toString(), this.elements.distortionStrengthSlider.value = this.config.distortionStrength.toString(), this.elements.cycleDurationSlider.value = this.config.cycleSeconds.toString(), this.elements.silenceThresholdSlider.value = this.config.silenceRms.toString(), this.updateValueDisplays();
  }
  setupEventListeners() {
    this.elements.startAudioBtn.addEventListener("click", () => {
      this.emit("start-audio");
    }), this.elements.stopAudioBtn.addEventListener("click", () => {
      this.emit("stop-audio");
    }), this.elements.audioInputSelect.addEventListener("change", () => {
      this.emit("audio-device-changed", this.elements.audioInputSelect.value);
    }), this.elements.tileSizeSlider.addEventListener("input", () => {
      this.config.gridTileSize = parseInt(this.elements.tileSizeSlider.value), this.updateValueDisplays(), this.emit("tile-size-changed", this.config.gridTileSize);
    }), this.elements.distortionStrengthSlider.addEventListener("input", () => {
      this.config.distortionStrength = parseFloat(this.elements.distortionStrengthSlider.value), this.updateValueDisplays(), this.emit("distortion-strength-changed", this.config.distortionStrength);
    }), this.elements.cycleDurationSlider.addEventListener("input", () => {
      this.config.cycleSeconds = parseInt(this.elements.cycleDurationSlider.value), this.updateValueDisplays(), this.emit("cycle-duration-changed", this.config.cycleSeconds);
    }), this.elements.silenceThresholdSlider.addEventListener("input", () => {
      this.config.silenceRms = parseFloat(this.elements.silenceThresholdSlider.value), this.updateValueDisplays(), this.emit("silence-threshold-changed", this.config.silenceRms);
    }), this.elements.nextImageBtn.addEventListener("click", () => {
      this.emit("next-image");
    }), this.elements.freezeAudioBtn.addEventListener("click", () => {
      this.emit("freeze-audio");
    }), this.elements.enableAudioBtn.addEventListener("click", () => {
      this.emit("enable-audio");
    }), this.elements.visualizeWithoutAudioBtn.addEventListener("click", () => {
      this.emit("visualize-without-audio");
    });
  }
  updateValueDisplays() {
    this.elements.tileSizeValue.textContent = `${this.config.gridTileSize}px`, this.elements.distortionStrengthValue.textContent = this.config.distortionStrength.toFixed(1), this.elements.cycleDurationValue.textContent = `${this.config.cycleSeconds}s`, this.elements.silenceThresholdValue.textContent = this.config.silenceRms.toFixed(3);
  }
  async populateAudioDevices() {
    try {
      const e = await R();
      this.clearAudioDeviceOptions();
      const t = document.createElement("option");
      t.value = "", t.textContent = "Default Audio Input", this.elements.audioInputSelect.appendChild(t), e.forEach((i) => {
        const r = document.createElement("option");
        r.value = i.deviceId, r.textContent = i.label, this.elements.audioInputSelect.appendChild(r);
      }), console.log(`Populated ${e.length} audio devices`);
    } catch (e) {
      console.error("Error populating audio devices:", e);
    }
  }
  clearAudioDeviceOptions() {
    for (; this.elements.audioInputSelect.firstChild; ) this.elements.audioInputSelect.removeChild(this.elements.audioInputSelect.firstChild);
  }
  on(e, t) {
    this.listeners[e] || (this.listeners[e] = []), this.listeners[e].push(t);
  }
  emit(e, ...t) {
    this.listeners[e] && this.listeners[e].forEach((i) => i(...t));
  }
  showOverlay() {
    this.elements.overlay.classList.remove("hidden");
  }
  hideOverlay() {
    this.elements.overlay.classList.add("hidden");
  }
  setAudioControlsEnabled(e) {
    this.elements.startAudioBtn.disabled = !e, this.elements.stopAudioBtn.disabled = e, this.elements.audioInputSelect.disabled = !e;
  }
  updateFPS(e) {
    this.elements.fpsDisplay.textContent = `FPS: ${e.toFixed(0)}`;
  }
  updateRMS(e) {
    this.elements.rmsDisplay.textContent = `RMS: ${e.toFixed(3)}`;
  }
  updateState(e) {
    this.elements.stateDisplay.textContent = `State: ${e}`;
  }
  updateAudioBands(e, t, i) {
    this.elements.lowBandDisplay.textContent = e.toFixed(2), this.elements.midBandDisplay.textContent = t.toFixed(2), this.elements.highBandDisplay.textContent = i.toFixed(2);
  }
  getConfig() {
    return { ...this.config };
  }
}
class k {
  canvas;
  config;
  stateMachine;
  uiController;
  audioAnalyzer = null;
  audioStream = null;
  imageLoader;
  renderer = null;
  isRunning = false;
  fpsCounter = { frames: 0, lastTime: 0, fps: 0 };
  cycleStartTime = 0;
  transitionStartTime = 0;
  fadeStartTime = 0;
  currentImage = null;
  nextImage = null;
  lastAudioBands = { low: 0, mid: 0, high: 0 };
  audioFrozen = false;
  constructor(e) {
    this.canvas = e, this.config = { ...U }, this.stateMachine = new C(), this.uiController = new W(this.config), this.imageLoader = new M(), this.setupEventListeners(), this.setupStateMachine();
  }
  async initialize() {
    try {
      console.log("Initializing Music Mosaic App..."), await this.imageLoader.initialize(), await this.initializeRenderer(), await this.uiController.populateAudioDevices(), this.uiController.showOverlay(), this.stateMachine.transitionTo("IDLE"), console.log("App initialized successfully");
    } catch (e) {
      throw console.error("Error initializing app:", e), e;
    }
  }
  async initializeRenderer() {
    try {
      const e = await z();
      if (console.log("WebGPU support:", e), e.supported) {
        const t = await G(this.canvas);
        if (t) {
          this.renderer = new L(t), await this.renderer.initialize(), console.log("Using WebGPU renderer");
          return;
        }
      }
      console.log("Falling back to WebGL2 renderer"), this.renderer = new V(this.canvas), await this.renderer.initialize();
    } catch (e) {
      throw console.error("Error initializing renderer:", e), e;
    }
  }
  setupEventListeners() {
    this.uiController.on("enable-audio", () => this.enableAudio()), this.uiController.on("visualize-without-audio", () => this.startWithoutAudio()), this.uiController.on("start-audio", () => this.startAudio()), this.uiController.on("stop-audio", () => this.stopAudio()), this.uiController.on("next-image", () => this.forceNextImage()), this.uiController.on("freeze-audio", () => this.toggleAudioFreeze()), window.addEventListener("resize", () => this.handleResize()), this.handleResize();
  }
  setupStateMachine() {
    this.stateMachine.onStateEnter("FADE_IN", () => this.onFadeInStart()), this.stateMachine.onStateEnter("RUN", () => this.onRunStart()), this.stateMachine.onStateEnter("TRANSITION", () => this.onTransitionStart()), this.stateMachine.onStateEnter("FADE_OUT", () => this.onFadeOutStart()), this.stateMachine.onStateEnter("BLACK", () => this.onBlackStart());
  }
  handleResize() {
    const e = this.canvas.parentElement.getBoundingClientRect(), t = e.width, i = e.height;
    this.renderer && this.renderer.resize(t, i);
  }
  async enableAudio() {
    try {
      await _() && (await this.uiController.populateAudioDevices(), this.uiController.hideOverlay(), this.uiController.setAudioControlsEnabled(true));
    } catch (e) {
      console.error("Error enabling audio:", e);
    }
  }
  async startWithoutAudio() {
    this.uiController.hideOverlay(), this.uiController.setAudioControlsEnabled(false), this.startVisualization();
  }
  async startAudio() {
    try {
      this.audioStream = await A(), this.audioAnalyzer = new I(this.config), await this.audioAnalyzer.initialize(this.audioStream), this.startVisualization(), this.uiController.setAudioControlsEnabled(false);
    } catch (e) {
      console.error("Error starting audio:", e);
    }
  }
  stopAudio() {
    this.audioAnalyzer && (this.audioAnalyzer.destroy(), this.audioAnalyzer = null), this.audioStream && (w(this.audioStream), this.audioStream = null), this.stopVisualization(), this.uiController.setAudioControlsEnabled(true);
  }
  async startVisualization() {
    if (!this.isRunning) try {
      this.currentImage = await this.imageLoader.loadRandomImage(), this.renderer && this.currentImage && (this.renderer.setCurrentImage(this.currentImage, this.config.gridTileSize), this.stateMachine.transitionTo("FADE_IN"), this.startRenderLoop());
    } catch (e) {
      console.error("Error starting visualization:", e);
    }
  }
  stopVisualization() {
    this.isRunning = false, this.stateMachine.reset(), this.uiController.updateState("IDLE");
  }
  onFadeInStart() {
    this.fadeStartTime = performance.now(), console.log("Fade in started");
  }
  onRunStart() {
    this.cycleStartTime = performance.now(), this.preloadNextImage(), console.log("Run phase started");
  }
  onTransitionStart() {
    this.transitionStartTime = performance.now(), console.log("Transition started");
  }
  onFadeOutStart() {
    this.fadeStartTime = performance.now(), console.log("Fade out started");
  }
  onBlackStart() {
    console.log("Black phase started");
  }
  async preloadNextImage() {
    try {
      this.nextImage = await this.imageLoader.preloadNextImage(), this.renderer && this.nextImage && this.renderer.setNextImage(this.nextImage);
    } catch (e) {
      console.error("Error preloading next image:", e);
    }
  }
  forceNextImage() {
    this.stateMachine.getCurrentState() === "RUN" && this.stateMachine.transitionTo("TRANSITION");
  }
  toggleAudioFreeze() {
    this.audioFrozen = !this.audioFrozen, console.log("Audio frozen:", this.audioFrozen);
  }
  startRenderLoop() {
    this.isRunning = true, this.render();
  }
  render = () => {
    if (!this.isRunning) return;
    const e = performance.now();
    this.updateFPS(e);
    const t = this.getAudioBands(), i = this.audioAnalyzer?.getRMS() || 0;
    if (this.audioAnalyzer) {
      const n = this.audioAnalyzer.checkSilence();
      this.handleSilenceDetection(n);
    }
    this.updateStateMachine(e);
    const r = this.createUniforms(e);
    this.renderer && this.renderer.render(r, t), this.updateUI(t, i), requestAnimationFrame(this.render);
  };
  updateFPS(e) {
    this.fpsCounter.frames++, e - this.fpsCounter.lastTime >= 1e3 && (this.fpsCounter.fps = Math.round(this.fpsCounter.frames * 1e3 / (e - this.fpsCounter.lastTime)), this.fpsCounter.frames = 0, this.fpsCounter.lastTime = e);
  }
  getAudioBands() {
    if (!this.audioAnalyzer || this.audioFrozen) return this.lastAudioBands;
    const e = this.audioAnalyzer.getAudioBands();
    return this.lastAudioBands = e, e;
  }
  handleSilenceDetection(e) {
    const t = this.stateMachine.getCurrentState();
    e.isSilent && (t === "RUN" || t === "TRANSITION") ? this.stateMachine.transitionTo("FADE_OUT") : e.shouldResume && t === "BLACK" && this.startVisualization();
  }
  updateStateMachine(e) {
    switch (this.stateMachine.getCurrentState()) {
      case "FADE_IN":
        e - this.fadeStartTime >= this.config.fadeInMs && this.stateMachine.transitionTo("RUN");
        break;
      case "RUN":
        e - this.cycleStartTime >= this.config.cycleSeconds * 1e3 && this.stateMachine.transitionTo("TRANSITION");
        break;
      case "TRANSITION":
        e - this.transitionStartTime >= this.config.transitionMs && (this.renderer && this.renderer.swapTextures(), this.currentImage = this.nextImage, this.nextImage = null, this.stateMachine.transitionTo("RUN"));
        break;
      case "FADE_OUT":
        e - this.fadeStartTime >= this.config.fadeOutMs && this.stateMachine.transitionTo("BLACK");
        break;
    }
  }
  createUniforms(e) {
    const t = this.stateMachine.getCurrentState();
    let i = 1;
    switch (t) {
      case "FADE_IN":
        const l = y((e - this.fadeStartTime) / this.config.fadeInMs, 0, 1);
        i = S(l);
        break;
      case "TRANSITION":
        const u = y((e - this.transitionStartTime) / this.config.transitionMs, 0, 1);
        i = S(u);
        break;
      case "FADE_OUT":
        const h = y((e - this.fadeStartTime) / this.config.fadeOutMs, 0, 1);
        i = 1 - S(h);
        break;
      case "BLACK":
        i = 0;
        break;
    }
    const r = this.currentImage?.width || 1920, n = this.currentImage?.height || 1080, a = Math.ceil(r / this.config.gridTileSize), o = Math.ceil(n / this.config.gridTileSize);
    return { time: e / 1e3, alpha: i, cols: a, rows: o, imgW: r, imgH: n, strength: this.config.distortionStrength, pad: 0 };
  }
  updateUI(e, t) {
    this.uiController.updateFPS(this.fpsCounter.fps), this.uiController.updateRMS(t), this.uiController.updateState(this.stateMachine.getCurrentState()), this.uiController.updateAudioBands(e.low, e.mid, e.high);
  }
  destroy() {
    this.stopVisualization(), this.audioAnalyzer && this.audioAnalyzer.destroy(), this.audioStream && w(this.audioStream), this.renderer && this.renderer.destroy(), this.imageLoader.clearCache(), console.log("App destroyed");
  }
}
async function X() {
  try {
    const s = document.getElementById("canvas");
    if (!s) throw new Error("Canvas element not found");
    console.log("Starting WebGPU Music-Reactive Image Mosaic...");
    const e = new k(s);
    await e.initialize(), window.addEventListener("beforeunload", () => {
      e.destroy();
    }), document.addEventListener("visibilitychange", () => {
      document.hidden ? console.log("Page hidden - pausing app") : console.log("Page visible - resuming app");
    }), console.log("App started successfully");
  } catch (s) {
    console.error("Failed to start app:", s);
    const e = document.createElement("div");
    e.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: monospace;
      z-index: 10000;
      max-width: 80%;
      text-align: center;
    `, e.innerHTML = `
      <h3>Failed to Initialize</h3>
      <p>${s instanceof Error ? s.message : String(s)}</p>
      <p>Please check the console for more details.</p>
    `, document.body.appendChild(e);
  }
}
X();
