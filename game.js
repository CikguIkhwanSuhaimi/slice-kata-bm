// ======================= DATA =======================
const FRUITS = ["Apple","Apricot","Avocado","Coconut","DragonFruit","Fig","Grapefruit","Guava",
  "Lemon","Lime","Mandarin","Mango","Melon","Nectarine","Orange","Papaya","Passionfruit","Peach",
  "Pear","Pineapple","Plum","Pomegranate","Strawberry","Watermelon","kiwi"];

const WORD_BANK = {
  nama: { label: "KATA NAMA", tiers: [
    ["meja","kerusi","buku","bola","jam","beg","baju","kasut","air","pintu"],
    ["sekolah","guru","murid","kereta","komputer","telefon","makanan","tingkap","rumah","kanak-kanak"],
    ["perpustakaan","jururawat","penyelidik","kemudahan","pentadbiran","kenderaan","pengangkutan","kejohanan"]
  ]},
  kerja: { label: "KATA KERJA", tiers: [
    ["makan","minum","tidur","lari","main","tulis","baca","lompat"],
    ["berlari","membaca","menulis","bermain","melompat","menyanyi","menari","memasak","belajar","berjalan"],
    ["bercakap-cakap","menyelesaikan","mempertahankan","mempersembahkan","mengembangkan","memperjuangkan","menganjurkan"]
  ]},
  adjektif: { label: "KATA ADJEKTIF", tiers: [
    ["besar","kecil","panas","sejuk","cepat","kuat","lama","baru"],
    ["cantik","hodoh","tinggi","rendah","perlahan","gembira","sedih","lemah","mudah","susah"],
    ["bersungguh-sungguh","menyeluruh","berkesinambungan","memberangsangkan","membanggakan","mengagumkan"]
  ]},
  ganti: { label: "KATA GANTI NAMA", tiers: [
    ["saya","awak","dia","kami","kita"],
    ["mereka","kamu","anda","ia","beliau"],
    ["kalian","kau","tuan","puan","baginda"]
  ]}
};

const SCORE_TIER_THRESHOLDS = [0, 100, 250]; // score needed to reach tier 0,1,2
function tierForScore(score) {
  let t = 0;
  for (let i = 0; i < SCORE_TIER_THRESHOLDS.length; i++) if (score >= SCORE_TIER_THRESHOLDS[i]) t = i;
  return t;
}

const PUFF_FRAMES = [0,4,8,12,16,20,24].map(i => "puff_" + String(i).padStart(2,"0"));
const BOOM_FRAMES = [0,2,4,6,8].map(i => "boom_" + String(i).padStart(2,"0"));

