const fileInput = document.getElementById("fileInput");
const pickBtn = document.getElementById("pickBtn");
const dropZone = document.getElementById("dropZone");
const mainCanvas = document.getElementById("mainCanvas");
const edgeCanvas = document.getElementById("edgeCanvas");
const magnifier = document.getElementById("magnifier");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const zoomRange = document.getElementById("zoomRange");
const zoomValue = document.getElementById("zoomValue");
const matchesEl = document.getElementById("matches");
const inspectSwatch = document.getElementById("inspectSwatch");
const inspectHex = document.getElementById("inspectHex");
const inspectBlock = document.getElementById("inspectBlock");
const langToggle = document.getElementById("langToggle");
const i18nNodes = document.querySelectorAll("[data-i18n]");

const mainCtx = mainCanvas.getContext("2d", { willReadFrequently: true });
const edgeCtx = edgeCanvas.getContext("2d");
const magCtx = magnifier.getContext("2d");
const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

let blocks = [];
let blockCache = [];
let currentImage = null;
let lastResults = [];
let lastSampleColor = null;
let currentLang = "zh";
let lastObjectUrl = "";

const I18N = {
  zh: {
    tagline: "末地调色盘 · Minecraft 图像调色盘分析器",
    badgeDrag: "拖拽上传",
    badgeSample: "点击取色",
    uploadTitle: "上传图片",
    uploadDesc: "把图片拖到这里，或点击选择。",
    chooseFile: "选择文件",
    hint: "滚轮缩放，拖拽移动，点击画面取色。",
    inspector: "取色器",
    edgeLines: "边缘线条",
    blockMatches: "方块匹配",
    noMatch: "暂无匹配",
    langToggle: "切换语言",
    zoomIn: "放大",
    zoomOut: "缩小",
    zoomReset: "重置",
    zoomLabel: "缩放",
  },
  en: {
    tagline: "EnderPalette · Minecraft Image Palette Analyzer",
    badgeDrag: "Drag & Drop",
    badgeSample: "Click to Sample",
    uploadTitle: "Upload Image",
    uploadDesc: "Drag an image here or click to choose.",
    chooseFile: "Choose File",
    hint: "Scroll to zoom, drag to pan, click to sample.",
    inspector: "Inspector",
    edgeLines: "Edge Lines",
    blockMatches: "Minecraft Block Matches",
    noMatch: "No match",
    langToggle: "Language",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    zoomReset: "Reset",
    zoomLabel: "Zoom",
  },
};

const MAX_W = 960;
const MAX_H = 540;
const MAG_SIZE = 140;
const MAG_ZOOM = 6;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;

const viewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  dragStart: null,
  wasDragging: false,
};

init();

function init() {
  initLanguage();

  fetch("blocks.json")
    .then((res) => res.json())
    .then((data) => {
      blocks = data;
      blockCache = blocks.map((block) => ({
        block,
        rgb: hexToRgb(block.hex),
        lab: rgbToLab(hexToRgb(block.hex)),
        imageUrls: buildBlockImageCandidates(block),
      }));
    })
    .catch(() => {
      blocks = [];
      blockCache = [];
    });

  pickBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  dropZone.addEventListener("click", () => fileInput.click());

  mainCanvas.addEventListener("mousemove", (e) => handleCanvasMove(e));

  mainCanvas.addEventListener("mouseleave", () => {
    stopPanning();
    magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
  });

  mainCanvas.addEventListener("click", (e) => {
    if (!currentImage) return;
    if (viewState.wasDragging) {
      viewState.wasDragging = false;
      return;
    }
    const pos = getImagePos(e);
    const color = sampleAverageColor(pos.x, pos.y, 6);
    updateInspector(color);
  });

  mainCanvas.addEventListener("mousedown", (e) => startPanning(e));
  window.addEventListener("mouseup", () => stopPanning());
  mainCanvas.addEventListener("wheel", (e) => handleCanvasZoom(e), {
    passive: false,
  });

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => adjustZoom(ZOOM_STEP));
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => adjustZoom(-ZOOM_STEP));
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => resetView());
  }
  if (zoomRange) {
    zoomRange.addEventListener("input", (e) => {
      if (!currentImage) return;
      const value = Number(e.target.value);
      setZoom(value, mainCanvas.width / 2, mainCanvas.height / 2);
    });
  }
}

