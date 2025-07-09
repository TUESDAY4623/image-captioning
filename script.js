// Image Captioning AI Class
class ImageCaptioningAI {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.currentImage = null;
        this.history = [];
        this.maxHistoryItems = 10;
        
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        this.loadModel();
        this.loadHistory();
        this.addParticleEffects();
    }

    setupEventListeners() {
        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Buttons
        document.getElementById('change-image-btn').addEventListener('click', () => {
            this.resetImage();
        });

        document.getElementById('regenerate-btn').addEventListener('click', () => {
            if (this.currentImage) {
                this.generateCaption(this.currentImage);
            }
        });

        document.getElementById('copy-btn').addEventListener('click', () => {
            this.copyCaption();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'o':
                        e.preventDefault();
                        fileInput.click();
                        break;
                    case 'r':
                        e.preventDefault();
                        if (this.currentImage) {
                            this.generateCaption(this.currentImage);
                        }
                        break;
                }
            }
        });
    }

    async loadModel() {
        try {
            console.log('Loading MobileNet model...');
            
            // Load MobileNet model for feature extraction
            this.model = await mobilenet.load();
            this.isModelLoaded = true;
            
            console.log('Model loaded successfully!');
            this.showToast('AI model loaded successfully!', 'success');
        } catch (error) {
            console.error('Error loading model:', error);
            this.showToast('Failed to load AI model. Please refresh the page.', 'error');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select a valid image file.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.displayImage(e.target.result);
            this.currentImage = e.target.result;
            this.generateCaption(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    displayImage(imageSrc) {
        const previewImage = document.getElementById('preview-image');
        const uploadSection = document.getElementById('upload-area').parentElement;
        const imagePreviewSection = document.getElementById('image-preview-section');

        previewImage.src = imageSrc;
        uploadSection.style.display = 'none';
        imagePreviewSection.style.display = 'block';
        imagePreviewSection.classList.add('fade-in-up');
    }

    resetImage() {
        const uploadSection = document.getElementById('upload-area').parentElement;
        const imagePreviewSection = document.getElementById('image-preview-section');
        const captionSection = document.getElementById('caption-section');

        uploadSection.style.display = 'flex';
        imagePreviewSection.style.display = 'none';
        captionSection.style.display = 'none';
        
        this.currentImage = null;
        document.getElementById('file-input').value = '';
    }

    async generateCaption(imageSrc) {
        if (!this.isModelLoaded) {
            this.showToast('AI model is still loading. Please wait...', 'error');
            return;
        }

        this.showLoading(true);
        this.updateProgress(0);

        try {
            // Create image element for TensorFlow.js
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = async () => {
                try {
                    // Extract features using MobileNet
                    this.updateProgress(30);
                    const features = await this.extractFeatures(img);
                    
                    this.updateProgress(60);
                    
                    // Generate caption based on features
                    const caption = await this.generateCaptionFromFeatures(features);
                    
                    this.updateProgress(90);
                    
                    // Display results
                    this.displayCaption(caption);
                    this.addToHistory(caption);
                    
                    this.updateProgress(100);
                    
                    setTimeout(() => {
                        this.showLoading(false);
                    }, 500);
                    
                } catch (error) {
                    console.error('Error generating caption:', error);
                    this.showToast('Error generating caption. Please try again.', 'error');
                    this.showLoading(false);
                }
            };
            
            img.src = imageSrc;
            
        } catch (error) {
            console.error('Error processing image:', error);
            this.showToast('Error processing image. Please try again.', 'error');
            this.showLoading(false);
        }
    }

    async extractFeatures(img) {
        // Use MobileNet to extract features
        const predictions = await this.model.classify(img);
        
        // Get top predictions
        const topPredictions = predictions.slice(0, 5);
        
        // Create feature vector
        const features = {
            objects: topPredictions.map(p => p.className),
            confidence: topPredictions.map(p => p.probability),
            dominantObject: topPredictions[0]?.className || 'object',
            overallConfidence: topPredictions[0]?.probability || 0
        };
        
        return features;
    }

    async generateCaptionFromFeatures(features) {
        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { objects, confidence, dominantObject, overallConfidence } = features;
        
        // Generate caption based on detected objects
        let caption = this.createCaptionFromObjects(objects, confidence);
        
        // Add confidence score
        const confidencePercent = Math.round(overallConfidence * 100);
        
        return {
            text: caption,
            confidence: confidencePercent,
            objects: objects,
            features: features
        };
    }

    createCaptionFromObjects(objects, confidence) {
        const templates = [
            "A {object} in the image",
            "The image shows a {object}",
            "There is a {object} visible",
            "This appears to be a {object}",
            "The main subject is a {object}",
            "I can see a {object} in this image",
            "This image contains a {object}",
            "A {object} is prominently featured"
        ];
        
        const object = objects[0]?.toLowerCase() || 'object';
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        let caption = template.replace('{object}', object);
        
        // Add additional objects if confidence is high
        if (objects.length > 1 && confidence[1] > 0.3) {
            caption += ` along with a ${objects[1].toLowerCase()}`;
        }
        
        // Add descriptive elements based on confidence
        if (confidence[0] > 0.8) {
            caption += " with high clarity";
        } else if (confidence[0] > 0.5) {
            caption += " with moderate clarity";
        }
        
        return caption;
    }

    displayCaption(captionData) {
        const captionSection = document.getElementById('caption-section');
        const captionText = document.getElementById('caption-text');
        const confidenceFill = document.getElementById('confidence-fill');
        const confidenceText = document.getElementById('confidence-text');

        captionText.textContent = captionData.text;
        confidenceFill.style.width = `${captionData.confidence}%`;
        confidenceText.textContent = `${captionData.confidence}%`;

        captionSection.style.display = 'block';
        captionSection.classList.add('fade-in-up');
        
        // Add particle effect
        this.addParticleEffect(captionSection);
    }

    copyCaption() {
        const captionText = document.getElementById('caption-text').textContent;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(captionText).then(() => {
                this.showToast('Caption copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyTextToClipboard(captionText);
            });
        } else {
            this.fallbackCopyTextToClipboard(captionText);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Caption copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy caption.', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    addToHistory(captionData) {
        const historyItem = {
            text: captionData.text,
            confidence: captionData.confidence,
            timestamp: new Date().toLocaleString(),
            objects: captionData.objects
        };
        
        this.history.unshift(historyItem);
        
        // Keep only recent items
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(0, this.maxHistoryItems);
        }
        
        this.saveHistory();
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historySection = document.getElementById('history-section');
        const historyList = document.getElementById('history-list');
        
        if (this.history.length === 0) {
            historySection.style.display = 'none';
            return;
        }
        
        historySection.style.display = 'block';
        historyList.innerHTML = '';
        
        this.history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item fade-in-up';
            historyItem.style.animationDelay = `${index * 0.1}s`;
            
            historyItem.innerHTML = `
                <div class="caption">${item.text}</div>
                <div class="timestamp">${item.timestamp} • Confidence: ${item.confidence}%</div>
            `;
            
            historyList.appendChild(historyItem);
        });
    }

    saveHistory() {
        try {
            localStorage.setItem('imageCaptioningHistory', JSON.stringify(this.history));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('imageCaptioningHistory');
            if (saved) {
                this.history = JSON.parse(saved);
                this.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    updateProgress(percent) {
        const progressFill = document.getElementById('progress-fill');
        progressFill.style.width = `${percent}%`;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById(`${type === 'error' ? 'error' : 'success'}-toast`);
        const toastText = toast.querySelector('span');
        
        toastText.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    addParticleEffects() {
        // Add floating particles to the background
        for (let i = 0; i < 20; i++) {
            this.createParticle();
        }
    }

    createParticle() {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const size = Math.random() * 3 + 1;
        const duration = Math.random() * 20 + 10;
        
        particle.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            animation-duration: ${duration}s;
        `;
        
        document.body.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
            this.createParticle();
        }, duration * 1000);
    }

    addParticleEffect(element) {
        const rect = element.getBoundingClientRect();
        const colors = ['#4ecdc4', '#ff6b6b', '#feca57', '#45b7d1'];
        
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.style.cssText = `
                left: ${x}px;
                top: ${y}px;
                background: ${color};
                z-index: 1000;
            `;
            
            document.body.appendChild(particle);
            
            const angle = (i / 8) * Math.PI * 2;
            const velocity = 50;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            
            let opacity = 1;
            const animate = () => {
                opacity -= 0.02;
                particle.style.opacity = opacity;
                particle.style.left = (parseFloat(particle.style.left) + vx * 0.1) + 'px';
                particle.style.top = (parseFloat(particle.style.top) + vy * 0.1) + 'px';
                
                if (opacity > 0) {
                    requestAnimationFrame(animate);
                } else {
                    particle.remove();
                }
            };
            
            requestAnimationFrame(animate);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ImageCaptioningAI();
    
    // Add some cool initial animations
    setTimeout(() => {
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('fade-in-up');
            }, index * 200);
        });
    }, 500);
});

// Add mouse tracking for dynamic background
document.addEventListener('mousemove', (e) => {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    
    document.documentElement.style.setProperty('--mouse-x', x);
    document.documentElement.style.setProperty('--mouse-y', y);
});

// Add CSS custom properties for mouse tracking
const style = document.createElement('style');
style.textContent = `
    :root {
        --mouse-x: 0.5;
        --mouse-y: 0.5;
    }
    
    body::before {
        background: 
            radial-gradient(circle at calc(var(--mouse-x) * 100%) calc(var(--mouse-y) * 100%), rgba(120, 119, 198, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 60% 60%, rgba(255, 183, 77, 0.1) 0%, transparent 50%);
    }
`;
document.head.appendChild(style); 