// ======================= SFX (synthesized, no files needed) =======================
const SFX = (() => {
  let ctx = null;
  let masterGain = null;
  const SFX_MASTER_VOL = 2.6; // naikkan kelantangan keseluruhan SFX berbanding BGM
  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = SFX_MASTER_VOL;
      masterGain.connect(ctx.destination);
    }
    return ctx;
  }
  function setMuted(muted) {
    ac(); // pastikan context & masterGain wujud walau belum ada bunyi dimainkan lagi
    masterGain.gain.value = muted ? 0 : SFX_MASTER_VOL;
  }
  function tone(freq, dur, type, vol, glideTo) {
    const c = ac();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(); osc.stop(c.currentTime + dur);
  }
  function noise(dur, vol, freq, filterType) {
    const c = ac();
    const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = filterType || "bandpass";
    filter.frequency.value = freq || 1200;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start(); src.stop(c.currentTime + dur);
  }
  return {
    setMuted,
    // Bunyi hiris (blade swoosh) - pitch & volume naik ikut kelajuan swipe (speedFactor 0..1)
    swoosh: (speedFactor) => {
      const sf = speedFactor === undefined ? 0.5 : Math.max(0, Math.min(1, speedFactor));
      noise(0.12 + sf * 0.06, 0.08 + sf * 0.09, 2000 + sf * 2200, "bandpass");
    },
    correct: () => tone(660, 0.12, "triangle", 0.18, 990),
    wrong: () => tone(180, 0.28, "sawtooth", 0.20, 90),
    boom: () => { noise(0.35, 0.28, 300); tone(90, 0.3, "sine", 0.2, 40); },
    // Kesan fizikal "potong buah" - dimainkan setiap kali hiris kena (betul ATAU salah), berasingan dari nada judgement
    slice: () => { noise(0.09, 0.16, 3200, "highpass"); noise(0.07, 0.1, 500, "lowpass"); },
    combo: (n) => tone(500 + n * 60, 0.10, "triangle", 0.15, 800 + n * 80),
    // Nada streak - naik sikit-sikit ikut panjang streak semasa (dimainkan setiap hiris BETUL)
    streak: (n) => { const s = Math.min(n, 12); tone(440 + s * 35, 0.08, "sine", 0.12 + s * 0.01, 660 + s * 40); },
    powerup: () => { tone(500, 0.15, "sine", 0.2, 900); setTimeout(() => tone(700, 0.18, "sine", 0.22, 1100), 90); },
    freeze: () => { tone(1200, 0.4, "sine", 0.15, 600); },
    // Amaran masa nak tamat (tick lembut, main sekali sahaja bila masuk zon merah)
    tick: () => tone(1000, 0.08, "square", 0.12),
    // Fanfare tamat round
    roundWin: () => { tone(523.25, 0.14, "triangle", 0.22, 784); setTimeout(() => tone(659.25, 0.14, "triangle", 0.22, 988), 120); setTimeout(() => tone(783.99, 0.3, "triangle", 0.25, 1046), 240); },
    roundLose: () => { tone(330, 0.2, "sawtooth", 0.2, 220); setTimeout(() => tone(247, 0.2, "sawtooth", 0.2, 165), 180); setTimeout(() => tone(196, 0.4, "sawtooth", 0.22, 110), 360); }
  };
})();

// ======================= ASSET LOADING =======================
const IMAGES = {};
function loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { IMAGES[key] = img; resolve(true); };
    img.onerror = () => { window.__loadErrors.push(key + " -> " + src); resolve(false); };
    img.src = src;
  });
}
async function loadAllAssets(onProgress) {
  window.__loadErrors = [];
  const jobs = [];
  FRUITS.forEach(f => {
    jobs.push(["fruit_" + f, `assets/fruits/${f}.png`]);
    jobs.push(["slice_" + f, `assets/slices/${f}SLICE.png`]);
  });
  PUFF_FRAMES.forEach(k => jobs.push([k, `assets/particles/puff/whitePuff${k.split("_")[1]}.png`]));
  BOOM_FRAMES.forEach(k => jobs.push([k, `assets/particles/explosion/explosion${k.split("_")[1]}.png`]));

  let done = 0;
  await Promise.all(jobs.map(([key, src]) =>
    loadImage(key, src).then(() => {
      done++;
      if (onProgress) onProgress(done / jobs.length);
    })
  ));
}

