// GRAVEHUSH — the ghost: AI director, hunts, learning, lies and map shifting (host only)
'use strict';

GH.Ghost = function (W, def, r) {
  const G = this;
  G.W = W; G.def = def; G.r = r; G.map = W.map;
  G.has = (b) => def.beh.includes(b);
  G.hasEv = (e) => def.evidence.includes(e);
  const map = G.map;
  const cand = map.allRooms.filter(rm => rm.type !== 'hall' && rm.cells.length >= 6);
  const sp = map.spawn;
  cand.sort((a, b) => GH.dist(b.cx, b.cy, sp.x, sp.y) - GH.dist(a.cx, a.cy, sp.x, sp.y));
  G.room = r.pick(cand.slice(0, Math.max(2, Math.ceil(cand.length * 0.6)))).id;
  const c = r.pick(map.rooms[G.room].cells);
  G.x = (c % map.w) + 0.5; G.y = ((c / map.w) | 0) + 0.5;
  G.form = r.chance(0.2) ? r.pick(['shadow', 'faceless', 'tall']) : r.pick(def.forms);
  G.fake = G.has('trickster') ? r.pick(GH.EVIDENCE.filter(e => !def.evidence.includes(e))) : '';
  G.fakeOn = false; G.fakeT = r.range(20, 50);
  G.tension = 0.04;
  G.eventT = 6 + r.expo(8);
  G.burst = 0;
  G.huntCD = (70 + r() * 70) / W.diff;
  G.hunt = null; G.stun = 0; G.manifestT = 0; G.mimic = -1; G.manX = 0; G.manY = 0;
  G.target = null; G.goal = null; G.flow = null; G.flowGoal = -1; G.flowT = 0;
  G.hideMemory = {}; G.sawHidden = {}; G.noises = [];
  G.silenceT = 0; G.territoryT = 0; G.roomChangeT = r.range(90, 170);
  G.shiftT = r.range(60, 120); G.lastCell = {}; G.loopCD = 0;
  G.looperDoor = G.has('looper') ? r.pick(map.doors.filter(d => !d.front)).i : -1;
  G.phantomT = r.range(120, 300);
  G.stepT = 0; G.gone = false; G.final = false;
  G.sceneT = r.range(140, 260) / W.diff; G.walk = null; G.timers = []; G.scenesDone = {};
  G.speedBase = 1.65 * def.speed;
  G.indoorOnly = W.loc !== 'farm';
  W.ghostPub.ev = def.evidence.join(',');
  W.ghostPub.fake = '';
};

const GP = GH.Ghost.prototype;

GP.alive = function () { return Object.values(this.W.players).filter(p => !p.dead); };
GP.walkable = function (i) { const m = this.map; return m.cells[i] === 0 && (!this.indoorOnly || !m.outdoor[i] || m.doorAt[i] >= 0); };

GP.roomTemp = function (i, base) {
  const G = this, rm = G.map.rooms[i];
  if (rm.outdoor) return base;
  let t = base;
  if (G.has('cold_aura')) t -= 7;
  if (i === G.room) {
    if (G.hasEv('cold')) t = -3.5;
    else if (G.fake === 'cold' && G.fakeOn) t = -1.2;
    else t = Math.max(1.5, Math.min(t, 6));
  } else if (G.has('cold_aura')) t = Math.max(1, t);
  return t;
};

GP.emitEmf = function (x, y) {
  const G = this, r = G.r;
  let l = r.int(2, 4);
  if (G.hasEv('emf') && r.chance(0.4)) l = 5;
  if (G.fake === 'emf' && G.fakeOn && r.chance(0.5)) l = 5;
  G.W.emf.push({ x, y, l, t: 20 });
};

GP.flavor = function () {
  return { drowned: 'drip', burned: 'crackle', hanged: 'rope', child: 'giggle', plague: 'cough', murdered: 'whisper', bride: 'sob', cursed: 'chant' }[this.def.origin];
};

GP.scare = function (x, y, amt) { this.W.emit({ t: 'scare', x, y, a: amt }); };

// ---------- path finding (flow field toward goal) ----------
GP.computeFlow = function (goalIdx) {
  const m = this.map, N = m.w * m.h;
  if (!this.flow || this.flow.length !== N) this.flow = new Int16Array(N);
  const f = this.flow; f.fill(-1);
  const q = new Int32Array(N); let h = 0, t = 0;
  q[t++] = goalIdx; f[goalIdx] = 0;
  while (h < t) {
    const c = q[h++];
    for (const d of [1, -1, m.w, -m.w]) {
      const j = c + d;
      if (j < 0 || j >= N || f[j] >= 0 || !this.walkable(j)) continue;
      f[j] = f[c] + 1; q[t++] = j;
    }
  }
  this.flowGoal = goalIdx;
};
GP.moveToward = function (gx, gy, speed, dt) {
  const G = this, m = G.map;
  const gi = Math.floor(gy) * m.w + Math.floor(gx);
  G.flowT -= dt;
  if (gi !== G.flowGoal || G.flowT <= 0) { G.computeFlow(gi); G.flowT = 0.6; }
  const ci = Math.floor(G.y) * m.w + Math.floor(G.x);
  let tx = gx, ty = gy;
  if (ci !== gi) {
    let best = ci, bd = G.flow[ci] < 0 ? 1e9 : G.flow[ci];
    for (const d of [1, -1, m.w, -m.w]) { const j = ci + d; if (G.flow[j] >= 0 && G.flow[j] < bd) { bd = G.flow[j]; best = j; } }
    if (best === ci && G.flow[ci] < 0) return true; // unreachable
    tx = (best % m.w) + 0.5; ty = ((best / m.w) | 0) + 0.5;
  }
  const dx = tx - G.x, dy = ty - G.y, dd = Math.hypot(dx, dy);
  if (dd < 0.05) return ci === gi;
  const s = Math.min(dd, speed * dt);
  G.x += dx / dd * s; G.y += dy / dd * s;
  G.dir = Math.atan2(dy, dx);
  return ci === gi && dd < 0.2;
};
GP.randomCellIn = function (roomId) { const rm = this.map.rooms[roomId]; const cs = rm.cells.filter(i => this.walkable(i)); return cs.length ? this.r.pick(cs) : null; };

