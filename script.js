// FaceVision - Face Detection & Recognition
// By: AI Assistant

// --- GLOBALS ---
let modelsLoaded = false;
let labeledDescriptors = [];
let faceMatcher = null;
let history = [];
let currentStream = null;
let currentSection = 'live';

// --- THEME TOGGLE ---
function setTheme(mode) {
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(mode + '-mode');
    localStorage.setItem('theme', mode);
}
function toggleTheme() {
    const mode = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    setTheme(mode);
}
document.getElementById('theme-toggle').onclick = toggleTheme;
window.onload = () => {
    setTheme(localStorage.getItem('theme') || 'dark');
};

// --- NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById('section-' + btn.dataset.section).classList.add('active');
        currentSection = btn.dataset.section;
        if (currentSection === 'history') renderHistory();
    };
});

// --- LOADING OVERLAY ---
function showLoading(msg = 'Loading...') {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-overlay').querySelector('p').textContent = msg;
}
function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// --- FACE-API.JS MODEL LOADING ---
async function loadModels() {
    showLoading('Loading AI models & preparing camera...');
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models/';
    console.log('Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL); console.log('TinyFaceDetector loaded');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL); console.log('Landmark68 loaded');
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL); console.log('RecognitionNet loaded');
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL); console.log('SSD Mobilenet loaded');
    modelsLoaded = true;
    hideLoading();
}

// --- INIT ---
(async function init() {
    await loadModels();
    loadLabeledDescriptors();
    setupCamera();
    setupUpload();
    setupRegister();
    renderHistory();
})();

// --- FACE DATA STORAGE (Local) ---
function saveLabeledDescriptors() {
    localStorage.setItem('facevision_faces', JSON.stringify(labeledDescriptors.map(ld => ({
        label: ld.label,
        descriptors: ld.descriptors.map(d => Array.from(d))
    }))));
}
function loadLabeledDescriptors() {
    const data = localStorage.getItem('facevision_faces');
    if (data) {
        labeledDescriptors = JSON.parse(data).map(ld => new faceapi.LabeledFaceDescriptors(
            ld.label,
            ld.descriptors.map(d => new Float32Array(d))
        ));
        if (labeledDescriptors.length > 0) faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
    }
}

// --- HISTORY STORAGE ---
function saveHistory() {
    localStorage.setItem('facevision_history', JSON.stringify(history));
}
function loadHistory() {
    const data = localStorage.getItem('facevision_history');
    if (data) history = JSON.parse(data);
}

// --- CAMERA MODULE ---
async function setupCamera() {
    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');
    const startBtn = document.getElementById('start-camera');
    const stopBtn = document.getElementById('stop-camera');
    let detecting = false;

    startBtn.onclick = async () => {
        if (currentStream) return;
        showLoading('Starting camera...');
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = currentStream;
            await video.play();
            hideLoading();
            detecting = true;
            detectLoop();
        } catch (e) {
            alert('Camera access denied!');
            hideLoading();
        }
    };
    stopBtn.onclick = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            video.srcObject = null;
            overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
            detecting = false;
        }
    };

    async function detectLoop() {
        if (!detecting || !modelsLoaded) return;
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
        let results = [];
        if (detections.length && faceMatcher) {
            results = detections.map(det => {
                const best = faceMatcher.findBestMatch(det.descriptor);
                drawBox(det.detection.box, best.label, overlay);
                return { label: best.label, box: det.detection.box, confidence: best.distance };
            });
        } else {
            detections.forEach(det => drawBox(det.detection.box, 'Unknown', overlay));
        }
        renderLiveResults(results);
        requestAnimationFrame(detectLoop);
    }
}

function drawBox(box, label, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = label === 'Unknown' ? '#ff4d4f' : '#4f8cff';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.font = 'bold 16px Montserrat';
    ctx.fillStyle = label === 'Unknown' ? '#ff4d4f' : '#4f8cff';
    ctx.fillText(label, box.x + 4, box.y - 8 < 0 ? box.y + 18 : box.y - 8);
}

function renderLiveResults(results) {
    const area = document.getElementById('live-results');
    area.innerHTML = '';
    if (!results.length) return;
    results.forEach(r => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `<div class="avatar"><i class="fas fa-user"></i></div>
            <div class="name">${r.label}</div>
            <div class="confidence">${r.confidence ? 'Confidence: ' + (1 - r.confidence).toFixed(2) : ''}</div>`;
        area.appendChild(card);
        if (r.label !== 'Unknown') addToHistory(r.label);
    });
}