function handleFiles(files) {
  const file = files && files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return;

  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
  }

  const img = new Image();
  img.onload = () => {
    currentImage = img;
    drawToCanvas(img);
    analyzeImage();
  };
  lastObjectUrl = URL.createObjectURL(file);
  img.src = lastObjectUrl;
  fileInput.value = "";
}

function drawToCanvas(img) {
  const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
  const w = Math.floor(img.width * scale);
  const h = Math.floor(img.height * scale);

  sourceCanvas.width = w;
  sourceCanvas.height = h;
  sourceCtx.clearRect(0, 0, w, h);
  sourceCtx.drawImage(img, 0, 0, w, h);

  mainCanvas.width = w;
  mainCanvas.height = h;
  resetView();
}

function analyzeImage() {
  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  renderEdges(imageData);
  lastResults = analyzeBlocks(imageData);
  renderMatches(lastResults);
}

function renderEdges(imageData) {
  const { width, height } = imageData;
  const gray = new Float32Array(width * height);
  const data = imageData.data;

  for (let i = 0; i < width * height; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const sobel = new Uint8ClampedArray(width * height * 4);
  const threshold = 60;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const gx =
        -gray[idx - width - 1] +
        gray[idx - width + 1] +
        -2 * gray[idx - 1] +
        2 * gray[idx + 1] +
        -gray[idx + width - 1] +
        gray[idx + width + 1];
      const gy =
        gray[idx - width - 1] +
        2 * gray[idx - width] +
        gray[idx - width + 1] +
        -gray[idx + width - 1] +
        -2 * gray[idx + width] +
        -gray[idx + width + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      const v = mag > threshold ? 255 : 0;
      const o = idx * 4;
      sobel[o] = v;
      sobel[o + 1] = v;
      sobel[o + 2] = v;
      sobel[o + 3] = 255;
    }
  }

  edgeCanvas.width = width;
  edgeCanvas.height = height;
  const edgeImage = new ImageData(sobel, width, height);
  edgeCtx.putImageData(edgeImage, 0, 0);
}

function analyzeBlocks(imageData) {
  if (!blockCache.length) return [];
  const { width, height, data } = imageData;
  const total = width * height;
  const stats = blockCache.map(() => ({ count: 0, sum: [0, 0, 0] }));

  for (let i = 0; i < data.length; i += 4) {
    const color = [data[i], data[i + 1], data[i + 2]];
    const colorLab = rgbToLab(color);
    const idx = nearestBlockIndexLab(colorLab);
    const entry = stats[idx];
    entry.count += 1;
    entry.sum[0] += color[0];
    entry.sum[1] += color[1];
    entry.sum[2] += color[2];
  }

  return stats
    .map((entry, idx) => {
      if (!entry.count) return null;
      return {
        block: blockCache[idx].block,
        imageUrls: blockCache[idx].imageUrls,
        count: entry.count,
        percent: entry.count / total,
        avgColor: [
          Math.round(entry.sum[0] / entry.count),
          Math.round(entry.sum[1] / entry.count),
          Math.round(entry.sum[2] / entry.count),
        ],
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count);
}

function renderMatches(results) {
  matchesEl.innerHTML = "";
  results.forEach((result) => {
    const name = getBlockName(result.block);
    const hex = rgbToHex(result.avgColor);
    const row = document.createElement("div");
    row.className = "match-item";

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = hex;

    const img = document.createElement("img");
    img.className = "block-img";
    img.alt = name;
    img.loading = "lazy";
    applyImageFallback(img, result.imageUrls);

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = name;
    const id = document.createElement("div");
    id.className = "score";
    id.textContent = result.block.id;
    info.appendChild(title);
    info.appendChild(id);

    const percent = document.createElement("div");
    percent.className = "score";
    percent.textContent = `${(result.percent * 100).toFixed(2)}%`;

    row.appendChild(swatch);
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(percent);
    matchesEl.appendChild(row);
  });
}

function updateInspector(color) {
  const hex = rgbToHex(color);
  const match = findClosestBlock(color);
  lastSampleColor = color;
  inspectSwatch.style.background = hex;
  inspectHex.textContent = hex;
  inspectBlock.textContent = match
    ? `${getBlockName(match)} (${match.id})`
    : t("noMatch");
}

function findClosestBlock(color) {
  if (!blockCache.length) return null;
  const colorLab = rgbToLab(color);
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const entry of blockCache) {
    const dist = deltaE(colorLab, entry.lab);
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...entry.block, distance: dist };
    }
  }
  return best;
}

