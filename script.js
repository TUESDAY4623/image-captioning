/* ─────────────────────────────────────────────────────────────────────────
   VisionAI — script.js
   Full AI image captioning with MobileNet + natural language generation
───────────────────────────────────────────────────────────────────────── */

'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────
const state = {
    model: null,
    modelReady: false,
    currentImage: null,      // HTMLImageElement
    currentFile: null,
    currentPredictions: [],
    currentCaption: '',
    captionStyle: 'descriptive',
    captionLength: 2,        // 1=short 2=medium 3=long
    history: [],
    speaking: false,
};

// ── DOM REFS ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const uploadArea = $('uploadArea');
const fileInput = $('fileInput');
const previewImage = $('previewImage');
const uploadSection = $('uploadSection');
const previewSection = $('imagePreviewSection');
const analysisGrid = $('analysisGrid');
const captionSection = $('captionSection');
const captionText = $('captionText');
const confidenceFill = $('confidenceFill');
const confidenceText = $('confidenceText');
const colorSwatches = $('colorSwatches');
const sceneInfo = $('sceneInfo');
const tagsWrap = $('tagsWrap');
const classifications = $('classifications');
const imageMeta = $('imageMeta');
const historySection = $('historySection');
const historyList = $('historyList');
const loadingOverlay = $('loadingOverlay');
const progressFill = $('progressFill');
const loadingMsg = $('loadingMsg');
const statusDot = $('statusDot');
const statusText = $('statusText');

// ── MODEL LOADING ─────────────────────────────────────────────────────────
async function loadModel() {
    try {
        statusDot.className = 'status-dot loading';
        statusText.textContent = 'Loading MobileNet AI model…';
        state.model = await mobilenet.load({ version: 2, alpha: 1.0 });
        state.modelReady = true;
        statusDot.className = 'status-dot ready';
        statusText.textContent = 'AI model ready — drop an image to start';
        showToast('AI model loaded and ready ✓', 'success');
    } catch (err) {
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Model failed — check your internet connection';
        showToast('Failed to load AI model. Check internet.', 'error');
        console.error('Model load error:', err);
    }
}

// ── UPLOAD / DRAG-DROP ─────────────────────────────────────────────────────
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
    else showToast('Please drop a valid image file', 'error');
});

// ── PASTE SUPPORT ──────────────────────────────────────────────────────────
document.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            handleFile(item.getAsFile());
            break;
        }
    }
});

// ── HANDLE FILE ────────────────────────────────────────────────────────────
function handleFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
    state.currentFile = file;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        state.currentImage = img;
        previewImage.src = url;
        previewImage.onload = () => {
            showImageUI();
            analyzeImage(img);
        };
    };
    img.src = url;
}

// ── SHOW/HIDE SECTIONS ─────────────────────────────────────────────────────
function showImageUI() {
    uploadSection.style.display = 'none';
    previewSection.style.display = '';
    analysisGrid.style.display = '';
    captionSection.style.display = '';
}
function resetUI() {
    uploadSection.style.display = '';
    previewSection.style.display = 'none';
    analysisGrid.style.display = 'none';
    captionSection.style.display = 'none';
    fileInput.value = '';
    state.currentPredictions = [];
    state.currentCaption = '';
}

// ── IMAGE ANALYSIS ─────────────────────────────────────────────────────────
async function analyzeImage(img) {
    if (!state.modelReady) { showToast('AI model is still loading, please wait…', 'info'); return; }
    showLoading(true);
    setProgress(10, 'Running deep learning inference');
    captionText.innerHTML = '<i class="fas fa-spinner"></i> Analyzing image…';
    captionText.className = 'caption-text loading';
    try {
        await sleep(60); setProgress(30, 'Classifying visual features');
        const preds = await state.model.classify(img, 8);
        state.currentPredictions = preds;
        setProgress(55, 'Extracting color palette');
        const colors = extractColors(img);
        setProgress(70, 'Analyzing scene properties');
        const scene = analyzeScene(img);
        setProgress(85, 'Generating natural language caption');
        await sleep(40);
        // Render all analysis
        renderMeta(state.currentFile, img);
        renderColors(colors);
        renderScene(scene);
        renderTags(preds);
        renderClassifications(preds);
        // Generate caption
        const caption = generateCaption(preds, scene, colors, state.captionStyle, state.captionLength);
        state.currentCaption = caption;
        setProgress(100, 'Done!');
        await sleep(200);
        showLoading(false);
        renderCaption(caption, preds[0]?.probability ?? 0);
    } catch (err) {
        showLoading(false);
        captionText.className = 'caption-text';
        captionText.textContent = '⚠ Analysis failed. Please try another image.';
        showToast('Analysis failed: ' + err.message, 'error');
        console.error(err);
    }
}

