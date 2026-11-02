// GRAVEHUSH — shared world state, items and actions (host is authoritative)
'use strict';

GH.ITEMS = {
  modern: ['emf', 'thermo', 'spiritbox', 'notebook', 'uv', 'camera', 'motion', 'crucifix', 'salt', 'smudge', 'lighter'],
  medieval: ['candle', 'bowl', 'bell', 'quill', 'ash', 'mirror', 'thread', 'crucifix', 'salt', 'bible', 'holywater']
};
GH.EV_ITEM = {
  modern: { cold: 'thermo', emf: 'emf', voice: 'spiritbox', writing: 'notebook', prints: 'uv', lens: 'camera', motion: 'motion' },
  medieval: { cold: 'bowl', emf: 'candle', voice: 'bell', writing: 'quill', prints: 'ash', lens: 'mirror', motion: 'thread' }
};
GH.ITEM_USES = { salt: 3, bible: 2, smudge: 1, holywater: 1, crucifix: 2 };
GH.PLACEABLE = { notebook: 1, quill: 1, ash: 1, motion: 1, thread: 1, crucifix: 1, salt: 1, candle: 1 };
GH.OBJECTIVES = ['identify', 'banish', 'dawn'];
GH.DYN = { throw: 1, item: 1, clue: 1, bones: 1, print: 1, deco: 1, salt: 1, orbs: 1, body: 1 };

GH.World = function (o) {
  const W = this;
  W.isHost = !!o.isHost;
  W.seed = o.seed; W.era = o.era; W.loc = o.loc; W.diff = o.diff || 1;
  W.lobby = !!o.lobby;
  W.map = o.lobby ? GH.genLobbyMap(o.era) : GH.genMap(o.seed, o.era, o.loc);
  W.objs = W.map.objects; // index == id
  W.players = {};
  W.time = 0;
  W.temps = W.map.rooms.map(() => 12);
  W.emf = [];
  W.found = [];
  W.guess = -1;
  W.mods = [];
  W.over = null;
  W.events = [];
  W.ghostPub = { x: -50, y: -50, vis: 0, form: 'shadow', hunt: 0, mimic: -1, room: -1, glitch: 0, emit: 0, phantom: 0 };
  W.objective = o.objective || 'identify';
  W.deadName = o.deadName || '';
  W.dawnTime = 9 * 60;
  W.bonesBurned = false;
  W.stock = {};
  for (const it of GH.ITEMS[W.era]) W.stock[it] = it === 'salt' || it === 'crucifix' ? 2 : 2;
  const map = W.map;
  W.cellFree = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= map.w || yi >= map.h) return false;
    const i = yi * map.w + xi;
    if (map.cells[i] > 0) return false;
    const d = map.doorAt[i]; if (d >= 0 && map.doors[d].open < 0.8) return false;
    return true;
  };
  W.blockSight = (i) => map.cells[i] > 0 || (map.doorAt[i] >= 0 && map.doors[map.doorAt[i]].open < 0.5);

  W.baseTemp = W.map.rooms.map(() => 18);
  if (W.isHost && !W.lobby) {
    const r = GH.rng(o.seed ^ 0x5eed);
    W.r = r;
    W.ghostDef = GH.GHOSTS[o.ghostIdx];
    // fixed room temperatures
    W.baseTemp = W.map.rooms.map(rm => rm.outdoor ? 6 : r.range(10, 17));
    // clues and bones
    const rooms = W.map.allRooms.filter(rm => rm.type !== 'hall' && rm.cells.length >= 6);
    const freeCell = (rm) => { const c = rm.cells.filter(i => map.blockObj[i] < 0 && map.doorAt[i] < 0); return c.length ? r.pick(c) : -1; };
    const nClue = 4;
    const clueVariants = r.shuffle([0, 1, 2, 3, 4]);
    for (let k = 0; k < nClue; k++) {
      const rm = r.pick(rooms); const i = freeCell(rm); if (i < 0) continue;
      W.addObj({ kind: 'clue', spr: r.pick(['note', 'photo', 'toy', 'note']), x: (i % map.w) + 0.3 + r() * 0.4, y: ((i / map.w) | 0) + 0.3 + r() * 0.4, sh: 0.25, room: rm.id, clue: 'clue_' + W.ghostDef.origin + '_' + clueVariants[k] });
    }
    // one misleading clue (generic)
    { const rm = r.pick(rooms); const i = freeCell(rm); if (i >= 0) W.addObj({ kind: 'clue', spr: 'note', x: (i % map.w) + 0.5, y: ((i / map.w) | 0) + 0.5, sh: 0.25, room: rm.id, clue: 'clue_generic_' + r.int(0, 3) }); }
    const brm = r.pick(rooms); const bi = freeCell(brm);
    W.bonesId = W.addObj({ kind: 'bones', spr: 'bones', x: (bi % map.w) + 0.5, y: ((bi / map.w) | 0) + 0.5, sh: 0.3, room: brm.id }).id;
    W.ghost = new GH.Ghost(W, W.ghostDef, r);
  }
};

