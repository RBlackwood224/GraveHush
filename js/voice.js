// GRAVEHUSH — microphone, proximity voice chat, speech recognition and voice recording for the ghost's mimicry
'use strict';

GH.Voice = function (audio) {
  const V = this;
  V.stream = null; V.level = 0; V.talking = 0; V.enabled = GH.store.get('mic', true);
  V.mode = GH.store.get('micMode', 'open'); // 'open' | 'ptt'
  V.speechOn = GH.store.get('speech', true);
  V.remotes = {}; // pid -> {stream, el, src, gain, panner, filter, rec, clips, an}
  V.clips = { self: [] };
  V.onSpeech = null;
  V.lang = 'en';
  V.allow = true;

  V.init = async function () {
    if (!V.enabled || V.stream) return !!V.stream;
    try {
      V.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { V.stream = null; return false; }
    const ctx = audio.ctx;
    const src = ctx.createMediaStreamSource(V.stream);
    V.an = ctx.createAnalyser(); V.an.fftSize = 512; src.connect(V.an);
    V.data = new Uint8Array(V.an.fftSize);
    V.recordLoop('self', V.stream, () => V.level);
    V.startSpeech();
    return true;
  };

  function rms(an, data) { an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } return Math.sqrt(s / data.length); }

  V.frame = function (dt, pttHeld) {
    V.allow = V.mode === 'open' || pttHeld;
    if (V.stream) V.stream.getAudioTracks().forEach(t => t.enabled = V.allow);
    if (V.an && V.allow) { const l = rms(V.an, V.data); V.level = V.level * 0.7 + Math.min(1, l * 6) * 0.3; } else V.level *= 0.8;
    V.talking = V.level > 0.12 ? Math.min(1, (V.level - 0.12) * 2.5) : 0;
    for (const id in V.remotes) { const R = V.remotes[id]; if (R.an) { R.level = R.level * 0.7 + Math.min(1, rms(R.an, R.data) * 6) * 0.3; } }
  };

  // keep a few short clips of each voice (only in memory, never uploaded anywhere)
  V.recordLoop = function (id, stream, levelFn) {
    if (!window.MediaRecorder || !GH.store.get('mimicRec', true)) return;
    V.clips[id] = V.clips[id] || [];
    let peak = 0;
    const tick = () => {
      if (!stream.active) return;
      let rec;
      try { rec = new MediaRecorder(stream); } catch (e) { return; }
      const chunks = []; peak = 0;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (peak > 0.3 && chunks.length) { V.clips[id].push(new Blob(chunks, { type: rec.mimeType })); if (V.clips[id].length > 4) V.clips[id].shift(); }
        setTimeout(tick, 300);
      };
      rec.start();
      const iv = setInterval(() => { peak = Math.max(peak, levelFn()); }, 100);
      setTimeout(() => { clearInterval(iv); try { rec.stop(); } catch (e) { } }, 2600);
    };
    tick();
  };

  V.playMimic = async function (of, x, y) {
    const list = V.clips[of] && V.clips[of].length ? V.clips[of] : V.clips.self;
    if (!list || !list.length) { audio.play('whisper', x, y, 1, 0.8); return; }
    try {
      const blob = list[Math.floor(Math.random() * list.length)];
      const ab = await blob.arrayBuffer();
      const b = await audio.ctx.decodeAudioData(ab);
      const src = audio.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = 0.86 + Math.random() * 0.1;
      const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const p = audio.makePanner(); audio.setPannerPos(p, x, y);
      const g = audio.ctx.createGain(); g.gain.value = 1.4;
      src.connect(f); f.connect(p); p.connect(g); g.connect(audio.sfx); src.start();
    } catch (e) { audio.play('whisper', x, y, 1, 0.8); }
  };

  // ---------- speech recognition (Chrome / Edge) ----------
  V.startSpeech = function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !V.speechOn || V.sr) return;
    const sr = new SR();
    sr.continuous = true; sr.interimResults = false;
    sr.lang = { en: 'en-US', fr: 'fr-FR', hu: 'hu-HU' }[V.lang] || 'en-US';
    sr.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal && V.onSpeech && V.allow) V.onSpeech(e.results[i][0].transcript); };
    sr.onend = () => { if (V.sr === sr) setTimeout(() => { try { sr.start(); } catch (e) { } }, 400); };
    sr.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { V.sr = null; } };
    try { sr.start(); V.sr = sr; } catch (e) { }
  };
  V.setLang = function (l) { V.lang = l; if (V.sr) { const s = V.sr; V.sr = null; try { s.stop(); } catch (e) { } setTimeout(V.startSpeech, 500); } };

  // ---------- proximity chat ----------
  V.addRemote = function (pid, stream) {
    V.removeRemote(pid);
    const ctx = audio.ctx;
    const el = new Audio(); el.srcObject = stream; el.muted = true; el.play().catch(() => { }); // needed by Chrome for WebAudio
    const src = ctx.createMediaStreamSource(stream);
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 20000;
    const panner = audio.makePanner(); panner.refDistance = 2; panner.rolloffFactor = 1.1; panner.maxDistance = 30;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const an = ctx.createAnalyser(); an.fftSize = 512;
    src.connect(an); src.connect(filter); filter.connect(panner); panner.connect(gain); gain.connect(audio.voiceBus);
    const R = V.remotes[pid] = { stream, el, src, filter, panner, gain, an, data: new Uint8Array(512), level: 0 };
    V.recordLoop(pid, stream, () => R.level);
  };
  V.removeRemote = function (pid) {
    const R = V.remotes[pid]; if (!R) return;
    try { R.gain.disconnect(); R.el.srcObject = null; } catch (e) { }
    delete V.remotes[pid];
  };
  // living players can't hear the dead; the dead hear everyone
  V.update = function (me, players, occludedFn) {
    for (const pid in V.remotes) {
      const R = V.remotes[pid], p = players[pid];
      if (!p || !me) { R.gain.gain.value = 0; continue; }
      audio.setPannerPos(R.panner, p.x, p.y);
      let g = 1;
      if (p.dead && !me.dead) g = 0;
      const d = GH.dist(me.x, me.y, p.x, p.y);
      if (d > 22) g = 0;
      const occ = occludedFn(p.x, p.y);
      R.filter.frequency.value = occ ? 900 : 20000;
      if (occ) g *= 0.6;
      R.gain.gain.value += (g - R.gain.gain.value) * 0.3;
    }
  };
  V.stop = function () { for (const id in V.remotes) V.removeRemote(id); };
};