// ---------- main update ----------
GP.update = function (dt) {
  const G = this, W = G.W, r = G.r, map = G.map;
  const pub = W.ghostPub;
  if (G.gone) { pub.vis = 0; pub.hunt = 0; pub.x = -50; pub.y = -50; return; }
  const alive = G.alive();
  const avgFear = alive.length ? alive.reduce((a, p) => a + p.fear, 0) / alive.length / 100 : 0;
  // trickster flips its fake evidence on and off
  if (G.fake && (G.fakeT -= dt) <= 0) { G.fakeOn = !G.fakeOn; G.fakeT = G.fakeOn ? r.range(10, 25) : r.range(25, 60); }
  pub.fake = G.fakeOn ? G.fake : '';
  // director tension
  let gain = 0.0035 + avgFear * 0.006;
  const totalNoise = alive.reduce((a, p) => a + p.talk + p.noise, 0);
  if (G.has('silence')) { if (totalNoise < 0.05) G.silenceT += dt; else G.silenceT = Math.max(0, G.silenceT - dt * 2); if (G.silenceT > 20) gain += 0.012; }
  if (G.has('listener')) gain += totalNoise * 0.004;
  const inRoom = alive.filter(p => GH.roomAt(map, p.x, p.y) === G.room).length;
  if (inRoom) gain += 0.003 * inRoom;
  if (G.has('territorial') && inRoom) { G.territoryT += dt; if (G.territoryT > 40) { G.tension = Math.max(G.tension, 0.9); G.huntCD = Math.min(G.huntCD, 2); G.territoryT = 0; } }
  G.tension = GH.clamp(G.tension + gain * dt * W.diff, 0, 1);
  for (let k = G.timers.length - 1; k >= 0; k--) { const tm = G.timers[k]; tm.at -= dt; if (tm.at <= 0) { G.timers.splice(k, 1); tm.fn(); } }
  if (G.stun > 0) { G.stun -= dt; pub.vis = Math.max(0, pub.vis - dt * 2); G.publish(); return; }
  if (G.hunt) { G.updateHunt(dt, alive); G.publish(); return; }

  // ----- roaming -----
  if (G.has('wanderer') && (G.roomChangeT -= dt) <= 0) { G.roomChangeT = r.range(90, 170); const rs = map.allRooms.filter(rm => rm.type !== 'hall' && rm.cells.length >= 6); G.room = r.pick(rs).id; }
  if (!G.goal || (G.goal.t -= dt) <= 0) {
    let roomId = G.room;
    if (G.has('wanderer') && r.chance(0.5)) roomId = r.pick(map.allRooms).id;
    if (G.has('stalker') && alive.length) { if (!G.target || !W.players[G.target] || W.players[G.target].dead) G.target = r.pick(alive).id; const tp = W.players[G.target]; const rr = GH.roomAt(map, tp.x, tp.y); if (rr > 0 && r.chance(0.45)) roomId = rr; }
    const ci = G.randomCellIn(roomId);
    if (ci !== null) G.goal = { x: (ci % map.w) + 0.5, y: ((ci / map.w) | 0) + 0.5, t: r.range(4, 12) };
  }
  if (G.goal && G.moveToward(G.goal.x, G.goal.y, 0.7, dt)) G.goal.t = Math.min(G.goal.t, r.range(1, 4));
  G.touchFloorItems();
  // manifestation
  if (G.walk) {
    const wk = G.walk; wk.t += dt;
    const f = Math.min(1, wk.t / wk.dur);
    G.manX = GH.lerp(wk.x0, wk.x1, f); G.manY = GH.lerp(wk.y0, wk.y1, f); G.manifestT = 0.3; G.mimic = -1;
    pub.vis = f > 0.92 ? (Math.random() < 0.5 ? 1 : 0) : 1;
    if ((wk.st -= dt) <= 0) { wk.st = 0.7; W.emit({ t: 'snd', s: 'stepghost', x: G.manX, y: G.manY, v: 0.7, r: 0.75 }); }
    if (f >= 1) { G.walk = null; G.manifestT = 0; pub.vis = 0; }
  } else if (G.manifestT > 0) { G.manifestT -= dt; const flick = Math.sin(W.time * 23) > -0.3 ? 1 : 0.2; pub.vis = Math.min(1, G.manifestT * 2) * flick; } else { pub.vis = 0; G.mimic = -1; }
  // events
  let rate = 1;
  if (G.has('shy') && alive.length > 1 && G.grouped(alive)) rate *= 0.4;
  if (G.burst > 0) rate *= 6;
  G.eventT -= dt * rate;
  if (G.eventT <= 0) {
    G.doEvent(alive);
    if (G.burst > 0) G.burst--;
    const mean = GH.lerp(26, 6, G.tension) / W.diff;
    G.eventT = r.expo(mean);
    if (r.chance(0.08)) G.eventT *= 4;              // dead silence
    if (r.chance(0.08)) G.burst = r.int(2, 4);      // sudden burst
  }
  // rare, hand-made scare scenes
  if ((G.sceneT -= dt) <= 0) { G.sceneT = r.range(170, 340) / W.diff; if (G.tension > 0.28 && alive.length && !G.walk) G.doScene(alive); }
  // phantom hunt (nothing is really chasing)
  if (G.has('phantom') || r.chance(0.0002)) { if ((G.phantomT -= dt) <= 0) { G.phantomT = r.range(100, 240); G.phantomHunt(); } }
  // map shifting / looping
  if (G.has('shifter') && G.tension > 0.25 && (G.shiftT -= dt) <= 0) { G.shiftT = r.range(45, 100); G.shiftMap(); }
  if (G.looperDoor >= 0) G.checkLoop(alive, dt);
  // hunts
  G.huntCD -= dt;
  if (G.huntCD <= 0 && alive.length) {
    const hazard = Math.max(0, G.tension - 0.22) * 0.06 * (G.has('frenzy') ? 1.8 : 1) * (G.has('patient') ? 0.5 : 1);
    if (r() < hazard * dt) G.tryHunt(alive);
  }
  G.publish();
};

GP.grouped = function (alive) {
  return alive.every(p => alive.some(q => q !== p && GH.dist(p.x, p.y, q.x, q.y) < 4));
};
GP.isAlone = function (p, alive) { return !alive.some(q => q !== p && GH.dist(p.x, p.y, q.x, q.y) < 4.5); };