// ── COLOR EXTRACTION ───────────────────────────────────────────────────────
function extractColors(img) {
    const canvas = document.createElement('canvas');
    const size = 80;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    // Simple k-means–inspired: bucket into grid of 64 colors
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i + 1] / 32) * 32;
        const b = Math.round(data[i + 2] / 32) * 32;
        const key = `${r},${g},${b}`;
        buckets[key] = (buckets[key] || 0) + 1;
    }
    const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    // Deduplicate similar colors
    const palette = [];
    for (const [key] of sorted) {
        const [r, g, b] = key.split(',').map(Number);
        const tooClose = palette.some(c => Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b) < 80);
        if (!tooClose) palette.push({ r, g, b, hex: rgbToHex(r, g, b) });
        if (palette.length >= 6) break;
    }
    return palette;
}
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
}

// ── SCENE ANALYSIS ────────────────────────────────────────────────────────
function analyzeScene(img) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 100, 100);
    const data = ctx.getImageData(0, 0, 100, 100).data;
    let r = 0, g = 0, b = 0, count = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    r /= count; g /= count; b /= count;
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const warmth = r > b ? (r - b) / 255 : 0;
    const coolness = b > r ? (b - r) / 255 : 0;
    // Saturation estimate
    const max = Math.max(r / 255, g / 255, b / 255), min = Math.min(r / 255, g / 255, b / 255);
    const saturation = max === 0 ? 0 : (max - min) / max;
    // Detect if mostly one color (colorfulness)
    const colorfulness = saturation > 0.25 ? 'Colorful' : brightness < 0.3 ? 'Dark/Monochrome' : 'Neutral';
    // Aspect ratio
    const aspect = img.naturalWidth / img.naturalHeight;
    const orientation = aspect > 1.2 ? 'Landscape' : aspect < 0.8 ? 'Portrait' : 'Square';
    return {
        brightness: Math.round(brightness * 100),
        warmth: Math.round(warmth * 100),
        saturation: Math.round(saturation * 100),
        colorfulness,
        orientation,
        avgR: Math.round(r), avgG: Math.round(g), avgB: Math.round(b),
    };
}

// ── CAPTION GENERATION ────────────────────────────────────────────────────
const ARTICLES = ['a', 'an', 'the'];
function article(word) {
    const vowels = 'aeiouAEIOU';
    return vowels.includes(word[0]) ? 'an' : 'a';
}

