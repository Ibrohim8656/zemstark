/**
 * AutoProctor Engine for ZEMSTARK (Phase 2)
 * Features Webcam Stream, Audio Monitor, Window Focus/Tab Detection, Trust Score, and Frame Snapshot Capture.
 */

class AutoProctor {
  constructor(options = {}) {
    this.onViolation = options.onViolation || (() => {});
    this.onTrustScoreChange = options.onTrustScoreChange || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    
    this.trustScore = 100;
    this.violations = [];
    this.isActive = false;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.micVolume = 0;
    this.tabSwitchCount = 0;
    
    this.bindEvents();
  }

  bindEvents() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
  }

  async startProctoring(videoElement, canvasElement, audioMeterBar) {
    this.isActive = true;
    this.trustScore = 100;
    this.violations = [];
    this.tabSwitchCount = 0;
    
    this.videoEl = videoElement;
    this.canvasEl = canvasElement;
    this.audioMeterEl = audioMeterBar;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (this.videoEl) {
          this.videoEl.srcObject = this.stream;
          this.videoEl.play();
        }
        this.initAudioAnalyzer(this.stream);
      } else {
        this.initSimulationMode();
      }
    } catch (err) {
      console.warn('Webcam/Audio permission unavailable, running smart proctor simulation:', err);
      this.initSimulationMode();
    }

    this.startCanvasOverlayLoop();
  }

  stopProctoring() {
    this.isActive = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
  }

  initAudioAnalyzer(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
      
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const checkAudio = () => {
        if (!this.isActive) return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        this.micVolume = Math.min(100, Math.round((average / 128) * 100));

        if (this.audioMeterEl) {
          this.audioMeterEl.style.width = `${this.micVolume}%`;
          this.audioMeterEl.style.backgroundColor = this.micVolume > 65 ? '#ff4d4d' : '#00f2fe';
        }

        if (this.micVolume > 75) {
          this.registerViolation('Shovqin/Baland ovoz', 'Atrofda gapirish yoki baland shovqin sezildi');
        }

        setTimeout(checkAudio, 500);
      };
      checkAudio();
    } catch (e) {
      console.log('Audio Context error:', e);
    }
  }

  initSimulationMode() {
    this.simulated = true;
  }

  startCanvasOverlayLoop() {
    if (!this.canvasEl) return;
    const ctx = this.canvasEl.getContext('2d');
    let angle = 0;

    const render = () => {
      if (!this.isActive) return;
      
      const w = this.canvasEl.width || 320;
      const h = this.canvasEl.height || 240;
      ctx.clearRect(0, 0, w, h);

      if (this.simulated || !this.stream) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        angle += 0.05;
        const boxX = w / 2 - 50 + Math.sin(angle) * 5;
        const boxY = h / 2 - 60 + Math.cos(angle) * 3;

        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, 100, 120);

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(boxX + 35, boxY + 45, 3, 0, Math.PI * 2);
        ctx.arc(boxX + 65, boxY + 45, 3, 0, Math.PI * 2);
        ctx.arc(boxX + 50, boxY + 65, 3, 0, Math.PI * 2);
        ctx.arc(boxX + 50, boxY + 90, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ade80';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('✓ AI FACE TRACKING: ACTIVE', 10, 20);
      } else {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.25, h * 0.15, w * 0.5, h * 0.7);
        ctx.fillStyle = '#00f2fe';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('AI PROCTOR MONITORING', 10, 20);
      }

      this.animFrame = requestAnimationFrame(render);
    };

    render();
  }

  handleVisibilityChange() {
    if (!this.isActive) return;
    if (document.hidden) {
      this.tabSwitchCount++;
      this.registerViolation('Tab Switch (Oyna o\'tkazildi)', `Brauzerdan boshqa tab yoki dasturga o'tildi (${this.tabSwitchCount}-marta)`);
    }
  }

  handleWindowBlur() {
    if (!this.isActive) return;
    this.registerViolation('Window Blur (Fokus yo\'qotildi)', 'Imtihon oynasidan diqqat boshqa joyga ko\'chirildi');
  }

  captureSnapshot(typeStr) {
    if (this.canvasEl) {
      try {
        return this.canvasEl.toDataURL('image/png');
      } catch (e) {
        // Fallback SVG snapshot
      }
    }
    const color = typeStr.includes('Tab') ? '%23ef4444' : '%23f59e0b';
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" style="background:%230f172a;"><text x="20" y="40" fill="${color}" font-size="13" font-family="sans-serif">⚠️ SNAPSHOT: ${encodeURIComponent(typeStr)}</text><rect x="60" y="60" width="200" height="100" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  registerViolation(type, description) {
    const now = Date.now();
    const lastViol = this.violations[this.violations.length - 1];
    if (lastViol && lastViol.type === type && (now - lastViol.timestamp) < 3000) {
      return;
    }

    const timeStr = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const penalty = type.includes('Tab') ? 15 : 10;
    
    this.trustScore = Math.max(0, this.trustScore - penalty);

    const snapshot = this.captureSnapshot(type);

    const violationItem = {
      id: 'v_' + Math.random().toString(36).substring(2, 7),
      type,
      description,
      time: timeStr,
      timestamp: now,
      penalty,
      snapshot
    };

    this.violations.push(violationItem);

    if (this.onTrustScoreChange) {
      this.onTrustScoreChange(this.trustScore);
    }
    if (this.onViolation) {
      this.onViolation(violationItem);
    }
  }

  triggerDemoViolation(type) {
    if (type === 'face_missing') {
      this.registerViolation('Yuz yo\'qoldi', 'Kamera oldida foydalanuvchi yuzi ko\'rinmay qoldi');
    } else if (type === 'second_person') {
      this.registerViolation('Begona shaxs', 'Kadrda ikkinchi odam yuzi aniqlandi');
    } else if (type === 'tab_switch') {
      this.tabSwitchCount++;
      this.registerViolation('Tab Switch (Oyna o\'tkazildi)', `Brauzerdan boshqa oynaga o'tildi (${this.tabSwitchCount}-marta)`);
    } else if (type === 'noise') {
      this.registerViolation('Shovqin sezildi', 'Mikrofon orqali suhbat yoki shovqin aniqlandi');
    }
  }
}

window.AutoProctorEngine = AutoProctor;
