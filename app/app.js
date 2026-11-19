// Vice Cover Studio — offline multi-panel GTA-style cover art maker.
// All rendering happens on <canvas>; photos are read locally and never leave
// the machine. No network requests, no external fonts: system fonts only.

const coverCanvas = document.getElementById('coverCanvas');
const previewCtx = coverCanvas.getContext('2d');
const exportNote = document.getElementById('exportNote');
const selftestBox = document.getElementById('selftest');

// ---------------------------------------------------------------------------
// Poster state
// ---------------------------------------------------------------------------

const DEMO_PHOTOS = [
  { src: 'samples/pier.jpg', name: 'Pier at dusk' },
  { src: 'samples/boulevard.jpg', name: 'Boulevard night' },
];

const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square post' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait post' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape cover' },
};

function freshPanel(photoIndex) {
  return { photo: photoIndex, zoom: 1, panX: 0, panY: 0, rotate: 0, flip: false };
}

function defaultPosterState() {
  return {
    layout: 'grid',
    grade: 'sunset',
    gradeStrength: 0.75,
    exportSize: '1920x1080',
    title: 'VICE CITY',
    tagline: 'One last score under the neon sun',
    credit: 'A VICE COVER STUDIO POSTER',
    titlePos: 'top',
    border: true,
    selectedPanel: 0,
    panels: [freshPanel(0), freshPanel(1), freshPanel(0), freshPanel(1)],
  };
}

const poster = defaultPosterState();
const photoLibrary = DEMO_PHOTOS.map((p) => ({ ...p, image: null, loaded: false }));

// ---------------------------------------------------------------------------
// Colour grades — Vice City sunset / neon palettes, all original
// ---------------------------------------------------------------------------

const VICE_GRADES = {
  sunset: {
    washTop: 'rgba(255, 122, 26, 0.28)', washBottom: 'rgba(255, 45, 120, 0.30)',
    glow: 'rgba(255, 190, 80, 0.55)', accent: '#ff7a1a', ink: '#1a0b2e',
    duotoneA: '#ff9a3d', duotoneB: '#7b2ff7', vignette: 0.42, grain: 0.05,
  },
  neon: {
    washTop: 'rgba(0, 229, 255, 0.22)', washBottom: 'rgba(255, 0, 153, 0.32)',
    glow: 'rgba(0, 229, 255, 0.5)', accent: '#00e5ff', ink: '#05021a',
    duotoneA: '#00e5ff', duotoneB: '#ff0099', vignette: 0.5, grain: 0.06,
  },
  noir: {
    washTop: 'rgba(40, 40, 60, 0.30)', washBottom: 'rgba(0, 0, 0, 0.45)',
    glow: 'rgba(220, 220, 235, 0.25)', accent: '#e8e8f0', ink: '#000000',
    duotoneA: '#9aa0b5', duotoneB: '#101018', vignette: 0.6, grain: 0.09,
  },
  pastel: {
    washTop: 'rgba(255, 183, 197, 0.26)', washBottom: 'rgba(125, 211, 252, 0.28)',
    glow: 'rgba(255, 214, 140, 0.45)', accent: '#ff8fb3', ink: '#2b1a3a',
    duotoneA: '#ffb7c5', duotoneB: '#7dd3fc', vignette: 0.3, grain: 0.04,
  },
};

// ---------------------------------------------------------------------------
// Layouts — panel rectangles as fractions of the cover (x, y, w, h)
// ---------------------------------------------------------------------------

const POSTER_LAYOUTS = {
  grid: {
    panels: 4,
    rects: [
      [0.03, 0.03, 0.46, 0.44], [0.51, 0.03, 0.46, 0.44],
      [0.03, 0.53, 0.46, 0.44], [0.51, 0.53, 0.46, 0.44],
    ],
  },
  hero: {
    panels: 4,
    rects: [
      [0.03, 0.03, 0.62, 0.94], [0.67, 0.03, 0.30, 0.30],
      [0.67, 0.35, 0.30, 0.30], [0.67, 0.67, 0.30, 0.30],
    ],
  },
  triptych: {
    panels: 3,
    rects: [
      [0.03, 0.03, 0.30, 0.94], [0.35, 0.03, 0.30, 0.94],
      [0.67, 0.03, 0.30, 0.94],
    ],
  },
  duo: {
    panels: 2,
    rects: [
      [0.03, 0.03, 0.46, 0.94], [0.51, 0.03, 0.46, 0.94],
    ],
  },
};