GP.publish = function () {
  const G = this, pub = G.W.ghostPub;
  pub.x = G.manifestT > 0 && G.manX ? G.manX : G.x; pub.y = G.manifestT > 0 && G.manY ? G.manY : G.y;
  if (G.hunt) { pub.x = G.x; pub.y = G.y; }
  pub.form = G.form; pub.hunt = G.hunt ? 1 : 0; pub.mimic = G.mimic; pub.room = G.room;
  pub.glitch = G.hunt ? 0.6 : (G.manifestT > 0 ? 0.35 : 0);
};

// objects on the floor react when the ghost passes over them
GP.touchFloorItems = function () {
  const G = this, W = G.W;
  for (const o of W.objs) {
    if (o.kind !== 'item' && o.kind !== 'salt') continue;
    const d = GH.dist(o.x, o.y, G.x, G.y);
    if (o.kind === 'salt' && d < 0.6 && o.spr === 'saltpile') {
      o.spr = 'saltprint';
      if (G.def.weak === 'salt' && G.def.immune !== 'salt') { G.stun = Math.max(G.stun, 2.5); W.emit({ t: 'snd', s: 'growl', x: G.x, y: G.y, v: 0.7 }); }
    }
    if (o.kind !== 'item') continue;
    if (o.it === 'ash' && d < 0.7 && (G.hasEv('prints') || (G.fake === 'prints' && G.fakeOn))) { o.spr = 'ashprint'; o.prints = 1; }
    if ((o.it === 'motion' || o.it === 'thread') && d < 1.3 && (G.hasEv('motion') || (G.fake === 'motion' && G.fakeOn))) {
      if (!o.trigT || W.time - o.trigT > 3) {
        o.trigT = W.time; o.on = 1; o.spr = o.it === 'motion' ? 'motionon' : 'threadon';
        W.emit({ t: 'snd', s: o.it === 'motion' ? 'beep' : 'bell', x: o.x, y: o.y, v: 0.6, r: o.it === 'motion' ? 1 : 1.8 });
        W.emit({ t: 'unflash', o: o.id, after: 1.5 });
      }
    }
  }
};