// Map class names to friendlier terms
function beautify(className) {
    return className
        .replace(/_/g, ' ')
        .replace(/,\s*\w+/g, '')  // remove secondary labels
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Build caption templates by style
function generateCaption(preds, scene, colors, style, length) {
    const top = preds.slice(0, 3).map(p => ({ name: beautify(p.className), prob: p.probability }));
    const main = top[0]?.name || 'subject';
    const second = top[1]?.name;
    const third = top[2]?.name;
    const art = article(main);

    const brightness = scene.brightness < 35 ? 'dark' : scene.brightness < 65 ? 'softly lit' : 'bright';
    const mood = scene.saturation > 50 ? 'vibrant' : scene.brightness < 40 ? 'moody' : 'calm';
    const toneAdj = scene.warmth > 25 ? 'warm' : scene.brightness > 70 ? 'cool' : 'natural';
    const domColor = colors[0] ? `a ${describeColor(colors[0])} palette` : 'varied tones';

    const short = {
        descriptive: `${art.charAt(0).toUpperCase() + art.slice(1)} ${main}.`,
        casual: `Looks like ${art} ${main}!`,
        creative: `${capitalize(main)} in the wild.`,
        technical: `Primary subject: ${main} (${(top[0]?.prob * 100).toFixed(1)}% confidence).`,
        short: `${capitalize(main)}.`,
    };

    const medium = {
        descriptive: `This image shows ${art} ${main}${second ? ` alongside what appears to be ${article(second)} ${second}` : ''}. The scene is ${brightness} with ${mood} tones.`,
        casual: `Oh wow, ${art} ${main}! ${second ? `Also spotted: ${article(second)} ${second}.` : ''} The vibe is very ${mood}!`,
        creative: `A ${toneAdj} moment frozen in time — ${art} ${main} ${second ? `and ${article(second)} ${second} ` : ''}emerge from ${domColor}.`,
        technical: `Detected: ${main} (${(top[0]?.prob * 100).toFixed(1)}%)${second ? `, ${second} (${(top[1]?.prob * 100).toFixed(1)}%)` : ''}. Image is ${scene.orientation.toLowerCase()}, brightness: ${scene.brightness}%.`,
        short: `${capitalize(main)}${second ? ` & ${second}` : ''}.`,
    };

    const long = {
        descriptive: `This ${scene.orientation.toLowerCase()} photograph features ${art} ${main} as its primary subject${second ? `, with elements of ${article(second)} ${second}${third ? ` and ${article(third)} ${third}` : ''}` : ''}. The image is ${brightness} and conveys ${article(mood)} ${mood} atmosphere, rendered in ${domColor}. Overall scene saturation is ${scene.saturation > 60 ? 'high' : scene.saturation > 30 ? 'moderate' : 'low'}, giving it a ${toneAdj} feel.`,
        casual: `Okay so this is clearly ${art} ${main}${second ? `, and you can also totally see ${article(second)} ${second}${third ? ` and even ${article(third)} ${third}` : ''}` : ''}! The whole thing feels really ${mood} — ${brightness} lighting, ${domColor}. Very ${toneAdj} energy overall!`,
        creative: `Through ${domColor}, a story unfolds: ${art} ${main}${second ? ` dances beside ${article(second)} ${second}` : ''} in ${article(mood)} ${mood} tableau. The ${brightness} light casts ${toneAdj} shadows, each hue whispering of ${third ? third : 'untold narratives'}. A ${scene.orientation.toLowerCase()} glimpse into a world both familiar and fleeting.`,
        technical: `Classification results — Top subject: ${main} (${(top[0]?.prob * 100).toFixed(1)}%)${second ? `; Secondary: ${second} (${(top[1]?.prob * 100).toFixed(1)}%)` : ''}${third ? `; Tertiary: ${third} (${(top[2]?.prob * 100).toFixed(1)}%)` : ''}. Image metadata: ${scene.orientation} orientation, brightness=${scene.brightness}%, saturation=${scene.saturation}%, avg RGB=(${scene.avgR},${scene.avgG},${scene.avgB}). Color complexity: ${scene.colorfulness}.`,
        short: `${capitalize(main)}${second ? `, ${second}` : ''}${third ? `, ${third}` : ''}.`,
    };

    const map = { 1: short, 2: medium, 3: long };
    return (map[length] || medium)[style] || medium.descriptive;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function describeColor({ r, g, b }) {
    if (r > 200 && g < 100 && b < 100) return 'vivid red';
    if (r < 100 && g > 180 && b < 100) return 'lush green';
    if (r < 100 && g < 100 && b > 200) return 'cool blue';
    if (r > 200 && g > 170 && b < 100) return 'golden amber';
    if (r > 200 && g < 120 && b > 150) return 'rose-tinted';
    if (r > 200 && g > 200 && b > 200) return 'bright white';
    if (r < 60 && g < 60 && b < 60) return 'deep black';
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) return 'neutral grey';
    return 'mixed';
}

// ── RENDER FUNCTIONS ──────────────────────────────────────────────────────
function renderCaption(caption, confidence) {
    captionText.className = 'caption-text';
    captionText.textContent = caption;
    const pct = Math.round(confidence * 100);
    confidenceFill.style.width = pct + '%';
    confidenceText.textContent = pct + '%';
}

function renderMeta(file, img) {
    const size = file ? formatBytes(file.size) : '';
    const res = `${img.naturalWidth}×${img.naturalHeight}`;
    const type = file ? file.type.split('/')[1].toUpperCase() : '';
    imageMeta.innerHTML = [
        type && `<span class="meta-badge">${type}</span>`,
        `<span class="meta-badge">${res}</span>`,
        size && `<span class="meta-badge">${size}</span>`,
    ].filter(Boolean).join('');
}

function renderColors(palette) {
    colorSwatches.innerHTML = palette.map(c =>
        `<div class="swatch" style="background:${c.hex}" data-hex="${c.hex}" title="${c.hex}" onclick="showToast('${c.hex} copied','info');navigator.clipboard.writeText('${c.hex}')"></div>`
    ).join('');
}

function renderScene(scene) {
    sceneInfo.innerHTML = `
    <div class="scene-row"><span class="scene-label">Brightness</span>
      <div class="brightness-bar"><div class="brightness-fill" style="width:${scene.brightness}%"></div></div>
      <span class="scene-val">${scene.brightness}%</span></div>
    <div class="scene-row"><span class="scene-label">Saturation</span><span class="scene-val">${scene.saturation}%</span></div>
    <div class="scene-row"><span class="scene-label">Orientation</span><span class="scene-val">${scene.orientation}</span></div>
    <div class="scene-row"><span class="scene-label">Colorfulness</span><span class="scene-val">${scene.colorfulness}</span></div>
    <div class="scene-row"><span class="scene-label">Avg RGB</span><span class="scene-val" style="font-size:.75rem">(${scene.avgR},${scene.avgG},${scene.avgB})</span></div>
  `;
}

function renderTags(preds) {
    const tags = [...new Set(preds.flatMap(p =>
        beautify(p.className).split(/\s+,?\s*/).filter(w => w.length > 2)
    ))].slice(0, 12);
    tagsWrap.innerHTML = tags.map(t =>
        `<span class="tag" onclick="insertTag('${t}')">${t}</span>`
    ).join('');
}

function renderClassifications(preds) {
    classifications.innerHTML = preds.slice(0, 6).map(p => {
        const pct = (p.probability * 100).toFixed(1);
        return `<div class="cls-row">
      <span class="cls-label">${beautify(p.className)}</span>
      <div class="cls-bar"><div class="cls-fill" style="width:${pct}%"></div></div>
      <span class="cls-pct">${pct}%</span>
    </div>`;
    }).join('');
}

// ── CAPTION STYLE TABS ─────────────────────────────────────────────────────
document.querySelectorAll('.style-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.style-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.captionStyle = tab.dataset.style;
        if (state.currentPredictions.length) {
            const caption = generateCaption(
                state.currentPredictions,
                analyzeScene(state.currentImage),
                extractColors(state.currentImage),
                state.captionStyle,
                state.captionLength
            );
            state.currentCaption = caption;
            renderCaption(caption, state.currentPredictions[0]?.probability || 0);
        }
    });
});

