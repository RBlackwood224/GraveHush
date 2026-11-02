// GRAVEHUSH — procedural 3D audio (no sound files needed)
'use strict';

GH.Audio = function () {
  const A = this;
  let ctx = null;
  A.ready = false;
  A.buffers = {};
  A.vol = GH.store.get('vol', 0.8);
  A.musicVol = GH.store.get('musicVol', 0.5);

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    A.ctx = ctx;
    A.master = ctx.createGain(); A.master.gain.value = A.vol; A.master.connect(ctx.destination);
    A.sfx = ctx.createGain(); A.sfx.connect(A.master);
    A.voiceBus = ctx.createGain(); A.voiceBus.connect(A.master);
    synthAll();
    A.ready = true;
  };
  A.setVol = function (v) { A.vol = v; GH.store.set('vol', v); if (A.master) A.master.gain.value = v; };
  A.playMusic = function () { };
  A.stopMusic = function () { };

  // ---------------- synthesis ----------------
  const SR = 22050;
  function buf(sec, fn) {
    const n = Math.floor(sec * SR), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
    fn(d, n); return b;
  }
  const rnd = () => Math.random() * 2 - 1;
  function brown(d, n, k) { let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * rnd()) / 1.02; d[i] = l * (k || 3.5); } }
  // simple resonant bandpass on array (state variable filter)
  function bandpass(d, f0, q, sweepTo) {
    let low = 0, band = 0;
    for (let i = 0; i < d.length; i++) {
      const f = sweepTo ? f0 + (sweepTo - f0) * i / d.length : f0;
      const fc = 2 * Math.sin(Math.PI * f / SR);
      const high = d[i] - low - q * band; band += fc * high; low += fc * band; d[i] = band;
    }
  }
  function lowpass(d, a) { let y = 0; for (let i = 0; i < d.length; i++) { y += a * (d[i] - y); d[i] = y; } }
  function norm(d, peak) { let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m; }

  function synthAll() {
    const B = A.buffers;
    B.step = buf(0.12, (d, n) => { brown(d, n); for (let i = 0; i < n; i++) d[i] *= Math.exp(-i / (n * 0.15)); norm(d, 0.5); });
    B.stepghost = buf(0.25, (d, n) => { brown(d, n, 6); for (let i = 0; i < n; i++) d[i] = d[i] * Math.exp(-i / (n * 0.2)) + Math.sin(i * 2 * Math.PI * 45 / SR) * Math.exp(-i / (n * 0.15)) * 0.6; norm(d, 0.9); });
    B.creak = buf(0.9, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = 220 + 160 * Math.sin(t * 7) + 60 * rnd(); ph += f / SR; const saw = (ph % 1) * 2 - 1; d[i] = saw * Math.sin(Math.PI * t) * (0.5 + 0.5 * Math.sin(t * 90)); } bandpass(d, 700, 0.3); norm(d, 0.5); });
    B.slam = buf(0.6, (d, n) => { brown(d, n, 8); for (let i = 0; i < n; i++) d[i] = d[i] * Math.exp(-i / (n * 0.12)) + (i < 300 ? rnd() * (1 - i / 300) : 0) + Math.sin(i * 2 * Math.PI * 70 / SR) * Math.exp(-i / (n * 0.2)); norm(d, 1); });
    B.knock = buf(0.9, (d, n) => { for (const s of [0, 0.22, 0.44]) { const o = (s * SR) | 0; for (let i = 0; i < 2200; i++) d[o + i] += (Math.sin(i * 2 * Math.PI * 140 / SR) + rnd() * 0.4) * Math.exp(-i / 300); } norm(d, 0.9); });
    B.whisper = buf(1.8, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd(); bandpass(d, 1800, 0.25, 3200); for (let i = 0; i < n; i++) { const t = i / SR; d[i] *= Math.max(0, Math.sin(t * Math.PI * 5.5 + Math.sin(t * 3) * 2)) * Math.sin(Math.PI * i / n); } norm(d, 0.5); });
    B.giggle = buf(1.1, (d, n) => { for (let k = 0; k < 5; k++) { const o = (k * 0.18 * SR) | 0, L = (0.12 * SR) | 0, f = 820 - k * 50; for (let i = 0; i < L; i++) { const e = Math.sin(Math.PI * i / L); d[o + i] += (Math.sin(2 * Math.PI * f * i / SR + Math.sin(i / 40) * 2) * 0.7 + rnd() * 0.3) * e; } } bandpass(d, 1100, 0.5); norm(d, 0.55); });
    B.sob = buf(2.4, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 330 - t * 50 + Math.sin(t * 30) * 12; ph += f / SR; const env = Math.max(0, Math.sin(t * Math.PI * 1.7)) * Math.max(0, Math.sin(t * 9)); d[i] = (Math.sin(ph * 2 * Math.PI) * 0.5 + rnd() * 0.5) * env; } bandpass(d, 900, 0.4); norm(d, 0.5); });
    B.scream = buf(1.4, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = 1100 - 650 * t + Math.sin(i / 30) * 40; ph += f / SR; d[i] = (Math.sin(ph * 2 * Math.PI) + Math.sin(ph * 2 * Math.PI * 1.51) * 0.6 + rnd() * 0.7) * Math.min(1, t * 20) * (1 - t); d[i] = Math.tanh(d[i] * 2); } norm(d, 1); });
    B.breath = buf(2.2, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd(); bandpass(d, 600, 0.6); for (let i = 0; i < n; i++) { const t = i / n; d[i] *= Math.pow(Math.sin(Math.PI * t * 2) ** 2, 1.5); } norm(d, 0.35); });
    B.heart = buf(0.8, (d, n) => { for (const [s, a] of [[0, 1], [0.18, 0.7]]) { const o = (s * SR) | 0; for (let i = 0; i < 3000 && o + i < n; i++) d[o + i] += Math.sin(i * 2 * Math.PI * 48 / SR) * Math.exp(-i / 700) * a; } norm(d, 0.8); });
    B.drip = buf(0.12, (d, n) => { for (let i = 0; i < n; i++) { const t = i / n; d[i] = Math.sin(2 * Math.PI * (1200 + 1800 * t) * i / SR) * Math.exp(-t * 6); } norm(d, 0.4); });
    B.crackle = buf(1.6, (d, n) => { for (let k = 0; k < 60; k++) { const o = (Math.random() * (n - 400)) | 0; for (let i = 0; i < 200; i++) d[o + i] += rnd() * Math.exp(-i / 40); } brown(d.subarray(0, 0), 0); norm(d, 0.5); });
    B.rope = buf(1.8, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; ph += (90 + 30 * Math.sin(t * 5)) / SR; d[i] = ((ph % 1) * 2 - 1) * (0.4 + 0.6 * Math.abs(Math.sin(t * 13))) * Math.sin(Math.PI * t); } bandpass(d, 420, 0.4); norm(d, 0.45); });
    B.cough = buf(0.9, (d, n) => { for (const s of [0, 0.3]) { const o = (s * SR) | 0; for (let i = 0; i < 4000; i++) d[o + i] += rnd() * Math.exp(-i / 1200); } bandpass(d, 500, 0.5); norm(d, 0.6); });
    B.chant = buf(3, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 164.8 * t) * 0.7 + Math.sin(2 * Math.PI * 116.5 * t) * 0.5) * Math.sin(Math.PI * i / n) * (0.7 + 0.3 * Math.sin(t * 4)); } norm(d, 0.45); });
    B.thud = buf(0.3, (d, n) => { brown(d, n, 6); for (let i = 0; i < n; i++) d[i] *= Math.exp(-i / (n * 0.1)); for (let i = 0; i < 400; i++) d[i] += rnd() * (1 - i / 400) * 0.5; norm(d, 0.8); });
    B.glass = buf(0.8, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (rnd() * Math.exp(-t * 30) + (Math.sin(2 * Math.PI * 3100 * t) + Math.sin(2 * Math.PI * 4733 * t) + Math.sin(2 * Math.PI * 6211 * t)) * 0.3 * Math.exp(-t * 6)); } norm(d, 0.7); });
    B.bell = buf(2.5, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 520 * t) + Math.sin(2 * Math.PI * 520 * 2.76 * t) * 0.5 * Math.exp(-t * 2) + Math.sin(2 * Math.PI * 520 * 5.4 * t) * 0.25 * Math.exp(-t * 4)) * Math.exp(-t * 1.5); } norm(d, 0.6); });
    B.static = buf(0.6, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd() * (0.5 + 0.5 * Math.sin(i / 300)); bandpass(d, 2200, 0.8); norm(d, 0.35); });
    B.beep = buf(0.09, (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.sign(Math.sin(2 * Math.PI * 1500 * i / SR)) * 0.3 * Math.min(1, (n - i) / 100); });
    B.click = buf(0.04, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd() * Math.exp(-i / 60); norm(d, 0.5); });
    B.whoosh = buf(1.0, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd(); bandpass(d, 300, 0.7, 1400); for (let i = 0; i < n; i++) d[i] *= Math.sin(Math.PI * i / n); norm(d, 0.6); });
    B.musicbox = buf(4, (d, n) => { const notes = [659, 587, 523, 494, 523, 440, 494, 392]; notes.forEach((f, k) => { const o = (k * 0.45 * SR) | 0; for (let i = 0; i < SR * 1.2 && o + i < n; i++) { const t = i / SR; d[o + i] += (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 3.01 * t) * 0.2) * Math.exp(-t * 3.5) * (0.9 + 0.1 * Math.sin(t * 30)); } }); norm(d, 0.4); });
    B.sting = buf(2.4, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR, e = Math.pow(i / n, 2) * (i > n * 0.95 ? (n - i) / (n * 0.05) : 1); d[i] = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 233 * t) + Math.sin(2 * Math.PI * 311 * t * (1 + t * 0.05)) + rnd() * 0.3) * e; } norm(d, 0.7); });
    B.hum = buf(3, (d, n) => { for (let i = 0; i < n; i++) { const t = i / SR; d[i] = (Math.sin(2 * Math.PI * 55 * t) + Math.sin(2 * Math.PI * 82.5 * t) * 0.5 + Math.sin(2 * Math.PI * 58 * t) * 0.6) * Math.sin(Math.PI * i / n); } norm(d, 0.5); });
    B.wind = buf(8, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd(); bandpass(d, 400, 0.9); for (let i = 0; i < n; i++) { const t = i / n; d[i] *= 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 3 + Math.sin(t * 11))); } norm(d, 0.3); for (let i = 0; i < 2000; i++) { const a = i / 2000; d[i] *= a; d[n - 1 - i] *= a; } });
    B.drone = buf(10, (d, n) => { brown(d, n, 2); for (let i = 0; i < n; i++) { const t = i / SR; d[i] = d[i] * 0.6 + (Math.sin(2 * Math.PI * 41 * t) + Math.sin(2 * Math.PI * 41.6 * t)) * 0.25; } norm(d, 0.35); for (let i = 0; i < 3000; i++) { const a = i / 3000; d[i] *= a; d[n - 1 - i] *= a; } });
    B.burn = buf(2.0, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd(); bandpass(d, 500, 0.6, 2500); for (let k = 0; k < 40; k++) { const o = (Math.random() * (n - 300)) | 0; for (let i = 0; i < 150; i++) d[o + i] += rnd() * 2 * Math.exp(-i / 30); } for (let i = 0; i < n; i++) d[i] *= Math.min(1, i / 2000) * (1 - i / n); norm(d, 0.7); });
    B.howl = buf(3.2, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; const f = 380 + 260 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) - 200 * Math.max(0, t - 0.6) + Math.sin(i / 90) * 6; ph += f / SR; d[i] = (Math.sin(ph * 2 * Math.PI) + 0.25 * Math.sin(ph * 4 * Math.PI) + rnd() * 0.05) * Math.sin(Math.PI * t) ** 1.5; } norm(d, 0.35); });
    B.owl = buf(1.4, (d, n) => { for (const [s, L] of [[0, 0.25], [0.45, 0.6]]) { const o = (s * SR) | 0, m = (L * SR) | 0; for (let i = 0; i < m && o + i < n; i++) d[o + i] += Math.sin(2 * Math.PI * (390 - i / m * 30) * i / SR) * Math.sin(Math.PI * i / m); } norm(d, 0.3); });
    B.settle = buf(1.2, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; ph += (60 + 40 * t + rnd() * 30) / SR; d[i] = ((ph % 1) * 2 - 1) * Math.sin(Math.PI * t) * (Math.random() < 0.3 ? 1 : 0.4); } bandpass(d, 300, 0.5); norm(d, 0.4); });
    B.tick = buf(1.0, (d, n) => { for (const s of [0, 0.5]) { const o = (s * SR) | 0; for (let i = 0; i < 300; i++) d[o + i] += rnd() * Math.exp(-i / 40) * (s ? 0.7 : 1); } bandpass(d, 2500, 0.6); norm(d, 0.25); });
    B.growl = buf(1.6, (d, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / n; ph += (70 + 20 * Math.sin(t * 40) + rnd() * 15) / SR; d[i] = Math.tanh((((ph % 1) * 2 - 1) + rnd() * 0.5) * 3) * Math.sin(Math.PI * t); } lowpass(d, 0.15); norm(d, 0.8); });
  }

  // ---------------- playback ----------------
  let lx = 0, ly = 0;
  A.listener = function (x, y, a) {
    if (!ctx) return;
    lx = x; ly = y;
    const L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(x, t); L.positionY.setValueAtTime(0, t); L.positionZ.setValueAtTime(y, t);
      L.forwardX.setValueAtTime(Math.cos(a), t); L.forwardY.setValueAtTime(0, t); L.forwardZ.setValueAtTime(Math.sin(a), t);
      L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
    } else { L.setPosition(x, 0, y); L.setOrientation(Math.cos(a), 0, Math.sin(a), 0, 1, 0); }
  };
  A.makePanner = function () {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.maxDistance = 40; p.rolloffFactor = 1.4;
    return p;
  };
  A.setPannerPos = function (p, x, y) { if (p.positionX) { p.positionX.value = x; p.positionY.value = 0; p.positionZ.value = y; } else p.setPosition(x, 0, y); };

  // occluded(x,y) -> bool (supplied by the game)
  A.occluded = null;
  A.play = function (name, x, y, vol, rate) {
    if (!A.ready || !A.buffers[name]) return null;
    const src = ctx.createBufferSource(); src.buffer = A.buffers[name];
    src.playbackRate.value = rate || 1;
    const g = ctx.createGain(); g.gain.value = vol === undefined ? 1 : vol;
    let node = src;
    if (x !== undefined && x !== null) {
      const occ = A.occluded ? A.occluded(x, y) : false;
      if (occ) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; node.connect(f); node = f; g.gain.value *= 0.7; }
      const p = A.makePanner(); A.setPannerPos(p, x, y); node.connect(p); node = p;
    }
    node.connect(g); g.connect(A.sfx);
    src.start();
    return src;
  };
  A.play2D = (name, vol, rate) => A.play(name, null, null, vol, rate);

  // looping layers (ambience, heartbeat)
  A.loops = {};
  A.loop = function (name, vol) {
    if (!A.ready) return;
    let L = A.loops[name];
    if (!L) {
      const src = ctx.createBufferSource(); src.buffer = A.buffers[name]; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(A.sfx); src.start();
      L = A.loops[name] = { src, g };
    }
    L.g.gain.setTargetAtTime(vol, ctx.currentTime, 0.3);
  };
  A.stopLoops = function () { for (const k in A.loops) { try { A.loops[k].src.stop(); } catch (e) { } } A.loops = {}; };

  // eerie text-to-speech for spirit box / bell answers
  A.ghostSay = function (text, lang) {
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = { en: 'en-US', fr: 'fr-FR', hu: 'hu-HU' }[lang] || 'en-US';
      u.pitch = 0.1; u.rate = 0.55; u.volume = 0.9;
      speechSynthesis.speak(u);
      A.play2D('static', 0.5, 0.8);
    } catch (e) { }
  };
};
