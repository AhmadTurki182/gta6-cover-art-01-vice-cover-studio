// Vice Cover Studio — canvas cover maker. All photos stay on this machine:
// uploads are read with FileReader into memory and never sent anywhere.
// Lettering uses system fonts only; no Rockstar logo, artwork or font.

const DEMO_PHOTOS = ['samples/boulevard.jpg', 'samples/pier.jpg'];
const LAYOUT_NAMES = { grid: '2×2 Grid', hero: 'Hero + Strip', vertical: '3-Panel Vertical', duo: 'Duo Split' };
const GRADE_NAMES = { sunset: 'Sunset', neon: 'Neon Nights', noir: 'Noir', pastel: 'Vice Pastel' };

const GRADE_STYLES = {
  sunset: { filter: 'saturate(1.4) contrast(1.1) brightness(1.03)', top: '#ff7a18', bottom: '#ff2e88', mid: '#7b2ff7' },
  neon: { filter: 'saturate(1.7) hue-rotate(-18deg) contrast(1.18)', top: '#19e3ff', bottom: '#ff2e88', mid: '#7b2ff7' },
  noir: { filter: 'grayscale(1) contrast(1.28) brightness(0.96)', top: '#9db4c8', bottom: '#101018', mid: '#5a6b7d' },
  pastel: { filter: 'saturate(1.15) brightness(1.1) sepia(0.22)', top: '#ffd319', bottom: '#ff9ecf', mid: '#8ec8ff' },
};

const EXPORT_SIZES = { '1080x1080': [1080, 1080], '1080x1350': [1080, 1350], '1920x1080': [1920, 1080] };

const state = {
  photos: [], // { name, image: HTMLImageElement, url }
  layout: 'grid',
  grade: 'sunset',
  gradeStrength: 70,
  title: 'VICE HEIST',
  tagline: 'One last sunset. One last score.',
  byline: 'STARRING YOU',
  titlePosition: 'top',
  exportSize: '1920x1080',
  selectedPanel: 0,
  selectedPhoto: 0,
  panels: [], // { photo, zoom, panX, panY, rotation, flipped }
};

const previewCanvas = document.getElementById('coverPreview');
const previewCtx = previewCanvas.getContext('2d');
const shotImage = document.getElementById('shotCover');

function defaultPanels(count) {
  const panels = [];
  for (let i = 0; i < count; i++) {
    panels.push({ photo: i % 2, zoom: 1, panX: 0, panY: 0, rotation: 0, flipped: false });
  }
  return panels;
}

function panelCountForLayout(layout) {
  if (layout === 'grid') return 4;
  if (layout === 'hero') return 4;
  if (layout === 'vertical') return 3;
  return 2;
}

function applyLayout(layout) {
  state.layout = layout;
  state.panels = defaultPanels(panelCountForLayout(layout));
  state.selectedPanel = 0;
  rebuildPanelPicker();
  syncLayoutButtons();
  renderPreview();
}

function layoutRects(layout, width, height) {
  const gap = Math.round(width * 0.008);
  const frame = Math.round(width * 0.012);
  const innerX = frame, innerY = frame;
  const innerW = width - frame * 2, innerH = height - frame * 2;
  if (layout === 'grid') {
    const cw = (innerW - gap) / 2, ch = (innerH - gap) / 2;
    return [
      { x: innerX, y: innerY, w: cw, h: ch },
      { x: innerX + cw + gap, y: innerY, w: cw, h: ch },
      { x: innerX, y: innerY + ch + gap, w: cw, h: ch },
      { x: innerX + cw + gap, y: innerY + ch + gap, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const heroH = innerH * 0.62;
    const stripH = innerH - heroH - gap;
    const sw = (innerW - gap * 2) / 3;
    return [
      { x: innerX, y: innerY, w: innerW, h: heroH },
      { x: innerX, y: innerY + heroH + gap, w: sw, h: stripH },
      { x: innerX + sw + gap, y: innerY + heroH + gap, w: sw, h: stripH },
      { x: innerX + (sw + gap) * 2, y: innerY + heroH + gap, w: sw, h: stripH },
    ];
  }
  if (layout === 'vertical') {
    const cw = (innerW - gap * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: innerX + i * (cw + gap), y: innerY, w: cw, h: innerH }));
  }
  const cw = (innerW - gap) / 2;
  return [
    { x: innerX, y: innerY, w: cw, h: innerH },
    { x: innerX + cw + gap, y: innerY, w: cw, h: innerH },
  ];
}