// ---------- ghost events ----------
GP.doEvent = function (alive) {
  const G = this, W = G.W, r = G.r, map = G.map;
  const near = alive.length && (G.tension > 0.3 || r.chance(0.3)) ? (G.target && W.players[G.target] && !W.players[G.target].dead && G.has('stalker') ? W.players[G.target] : r.pick(alive)) : null;
  const w = {
    sound: 3, door: G.has('slammer') ? 6 : 2, light: G.has('light_eater') ? 5 : 1.5, throw: G.has('thrower') ? 6 : 1.5, write: 2,
    manifest: 0.4 + G.tension * 1.6, whisper: G.has('whisperer') ? 4 : 0.6, mimicvoice: G.has('mimic_voice') ? 3 : 0,
    possess: G.has('possessor') ? 2.5 : 0, collect: G.has('collector') ? 3 : 0, music: (G.def.origin === 'child' || G.has('giggler')) ? 1.5 : 0.2,
    footsteps: 1.5, lens: G.has('mirror') ? 2 : 0, behind: G.tension > 0.35 ? 0.5 : 0, flavor: G.has('weeper') || G.has('giggler') ? 4 : 1.5
  };
  let tot = 0; for (const k in w) tot += w[k];
  let pick = r() * tot, ev = 'sound';
  for (const k in w) { pick -= w[k]; if (pick <= 0) { ev = k; break; } }
  const fl = G.flavor();
  switch (ev) {
    case 'sound': case 'flavor': {
      const s = ev === 'flavor' ? fl : r.pick(['knock', fl, 'creak', 'breath', fl]);
      const pos = near && r.chance(0.5) ? G.offsetNear(near, r.range(2, 5)) : { x: G.x, y: G.y };
      W.emit({ t: 'snd', s, x: pos.x, y: pos.y, v: 0.9 });
      G.scare(pos.x, pos.y, 6);
      if (s === 'knock') G.emitEmf(pos.x, pos.y);
      break;
    }
    case 'footsteps': {
      const p = near || r.pick(alive) || null; if (!p) break;
      const pos = G.offsetNear(p, r.range(2.5, 5));
      W.emit({ t: 'steps', x: pos.x, y: pos.y, tx: p.x, ty: p.y, n: r.int(3, 7) });
      G.scare(p.x, p.y, 8);
      break;
    }
    case 'door': {
      let best = null, bd = 6;
      for (const d of map.doors) { if (d.dead) continue; const dd = GH.dist(d.x + 0.5, d.y + 0.5, G.x, G.y); if (dd < bd) { bd = dd; best = d; } }
      if (!best) break;
      if (best.front && !G.hunt && r.chance(0.7)) break;
      const slam = G.has('slammer') ? r.chance(0.7) : r.chance(0.3);
      if (slam && best.target > 0.5) { best.target = 0; best.slam = 1; W.emit({ t: 'snd', s: 'slam', x: best.x + 0.5, y: best.y + 0.5, v: 1 }); G.scare(best.x, best.y, 14); if (G.has('slammer') && r.chance(0.5)) best.locked = r.range(6, 14); }
      else { best.target = best.target > 0.5 ? 0 : r.range(0.3, 1); W.emit({ t: 'snd', s: 'creak', x: best.x + 0.5, y: best.y + 0.5, v: 0.8, r: 0.7 }); G.scare(best.x, best.y, 6); }
      G.emitEmf(best.x + 0.5, best.y + 0.5);
      if (G.hasEv('prints') || (G.fake === 'prints' && G.fakeOn)) if (r.chance(0.7)) G.W.addObj({ kind: 'print', spr: 'hand', x: best.x + 0.5 + (best.axis === 'v' ? r.pick([-0.45, 0.45]) : r.range(-0.3, 0.3)), y: best.y + 0.5 + (best.axis === 'h' ? r.pick([-0.45, 0.45]) : r.range(-0.3, 0.3)), sh: 0.3, z: 0.45, room: -1, ttl: 150 });
      break;
    }
    case 'light': {
      let best = null, bd = 7;
      for (const L of map.lights) { if (L.kind === 'van') continue; const dd = GH.dist(L.x, L.y, G.x, G.y); if (L.on && dd < bd) { bd = dd; best = L; } }
      if (!best) { G.eventT = 1; break; }
      if (r.chance(0.5)) { best.flicker = r.range(1, 3); W.emit({ t: 'snd', s: 'static', x: best.x, y: best.y, v: 0.25, r: 0.6 }); }
      else { best.on = false; if (best.kind === 'lamp' && r.chance(G.has('light_eater') ? 0.4 : 0.15)) { best.broken = true; W.emit({ t: 'snd', s: 'glass', x: best.x, y: best.y, v: 0.9 }); } else W.emit({ t: 'snd', s: best.kind === 'torch' ? 'whoosh' : 'click', x: best.x, y: best.y, v: 0.7, r: 1.5 }); }
      G.emitEmf(best.x, best.y); G.scare(best.x, best.y, 10);
      break;
    }
    case 'throw': {
      const objs = W.objs.filter(o => (o.kind === 'throw' || o.kind === 'item') && GH.dist(o.x, o.y, G.x, G.y) < 4.5);
      if (!objs.length) { G.eventT = 1; break; }
      const o = r.pick(objs);
      const a = r() * Math.PI * 2, d = r.range(0.8, 2.2);
      const nx = o.x + Math.cos(a) * d, ny = o.y + Math.sin(a) * d;
      if (W.cellFree(nx, ny) && GH.los(map, o.x, o.y, nx, ny, W.blockSight)) { o.x = nx; o.y = ny; }
      W.emit({ t: 'snd', s: o.spr === 'cup' ? 'glass' : 'thud', x: o.x, y: o.y, v: 0.9 });
      G.emitEmf(o.x, o.y); G.scare(o.x, o.y, 12);
      break;
    }
    case 'write': {
      const book = W.objs.find(o => o.kind === 'item' && (o.it === 'notebook' || o.it === 'quill') && !o.written && GH.dist(o.x, o.y, G.x, G.y) < 4);
      if (!book) break;
      if (G.hasEv('writing') || (G.fake === 'writing' && G.fakeOn)) { book.written = 1; book.spr = 'written'; W.emit({ t: 'snd', s: 'whisper', x: book.x, y: book.y, v: 0.3, r: 1.6 }); G.emitEmf(book.x, book.y); }
      break;
    }
    case 'manifest': {
      const p = near; let pos;
      if (p && G.tension > 0.25) {
        // appear in the player's view, a few cells away
        let tries = 0;
        do { const a = p.a + r.range(-0.6, 0.6), d = r.range(3, 6.5); pos = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }; } while (tries++ < 10 && !(W.cellFree(pos.x, pos.y) && GH.los(map, p.x, p.y, pos.x, pos.y, W.blockSight)));
        if (tries >= 10) pos = { x: G.x, y: G.y };
      } else pos = { x: G.x, y: G.y };
      G.manX = pos.x; G.manY = pos.y;
      G.manifestT = r.range(1.2, 3.2);
      if (G.has('mimic_form') && alive.length > 1 && p) { const others = alive.filter(q => q !== p); G.mimic = r.pick(others).slot; } else G.mimic = -1;
      W.emit({ t: 'snd', s: r.pick(['hum', 'breath', fl]), x: pos.x, y: pos.y, v: 1 });
      G.scare(pos.x, pos.y, 22);
      G.emitEmf(pos.x, pos.y);
      break;
    }
    case 'whisper': {
      const p = near || r.pick(alive); if (!p) break;
      W.emit({ t: 'whisper', pid: p.id, name: G.has('whisperer') && r.chance(0.5) ? 1 : 0 });
      G.scare(p.x, p.y, 10);
      break;
    }
    case 'mimicvoice': {
      const p = near || r.pick(alive); if (!p) break;
      const others = alive.filter(q => q !== p);
      const of = others.length ? r.pick(others).id : p.id;
      const pos = G.offsetNear(p, r.range(2, 5));
      W.emit({ t: 'mimic', pid: p.id, of, x: pos.x, y: pos.y });
      break;
    }
    case 'possess': {
      const p = near || r.pick(alive); if (!p) break;
      W.emit({ t: 'lightfail', pid: p.id, d: r.range(2, 5) });
      G.scare(p.x, p.y, 15);
      break;
    }
    case 'collect': {
      const items = W.objs.filter(o => o.kind === 'item' && o.it !== 'crucifix');
      if (!items.length) break;
      const o = r.pick(items);
      const ci = G.randomCellIn(G.room); if (ci === null) break;
      o.x = (ci % map.w) + 0.3 + r() * 0.4; o.y = ((ci / map.w) | 0) + 0.3 + r() * 0.4; o.room = G.room;
      W.emit({ t: 'snd', s: 'giggle', x: o.x, y: o.y, v: 0.4, r: 0.7 });
      break;
    }
    case 'behind': { const p = near || r.pick(alive); if (p) W.emit({ t: 'behind', pid: p.id, form: G.form }); break; }
    case 'music': W.emit({ t: 'snd', s: 'musicbox', x: G.x, y: G.y, v: 0.6, r: r.range(0.85, 1.05) }); G.scare(G.x, G.y, 8); break;
    case 'lens': {
      // appears behind someone using a camera / mirror
      const p = alive.find(q => q.lens);
      if (!p) break;
      const pos = { x: p.x - Math.cos(p.a) * 1.4, y: p.y - Math.sin(p.a) * 1.4 };
      if (!W.cellFree(pos.x, pos.y)) break;
      G.manX = pos.x; G.manY = pos.y; G.manifestT = 2.5;
      W.emit({ t: 'snd', s: 'breath', x: pos.x, y: pos.y, v: 1 });
      break;
    }
  }
};

GP.offsetNear = function (p, d) {
  const W = this.W, r = this.r;
  for (let k = 0; k < 12; k++) { const a = r() * Math.PI * 2; const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d; if (W.cellFree(x, y)) return { x, y }; }
  return { x: p.x + 0.8, y: p.y };
};

// ---------- hunts ----------
GP.crucifixBlocks = function () {
  const G = this, W = G.W;
  if (G.def.immune === 'holy') return false;
  const R = G.def.weak === 'holy' ? 4.5 : 3;
  for (const o of W.objs) {
    if (o.kind === 'item' && o.it === 'crucifix' && GH.dist(o.x, o.y, G.x, G.y) < R) {
      o.n = (o.n || 1) - 1; if (o.n <= 0) o.kind = 'gone';
      W.emit({ t: 'snd', s: 'whoosh', x: o.x, y: o.y, v: 1, r: 0.6 }); W.emit({ t: 'msg', pid: -1, k: 'crucifix' });
      return true;
    }
  }
  for (const p of G.alive()) for (let k = 0; k < 4; k++) {
    const s = p.inv[k];
    if (s && s.it === 'crucifix' && k === p.sel && GH.dist(p.x, p.y, G.x, G.y) < R) {
      s.n--; if (s.n <= 0) p.inv[k] = null;
      W.emit({ t: 'snd', s: 'whoosh', x: p.x, y: p.y, v: 1, r: 0.6 }); W.emit({ t: 'msg', pid: p.id, k: 'crucifix' });
      return true;
    }
  }
  return false;
};