// ======================= GAME =======================
class SliceGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 200));

    this.fruits = [];
    this.effects = []; // puff/boom animations
    this.trail = [];
    this.running = false;
    this.category = null;
    this.muted = false;

    this.bgm = document.getElementById("bgmAudio");
    if (this.bgm) this.bgm.volume = 0.15; // lagu latar dikecilkan ketara masa gameplay supaya SFX jelas menonjol

    this._bindInput();
    this._wireDom();

    this._lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const wrap = document.getElementById("phaser-container");
    const rect = wrap.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width);
    this.canvas.height = Math.round(rect.height);
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  _bindInput() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };
    const down = (e) => {
      const p = getPos(e);
      this.trail = [{ x: p.x, y: p.y, t: performance.now() }];
      e.preventDefault();
    };
    const move = (e) => {
      if (this.trail.length === 0) return;
      const p = getPos(e);
      const now = performance.now();
      const prev = this.trail[this.trail.length - 1];
      this.trail.push({ x: p.x, y: p.y, t: now });
      if (this.trail.length > 12) this.trail.shift();

      if (!this._lastSwoosh || now - this._lastSwoosh > 140) {
        // kira kelajuan swipe (px/ms) untuk jadikan bunyi hiris lagi "hidup" - laju = tajam & kuat, perlahan = lembut
        const dt = Math.max(1, now - (prev ? prev.t : now));
        const dist = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
        const speedFactor = Math.min(1, (dist / dt) / 1.8);
        SFX.swoosh(speedFactor);
        this._lastSwoosh = now;
      }

      if (this.running && this.trail.length >= 2) {
        const a = this.trail[this.trail.length - 2];
        const b = this.trail[this.trail.length - 1];
        this.fruits.forEach(f => {
          if (f.sliced) return;
          const r = f.displaySize * 0.36;
          if (this._segCircleHit(a, b, f.x, f.y, r)) this._sliceFruit(f);
        });
      }
      e.preventDefault();
    };
    const up = (e) => { this.trail = []; if (e) e.preventDefault(); };

    this.canvas.addEventListener("mousedown", down);
    this.canvas.addEventListener("mousemove", (e) => { if (e.buttons === 1) move(e); });
    this.canvas.addEventListener("mouseup", up);
    this.canvas.addEventListener("touchstart", down, { passive: false });
    this.canvas.addEventListener("touchmove", move, { passive: false });
    this.canvas.addEventListener("touchend", up, { passive: false });
  }

  _segCircleHit(a, b, cx, cy, r) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((cx - a.x) * dx + (cy - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    const distSq = (px - cx) ** 2 + (py - cy) ** 2;
    return distSq <= r * r;
  }

  _wireDom() {
    document.querySelectorAll(".cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("menuOverlay").classList.add("hidden");
        this.startRound(btn.dataset.cat);
      });
    });
    document.getElementById("howtoBtn").addEventListener("click", () => {
      document.getElementById("menuOverlay").classList.add("hidden");
      document.getElementById("howtoOverlay").classList.remove("hidden");
    });
    document.getElementById("backFromHowto").addEventListener("click", () => {
      document.getElementById("howtoOverlay").classList.add("hidden");
      document.getElementById("menuOverlay").classList.remove("hidden");
    });
    document.getElementById("introBtn").addEventListener("click", () => {
      document.getElementById("menuOverlay").classList.add("hidden");
      document.getElementById("introOverlay").classList.remove("hidden");
    });
    document.getElementById("backFromIntro").addEventListener("click", () => {
      document.getElementById("introOverlay").classList.add("hidden");
      document.getElementById("menuOverlay").classList.remove("hidden");
    });
    document.getElementById("retryBtn").addEventListener("click", () => {
      document.getElementById("overOverlay").classList.add("hidden");
      this.startRound(this.category);
    });
    document.getElementById("menuBtn").addEventListener("click", () => {
      document.getElementById("overOverlay").classList.add("hidden");
      document.getElementById("menuOverlay").classList.remove("hidden");
    });
    document.getElementById("portalBtn").addEventListener("click", () => {
      // Score/best is already saved to localStorage in endRound() before this screen shows.
      window.location.href = 'https://cikguikhwansuhaimi.github.io/';
    });
    document.getElementById("portalBtnMenu").addEventListener("click", () => {
      window.location.href = 'https://cikguikhwansuhaimi.github.io/';
    });
    document.getElementById("muteBtn").addEventListener("click", () => {
      this.muted = !this.muted;
      document.getElementById("muteBtn").textContent = this.muted ? "🔇" : "🔊";
      if (this.bgm) this.bgm.muted = this.muted;
      SFX.setMuted(this.muted);
    });
    document.getElementById("quitBtn").addEventListener("click", () => {
      this.running = false;
      if (this.bgm) this.bgm.pause();
      document.getElementById("hud").classList.add("hidden");
      document.getElementById("menuOverlay").classList.remove("hidden");
    });
    document.getElementById("freezeBtn").addEventListener("click", () => this.activateFreeze());
    document.getElementById("highlightBtn").addEventListener("click", () => this.activateHighlight());
  }

  updateLivesDom(n) {
    document.getElementById("livesVal").textContent = "❤".repeat(Math.max(n, 0)) + "🖤".repeat(Math.max(3 - n, 0));
  }

  updatePowerDom() {
    const fc = document.getElementById("freezeCount");
    const hc = document.getElementById("highlightCount");
    if (fc) fc.textContent = this.inventory.freeze;
    if (hc) hc.textContent = this.inventory.highlight;
    document.getElementById("freezeBtn").classList.toggle("active", this.inventory.freeze > 0);
    document.getElementById("highlightBtn").classList.toggle("active", this.inventory.highlight > 0);
  }

  activateFreeze() {
    if (!this.running || this.inventory.freeze <= 0) return;
    this.inventory.freeze--;
    this.updatePowerDom();
    SFX.freeze();
    this.freezeUntil = performance.now() + 4000;
    const overlay = document.getElementById("freezeOverlay");
    overlay.classList.add("show");
    setTimeout(() => overlay.classList.remove("show"), 4000);
  }

  activateHighlight() {
    if (!this.running || this.inventory.highlight <= 0) return;
    this.inventory.highlight--;
    this.updatePowerDom();
    SFX.powerup();
    this.highlightUntil = performance.now() + 4000;
  }

  startRound(cat) {
    this.category = cat;
    document.getElementById("bannerCat").textContent = WORD_BANK[cat].label;
    document.getElementById("hud").classList.remove("hidden");
    document.getElementById("scoreVal").textContent = "0";
    this.updateLivesDom(3);
    document.getElementById("timerbar").style.width = "100%";
    document.getElementById("timerbar").classList.remove("low");

    this.fruits = [];
    this.effects = [];
    this.score = 0; this.lives = 3; this.combo = 1; this.bestCombo = 1;
    this.streak = 0;
    this.inventory = { freeze: 0, highlight: 0 };
    this.freezeUntil = 0; this.highlightUntil = 0;
    this.updatePowerDom();
    this.tier = 0;
    this.elapsed = 0; this.spawnTimer = 0; this.spawnInterval = 1600; // constant, no speed ramp — accessibility
    this.roundLength = 60000;
    this.running = true;

    if (this.bgm) {
      this.bgm.currentTime = 0;
      this.bgm.volume = 0.15;
      this.bgm.play().catch(() => {});
    }
  }

  spawnFruit() {
    const cat = this.category;
    const tier = tierForScore(this.score);
    const targetPool = WORD_BANK[cat].tiers[tier];
    const otherCats = Object.keys(WORD_BANK).filter(c => c !== cat);
    const distractorPool = otherCats.flatMap(c => WORD_BANK[c].tiers[tier]);

    const isTarget = Math.random() < 0.6;
    const word = isTarget
      ? targetPool[Math.floor(Math.random() * targetPool.length)]
      : distractorPool[Math.floor(Math.random() * distractorPool.length)];
    const fruitKey = FRUITS[Math.floor(Math.random() * FRUITS.length)];

    const startX = 60 + Math.random() * (this.width - 120);
    const startY = this.height + 40;
    const vx = -90 + Math.random() * 180;
    // Tune launch speed to canvas height so fruit reliably reaches the upper screen
    const peakTargetY = this.height * (0.12 + Math.random() * 0.28); // how high up it should peak
    const riseDist = startY - peakTargetY;
    const vy = -Math.sqrt(2 * 850 * riseDist);

    this.fruits.push({
      x: startX, y: startY, vx, vy,
      rot: 0, vr: (-120 + Math.random() * 240) * (Math.PI / 180),
      word, isTarget, fruitKey, sliced: false,
      displaySize: Math.max(64, this.width * 0.19), alpha: 1, scale: 1
    });
  }

  _sliceFruit(f) {
    f.sliced = true;
    const correct = f.isTarget;
    SFX.slice(); // kesan fizikal potong buah - main setiap kali kena, betul atau salah

    if (correct) {
      SFX.correct();
      this.combo = Math.min(this.combo + 1, 8);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.streak = (this.streak || 0) + 1;
      SFX.streak(this.streak);
      const pts = 10 * this.combo;
      this.score += pts;
      document.getElementById("scoreVal").textContent = this.score;
      this.floatText(f.x, f.y, "+" + pts, "#5cff8f");
      this.showCombo();
      if (this.combo >= 3) SFX.combo(this.combo);
      this.spawnEffect(f.x, f.y, PUFF_FRAMES);

      if (this.streak > 0 && this.streak % 5 === 0) {
        const type = Math.random() < 0.5 ? "freeze" : "highlight";
        this.inventory[type]++;
        this.updatePowerDom();
        this.floatText(f.x, f.y - 40, (type === "freeze" ? "❄️" : "💡") + " +1!", "#ffe86b");
        SFX.powerup();
      }

      const newTier = tierForScore(this.score);
      if (newTier > this.tier) {
        this.tier = newTier;
        this.showTierUp(newTier);
      }
    } else {
      SFX.wrong(); SFX.boom();
      this.lives -= 1;
      this.combo = 1;
      this.streak = 0;
      this.updateLivesDom(this.lives);
      this.floatText(f.x, f.y, "SALAH!", "#ff5d7a");
      this.shakeUntil = performance.now() + 180;
      const flashEl = document.getElementById("flash");
      flashEl.classList.remove("hit"); void flashEl.offsetWidth; flashEl.classList.add("hit");
      this.spawnEffect(f.x, f.y, BOOM_FRAMES);
      if (this.lives <= 0) this.endRound(false);
    }

    f.vy = -260;
    f.vx *= 0.4;
    f.fading = true;
  }

  showCombo() {
    const el = document.getElementById("comboBadge");
    el.textContent = "COMBO x" + this.combo;
    el.classList.add("show");
    clearTimeout(this._comboTO);
    this._comboTO = setTimeout(() => el.classList.remove("show"), 900);
  }

  showTierUp(tier) {
    SFX.combo(6);
    const el = document.createElement("div");
    el.className = "tierup";
    el.textContent = "🌟 TAHAP " + (tier + 1) + " — LEBIH MENCABAR!";
    document.getElementById("hud").appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  floatText(x, y, txt, color) {
    const rect = this.canvas.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "floattext";
    el.textContent = txt;
    el.style.color = color;
    el.style.left = (rect.left + x - 20) + "px";
    el.style.top = (rect.top + y - 10) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  spawnEffect(x, y, frames) {
    this.effects.push({ x, y, frames, i: 0, t: 0, delay: 45 });
  }

  endRound(timeUp) {
    this.running = false;
    if (this.bgm) this.bgm.pause();
    if (timeUp) SFX.roundWin(); else SFX.roundLose();

    const key = "sliceKata_best_" + this.category;
    const prevBest = parseInt(localStorage.getItem(key) || "0", 10);
    const best = Math.max(prevBest, this.score);
    localStorage.setItem(key, best);

    document.getElementById("hud").classList.add("hidden");
    document.getElementById("overTitle").textContent = timeUp ? "MASA TAMAT!" : "CUBA LAGI!";
    document.getElementById("finalScore").textContent = this.score;
    document.getElementById("finalCombo").textContent = this.bestCombo;
    document.getElementById("finalBest").textContent = best;
    document.getElementById("overOverlay").classList.remove("hidden");
  }

  update(dt, dtMs) {
    if (!this.running) return;
    const now = performance.now();
    const frozen = this.freezeUntil && now < this.freezeUntil;

    if (!frozen) {
      this.elapsed += dtMs;
      this.spawnTimer += dtMs;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnFruit();
      }
    }

    const remain = Math.max(0, this.roundLength - this.elapsed);
    const pct = (remain / this.roundLength) * 100;
    const bar = document.getElementById("timerbar");
    bar.style.width = pct + "%";
    const isLow = pct < 20;
    bar.classList.toggle("low", isLow);
    if (isLow) {
      if (!this._lastTick || now - this._lastTick > 1000) { SFX.tick(); this._lastTick = now; }
    } else {
      this._lastTick = 0;
    }

    const GRAVITY = 850;
    this.fruits.forEach(f => {
      if (!frozen || f.fading) {
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
      }
      if (f.fading) { f.alpha -= dt * 2.2; f.scale += dt * 1.3; }
    });

    this.fruits = this.fruits.filter(f => {
      if (f.fading && f.alpha <= 0) return false;
      if (!f.sliced && f.y > this.height + 90) {
        if (f.isTarget) { this.combo = 1; this.streak = 0; }
        return false;
      }
      return true;
    });

    this.effects.forEach(e => { e.t += dtMs; });
    this.effects = this.effects.filter(e => {
      const idx = Math.floor(e.t / e.delay);
      return idx < e.frames.length;
    });

    if (remain <= 0) this.endRound(true);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;

    let shakeX = 0, shakeY = 0;
    if (this.shakeUntil && performance.now() < this.shakeUntil) {
      shakeX = (Math.random() - 0.5) * 10;
      shakeY = (Math.random() - 0.5) * 10;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1b2a4d");
    grad.addColorStop(1, "#0d1626");
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    ctx.strokeStyle = "#2c3f66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - 40);
    ctx.lineTo(w, h - 40);
    ctx.stroke();

    const highlightActive = this.highlightUntil && performance.now() < this.highlightUntil;

    this.fruits.forEach(f => {
      if (highlightActive && f.isTarget && !f.sliced) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * pulse;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.displaySize * 0.62 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#5cff8f";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#5cff8f";
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.restore();
      }

      const img = IMAGES[(f.sliced ? "slice_" : "fruit_") + f.fruitKey];
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(f.scale, f.scale);
      const s = f.displaySize;
      if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();

      if (!f.sliced) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.alpha);
        ctx.font = "16px KenneyFuture, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(f.word, f.x, f.y - f.displaySize * 0.55);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(f.word, f.x, f.y - f.displaySize * 0.55);
        ctx.restore();
      }
    });

    this.effects.forEach(e => {
      const idx = Math.min(e.frames.length - 1, Math.floor(e.t / e.delay));
      const img = IMAGES[e.frames[idx]];
      if (img) {
        const s = 70;
        ctx.drawImage(img, e.x - s / 2, e.y - s / 2, s, s);
      }
    });

    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const alpha = i / this.trail.length;
        ctx.strokeStyle = `rgba(180,240,255,${alpha * 0.9})`;
        ctx.lineWidth = 3 + alpha * 6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  loop(t) {
    const dtMs = Math.min(50, t - this._lastTime);
    this._lastTime = t;
    this.update(dtMs / 1000, dtMs);
    this.render();
    requestAnimationFrame((nt) => this.loop(nt));
  }
}