GH.World.prototype.addObj = function (o) {
  o.id = this.objs.length; this.objs.push(o); return o;
};
GH.World.prototype.emit = function (ev) { this.events.push(ev); if (this.onEvent) this.onEvent(ev); };

GH.World.prototype.addPlayer = function (id, name, slot, lang) {
  const s = this.map.spawn;
  this.players[id] = {
    id, name, slot, lang: lang || 'en', x: s.x + (slot % 2) * 0.6 - 0.3, y: s.y + (slot >> 1) * 0.6, a: s.a,
    inv: [null, null, null, null], sel: 0, light: true, hiding: -1, dead: false, fear: 0, noise: 0, talk: 0, alive: true, run: 0, lens: 0, uvOn: 0, heldOn: 0
  };
  return this.players[id];
};

GH.World.prototype.roomOf = function (x, y) { return GH.roomAt(this.map, x, y); };

// ---------- actions (executed on host) ----------
GH.World.prototype.act = function (pid, a) {
  const W = this, p = W.players[pid], map = W.map;
  if (!p || W.over) return;
  if (W.lobby && !['door', 'lamp', 'light', 'sel', 'deco'].includes(a.t)) return;
  if (p.dead && a.t !== 'guess') return;
  const g = W.ghost;
  switch (a.t) {
    case 'door': {
      const d = map.doors[a.i]; if (!d) return;
      if (d.locked > 0) { W.emit({ t: 'snd', s: 'click', x: d.x + 0.5, y: d.y + 0.5, v: 0.6 }); W.emit({ t: 'msg', pid, k: 'locked' }); return; }
      d.target = d.target > 0.5 ? 0 : 1;
      W.emit({ t: 'snd', s: 'creak', x: d.x + 0.5, y: d.y + 0.5, v: 0.5, r: 0.9 + Math.random() * 0.3 });
      if (g) g.noise(d.x + 0.5, d.y + 0.5, 3);
      break;
    }
    case 'lamp': {
      const L = map.lights[a.l]; if (!L) return;
      if (L.kind === 'lamp') {
        W.emit({ t: 'snd', s: 'click', x: L.x, y: L.y, v: 0.7 });
        if (L.broken) { L.flicker = 0.4; return; }
        L.on = !L.on;
      } else if (L.kind === 'torch') {
        if (!L.on) { if (W.hasFire(p)) { L.on = true; W.emit({ t: 'snd', s: 'whoosh', x: L.x, y: L.y, v: 0.5 }); } else W.emit({ t: 'msg', pid, k: 'needfire' }); }
        else { L.on = false; W.emit({ t: 'snd', s: 'whoosh', x: L.x, y: L.y, v: 0.3, r: 1.6 }); }
      }
      break;
    }
    case 'deco': { // candles on the floor
      const o = W.objs[a.o]; if (!o || o.kind !== 'deco') return;
      if (o.spr === 'candlesoff' && W.hasFire(p)) { o.spr = 'candles'; W.emit({ t: 'snd', s: 'whoosh', x: o.x, y: o.y, v: 0.3, r: 1.8 }); }
      else if (o.spr === 'candles') o.spr = 'candlesoff';
      break;
    }
    case 'take': {
      const slot = p.inv.indexOf(null);
      if (slot < 0) { W.emit({ t: 'msg', pid, k: 'invfull' }); return; }
      if (!W.stock[a.it]) return;
      W.stock[a.it]--;
      p.inv[slot] = { it: a.it, n: GH.ITEM_USES[a.it] || 1, on: 0 };
      p.sel = slot;
      W.emit({ t: 'snd', s: 'click', x: p.x, y: p.y, v: 0.5 });
      break;
    }
    case 'return': { // put an item back into the crate
      const s = p.inv[a.slot]; if (!s) return;
      W.stock[s.it] = (W.stock[s.it] || 0) + 1; p.inv[a.slot] = null;
      break;
    }
    case 'sel': p.sel = GH.clamp(a.slot | 0, 0, 3); break;
    case 'toggle': { // device on/off
      const s = p.inv[p.sel]; if (!s) return;
      s.on = s.on ? 0 : 1;
      W.emit({ t: 'snd', s: 'click', x: p.x, y: p.y, v: 0.4 });
      break;
    }
    case 'light': p.light = !p.light; W.emit({ t: 'snd', s: 'click', x: p.x, y: p.y, v: 0.4, r: 1.3 }); break;
    case 'place': {
      const s = p.inv[p.sel]; if (!s) return;
      const x = a.x, y = a.y;
      if (!W.cellFree(x, y)) return;
      if (s.it === 'salt') {
        W.addObj({ kind: 'salt', spr: 'saltpile', x, y, sh: 0.12, room: W.roomOf(x, y) });
        s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      } else {
        W.addObj({ kind: 'item', it: s.it, spr: 'it_' + s.it, x, y, sh: 0.25, room: W.roomOf(x, y), n: s.n, on: s.it === 'candle' ? 1 : s.on, written: 0, trig: 0, prints: 0 });
        p.inv[p.sel] = null;
      }
      W.emit({ t: 'snd', s: 'thud', x, y, v: 0.25, r: 1.6 });
      break;
    }
    case 'pick': {
      const o = W.objs[a.o]; if (!o || o.kind !== 'item') return;
      const slot = p.inv.indexOf(null); if (slot < 0) { W.emit({ t: 'msg', pid, k: 'invfull' }); return; }
      p.inv[slot] = { it: o.it, n: o.n || 1, on: 0 }; p.sel = slot;
      o.kind = 'gone';
      W.emit({ t: 'snd', s: 'click', x: o.x, y: o.y, v: 0.4 });
      break;
    }
    case 'clue': {
      const o = W.objs[a.o]; if (!o || o.kind !== 'clue') return;
      if (!W.found.includes(o.clue)) W.found.push(o.clue);
      W.emit({ t: 'clue', pid, k: o.clue });
      break;
    }
    case 'hide': {
      const o = W.objs[a.o]; if (!o || !o.hide) return;
      if (Object.values(W.players).some(q => q.hiding === o.id && q.id !== pid)) { W.emit({ t: 'msg', pid, k: 'occupied' }); return; }
      p.hiding = o.id; p.hideFrom = { x: p.x, y: p.y };
      W.emit({ t: 'snd', s: 'creak', x: o.x, y: o.y, v: 0.6, r: 1.3 });
      if (g) g.sawHide(p, o);
      break;
    }
    case 'unhide': {
      if (p.hiding < 0) return; const o = W.objs[p.hiding];
      p.hiding = -1; W.emit({ t: 'snd', s: 'creak', x: o.x, y: o.y, v: 0.6, r: 1.2 });
      break;
    }
    case 'bones': {
      const o = W.objs[a.o]; if (!o || o.kind !== 'bones') return;
      if (o.spr === 'ashbones') return;
      if (!W.hasFire(p)) { W.emit({ t: 'msg', pid, k: 'needfire' }); return; }
      o.spr = 'ashbones'; W.bonesBurned = true;
      W.emit({ t: 'snd', s: 'burn', x: o.x, y: o.y, v: 1 });
      W.emit({ t: 'msg', pid: -1, k: 'bonesburned' });
      if (g) g.onBonesBurned();
      break;
    }
    case 'ask': {
      const s = p.inv[p.sel];
      if (!s || !(s.it === 'spiritbox' || s.it === 'bell')) return;
      if (s.it === 'spiritbox' && !s.on) { W.emit({ t: 'msg', pid, k: 'turnon' }); return; }
      if (s.it === 'bell') W.emit({ t: 'snd', s: 'bell', x: p.x, y: p.y, v: 0.8 });
      else W.emit({ t: 'snd', s: 'static', x: p.x, y: p.y, v: 0.6 });
      if (g) g.onAsk(p, a.q || 0);
      break;
    }
    case 'ward': { // smudge / bible / holy water
      const s = p.inv[p.sel]; if (!s || !['smudge', 'bible', 'holywater'].includes(s.it)) return;
      s.n--; if (s.n <= 0) p.inv[p.sel] = null;
      W.emit({ t: 'snd', s: s.it === 'bible' ? 'chant' : 'whoosh', x: p.x, y: p.y, v: 0.9 });
      if (g) g.onWard(p, s.it);
      break;
    }
    case 'guess': W.guess = a.g; W.emit({ t: 'guess', pid, g: a.g }); break;
    case 'speech': if (g) g.onSpeech(p, a.text || ''); break;
    case 'callname': if (g) g.onSpeech(p, W.deadName); break;
    case 'end': W.finish(false); break;
  }
};