GP.tryHunt = function (alive, forced) {
  const G = this, r = G.r;
  if (!forced && G.has('lonely') && !alive.some(p => G.isAlone(p, alive))) { G.huntCD = 8; return; }
  if (!forced && G.crucifixBlocks()) { G.huntCD = r.range(25, 45); G.tension *= 0.7; return; }
  G.startHunt(alive, forced);
};

GP.startHunt = function (alive, final) {
  const G = this, W = G.W, r = G.r, map = G.map;
  let dur = r.range(22, 40) * (G.has('patient') ? 1.45 : 1) * (G.has('frenzy') ? 0.6 : 1);
  if (final) dur = 35;
  if (G.has('teleporter') && alive.length) {
    const p = r.pick(alive);
    for (let k = 0; k < 30; k++) {
      const a = r() * Math.PI * 2, d = r.range(5, 9);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const i = Math.floor(y) * map.w + Math.floor(x);
      if (x > 0 && y > 0 && x < map.w && y < map.h && G.walkable(i) && !GH.los(map, p.x, p.y, x, y, W.blockSight)) { G.x = x; G.y = y; break; }
    }
  }
  G.manifestT = 0;
  G.hunt = { t: dur, seen: {}, last: null, losT: 0, retarget: 0, check: null, checked: {}, blinkT: 0, hidden: {} };
  const fd = map.doors[map.frontDoor]; fd.target = 0; fd.slam = 1; fd.locked = dur + 3;
  for (const L of map.lights) if (L.on && GH.dist(L.x, L.y, G.x, G.y) < 12) L.flicker = 2;
  W.emit({ t: 'hunt', on: 1 });
  W.emit({ t: 'snd', s: 'slam', x: fd.x + 0.5, y: fd.y + 0.5, v: 1 });
  W.emit({ t: 'snd', s: 'growl', x: G.x, y: G.y, v: 1 });
};

GP.phantomHunt = function () {
  const G = this, W = G.W, map = G.map;
  for (const L of map.lights) if (L.on && G.r.chance(0.7)) L.flicker = 4;
  W.emit({ t: 'hunt', on: 2 });
  const p = G.r.pick(G.alive()); if (p) W.emit({ t: 'steps', x: G.offsetNear(p, 4).x, y: G.offsetNear(p, 4).y, tx: p.x, ty: p.y, n: 8, heavy: 1 });
  G.scare(G.x, G.y, 10);
};

GP.endHunt = function () {
  const G = this, W = G.W, r = G.r;
  const h = G.hunt; G.hunt = null;
  for (const pid in h.hidden) { const o = h.hidden[pid]; G.hideMemory[o] = (G.hideMemory[o] || 0) + 1; }
  // learns hiding *types* too (all wardrobes / lockers become suspicious)
  G.huntCD = r.range(25, 75) * (G.has('frenzy') ? 0.55 : 1) * (G.has('patient') ? 1.6 : 1) / W.diff;
  G.tension *= 0.45;
  const fd = G.map.doors[G.map.frontDoor]; fd.locked = 0;
  W.ghostPub.vis = 0;
  W.emit({ t: 'hunt', on: 0 });
  if (G.final) { G.gone = true; W.emit({ t: 'msg', pid: -1, k: 'ghostgone' }); W.emit({ t: 'snd', s: 'sting', x: null, y: null, v: 0.6 }); }
  // after a hunt the ghost returns home
  const ci = G.randomCellIn(G.room); if (ci !== null) { G.x = (ci % G.map.w) + 0.5; G.y = ((ci / G.map.w) | 0) + 0.5; }
};