function activePanelCount() {
  return POSTER_LAYOUTS[poster.layout].panels;
}

function panelRect(index, coverW, coverH) {
  const r = POSTER_LAYOUTS[poster.layout].rects[index];
  return { x: r[0] * coverW, y: r[1] * coverH, w: r[2] * coverW, h: r[3] * coverH };
}

// ---------------------------------------------------------------------------
// Photo loading — FileReader / object URLs, local only
// ---------------------------------------------------------------------------

function loadPhotoImage(entry) {
  return new Promise((resolve) => {
    if (entry.loaded) { resolve(entry.image); return; }
    const img = new Image();
    img.onload = () => { entry.image = img; entry.loaded = true; resolve(img); };
    img.onerror = () => { entry.image = null; entry.loaded = false; resolve(null); };
    img.src = entry.src;
  });
}

async function loadAllDemoPhotos() {
  await Promise.all(photoLibrary.map((entry) => loadPhotoImage(entry)));
  renderPreview();
}

function addUploadedPhotos(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    if (photoLibrary.length >= 6) break;
    const url = URL.createObjectURL(file);
    const entry = { src: url, name: file.name.replace(/\.[^.]+$/, ''), image: null, loaded: false };
    photoLibrary.push(entry);
    loadPhotoImage(entry).then(() => renderPreview());
  }
  rebuildPhotoTray();
  renderPreview();
}

// ---------------------------------------------------------------------------
// Film grain — one seeded noise tile, reused so every render is stable
// ---------------------------------------------------------------------------

let grainTile = null;
function makeGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 160; tile.height = 160;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(160, 160);
  let seed = 20261119;
  const nextRand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(nextRand() * 255);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