GH.World.prototype.hasFire = function (p) {
  if (this.era === 'medieval' && p.light) return true; // torch
  const s = p.inv[p.sel];
  return !!(s && ((s.it === 'lighter' && s.on) || (s.it === 'candle')));
};

GH.World.prototype.finish = function (timeUp) {
  const W = this; if (W.over) return;
  const alive = Object.values(W.players).filter(p => !p.dead).length;
  const correct = W.guess === W.ghostDef.idx;
  let success = false;
  if (alive > 0) {
    if (W.objective === 'identify') success = correct;
    else if (W.objective === 'banish') success = W.bonesBurned;
    else if (W.objective === 'dawn') success = timeUp;
  }
  W.over = { success, correct, ghost: W.ghostDef.idx, guess: W.guess, alive, objective: W.objective, time: Math.floor(W.time), deadName: W.deadName };
  W.emit({ t: 'end', over: W.over });
};

// ---------- host simulation ----------
GH.World.prototype.update = function (dt) {
  const W = this, map = W.map;
  W.time += dt;
  for (const d of map.doors) { if (d.locked > 0) d.locked -= dt; }
  for (const L of map.lights) if (L.flicker > 0) L.flicker -= dt;
  W.emf = W.emf.filter(e => (e.t -= dt) > 0);
  // temperatures drift
  const g = W.ghost;
  for (let i = 0; i < W.temps.length; i++) {
    let target = W.baseTemp[i];
    if (g) target = g.roomTemp(i, target);
    W.temps[i] += (target - W.temps[i]) * Math.min(1, dt * 0.08);
  }
  if (g) g.update(dt);
  // objective timers
  if (!W.lobby && W.objective === 'dawn' && W.time >= W.dawnTime) W.finish(true);
  if (!W.lobby && Object.keys(W.players).length && Object.values(W.players).every(p => p.dead)) W.finish(false);
  for (const o of W.objs) if (o.kind === 'print' && (o.ttl -= dt) <= 0) o.kind = 'gone';
};