GP.updateHunt = function (dt, alive) {
  const G = this, W = G.W, r = G.r, map = G.map, h = G.hunt, pub = W.ghostPub;
  h.t -= dt;
  if (h.t <= 0 || !alive.length) { G.endHunt(); return; }
  // blinking visibility
  h.blinkT -= dt;
  if (h.blinkT <= 0) { h.on = !h.on; h.blinkT = h.on ? r.range(0.25, 0.8) : r.range(0.08, 0.45); }
  pub.vis = G.has('invisible') ? (h.on && r.chance(0.08) ? 0.6 : 0) : (h.on ? 1 : 0.05);
  // mimic another player during hunts
  if (G.has('mimic_form') && alive.length) { if (!h.mim || r.chance(dt * 0.3)) h.mim = r.pick(alive).slot; G.mimic = r.chance(0.6) ? h.mim : -1; }
  // senses
  h.retarget -= dt;
  if (h.retarget <= 0) {
    h.retarget = 0.25;
    let best = null, bd = 1e9;
    for (const p of alive) {
      if (p.hiding >= 0) continue;
      const d = GH.dist(p.x, p.y, G.x, G.y);
      let range = p.light ? 15 : 7;
      if (G.has('sound_hunter')) range = 0;
      const sees = d < range && GH.los(map, G.x, G.y, p.x, p.y, W.blockSight);
      const hear = (p.talk * 14 + p.noise * 9 + (p.heldOn ? 2 : 0)) * (G.has('listener') ? 1.5 : 1);
      if (sees || d < hear || d < 1.5) { if (d < bd) { bd = d; best = p; } if (sees) h.seen[p.id] = 1; }
    }
    if (best) { h.last = { x: best.x, y: best.y, pid: best.id }; h.losT += 0.25; h.check = null; }
    else h.losT = Math.max(0, h.losT - 0.5);
    // search a hiding place?
    if (!best && !h.check) {
      const spots = W.objs.filter(o => o.hide && !h.checked[o.id] && GH.dist(o.x, o.y, G.x, G.y) < 7);
      for (const o of spots) {
        const saw = Object.values(G.sawHidden).includes(o.id);
        const mem = G.hideMemory[o.id] || 0;
        const typeMem = Object.keys(G.hideMemory).filter(k => W.objs[k] && W.objs[k].spr === o.spr).length;
        const p = saw ? 0.95 : Math.min(0.8, 0.08 + mem * 0.3 + typeMem * 0.08);
        if (r() < p * 0.5) { h.check = o; break; }
        h.checked[o.id] = 1;
      }
    }
  }
  // speed
  let sp = G.speedBase * (0.9 + 0.1 * W.diff);
  const ci = Math.floor(G.y) * map.w + Math.floor(G.x);
  if (G.has('fast_dark')) { const lit = map.lights.some(L => L.on && !L.broken && GH.dist(L.x, L.y, G.x, G.y) < L.rad * 0.6); if (!lit) sp *= 1.3; }
  if (G.has('accelerating')) sp *= 1 + Math.min(1, h.losT / 7) * 0.75;
  // weaknesses that slow it down
  for (const p of alive) {
    const d = GH.dist(p.x, p.y, G.x, G.y);
    if (d > 6) continue;
    const facing = Math.abs(GH.angDiff(p.a, Math.atan2(G.y - p.y, G.x - p.x))) < 0.35;
    if (G.def.weak === 'light' && p.light && W.era === 'modern' && facing) sp *= 0.55;
    if (G.def.weak === 'fire' && W.hasFire(p) && d < 2.5) sp *= 0.5;
  }
  if (h.check) {
    if (G.moveToward(h.check.x, h.check.y, sp * 0.9, dt) || GH.dist(h.check.x, h.check.y, G.x, G.y) < 0.9) {
      const victim = alive.find(p => p.hiding === h.check.id);
      W.emit({ t: 'snd', s: 'creak', x: h.check.x, y: h.check.y, v: 1, r: 0.6 });
      h.checked[h.check.id] = 1;
      if (victim && !(victim.talk < 0.05 && r.chance(G.sawHidden[victim.id] === h.check.id ? 0 : 0.35))) { G.kill(victim); return; }
      h.check = null;
    }
  } else if (h.last) {
    if (G.moveToward(h.last.x, h.last.y, sp, dt)) h.last = null;
  } else {
    if (!G.goal || (G.goal.t -= dt) <= 0) { const rr = r.pick(map.allRooms); const c = G.randomCellIn(rr.id); if (c !== null) G.goal = { x: (c % map.w) + 0.5, y: ((c / map.w) | 0) + 0.5, t: 6 }; }
    if (G.goal && G.moveToward(G.goal.x, G.goal.y, sp * 0.8, dt)) G.goal.t = 0;
  }
  G.touchFloorItems();
  // record hidden players this hunt
  for (const p of alive) if (p.hiding >= 0) h.hidden[p.id] = p.hiding;
  // footsteps
  G.stepT -= dt;
  if (G.stepT <= 0) { G.stepT = 0.42 / (sp / 1.6); W.emit({ t: 'snd', s: 'stepghost', x: G.x, y: G.y, v: 1, r: r.range(0.85, 1.1) }); }
  // kill
  for (const p of alive) if (p.hiding < 0 && GH.dist(p.x, p.y, G.x, G.y) < 0.55) { G.kill(p); return; }
};

GP.kill = function (p) {
  const G = this, W = G.W;
  p.dead = true; p.hiding = -1;
  W.addObj({ kind: 'body', spr: `body_${W.era}_${p.slot}`, x: p.x, y: p.y, sh: 0.55, room: -1 });
  W.emit({ t: 'kill', pid: p.id, x: p.x, y: p.y });
  W.emit({ t: 'snd', s: 'scream', x: p.x, y: p.y, v: 1 });
  if (G.hunt) G.endHunt();
};

GP.sawHide = function (p, o) {
  const G = this;
  if (G.hunt && GH.dist(p.x, p.y, G.x, G.y) < 10 && GH.los(G.map, G.x, G.y, p.x, p.y, G.W.blockSight)) G.sawHidden[p.id] = o.id;
  else delete G.sawHidden[p.id];
};

GP.noise = function (x, y, amt) { this.noises.push({ x, y, amt }); if (this.noises.length > 8) this.noises.shift(); if (this.hunt && GH.dist(x, y, this.x, this.y) < amt * 3) this.hunt.last = { x, y }; };

// ---------- interactions from players ----------
const ANSWERS = {
  where: ['v_here', 'v_close', 'v_behind', 'v_away'], who: ['v_child', 'v_old', 'v_young', 'v_death'], what: ['v_kill', 'v_leave', 'v_mine', 'v_death', 'v_cold'], any: ['v_here', 'v_leave', 'v_death', 'v_behind', 'v_kill', 'v_name']
};
GP.onAsk = function (p, q) {
  const G = this, W = G.W, r = G.r;
  G.tension = Math.min(1, G.tension + (G.has('listener') ? 0.08 : 0.03));
  const dist = GH.dist(p.x, p.y, G.x, G.y);
  const room = GH.roomAt(G.map, p.x, p.y);
  const dark = !G.map.lights.some(L => L.on && !L.broken && L.room === room);
  const can = G.hasEv('voice') || (G.fake === 'voice' && G.fakeOn);
  if (can && dist < 5.5 && (dark || W.era === 'medieval') && r.chance(0.65)) {
    const kind = ['any', 'where', 'who', 'what'][q] || 'any';
    let word = r.pick(ANSWERS[kind]);
    if (kind === 'who') word = G.def.origin === 'child' ? 'v_child' : r.pick(['v_old', 'v_young', 'v_death']);
    W.emit({ t: 'voice', pid: p.id, w: word, x: p.x, y: p.y });
    G.scare(p.x, p.y, 12);
  }
};
GP.onSpeech = function (p, text) {
  const G = this, W = G.W;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const t = norm(text);
  const first = norm(W.deadName.split(' ').filter(s => !/^(of|brother|sister|mother|father|old|the)$/i.test(s))[0] || '');
  if (first && first.length > 2 && t.includes(first)) {
    G.tension = Math.min(1, G.tension + (G.has('listener') ? 0.25 : 0.1));
    if (G.hunt && G.def.weak === 'name') { W.emit({ t: 'msg', pid: -1, k: 'namecalm' }); G.endHunt(); return; }
    if (G.r.chance(0.4)) W.emit({ t: 'snd', s: 'knock', x: G.x, y: G.y, v: 1 });
  }
  if (G.has('listener')) G.tension = Math.min(1, G.tension + 0.02);
  const s = p.inv[p.sel];
  if (s && (s.it === 'spiritbox' || s.it === 'bell')) {
    let q = -1;
    if (/(where|ou es|hol vagy|merre|are you here|itt vagy|es-tu la)/.test(t)) q = 1;
    else if (/(who|qui es|ki vagy|how old|hany eves|quel age)/.test(t)) q = 2;
    else if (/(what do you want|que veux|mit akarsz|give us a sign|adj jelet|fais un signe)/.test(t)) q = 3;
    if (q >= 0) { if (s.it === 'spiritbox' && !s.on) return; G.onAsk(p, q); }
  }
};
GP.onWard = function (p, it) {
  const G = this, W = G.W;
  const d = GH.dist(p.x, p.y, G.x, G.y);
  const holy = it === 'bible' || it === 'holywater';
  if (holy && G.def.immune === 'holy') { W.emit({ t: 'snd', s: 'growl', x: G.x, y: G.y, v: 0.9 }); W.emit({ t: 'msg', pid: p.id, k: 'noeffect' }); return; }
  const weak = (holy && G.def.weak === 'holy') || (it === 'smudge' && G.def.weak === 'smoke');
  if (G.hunt) {
    if (d < (it === 'holywater' ? 3.5 : 5)) {
      if (it === 'holywater' && weak) { G.endHunt(); W.emit({ t: 'msg', pid: -1, k: 'banished' }); return; }
      G.stun = (it === 'holywater' ? 6 : 5) * (weak ? 1.7 : 1);
      W.emit({ t: 'snd', s: 'scream', x: G.x, y: G.y, v: 0.6, r: 0.6 });
      // move away a bit
      G.hunt.last = null;
    }
  } else if (GH.roomAt(G.map, p.x, p.y) === G.room || d < 5) {
    G.huntCD += 50 * (weak ? 1.6 : 1); G.tension = Math.max(0, G.tension - 0.25);
  }
};
GP.onBonesBurned = function () {
  const G = this;
  G.final = true; G.tension = 1;
  G.W.emit({ t: 'snd', s: 'scream', x: G.x, y: G.y, v: 1, r: 0.7 });
  setTimeout(() => { if (!G.W.over && !G.hunt) { G.startHunt(G.alive(), true); } else if (G.hunt) { G.hunt.t = 30; } }, 3500);
};