function seededRandom(seed) {
  let value = seed * 9301 + 49297;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function drawPanelPhoto(ctx, rect, panel, photo, panelIndex) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = '#241533';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (photo && photo.image) {
    const img = photo.image;
    const baseScale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const scale = baseScale * panel.zoom;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const cx = rect.x + rect.w / 2 + (panel.panX / 100) * rect.w * 0.5;
    const cy = rect.y + rect.h / 2 + (panel.panY / 100) * rect.h * 0.5;
    ctx.translate(cx, cy);
    ctx.rotate((panel.rotation * Math.PI) / 180);
    ctx.scale(panel.flipped ? -1 : 1, 1);
    ctx.filter = GRADE_STYLES[state.grade].filter;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = 'none';
  } else {
    drawSunsetPlaceholder(ctx, rect, panelIndex);
  }
  ctx.restore();
}

function drawSunsetPlaceholder(ctx, rect, seed) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  gradient.addColorStop(0, '#2b0f4d');
  gradient.addColorStop(0.5, '#ff7a18');
  gradient.addColorStop(1, '#ff2e88');
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = '#ffd319';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w * 0.5, rect.y + rect.h * 0.62, rect.w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0f2e';
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w * 0.3, rect.y + rect.h * 0.55);
  ctx.lineTo(rect.x + rect.w * 0.55, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w * 0.75, rect.y + rect.h * 0.62);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
  ctx.closePath();
  ctx.fill();
  void seed;
}