GH.World.prototype.animate = function (dt) {
  for (const d of this.map.doors) {
    const sp = dt * (d.slam ? 6 : 2.2);
    if (d.open < d.target) d.open = Math.min(d.target, d.open + sp); else if (d.open > d.target) d.open = Math.max(d.target, d.open - sp);
    if (d.open === d.target) d.slam = 0;
  }
};

// ---------- network serialisation ----------
GH.World.prototype.snapshot = function (full) {
  const W = this, map = W.map;
  const s = {
    t: 'S', tm: Math.round(W.time * 10) / 10,
    p: Object.values(W.players).map(p => [p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.a.toFixed(2), p.light ? 1 : 0, p.hiding, p.dead ? 1 : 0, p.sel, p.inv.map(s => s ? s.it + ':' + s.n + ':' + s.on : ''), p.name, p.slot, p.anim || 0, p.heldOn || 0]),
    g: [+W.ghostPub.x.toFixed(2), +W.ghostPub.y.toFixed(2), +W.ghostPub.vis.toFixed(2), W.ghostPub.form, W.ghostPub.hunt, W.ghostPub.mimic, W.ghostPub.room, +W.ghostPub.glitch.toFixed(2), W.ghostPub.ev || '', W.ghostPub.lens ? 1 : 0, W.ghostPub.fake || ''],
    d: map.doors.map(d => d.target > 0.5 ? (d.locked > 0 ? 3 : 1) : (d.locked > 0 ? 2 : 0)).join(''),
    l: map.lights.map(L => (L.on ? 1 : 0) + (L.broken ? 2 : 0) + (L.flicker > 0 ? 4 : 0)).join(','),
    e: W.emf.map(e => [+e.x.toFixed(1), +e.y.toFixed(1), e.l])
  };
  if (full) {
    s.full = 1;
    s.tp = W.temps.map(t => Math.round(t * 10) / 10);
    s.o = W.objs.filter(o => GH.DYN[o.kind] || o.kind === 'gone').map(o => [o.id, o.kind, o.spr, +o.x.toFixed(2), +o.y.toFixed(2), o.it || '', o.clue || '', o.n || 0, o.on || 0, o.sh || 0.25, o.room]);
    s.st = W.stock; s.f = W.found; s.gu = W.guess; s.m = W.mods; s.ob = W.objective; s.dn = W.deadName; s.bb = W.bonesBurned ? 1 : 0;
  }
  return s;
};