// ---------- the house changes while you're inside ----------
GP.unseen = function (x, y) {
  const W = this.W;
  return !Object.values(W.players).some(p => GH.dist(p.x, p.y, x, y) < 9 && GH.los(W.map, p.x, p.y, x, y, (i) => W.map.cells[i] > 0 && Math.floor(y) * W.map.w + Math.floor(x) !== i));
};
GP.shiftMap = function () {
  const G = this, W = G.W, map = G.map, r = G.r, w = map.w;
  if (r.chance(0.5)) {
    // open a new passage in a wall between two rooms
    const cand = [];
    for (let i = w; i < map.cells.length - w; i++) {
      if (map.cells[i] === 0 || map.outdoor[i]) continue;
      const x = i % w, y = (i / w) | 0;
      const h = map.cells[i - 1] === 0 && map.cells[i + 1] === 0 && map.cells[i - w] > 0 && map.cells[i + w] > 0;
      const v = map.cells[i - w] === 0 && map.cells[i + w] === 0 && map.cells[i - 1] > 0 && map.cells[i + 1] > 0;
      if (!h && !v) continue;
      const a = h ? [i - 1, i + 1] : [i - w, i + w];
      if (map.outdoor[a[0]] || map.outdoor[a[1]] || map.roomId[a[0]] === map.roomId[a[1]]) continue;
      if ([1, -1, w, -w].some(d => map.doorAt[i + d] >= 0)) continue;
      if (G.unseen(x + 0.5, y + 0.5)) cand.push(i);
    }
    if (!cand.length) return;
    const i = r.pick(cand);
    GH.applyMod(W, [i, 0, map.doors[0] ? map.doors[0].tex : 20]);
  } else {
    // seal a door that nobody is looking at, if the house stays connected
    const doors = map.doors.filter(d => !d.front && !d.dead && G.unseen(d.x + 0.5, d.y + 0.5) && !Object.values(W.players).some(p => GH.dist(p.x, p.y, d.x + 0.5, d.y + 0.5) < 1.5));
    r.shuffle(doors);
    for (const d of doors.slice(0, 4)) {
      const i = d.y * w + d.x;
      const old = map.cells[i]; map.cells[i] = 5; const odi = map.doorAt[i]; map.doorAt[i] = -1;
      const ok = G.connected();
      map.cells[i] = old; map.doorAt[i] = odi;
      if (ok) {
        const wallTex = map.cells[i - 1] > 0 ? map.cells[i - 1] : map.cells[i - w];
        GH.applyMod(W, [i, wallTex || 2, -1]);
        return;
      }
    }
  }
};
GP.connected = function () {
  const map = this.map, N = map.w * map.h, w = map.w;
  const s = Math.floor(map.spawn.y) * w + Math.floor(map.spawn.x);
  const seen = new Uint8Array(N); const q = [s]; seen[s] = 1; let n = 0;
  while (q.length) { const c = q.pop(); n++; for (const d of [1, -1, w, -w]) { const j = c + d; if (!seen[j] && map.cells[j] === 0) { seen[j] = 1; q.push(j); } } }
  let total = 0; for (let i = 0; i < N; i++) if (map.cells[i] === 0) total++;
  return n === total;
};
GP.checkLoop = function (alive, dt) {
  const G = this, W = G.W, map = G.map, r = G.r;
  G.loopCD -= dt;
  const D = map.doors[G.looperDoor]; if (!D || D.dead) return;
  for (const p of alive) {
    const ci = Math.floor(p.y) * map.w + Math.floor(p.x);
    const prev = G.lastCell[p.id]; G.lastCell[p.id] = ci;
    if (ci !== D.y * map.w + D.x || prev === ci || G.loopCD > 0 || G.tension < 0.2 || !r.chance(0.45)) continue;
    // send them through a different door, as if the corridor looped
    const others = map.doors.filter(d => d !== D && !d.front && !d.dead && d.axis === D.axis && GH.dist(d.x, d.y, D.x, D.y) > 6 && G.unseen(d.x + 0.5, d.y + 0.5));
    if (!others.length) continue;
    const T = r.pick(others);
    const ox = p.x - (D.x + 0.5), oy = p.y - (D.y + 0.5);
    W.emit({ t: 'tp', pid: p.id, x: T.x + 0.5 + ox, y: T.y + 0.5 + oy });
    T.target = 1;
    G.loopCD = r.range(30, 60);
    G.scare(p.x, p.y, 10);
  }
};