function applyGradeOverlay(ctx, rect, panelIndex) {
  const style = GRADE_STYLES[state.grade];
  const strength = state.gradeStrength / 100;
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  gradient.addColorStop(0, style.top);
  gradient.addColorStop(0.55, style.mid);
  gradient.addColorStop(1, style.bottom);
  ctx.save();
  ctx.globalAlpha = 0.16 * strength + 0.04;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.10 * strength;
  const shade = ctx.createLinearGradient(rect.x, rect.y + rect.h * 0.55, rect.x, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(10,2,24,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  drawGrain(ctx, rect, panelIndex);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, rect.w * 0.006);
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.restore();
}

function drawGrain(ctx, rect, seed) {
  const rand = seededRandom(seed * 7919 + 13);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 220; i++) {
    const x = rect.x + rand() * rect.w;
    const y = rect.y + rand() * rect.h;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

function drawLettering(ctx, width, height) {
  const frame = Math.round(width * 0.012);
  const titleSize = Math.round(width * (state.title.length > 12 ? 0.075 : 0.105));
  const tagSize = Math.round(width * 0.024);
  const bySize = Math.round(width * 0.02);
  const bandH = titleSize * 2.1;
  const bandY = state.titlePosition === 'top' ? frame : height - frame - bandH;
  ctx.save();
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (state.titlePosition === 'top') {
    scrim.addColorStop(0, 'rgba(8,2,20,0.82)');
    scrim.addColorStop(1, 'rgba(8,2,20,0)');
  } else {
    scrim.addColorStop(0, 'rgba(8,2,20,0)');
    scrim.addColorStop(1, 'rgba(8,2,20,0.88)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(frame, bandY, width - frame * 2, bandH);
  const centerX = width / 2;
  const titleY = state.titlePosition === 'top' ? bandY + titleSize * 1.05 : bandY + titleSize * 0.95;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${titleSize}px "Arial Black", Impact, "Segoe UI", sans-serif`;
  ctx.shadowColor = 'rgba(255,46,136,0.85)';
  ctx.shadowBlur = titleSize * 0.18;
  ctx.shadowOffsetY = titleSize * 0.05;
  ctx.lineJoin = 'round';
  ctx.lineWidth = titleSize * 0.14;
  ctx.strokeStyle = '#12041f';
  ctx.strokeText(state.title.toUpperCase(), centerX, titleY);
  const titleFill = ctx.createLinearGradient(0, titleY - titleSize / 2, 0, titleY + titleSize / 2);
  titleFill.addColorStop(0, '#fff7d6');
  titleFill.addColorStop(0.5, '#ffd319');
  titleFill.addColorStop(1, '#ff7a18');
  ctx.fillStyle = titleFill;
  ctx.fillText(state.title.toUpperCase(), centerX, titleY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.font = `700 ${tagSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = tagSize * 0.22;
  ctx.strokeStyle = 'rgba(10,2,24,0.9)';
  const tagY = titleY + titleSize * 0.62;
  ctx.strokeText(state.tagline, centerX, tagY);
  ctx.fillText(state.tagline, centerX, tagY);
  ctx.font = `800 ${bySize}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#19e3ff';
  const byY = state.titlePosition === 'top' ? height - frame - bySize : frame + bySize;
  ctx.fillText(state.byline.toUpperCase(), centerX, byY);
  ctx.restore();
}

function drawPosterBorder(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = '#f5efff';
  ctx.lineWidth = Math.max(3, width * 0.004);
  ctx.strokeRect(2, 2, width - 4, height - 4);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(2, width * 0.002);
  ctx.strokeRect(Math.round(width * 0.012), Math.round(height * 0.012), width - Math.round(width * 0.024), height - Math.round(height * 0.024));
  ctx.restore();
}

function drawCover(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#1a0f2e');
  bg.addColorStop(1, '#0d0618');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const rects = layoutRects(state.layout, width, height);
  rects.forEach((rect, index) => {
    const panel = state.panels[index] || { photo: 0, zoom: 1, panX: 0, panY: 0, rotation: 0, flipped: false };
    drawPanelPhoto(ctx, rect, panel, state.photos[panel.photo], index);
    applyGradeOverlay(ctx, rect, index);
  });
  drawLettering(ctx, width, height);
  drawPosterBorder(ctx, width, height);
}

function renderPreview() {
  const [exportW, exportH] = EXPORT_SIZES[state.exportSize];
  const scale = Math.min(960 / exportW, 540 / exportH);
  const previewW = Math.round(exportW * scale);
  const previewH = Math.round(exportH * scale);
  previewCanvas.width = previewW;
  previewCanvas.height = previewH;
  drawCover(previewCtx, previewW, previewH);
  document.getElementById('metaLayout').textContent = LAYOUT_NAMES[state.layout];
  document.getElementById('metaGrade').textContent = GRADE_NAMES[state.grade];
  document.getElementById('metaSize').textContent = state.exportSize.replace('x', ' × ');
  document.getElementById('metaPhotos').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded`;
  document.getElementById('zoomValue').textContent = `${Math.round((state.panels[state.selectedPanel]?.zoom ?? 1) * 100)}%`;
  document.getElementById('gradeStrengthValue').textContent = `${state.gradeStrength}%`;
}

function exportCover() {
  const [width, height] = EXPORT_SIZES[state.exportSize];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas.getContext('2d'), width, height);
  const status = document.getElementById('exportStatus');
  status.textContent = 'Rendering your PNG…';
  canvas.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed — try again.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vice-cover-${state.exportSize}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status.textContent = `Exported ${width} × ${height} PNG — check your downloads.`;
  }, 'image/png');
}

function loadImageFromUrl(url, name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ name, image, url });
    image.onerror = () => reject(new Error(`Could not load ${name}`));
    image.src = url;
  });
}

async function loadDemoPhotos() {
  for (const path of DEMO_PHOTOS) {
    try {
      const photo = await loadImageFromUrl(path, path.split('/').pop());
      state.photos.push(photo);
    } catch (error) {
      console.warn(error.message);
    }
  }
  rebuildPhotoThumbs();
  renderPreview();
}

function rebuildPhotoThumbs() {
  const holder = document.getElementById('photoThumbs');
  holder.innerHTML = '';
  state.photos.forEach((photo, index) => {
    const thumb = document.createElement('img');
    thumb.className = 'photo-thumb' + (index === state.selectedPhoto ? ' selected' : '');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    thumb.title = photo.name;
    thumb.addEventListener('click', () => {
      state.selectedPhoto = index;
      const panel = state.panels[state.selectedPanel];
      if (panel) panel.photo = index;
      rebuildPhotoThumbs();
      renderPreview();
    });
    holder.appendChild(thumb);
  });
  for (let i = state.photos.length; i < 4; i++) {
    const empty = document.createElement('div');
    empty.className = 'photo-thumb empty';
    empty.textContent = '+';
    empty.title = 'Upload a photo';
    holder.appendChild(empty);
  }
}