// ── LENGTH SLIDER ─────────────────────────────────────────────────────────
const lengthSlider = $('lengthSlider');
const lengthLabel = $('lengthLabel');
const labels = { 1: 'Short', 2: 'Medium', 3: 'Long' };
lengthSlider.addEventListener('input', () => {
    state.captionLength = +lengthSlider.value;
    lengthLabel.textContent = labels[state.captionLength];
    if (state.currentPredictions.length) {
        const caption = generateCaption(
            state.currentPredictions,
            analyzeScene(state.currentImage),
            extractColors(state.currentImage),
            state.captionStyle,
            state.captionLength
        );
        state.currentCaption = caption;
        renderCaption(caption, state.currentPredictions[0]?.probability || 0);
    }
});

// ── ACTION BUTTONS ─────────────────────────────────────────────────────────
$('regenerateBtn').addEventListener('click', () => {
    if (state.currentImage) analyzeImage(state.currentImage);
});

$('copyBtn').addEventListener('click', () => {
    if (!state.currentCaption) return;
    navigator.clipboard.writeText(state.currentCaption)
        .then(() => showToast('Caption copied to clipboard!', 'success'))
        .catch(() => showToast('Copy failed. Try manually.', 'error'));
});

$('speakBtn').addEventListener('click', () => {
    if (!state.currentCaption) return;
    if (state.speaking) { window.speechSynthesis.cancel(); state.speaking = false; $('speakBtn').innerHTML = '<i class="fas fa-volume-up"></i> Speak'; return; }
    const utt = new SpeechSynthesisUtterance(state.currentCaption);
    utt.rate = 0.95; utt.pitch = 1;
    utt.onend = () => { state.speaking = false; $('speakBtn').innerHTML = '<i class="fas fa-volume-up"></i> Speak'; };
    window.speechSynthesis.speak(utt);
    state.speaking = true;
    $('speakBtn').innerHTML = '<i class="fas fa-stop"></i> Stop';
});