// ---------- scripted scare scenes: rare, each at most once per mission ----------
GP.doScene = function (alive) {
  const G = this, W = G.W, r = G.r, map = G.map;
  const lonely = alive.filter(p => G.isAlone(p, alive) && p.hiding < 0 && GH.dist(p.x, p.y, map.van.x, map.van.y) >= 5);
  const p = lonely.length ? r.pick(lonely) : r.pick(alive);
  if (!p || map.outdoor[Math.floor(p.y) * map.w + Math.floor(p.x)]) { G.sceneT = 20; return; }
  const opts = ['walker', 'doors', 'lightchain', 'bang', 'corner', 'callname', 'behind'].filter(k => !G.scenesDone[k]);
  if (!opts.length) return;
  const k = r.pick(opts);
  G.scenesDone[k] = 1;
  const at = (sec, fn) => G.timers.push({ at: sec, fn });
  switch (k) {
    case 'walker': {
      // a figure slowly crosses the corridor in front of you, then is gone
      const ok = (pts) => pts.every(([x, y]) => W.cellFree(x, y) && GH.los(map, p.x, p.y, x, y, W.blockSight));
      for (let tries = 0; tries < 40; tries++) {
        const d = r.range(3.5, 8), cx = p.x + Math.cos(p.a) * d, cy = p.y + Math.sin(p.a) * d;
        const px = -Math.sin(p.a), py = Math.cos(p.a);
        let walk = null;
        for (const hw of [2.2, 1.6, 1.0]) {
          const x0 = cx - px * hw, y0 = cy - py * hw, x1 = cx + px * hw, y1 = cy + py * hw;
          if (ok([[x0, y0], [cx, cy], [x1, y1]])) { walk = { x0, y0, x1, y1 }; break; }
        }
        // in a narrow corridor it simply walks away from you, into the dark
        if (!walk) { const fx = cx + Math.cos(p.a) * 3, fy = cy + Math.sin(p.a) * 3; if (ok([[cx, cy], [fx, fy]])) walk = { x0: cx, y0: cy, x1: fx, y1: fy }; }
        if (walk) {
          G.walk = Object.assign(walk, { t: 0, dur: r.range(3.5, 5), st: 0 });
          W.emit({ t: 'snd', s: 'hum', x: cx, y: cy, v: 0.8 });
          G.scare(cx, cy, 25);
          return;
        }
      }
      G.scenesDone.walker = 0; G.sceneT = 15;
      break;
    }
    case 'doors': {
      // every door around you slams, one after another, closer and closer
      const ds = map.doors.filter(d => !d.dead && !d.front && GH.dist(d.x, d.y, p.x, p.y) < 16).sort((a, b) => GH.dist(b.x, b.y, p.x, p.y) - GH.dist(a.x, a.y, p.x, p.y));
      ds.forEach((d, i) => at(0.35 + i * 0.32, () => { d.target = 0; d.slam = 1; W.emit({ t: 'snd', s: 'slam', x: d.x + 0.5, y: d.y + 0.5, v: 1, r: 0.9 + Math.random() * 0.2 }); G.scare(d.x, d.y, 8); }));
      at(0.6 + ds.length * 0.32, () => W.emit({ t: 'whisper', pid: p.id, name: 1 }));
      break;
    }
    case 'lightchain': {
      // the lights die room by room, coming toward you
      const ls = map.lights.filter(L => L.kind !== 'van' && L.on && !L.broken).sort((a, b) => GH.dist(b.x, b.y, p.x, p.y) - GH.dist(a.x, a.y, p.x, p.y));
      ls.forEach((L, i) => at(0.4 + i * 0.55, () => { L.on = false; W.emit({ t: 'snd', s: L.kind === 'torch' ? 'whoosh' : 'click', x: L.x, y: L.y, v: 0.9, r: 0.8 }); }));
      at(0.8 + ls.length * 0.55, () => { W.emit({ t: 'lightfail', pid: p.id, d: 3.5 }); W.emit({ t: 'snd', s: 'breath', x: p.x - Math.cos(p.a) * 0.7, y: p.y - Math.sin(p.a) * 0.7, v: 1.2 }); G.scare(p.x, p.y, 25); });
      break;
    }
    case 'bang': {
      // something pounds on the nearest door, harder and harder… then silence
      let best = null, bd = 9;
      for (const d of map.doors) { if (d.dead) continue; const dd = GH.dist(d.x + 0.5, d.y + 0.5, p.x, p.y); if (dd < bd && dd > 1.5) { bd = dd; best = d; } }
      if (!best) { G.scenesDone.bang = 0; break; }
      best.target = 0; best.slam = 1; best.locked = 9;
      for (let i = 0; i < 7; i++) at(0.6 + i * (0.75 - i * 0.07), () => { W.emit({ t: 'snd', s: i % 2 ? 'knock' : 'slam', x: best.x + 0.5, y: best.y + 0.5, v: 0.5 + i * 0.08, r: 0.8 }); G.scare(best.x, best.y, 7); });
      at(6.5, () => { best.locked = 0; best.target = 1; W.emit({ t: 'snd', s: 'creak', x: best.x + 0.5, y: best.y + 0.5, v: 1, r: 0.6 }); });
      break;
    }
    case 'corner': W.emit({ t: 'corner', pid: p.id, form: G.form }); break;
    case 'behind': W.emit({ t: 'behind', pid: p.id, form: G.form, long: 1 }); break;
    case 'callname': {
      // a friend's voice calls you from the dark, and footsteps walk away from you
      const others = alive.filter(q => q !== p);
      const pos = G.offsetNear(p, r.range(5, 8));
      W.emit({ t: 'mimic', pid: p.id, of: others.length ? r.pick(others).id : p.id, x: pos.x, y: pos.y });
      at(1.5, () => W.emit({ t: 'steps', x: pos.x, y: pos.y, tx: pos.x + (pos.x - p.x), ty: pos.y + (pos.y - p.y), n: 6 }));
      at(5, () => W.emit({ t: 'snd', s: 'giggle', x: pos.x, y: pos.y, v: 0.6, r: 0.7 }));
      break;
    }
  }
};