GH.World.prototype.applySnapshot = function (s, myId) {
  const W = this, map = W.map;
  W.time = s.tm;
  const seen = {};
  for (const a of s.p) {
    const [id, x, y, ang, light, hiding, dead, sel, inv, name, slot, anim, heldOn] = a;
    seen[id] = 1;
    let p = W.players[id];
    if (!p) p = W.addPlayer(id, name, slot);
    p.name = name; p.slot = slot;
    if (id !== myId) { p.tx = x; p.ty = y; p.ta = ang; if (p.x === undefined || Math.abs(p.x - x) > 3 || Math.abs(p.y - y) > 3) { p.x = x; p.y = y; p.a = ang; } p.light = !!light; p.anim = anim; p.heldOn = heldOn; }
    p.hiding = hiding; p.dead = !!dead; p.sel = sel;
    p.inv = inv.map(t => { if (!t) return null; const q = t.split(':'); return { it: q[0], n: +q[1], on: +q[2] }; });
  }
  for (const id in W.players) if (!seen[id]) delete W.players[id];
  const g = s.g, G = W.ghostPub;
  G.tx = g[0]; G.ty = g[1]; G.vis = g[2]; G.form = g[3]; G.hunt = g[4]; G.mimic = g[5]; G.room = g[6]; G.glitch = g[7]; G.ev = g[8]; G.lens = g[9]; G.fake = g[10];
  if (Math.abs(G.x - G.tx) > 2 || Math.abs(G.y - G.ty) > 2) { G.x = G.tx; G.y = G.ty; }
  for (let i = 0; i < map.doors.length && i < s.d.length; i++) { const c = +s.d[i]; map.doors[i].target = (c & 1) ? 1 : 0; map.doors[i].locked = c >= 2 ? 1 : 0; }
  s.l.split(',').forEach((v, i) => { v = +v; const L = map.lights[i]; if (!L) return; L.on = !!(v & 1); L.broken = !!(v & 2); L.flicker = (v & 4) ? 0.2 : 0; });
  W.emf = s.e.map(e => ({ x: e[0], y: e[1], l: e[2], t: 1 }));
  if (s.full) {
    W.temps = s.tp;
    for (const a of s.o) {
      const [id, kind, spr, x, y, it, clue, n, on, sh, room] = a;
      let o = W.objs[id];
      if (!o) { while (W.objs.length < id) W.objs.push({ id: W.objs.length, kind: 'gone', x: 0, y: 0 }); o = W.objs[id] = { id }; }
      Object.assign(o, { kind, spr, x, y, it, clue, n, on, sh, room });
    }
    W.stock = s.st; W.found = s.f; W.guess = s.gu; W.objective = s.ob; W.deadName = s.dn; W.bonesBurned = !!s.bb;
    if (s.m && s.m.length !== W.mods.length) { for (let k = W.mods.length; k < s.m.length; k++) GH.applyMod(W, s.m[k]); }
  }
};

// map modification (ghost "shifter"): [cellIndex, newCellValue, doorTex or -1]
GH.applyMod = function (W, m) {
  const map = W.map;
  const [i, cell, dtex] = m;
  W.mods.push(m);
  if (dtex >= 0) {
    // wall -> door
    const x = i % map.w, y = (i / map.w) | 0;
    map.cells[i] = 0;
    const wl = map.cells[i - 1] > 0, wr = map.cells[i + 1] > 0;
    const d = { i: map.doors.length, x, y, axis: (wl && wr) ? 'h' : 'v', open: 0, target: 0, locked: 0, tex: dtex };
    map.doorAt[i] = d.i; map.doors.push(d);
    map.floor[i] = map.floor[i + 1] || map.floor[i - map.w] || 30; map.ceil[i] = 40;
  } else {
    // door -> wall
    const di = map.doorAt[i];
    if (di >= 0) { map.doors[di].dead = true; map.doors[di].open = 0; map.doors[di].target = 0; map.doors[di].locked = 1e9; }
    map.doorAt[i] = -1; map.cells[i] = cell;
  }
  GH.precomputeLights(map);
};