$('saveBtn').addEventListener('click', () => {
    if (!state.currentCaption || !state.currentFile) return;
    saveToHistory();
});

$('shareBtn').addEventListener('click', async () => {
    if (!state.currentCaption) return;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'VisionAI Caption', text: state.currentCaption });
        } catch { /* user cancelled */ }
    } else {
        navigator.clipboard.writeText(state.currentCaption);
        showToast('Caption copied for sharing!', 'info');
    }
});

$('changeImageBtn').addEventListener('click', () => { fileInput.click(); });
$('clearBtn').addEventListener('click', () => { resetUI(); });

$('downloadImageBtn').addEventListener('click', () => {
    if (!state.currentFile) return;
    const url = URL.createObjectURL(state.currentFile);
    const a = document.createElement('a');
    a.href = url; a.download = state.currentFile.name;
    a.click(); URL.revokeObjectURL(url);
});

// Tags clicking appends to clipboard
window.insertTag = function (tag) {
    navigator.clipboard.writeText(tag).catch(() => { });
    showToast(`Tag "${tag}" copied`, 'info');
};

// ── HISTORY ───────────────────────────────────────────────────────────────
function saveToHistory() {
    if (!state.currentCaption || !previewImage.src) return;
    const entry = {
        id: Date.now(),
        caption: state.currentCaption,
        style: state.captionStyle,
        thumb: thumbify(previewImage),
        filename: state.currentFile?.name || 'image',
        time: new Date().toLocaleTimeString(),
    };
    state.history.unshift(entry);
    if (state.history.length > 20) state.history.pop();
    renderHistory();
    showToast('Saved to history ✓', 'success');
}

function thumbify(imgEl) {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 80;
    c.getContext('2d').drawImage(imgEl, 0, 0, 120, 80);
    return c.toDataURL('image/jpeg', 0.6);
}

function renderHistory() {
    if (state.history.length === 0) { historySection.style.display = 'none'; return; }
    historySection.style.display = '';
    historyList.innerHTML = state.history.map(entry => `
    <div class="history-item fade-up" onclick="recallHistory(${entry.id})">
      <img class="history-thumb" src="${entry.thumb}" alt="">
      <div class="history-info">
        <div class="history-caption">${entry.caption}</div>
        <div class="history-meta">
          <span>🕐 ${entry.time}</span>
          <span>📝 ${entry.style}</span>
          <span>📁 ${entry.filename}</span>
        </div>
      </div>
      <button class="history-del" onclick="event.stopPropagation();deleteHistory(${entry.id})">✕</button>
    </div>
  `).join('');
}

window.recallHistory = function (id) {
    const e = state.history.find(h => h.id === id);
    if (!e) return;
    captionText.className = 'caption-text';
    captionText.textContent = e.caption;
    state.currentCaption = e.caption;
};

window.deleteHistory = function (id) {
    state.history = state.history.filter(h => h.id !== id);
    renderHistory();
};

// ── LOADING UI ───────────────────────────────────────────────────────────
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
    if (!show) progressFill.style.width = '0%';
}
function setProgress(pct, msg) {
    progressFill.style.width = pct + '%';
    if (msg) loadingMsg.textContent = msg;
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const ids = { success: 'toastSuccess', error: 'toastError', info: 'toastInfo' };
    const msgIds = { success: 'toastSuccessMsg', error: 'toastErrorMsg', info: 'toastInfoMsg' };
    const el = $(ids[type]);
    const ml = $(msgIds[type]);
    if (!el) return;
    ml.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return; // let paste handler work
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') { if (state.currentImage) analyzeImage(state.currentImage); }
    if (e.key === 'c' && !e.ctrlKey) { if (state.currentCaption) { navigator.clipboard.writeText(state.currentCaption); showToast('Caption copied ✓', 'success'); } }
    if (e.key === 'Escape') { resetUI(); }
    if (e.key === 'u' || e.key === 'U') { fileInput.click(); }
});

// ── INIT ──────────────────────────────────────────────────────────────────
loadModel();