// --- UPLOAD MODULE ---
function setupUpload() {
    const uploadInput = document.getElementById('image-upload');
    const uploadLabel = document.querySelector('.upload-label');
    const uploadArea = document.getElementById('upload-area');
    const uploadedImg = document.getElementById('uploaded-image');
    const overlay = document.getElementById('upload-overlay');
    uploadLabel.onclick = () => uploadInput.click();
    uploadInput.onchange = handleFile;
    uploadArea.ondragover = e => { e.preventDefault(); uploadArea.classList.add('drag'); };
    uploadArea.ondragleave = e => { e.preventDefault(); uploadArea.classList.remove('drag'); };
    uploadArea.ondrop = e => {
        e.preventDefault();
        uploadArea.classList.remove('drag');
        if (e.dataTransfer.files.length) {
            uploadInput.files = e.dataTransfer.files;
            handleFile();
        }
    };
    function handleFile() {
        const file = uploadInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            uploadedImg.src = e.target.result;
            uploadedImg.style.display = 'block';
            detectOnImage(uploadedImg, overlay, 'upload-results');
        };
        reader.readAsDataURL(file);
    }
}

async function detectOnImage(img, overlay, resultsId) {
    showLoading('Detecting faces...');
    await img.decode?.();
    overlay.width = img.naturalWidth;
    overlay.height = img.naturalHeight;
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
    let results = [];
    if (detections.length && faceMatcher) {
        results = detections.map(det => {
            const best = faceMatcher.findBestMatch(det.descriptor);
            drawBox(det.detection.box, best.label, overlay);
            return { label: best.label, box: det.detection.box, confidence: best.distance };
        });
    } else {
        detections.forEach(det => drawBox(det.detection.box, 'Unknown', overlay));
    }
    renderResults(results, resultsId);
    hideLoading();
}

function renderResults(results, id) {
    const area = document.getElementById(id);
    area.innerHTML = '';
    if (!results.length) return;
    results.forEach(r => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `<div class="avatar"><i class="fas fa-user"></i></div>
            <div class="name">${r.label}</div>
            <div class="confidence">${r.confidence ? 'Confidence: ' + (1 - r.confidence).toFixed(2) : ''}</div>`;
        area.appendChild(card);
        if (r.label !== 'Unknown') addToHistory(r.label);
    });
}

// --- REGISTER MODULE ---
function setupRegister() {
    const camBtn = document.getElementById('register-from-camera');
    const uploadBtn = document.getElementById('register-from-upload');
    const preview = document.getElementById('register-preview');
    const form = document.getElementById('register-form');
    const nameInput = document.getElementById('register-name');
    const saveBtn = document.getElementById('save-face');
    let captureImg = null;

    camBtn.onclick = async () => {
        showLoading('Accessing camera...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;
            preview.innerHTML = '';
            preview.appendChild(video);
            await video.play();
            hideLoading();
            setTimeout(async () => {
                // Capture frame
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                captureImg = canvas;
                preview.innerHTML = '';
                preview.appendChild(canvas);
                stream.getTracks().forEach(track => track.stop());
                form.style.display = 'flex';
            }, 1200);
        } catch (e) {
            alert('Camera access denied!');
            hideLoading();
        }
    };
    uploadBtn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.onload = () => {
                    preview.innerHTML = '';
                    preview.appendChild(img);
                    captureImg = img;
                    form.style.display = 'flex';
                };
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };
    saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) return alert('Please enter a name!');
        if (!captureImg) return alert('No image to register!');
        showLoading('Registering face...');
        const detections = await faceapi.detectSingleFace(captureImg, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (!detections) {
            hideLoading();
            return alert('No face detected!');
        }
        labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(name, [detections.descriptor]));
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
        saveLabeledDescriptors();
        hideLoading();
        preview.innerHTML = '';
        form.style.display = 'none';
        nameInput.value = '';
        document.getElementById('register-results').innerHTML = `<div class='result-card'><div class='avatar'><i class='fas fa-user'></i></div><div class='name'>${name}</div><div>Registered!</div></div>`;
    };
}

// --- HISTORY MODULE ---
function addToHistory(label) {
    const now = new Date();
    history.unshift({ label, time: now.toLocaleString() });
    if (history.length > 30) history = history.slice(0, 30);
    saveHistory();
    renderHistory();
}
function renderHistory() {
    loadHistory();
    const area = document.getElementById('history-list');
    area.innerHTML = '';
    if (!history.length) {
        area.innerHTML = '<div style="opacity:0.7;">No recognition history yet.</div>';
        return;
    }
    history.forEach(h => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `<div class='avatar'><i class='fas fa-user'></i></div><div class='name'>${h.label}</div><div class='timestamp'>${h.time}</div>`;
        area.appendChild(card);
    });
}

// DEBUG: Hide loading after 10s max
setTimeout(() => { hideLoading(); console.log('Force hide loading after 10s'); }, 10000);

navigator.mediaDevices.getUserMedia({video:true})
  .then(stream => { alert('Camera working!'); stream.getTracks().forEach(t=>t.stop()); })
  .catch(e => alert('Camera error: ' + e)); 