function nearestBlockIndexLab(colorLab) {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < blockCache.length; i += 1) {
    const dist = deltaE(colorLab, blockCache[i].lab);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function renderMagnifier(x, y) {
  const size = Math.floor(MAG_SIZE / MAG_ZOOM);
  const sx = clamp(Math.floor(x - size / 2), 0, sourceCanvas.width - size);
  const sy = clamp(Math.floor(y - size / 2), 0, sourceCanvas.height - size);

  magCtx.imageSmoothingEnabled = false;
  magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
  magCtx.drawImage(
    sourceCanvas,
    sx,
    sy,
    size,
    size,
    0,
    0,
    MAG_SIZE,
    MAG_SIZE
  );

  magCtx.strokeStyle = "rgba(94, 226, 200, 0.9)";
  magCtx.lineWidth = 2;
  magCtx.beginPath();
  magCtx.moveTo(MAG_SIZE / 2, 0);
  magCtx.lineTo(MAG_SIZE / 2, MAG_SIZE);
  magCtx.moveTo(0, MAG_SIZE / 2);
  magCtx.lineTo(MAG_SIZE, MAG_SIZE / 2);
  magCtx.stroke();
}

function sampleAverageColor(x, y, radius) {
  const startX = clamp(x - radius, 0, sourceCanvas.width - 1);
  const startY = clamp(y - radius, 0, sourceCanvas.height - 1);
  const size = radius * 2 + 1;
  const data = sourceCtx.getImageData(startX, startY, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  const count = size * size;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function getCanvasPos(event) {
  const rect = mainCanvas.getBoundingClientRect();
  const scaleX = mainCanvas.width / rect.width;
  const scaleY = mainCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getImagePos(event) {
  const canvasPos = getCanvasPos(event);
  const rawX = (canvasPos.x - viewState.panX) / viewState.zoom;
  const rawY = (canvasPos.y - viewState.panY) / viewState.zoom;
  return {
    x: clamp(Math.floor(rawX), 0, sourceCanvas.width - 1),
    y: clamp(Math.floor(rawY), 0, sourceCanvas.height - 1),
    canvasX: canvasPos.x,
    canvasY: canvasPos.y,
  };
}

function renderMainCanvas() {
  if (!currentImage) return;
  mainCtx.imageSmoothingEnabled = false;
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  mainCtx.drawImage(
    sourceCanvas,
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
    viewState.panX,
    viewState.panY,
    sourceCanvas.width * viewState.zoom,
    sourceCanvas.height * viewState.zoom
  );
}

function clampPan() {
  const scaledW = sourceCanvas.width * viewState.zoom;
  const scaledH = sourceCanvas.height * viewState.zoom;
  const minX = Math.min(0, mainCanvas.width - scaledW);
  const minY = Math.min(0, mainCanvas.height - scaledH);
  viewState.panX = clamp(viewState.panX, minX, 0);
  viewState.panY = clamp(viewState.panY, minY, 0);
}

function updateZoomControls() {
  if (zoomRange) zoomRange.value = viewState.zoom;
  if (zoomValue) zoomValue.textContent = `${Math.round(viewState.zoom * 100)}%`;
}

function setZoom(value, anchorX, anchorY) {
  const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
  if (nextZoom === viewState.zoom) return;
  const imageX = (anchorX - viewState.panX) / viewState.zoom;
  const imageY = (anchorY - viewState.panY) / viewState.zoom;
  viewState.zoom = nextZoom;
  viewState.panX = anchorX - imageX * nextZoom;
  viewState.panY = anchorY - imageY * nextZoom;
  clampPan();
  updateZoomControls();
  renderMainCanvas();
}

function adjustZoom(delta) {
  if (!currentImage) return;
  setZoom(viewState.zoom + delta, mainCanvas.width / 2, mainCanvas.height / 2);
}

function resetView() {
  viewState.zoom = 1;
  viewState.panX = 0;
  viewState.panY = 0;
  viewState.isPanning = false;
  viewState.wasDragging = false;
  updateZoomControls();
  renderMainCanvas();
}

function startPanning(event) {
  if (!currentImage) return;
  const pos = getCanvasPos(event);
  viewState.isPanning = true;
  viewState.dragStart = {
    x: pos.x,
    y: pos.y,
    panX: viewState.panX,
    panY: viewState.panY,
  };
  viewState.wasDragging = false;
  mainCanvas.classList.add("is-panning");
}

function stopPanning() {
  if (!viewState.isPanning) return;
  viewState.isPanning = false;
  viewState.dragStart = null;
  mainCanvas.classList.remove("is-panning");
}

function handleCanvasMove(event) {
  if (!currentImage) return;
  if (viewState.isPanning && viewState.dragStart) {
    const pos = getCanvasPos(event);
    const dx = pos.x - viewState.dragStart.x;
    const dy = pos.y - viewState.dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      viewState.wasDragging = true;
    }
    viewState.panX = viewState.dragStart.panX + dx;
    viewState.panY = viewState.dragStart.panY + dy;
    clampPan();
    renderMainCanvas();
  }

  const pos = getImagePos(event);
  renderMagnifier(pos.x, pos.y);
}

function handleCanvasZoom(event) {
  if (!currentImage) return;
  event.preventDefault();
  const pos = getCanvasPos(event);
  const direction = event.deltaY < 0 ? 1 : -1;
  setZoom(viewState.zoom + direction * ZOOM_STEP, pos.x, pos.y);
}

function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function deltaE(labA, labB) {
  const dL = labA[0] - labB[0];
  const dA = labA[1] - labB[1];
  const dB = labA[2] - labB[2];
  return Math.sqrt(dL * dL + dA * dA + dB * dB);
}

function rgbToLab(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

  return xyzToLab(x, y, z);
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function xyzToLab(x, y, z) {
  const refX = 0.95047;
  const refY = 1.0;
  const refZ = 1.08883;

  const fx = pivotXYZ(x / refX);
  const fy = pivotXYZ(y / refY);
  const fz = pivotXYZ(z / refZ);

  const L = Math.max(0, 116 * fy - 16);
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);
  return [L, A, B];
}

function pivotXYZ(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function initLanguage() {
  const saved = localStorage.getItem("enderpalette.lang");
  if (saved === "en" || saved === "zh") {
    currentLang = saved;
  }
  applyLanguage();

  if (langToggle) {
    langToggle.addEventListener("click", () => {
      currentLang = currentLang === "zh" ? "en" : "zh";
      localStorage.setItem("enderpalette.lang", currentLang);
      applyLanguage();
    });
  }
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  });
  if (lastResults.length) {
    renderMatches(lastResults);
  }
  if (lastSampleColor) {
    updateInspector(lastSampleColor);
  }
}

function t(key) {
  return I18N[currentLang]?.[key] || I18N.zh[key] || key;
}

function getBlockName(block) {
  if (currentLang === "zh" && block.nameCn) return block.nameCn;
  return block.name;
}

function buildBlockImageUrl(imageName) {
  if (!imageName) return "";
  return `https://zh.minecraft.wiki/wiki/Special:FilePath/${encodeURIComponent(imageName)}`;
}

function buildBlockImageCandidates(block) {
  const candidates = [];
  if (block.image) {
    candidates.push(buildBlockImageUrl(block.image));
  }

  const fromName = normalizeFileName(block.name);
  if (fromName) {
    candidates.push(buildBlockImageUrl(fromName));
  }

  const fromId = normalizeFileName(block.id);
  if (fromId) {
    candidates.push(buildBlockImageUrl(fromId));
  }

  candidates.push("block-textures/placeholder.svg");
  return Array.from(new Set(candidates));
}

function normalizeFileName(value) {
  if (!value) return "";
  const withSpaces = value.replace(/_/g, " ");
  const titled = withSpaces
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");
  return titled.endsWith(".png") ? titled : `${titled}.png`;
}

function applyImageFallback(img, urls) {
  let index = 0;
  const safeUrls = urls && urls.length ? urls : ["block-textures/placeholder.svg"];

  const tryNext = () => {
    if (index >= safeUrls.length) return;
    img.src = safeUrls[index];
    index += 1;
  };

  img.addEventListener("error", () => {
    tryNext();
  });

  tryNext();
}