function rebuildPanelPicker() {
  const holder = document.getElementById('panelPicker');
  holder.innerHTML = '';
  state.panels.forEach((panel, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-pick' + (index === state.selectedPanel ? ' active' : '');
    button.textContent = `Panel ${index + 1}`;
    button.addEventListener('click', () => {
      state.selectedPanel = index;
      state.selectedPhoto = panel.photo;
      rebuildPanelPicker();
      syncPanelControls();
      renderPreview();
    });
    holder.appendChild(button);
  });
}

function syncPanelControls() {
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  document.getElementById('zoomSlider').value = String(Math.round(panel.zoom * 100));
  document.getElementById('panXSlider').value = String(panel.panX);
  document.getElementById('panYSlider').value = String(panel.panY);
}

function syncLayoutButtons() {
  document.querySelectorAll('#layoutButtons .chip-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeButtons .chip-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.grade === state.grade);
  });
  document.querySelectorAll('#exportSizeButtons .chip-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.exportSize === state.exportSize);
  });
  document.querySelectorAll('#titlePositionButtons .chip-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.titlePos === state.titlePosition);
  });
}

function wireControls() {
  document.getElementById('photoInput').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 4 - state.photos.length);
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const photo = await loadImageFromUrl(url, file.name);
        state.photos.push(photo);
      } catch (error) {
        console.warn(error.message);
      }
    }
    if (state.photos.length) state.selectedPhoto = state.photos.length - 1;
    rebuildPhotoThumbs();
    renderPreview();
    event.target.value = '';
  });

  document.querySelectorAll('#layoutButtons .chip-button').forEach((button) => {
    button.addEventListener('click', () => applyLayout(button.dataset.layout));
  });
  document.querySelectorAll('#gradeButtons .chip-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.grade = button.dataset.grade;
      syncLayoutButtons();
      renderPreview();
    });
  });
  document.querySelectorAll('#exportSizeButtons .chip-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.exportSize = button.dataset.exportSize;
      syncLayoutButtons();
      renderPreview();
    });
  });
  document.querySelectorAll('#titlePositionButtons .chip-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.titlePosition = button.dataset.titlePos;
      syncLayoutButtons();
      renderPreview();
    });
  });

  document.getElementById('shuffleLayoutButton').addEventListener('click', () => {
    const layouts = Object.keys(LAYOUT_NAMES).filter((name) => name !== state.layout);
    const grades = Object.keys(GRADE_NAMES).filter((name) => name !== state.grade);
    applyLayout(layouts[Math.floor(Math.random() * layouts.length)]);
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    syncLayoutButtons();
    renderPreview();
  });
  document.getElementById('resetButton').addEventListener('click', () => {
    state.grade = 'sunset';
    state.gradeStrength = 70;
    state.title = 'VICE HEIST';
    state.tagline = 'One last sunset. One last score.';
    state.byline = 'STARRING YOU';
    state.titlePosition = 'top';
    state.exportSize = '1920x1080';
    document.getElementById('titleInput').value = state.title;
    document.getElementById('taglineInput').value = state.tagline;
    document.getElementById('nameInput').value = state.byline;
    document.getElementById('gradeStrength').value = '70';
    applyLayout('grid');
    syncLayoutButtons();
    renderPreview();
  });

  document.getElementById('zoomSlider').addEventListener('input', (event) => {
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.zoom = Number(event.target.value) / 100;
    renderPreview();
  });
  document.getElementById('panXSlider').addEventListener('input', (event) => {
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.panX = Number(event.target.value);
    renderPreview();
  });
  document.getElementById('panYSlider').addEventListener('input', (event) => {
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.panY = Number(event.target.value);
    renderPreview();
  });
  document.getElementById('rotateButton').addEventListener('click', () => {
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.rotation = (panel.rotation + 90) % 360;
    renderPreview();
  });
  document.getElementById('flipButton').addEventListener('click', () => {
    const panel = state.panels[state.selectedPanel];
    if (panel) panel.flipped = !panel.flipped;
    renderPreview();
  });
  document.getElementById('swapPhotoButton').addEventListener('click', () => {
    const panel = state.panels[state.selectedPanel];
    if (panel && state.photos.length) {
      panel.photo = (panel.photo + 1) % state.photos.length;
      state.selectedPhoto = panel.photo;
      rebuildPhotoThumbs();
      renderPreview();
    }
  });

  document.getElementById('gradeStrength').addEventListener('input', (event) => {
    state.gradeStrength = Number(event.target.value);
    renderPreview();
  });
  document.getElementById('titleInput').addEventListener('input', (event) => {
    state.title = event.target.value || 'VICE HEIST';
    renderPreview();
  });
  document.getElementById('taglineInput').addEventListener('input', (event) => {
    state.tagline = event.target.value;
    renderPreview();
  });
  document.getElementById('nameInput').addEventListener('input', (event) => {
    state.byline = event.target.value || 'STARRING YOU';
    renderPreview();
  });
  document.getElementById('exportButton').addEventListener('click', exportCover);

  let dragging = false;
  let lastX = 0, lastY = 0;
  previewCanvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    previewCanvas.setPointerCapture(event.pointerId);
  });
  previewCanvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const panel = state.panels[state.selectedPanel];
    if (!panel) return;
    const scale = previewCanvas.width / previewCanvas.clientWidth;
    panel.panX += ((event.clientX - lastX) * scale / previewCanvas.width) * 120;
    panel.panY += ((event.clientY - lastY) * scale / previewCanvas.height) * 120;
    panel.panX = Math.max(-100, Math.min(100, panel.panX));
    panel.panY = Math.max(-100, Math.min(100, panel.panY));
    lastX = event.clientX;
    lastY = event.clientY;
    syncPanelControls();
    renderPreview();
  });
  const stopDrag = () => { dragging = false; };
  previewCanvas.addEventListener('pointerup', stopDrag);
  previewCanvas.addEventListener('pointercancel', stopDrag);
}