// ======================= BOOT =======================
window.addEventListener("unhandledrejection", (e) => {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;z-index:999;background:#1a0000;color:#ff8080;font:13px monospace;padding:20px;overflow:auto;white-space:pre-wrap;";
  box.textContent = "RALAT (async):\n" + (e.reason && e.reason.stack ? e.reason.stack : e.reason);
  document.body.appendChild(box);
});

window.addEventListener("load", () => {
  document.getElementById("hud").classList.add("hidden");
  const canvas = document.getElementById("gameCanvas");
  const loadingEl = document.getElementById("loadingText");

  // Bind buttons & start the render loop immediately — do NOT wait for images.
  window.game = new SliceGame(canvas);

  // Load images in the background; menu/buttons already work regardless.
  window.__loadErrors = [];
  loadAllAssets((p) => {
    if (loadingEl) loadingEl.textContent = "Memuatkan imej... " + Math.round(p * 100) + "%";
  }).then(() => {
    if (loadingEl) loadingEl.remove();
    if (window.__loadErrors && window.__loadErrors.length) {
      const box = document.createElement("div");
      box.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:998;background:#1a1000;color:#ffcc66;font:10px monospace;padding:8px;max-height:30%;overflow:auto;white-space:pre-wrap;";
      box.textContent = "AMARAN - " + window.__loadErrors.length + " imej gagal load:\n" + window.__loadErrors.join("\n");
      document.body.appendChild(box);
    }
  });
});