function paintGrain(ctx, w, h, strength) {
  if (strength <= 0) return;
  const tile = makeGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drawing one photo into one panel (cover-fit + pan / zoom / rotate / flip)
// ---------------------------------------------------------------------------

function drawPhotoIntoPanel(ctx, image, rect, panel) {
  if (!image) {
    ctx.save();
    ctx.fillStyle = '#241534';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#ff7a1a';
    ctx.font = `700 ${Math.max(14, rect.w * 0.05)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const scale = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight) * panel.zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.translate(rect.x + rect.w / 2 + panel.panX, rect.y + rect.h / 2 + panel.panY);
  if (panel.rotate) ctx.rotate((panel.rotate * Math.PI) / 180);
  if (panel.flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function paintGradeWash(ctx, rect, grade, strength) {
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  wash.addColorStop(0, grade.washTop);
  wash.addColorStop(1, grade.washBottom);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  const duo = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  duo.addColorStop(0, grade.duotoneA);
  duo.addColorStop(1, grade.duotoneB);
  ctx.fillStyle = duo;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function paintVignette(ctx, rect, strength) {
  if (strength <= 0) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(rect.w, rect.h) * 0.72;
  const vig = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = vig;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bold poster lettering — heavy system-font caps with stroke + drop shadow
// ---------------------------------------------------------------------------

function paintPosterLettering(ctx, coverW, coverH, grade) {
  // Title size is capped by the cover height so wide landscape covers never
  // clip the caps at the top edge (1920x1080 was cutting "VICE CITY" off).
  const titleSize = Math.round(Math.min(coverW * 0.085, coverH * 0.13));
  const tagSize = Math.round(coverW * 0.024);
  const creditSize = Math.round(coverW * 0.016);
  const top = poster.titlePos === 'top';
  const bandH = coverH * 0.16;
  const bandY = top ? coverH * 0.03 : coverH * 0.81;

  // Sun-glow band behind the lettering so it reads over any photo.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  band.addColorStop(0, 'rgba(10, 2, 24, 0.0)');
  band.addColorStop(0.5, 'rgba(10, 2, 24, 0.55)');
  band.addColorStop(1, 'rgba(10, 2, 24, 0.0)');
  ctx.save();
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, coverW, bandH);
  ctx.restore();

  const cx = coverW / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title: thick white fill, dark outline, warm shadow.
  ctx.font = `900 ${titleSize}px Impact, 'Arial Black', 'Helvetica Neue', sans-serif`;
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = titleSize * 0.35;
  ctx.shadowOffsetY = titleSize * 0.06;
  ctx.lineWidth = Math.max(4, titleSize * 0.09);
  ctx.strokeStyle = grade.ink;
  ctx.lineJoin = 'round';
  const titleY = bandY + bandH * 0.45;
  const titleText = (poster.title || 'VICE CITY').toUpperCase();
  ctx.strokeText(titleText, cx, titleY);
  const titleFill = ctx.createLinearGradient(0, titleY - titleSize / 2, 0, titleY + titleSize / 2);
  titleFill.addColorStop(0, '#ffffff');
  titleFill.addColorStop(0.6, '#ffe9c4');
  titleFill.addColorStop(1, grade.accent);
  ctx.fillStyle = titleFill;
  ctx.fillText(titleText, cx, titleY);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Tagline under the title.
  ctx.font = `700 ${tagSize}px 'Trebuchet MS', Verdana, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, tagSize * 0.14);
  ctx.strokeStyle = 'rgba(10, 2, 24, 0.85)';
  const tagY = bandY + bandH * 0.78;
  if (poster.tagline) {
    ctx.strokeText(poster.tagline, cx, tagY);
    ctx.fillText(poster.tagline, cx, tagY);
  }

  // Credit strip at the opposite edge.
  ctx.font = `700 ${creditSize}px 'Trebuchet MS', Verdana, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const creditY = top ? coverH - creditSize * 1.6 : creditSize * 1.6;
  if (poster.credit) ctx.fillText(poster.credit, cx, creditY);
  ctx.restore();
}

function paintPosterBorder(ctx, coverW, coverH, grade) {
  if (!poster.border) return;
  const outer = Math.max(6, coverW * 0.008);
  const inner = Math.max(2, coverW * 0.002);
  ctx.save();
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = outer;
  ctx.strokeRect(outer / 2, outer / 2, coverW - outer, coverH - outer);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = inner;
  const gap = outer * 2.2;
  ctx.strokeRect(gap, gap, coverW - gap * 2, coverH - gap * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Full cover render — shared by the live preview and the PNG export
// ---------------------------------------------------------------------------

function renderCover(ctx, coverW, coverH) {
  const grade = VICE_GRADES[poster.grade];
  const strength = poster.gradeStrength;

  ctx.save();
  ctx.fillStyle = '#0b0218';
  ctx.fillRect(0, 0, coverW, coverH);

  const count = activePanelCount();
  for (let i = 0; i < count; i++) {
    const rect = panelRect(i, coverW, coverH);
    const panel = poster.panels[i];
    const photo = photoLibrary[panel.photo];
    drawPhotoIntoPanel(ctx, photo ? photo.image : null, rect, panel);
    paintGradeWash(ctx, rect, grade, strength);
    paintVignette(ctx, rect, grade.vignette * strength);
    // Thin neon divider between panels.
    ctx.strokeStyle = grade.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, coverW * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
  }

  paintGrain(ctx, coverW, coverH, grade.grain * strength);
  paintPosterLettering(ctx, coverW, coverH, grade);
  paintPosterBorder(ctx, coverW, coverH, grade);
  ctx.restore();
}

function renderPreview() {
  const size = EXPORT_SIZES[poster.exportSize];
  coverCanvas.width = size.w;
  coverCanvas.height = size.h;
  renderCover(previewCtx, size.w, size.h);
  updateSelectedPanelLabel();
}

// ---------------------------------------------------------------------------
// Export — one click renders the exact post size and downloads a PNG
// ---------------------------------------------------------------------------

function exportCoverPng() {
  const size = EXPORT_SIZES[poster.exportSize];
  const offscreen = document.createElement('canvas');
  offscreen.width = size.w;
  offscreen.height = size.h;
  renderCover(offscreen.getContext('2d'), size.w, size.h);
  offscreen.toBlob((blob) => {
    if (!blob) {
      exportNote.textContent = 'Export failed — please try again.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vice-cover-${size.w}x${size.h}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    exportNote.textContent = `Exported ${size.label} PNG — ${size.w} × ${size.h}. Share it anywhere.`;
  }, 'image/png');
}

// ---------------------------------------------------------------------------
// Photo tray + panel controls
// ---------------------------------------------------------------------------

const photoTray = document.getElementById('photoTray');

function rebuildPhotoTray() {
  photoTray.innerHTML = '';
  photoLibrary.forEach((entry, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'photo-thumb';
    thumb.title = entry.name;
    const img = document.createElement('img');
    img.src = entry.src;
    img.alt = entry.name;
    thumb.appendChild(img);
    const label = document.createElement('span');
    label.textContent = entry.name;
    thumb.appendChild(label);
    thumb.addEventListener('click', () => {
      poster.panels[poster.selectedPanel].photo = index;
      renderPreview();
      rebuildPhotoTray();
    });
    photoTray.appendChild(thumb);
  });
}

function updateSelectedPanelLabel() {
  const label = document.getElementById('selectedPanelLabel');
  if (!label) return;
  label.textContent = `Panel ${poster.selectedPanel + 1} of ${activePanelCount()} — drag the photo on the preview to move it`;
  const zoom = document.getElementById('zoomSlider');
  const rotate = document.getElementById('rotateSlider');
  const panel = poster.panels[poster.selectedPanel];
  if (zoom) zoom.value = String(Math.round(panel.zoom * 100));
  if (rotate) rotate.value = String(panel.rotate);
}

function selectPanelAt(clientX, clientY) {
  const rect = coverCanvas.getBoundingClientRect();
  const scaleX = coverCanvas.width / rect.width;
  const scaleY = coverCanvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  for (let i = 0; i < activePanelCount(); i++) {
    const r = panelRect(i, coverCanvas.width, coverCanvas.height);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      poster.selectedPanel = i;
      return true;
    }
  }
  return false;
}

// Drag-to-pan on the preview canvas.
let dragState = null;
coverCanvas.addEventListener('pointerdown', (event) => {
  if (!selectPanelAt(event.clientX, event.clientY)) return;
  const rect = coverCanvas.getBoundingClientRect();
  const scaleX = coverCanvas.width / rect.width;
  const scaleY = coverCanvas.height / rect.height;
  dragState = {
    startX: event.clientX, startY: event.clientY,
    panX: poster.panels[poster.selectedPanel].panX,
    panY: poster.panels[poster.selectedPanel].panY,
    scaleX, scaleY,
  };
  coverCanvas.setPointerCapture(event.pointerId);
  renderPreview();
});
coverCanvas.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const panel = poster.panels[poster.selectedPanel];
  panel.panX = dragState.panX + (event.clientX - dragState.startX) * dragState.scaleX;
  panel.panY = dragState.panY + (event.clientY - dragState.startY) * dragState.scaleY;
  renderPreview();
});
coverCanvas.addEventListener('pointerup', () => { dragState = null; });
coverCanvas.addEventListener('pointercancel', () => { dragState = null; });

// ---------------------------------------------------------------------------
// Control wiring
// ---------------------------------------------------------------------------

function markActive(groupSelector, button) {
  document.querySelectorAll(groupSelector).forEach((b) => b.classList.remove('is-active'));
  button.classList.add('is-active');
}

document.querySelectorAll('.layout-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    poster.layout = btn.dataset.layout;
    poster.selectedPanel = 0;
    markActive('.layout-btn', btn);
    renderPreview();
  });
});

document.querySelectorAll('.grade-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    poster.grade = btn.dataset.grade;
    markActive('.grade-btn', btn);
    renderPreview();
  });
});

document.querySelectorAll('.size-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    poster.exportSize = btn.dataset.size;
    markActive('.size-btn', btn);
    renderPreview();
  });
});

document.getElementById('gradeStrength').addEventListener('input', (event) => {
  poster.gradeStrength = Number(event.target.value) / 100;
  renderPreview();
});

document.getElementById('zoomSlider').addEventListener('input', (event) => {
  poster.panels[poster.selectedPanel].zoom = Number(event.target.value) / 100;
  renderPreview();
});

document.getElementById('rotateSlider').addEventListener('input', (event) => {
  poster.panels[poster.selectedPanel].rotate = Number(event.target.value);
  renderPreview();
});

document.getElementById('flipBtn').addEventListener('click', () => {
  const panel = poster.panels[poster.selectedPanel];
  panel.flip = !panel.flip;
  renderPreview();
});

document.getElementById('nextPhotoBtn').addEventListener('click', () => {
  const panel = poster.panels[poster.selectedPanel];
  panel.photo = (panel.photo + 1) % photoLibrary.length;
  renderPreview();
  rebuildPhotoTray();
});

document.getElementById('resetPanelBtn').addEventListener('click', () => {
  poster.panels[poster.selectedPanel] = freshPanel(poster.selectedPanel % photoLibrary.length);
  renderPreview();
});

document.getElementById('photoUpload').addEventListener('change', (event) => {
  addUploadedPhotos(event.target.files);
  event.target.value = '';
});

document.getElementById('titleInput').addEventListener('input', (event) => {
  poster.title = event.target.value;
  renderPreview();
});
document.getElementById('taglineInput').addEventListener('input', (event) => {
  poster.tagline = event.target.value;
  renderPreview();
});
document.getElementById('creditInput').addEventListener('input', (event) => {
  poster.credit = event.target.value;
  renderPreview();
});
document.getElementById('titlePosSelect').addEventListener('change', (event) => {
  poster.titlePos = event.target.value;
  renderPreview();
});
document.getElementById('borderToggle').addEventListener('change', (event) => {
  poster.border = event.target.checked;
  renderPreview();
});

document.getElementById('exportBtn').addEventListener('click', exportCoverPng);

document.getElementById('randomizeBtn').addEventListener('click', () => {
  const layouts = Object.keys(POSTER_LAYOUTS);
  const grades = Object.keys(VICE_GRADES);
  poster.layout = layouts[Math.floor(Math.random() * layouts.length)];
  poster.grade = grades[Math.floor(Math.random() * grades.length)];
  poster.panels.forEach((panel) => {
    panel.photo = Math.floor(Math.random() * photoLibrary.length);
    panel.zoom = 1 + Math.random() * 0.5;
    panel.rotate = Math.round((Math.random() - 0.5) * 20);
  });
  document.querySelectorAll('.layout-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.layout === poster.layout));
  document.querySelectorAll('.grade-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.grade === poster.grade));
  poster.selectedPanel = 0;
  renderPreview();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  const fresh = defaultPosterState();
  Object.assign(poster, fresh);
  document.querySelectorAll('.layout-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.layout === poster.layout));
  document.querySelectorAll('.grade-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.grade === poster.grade));
  document.querySelectorAll('.size-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.size === poster.exportSize));
  document.getElementById('titleInput').value = poster.title;
  document.getElementById('taglineInput').value = poster.tagline;
  document.getElementById('creditInput').value = poster.credit;
  document.getElementById('titlePosSelect').value = poster.titlePos;
  document.getElementById('borderToggle').checked = poster.border;
  renderPreview();
});

// ---------------------------------------------------------------------------
// Deterministic shot mode (for the maker's own screenshots) + self-test
// ---------------------------------------------------------------------------

function applyShotParams(params) {
  const photoName = params.get('photo');
  if (photoName) {
    const index = photoLibrary.findIndex((p) => p.src.includes(photoName));
    if (index >= 0) poster.panels.forEach((panel, i) => { panel.photo = (index + i) % photoLibrary.length; });
  }
  const caption = params.get('caption');
  if (caption) {
    poster.title = caption.toUpperCase();
    const titleInput = document.getElementById('titleInput');
    if (titleInput) titleInput.value = poster.title;
  }
  const layout = params.get('layout');
  if (layout && POSTER_LAYOUTS[layout]) {
    poster.layout = layout;
    document.querySelectorAll('.layout-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.layout === layout));
  }
  const grade = params.get('grade');
  if (grade && VICE_GRADES[grade]) {
    poster.grade = grade;
    document.querySelectorAll('.grade-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.grade === grade));
  }
  const size = params.get('size');
  if (size && EXPORT_SIZES[size]) {
    poster.exportSize = size;
    document.querySelectorAll('.size-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.size === size));
  }
  const pos = params.get('titlepos');
  if (pos === 'top' || pos === 'bottom') {
    poster.titlePos = pos;
    document.getElementById('titlePosSelect').value = pos;
  }
}

function runSelfTest() {
  const results = [];
  for (const [key, size] of Object.entries(EXPORT_SIZES)) {
    const offscreen = document.createElement('canvas');
    offscreen.width = size.w;
    offscreen.height = size.h;
    renderCover(offscreen.getContext('2d'), size.w, size.h);
    const ok = offscreen.width === size.w && offscreen.height === size.h;
    results.push(`EXPORT ${key} ${ok ? 'OK' : 'FAIL'} ${offscreen.width}x${offscreen.height}`);
  }
  results.push(`LAYOUTS ${Object.keys(POSTER_LAYOUTS).join(',')}`);
  results.push(`GRADES ${Object.keys(VICE_GRADES).join(',')}`);
  results.push(`PHOTOS ${photoLibrary.filter((p) => p.loaded).length}/${photoLibrary.length} loaded`);
  selftestBox.textContent = results.join(' | ');
  document.title = `SELFTEST ${results.join(' | ')}`;
}

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------

rebuildPhotoTray();
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('shot') === 'cover') {
  document.body.classList.add('shot-cover');
  applyShotParams(urlParams);
} else if (urlParams.get('shot') === 'editor') {
  applyShotParams(urlParams);
}
loadAllDemoPhotos().then(() => {
  renderPreview();
  if (urlParams.get('selftest') === '1') runSelfTest();
});