async function applyShotMode() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const caption = params.get('caption');
  if (caption) {
    state.title = caption;
    document.getElementById('titleInput').value = caption;
  }
  const photoName = params.get('photo');
  if (photoName) {
    try {
      const photo = await loadImageFromUrl(`samples/${photoName}.jpg`, `${photoName}.jpg`);
      state.photos = [photo];
      if (photoName === 'boulevard') {
        const second = await loadImageFromUrl('samples/pier.jpg', 'pier.jpg');
        state.photos.push(second);
      } else {
        // One photo supplied: reuse it in every panel so no panel is empty.
        state.photos.push(photo);
      }
    } catch (error) {
      console.warn(error.message);
    }
  }
  const layout = params.get('layout');
  if (layout && LAYOUT_NAMES[layout]) state.layout = layout;
  const grade = params.get('grade');
  if (grade && GRADE_NAMES[grade]) state.grade = grade;
  const size = params.get('size');
  if (size && EXPORT_SIZES[size]) state.exportSize = size;
  state.panels = defaultPanels(panelCountForLayout(state.layout));
  if (state.layout === 'vertical') {
    // Same photo in all three columns: give each a different crop so the
    // panels read as three shots, not one photo repeated.
    state.panels[1].zoom = 1.6;
    state.panels[1].panX = -30;
    state.panels[2].zoom = 1.35;
    state.panels[2].panY = 18;
  }
  rebuildPhotoThumbs();
  rebuildPanelPicker();
  syncLayoutButtons();
  renderPreview();
  if (shot === 'cover') {
    const [width, height] = EXPORT_SIZES[state.exportSize];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    drawCover(canvas.getContext('2d'), width, height);
    document.body.classList.add('shot-cover');
    shotImage.src = canvas.toDataURL('image/jpeg', 0.88);
    shotImage.alt = `Exported cover: ${state.title}`;
  }
  return true;
}

async function startStudio() {
  state.panels = defaultPanels(4);
  wireControls();
  rebuildPanelPicker();
  syncPanelControls();
  const inShotMode = await applyShotMode();
  if (!inShotMode) {
    await loadDemoPhotos();
  }
  renderPreview();
}

startStudio();
