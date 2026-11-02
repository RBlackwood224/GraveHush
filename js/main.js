// GRAVEHUSH — game loop, local player, networking glue
'use strict';

(function () {
  const G = GH.game = {};
  const t = GH.t, UI = GH.UI;
  let R, A, IN, V, NET;
  G.state = 'menu'; G.role = 'solo'; G.myId = 'h'; G.world = null; G.roster = []; G.code = '';
  G.journal = { ev: {}, origin: null };
  let pitch = 0, bobT = 0, stamina = 3, lightFail = 0, jumpT = 0, jumpForm = 'shadow', flashT = 0, huntOn = false, lastA = 0;
  let scares = [];
  const DEATH = 2.9;
  let sendT = 0, snapT = 0, fullT = 0, stepT = 0, beepT = 0, hallT = 20, breathT = 0, lensWas = false, mirrorFace = 0;
  let halluc = []; let schedule = []; let ambT = 6;
  let tutStep = 0, tutT = 0, journalOpened = false;
  let backdrop = null, bdA = 0;
  let nextPid = 1;

  G.me = () => G.world && G.world.players[G.myId];

  G.init = function () {
    const canvas = document.getElementById('view');
    R = G.R = new GH.Renderer(canvas);
    A = GH.audio = new GH.Audio();
    IN = GH.input = new GH.Input(canvas);
    V = G.V = new GH.Voice(A);
    NET = G.NET = new GH.Net();
    A.occluded = (x, y) => { const me = G.me(); if (!me || !G.world) return false; return !GH.los(G.world.map, me.x, me.y, x, y, G.world.blockSight); };
    V.lang = GH.LANG;
    V.onSpeech = (text) => { if (G.state === 'play') G.act({ t: 'speech', text }); };
    const unlock = () => { A.init(); if (G.state === 'menu') A.playMusic('menu'); };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: true });
    setupHandlers();
    setupNet();
    makeBackdrop();
    UI.show('main');
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try { frame(dt); } catch (e) { console.error(e); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  function makeBackdrop() {
    const era = Math.random() < 0.5 ? 'modern' : 'medieval';
    backdrop = new GH.World({ seed: (Math.random() * 1e9) | 0, era, loc: GH.R.pick(GH.LOCATIONS), isHost: false });
    const rm = GH.R.pick(backdrop.map.allRooms.filter(r => r.cells.length > 10 && r.type !== 'hall'));
    const c = rm.cells[(rm.cells.length / 2) | 0];
    backdrop.cam = { x: (c % backdrop.map.w) + 0.5, y: ((c / backdrop.map.w) | 0) + 0.5 };
    for (const L of backdrop.map.lights) L.on = Math.random() < 0.3;
  }

  // ---------------- UI handlers ----------------
  function setupHandlers() {
    UI.on('go', (v) => {
      if (v === 'solo' || v === 'host') UI.show('setup', { mode: v });
      else UI.show(v);
      if (v === 'settings') UI.bindSettings();
    });
    UI.on('lang', (v) => { GH.LANG = v; GH.store.set('lang', v); V.setLang(v); UI.resetInv(); document.documentElement.lang = v; if (UI.overlayOpen === 'pause') UI.pause(); else if (G.state === 'menu') UI.show(document.querySelector('.scr-settings') ? 'settings' : 'main'), UI.bindSettings(); });
    UI.on('cfg', (v) => {
      const [k, val] = v.split(':');
      if (k.startsWith('set_')) { const key = k.slice(4); const vv = key === 'micMode' ? val : val === '1'; GH.store.set(key, vv); if (key === 'micMode') V.mode = val; if (key === 'mic') V.enabled = vv; if (key === 'speech') V.speechOn = vv; refreshSettings(); return; }
      UI.cfg[k] = k === 'diff' ? +val : val; if (!GH.LOCS[UI.cfg.era].includes(UI.cfg.loc)) UI.cfg.loc = 'random'; GH.store.set('cfg', UI.cfg);
      if (G.role === 'host' && G.mode === 'lobby') {
        broadcastLobby();
        if (k === 'era' && G.world && G.world.era !== UI.cfg.era) G.enterLobby();
        refreshBoard(); return;
      }
      else UI.show('setup', { mode: document.querySelector('[data-a="create"]') ? 'host' : 'solo' });
    });
    UI.on('startsolo', () => { saveName(); G.role = 'solo'; G.myId = 'h'; G.roster = [{ id: 'h', name: UI.name || 'Player', slot: 0, lang: GH.LANG }]; G.begin(makeCfg(false)); });
    UI.on('practice', () => { saveName(); G.role = 'solo'; G.myId = 'h'; G.roster = [{ id: 'h', name: UI.name || 'Player', slot: 0, lang: GH.LANG }]; const c = makeCfg(false); c.era = 'modern'; c.loc = 'house'; c.diff = 0; c.objective = 'identify'; c.tutorial = 1; G.begin(c); });
    UI.on('create', () => {
      saveName();
      G.code = GH.makeCode();
      UI.show('connecting');
      NET.host(G.code, (err) => {
        if (err) { UI.show('join', { err: err === 'nopeer' ? t('err_nopeer') : t('err_conn') + ' (' + err + ')' }); return; }
        G.role = 'host'; G.myId = 'h';
        G.roster = [{ id: 'h', name: UI.name || 'Host', slot: 0, lang: GH.LANG, peer: NET.myPeer, mic: V.enabled, ready: true }];
        G.enterLobby();
      });
    });
    UI.on('dojoin', () => {
      saveName();
      const code = (document.getElementById('in-code').value || '').trim().toUpperCase();
      if (code.length < 4) return;
      UI.show('connecting');
      NET.join(code, (err) => {
        if (err) { UI.show('join', { code, err: err === 'nopeer' ? t('err_nopeer') : t('err_conn') }); return; }
        G.role = 'client'; G.state = 'joining'; G.code = code;
        NET.send({ t: 'hello', name: UI.name || 'Player', lang: GH.LANG, mic: V.enabled, peer: NET.myPeer });
      });
    });
    UI.on('ready', () => { NET.send({ t: 'ready' }); });
    UI.on('hoststart', () => {
      UI.closeOverlay();
      const cfg = makeCfg(true);
      NET.broadcast({ t: 'start', cfg, roster: G.roster });
      G.begin(cfg);
    });
    UI.on('leave', () => G.leave());
    UI.on('tolobby', () => { for (const r of G.roster) r.ready = r.id === 'h'; G.enterLobby(); broadcastLobby(); });
    UI.on('closeov', () => { UI.closeOverlay(); });
    UI.on('jev', (e) => { G.journal.ev[e] = ((G.journal.ev[e] || 0) + 1) % 3; UI.journal(G); });
    UI.on('jor', (o) => { G.journal.origin = G.journal.origin === o ? null : o; UI.journal(G); });
    UI.on('jguess', (g) => { G.act({ t: 'guess', g: +g }); if (G.role !== 'client') UI.journal(G); else { G.world.guess = +g; UI.journal(G); } });
    UI.on('callname', () => { G.act({ t: 'callname' }); UI.sub('“' + G.world.deadName + '”', 2.5); });
    UI.on('take', (it) => { G.act({ t: 'take', it }); setTimeout(() => UI.overlayOpen === 'equip' && UI.equip(G), 120); });
    UI.on('ret', (k) => { G.act({ t: 'return', slot: +k }); setTimeout(() => UI.overlayOpen === 'equip' && UI.equip(G), 120); });
    UI.on('endmission', () => { UI.closeOverlay(); G.act({ t: 'end' }); });
    UI.on('pg', (i) => { const d = document.getElementById('pdetail'); d.innerHTML = UI.ghostCard(GH.GHOSTS[+i], 'modern'); d.scrollIntoView({ behavior: 'smooth' }); });
    UI.on('slot', (k) => G.act({ t: 'sel', slot: +k }));
  }
  function refreshSettings() { if (UI.overlayOpen === 'pause') UI.pause(); else { UI.show('settings'); UI.bindSettings(); } }
  function saveName() { const el = document.getElementById('in-name'); if (el) { UI.name = el.value.trim().slice(0, 14); GH.store.set('name', UI.name); } }

  function makeCfg(online) {
    const c = UI.cfg;
    const era = c.era;
    const loc = c.loc === 'random' || !GH.LOCS[era].includes(c.loc) ? GH.R.pick(GH.LOCS[era]) : c.loc;
    const r = Math.random();
    return {
      seed: (Math.random() * 2e9) | 0, era, loc, diff: [0.7, 1, 1.4][c.diff],
      ghostIdx: Math.floor(Math.random() * GH.GHOSTS.length),
      objective: r < 0.45 ? 'identify' : r < 0.75 ? 'banish' : 'dawn',
      deadName: GH.R.pick(GH.DEAD_NAMES[era]), online
    };
  }

  // ---------------- networking ----------------
  function refreshBoard() { if (UI.overlayOpen === 'board') UI.board(G); }
  G.enterLobby = function () {
    const era = (G.role === 'host' ? UI.cfg : (G.lobbyCfg || UI.cfg)).era;
    G.begin({ seed: 1, era, loc: 'lobby', lobby: true });
  };
  function broadcastLobby() { NET.broadcast({ t: 'lobby', roster: G.roster, cfg: UI.cfg }); }
  function setupNet() {
    NET.onMsg = (pid, d, conn) => {
      if (!d || !d.t) return;
      if (G.role === 'host') {
        if (d.t === 'hello' && conn) {
          if (G.mode !== 'lobby') { conn.send({ t: 'err', k: 'err_started' }); setTimeout(() => conn.close(), 300); return; }
          if (G.roster.length >= 4) { conn.send({ t: 'err', k: 'err_full' }); setTimeout(() => conn.close(), 300); return; }
          const id = 'p' + (nextPid++);
          const used = G.roster.map(r => r.slot); let slot = 0; while (used.includes(slot)) slot++;
          NET.accept(conn, id);
          const r = { id, name: String(d.name || 'Player').slice(0, 14), slot, lang: d.lang || 'en', peer: d.peer, mic: !!d.mic, ready: false };
          G.roster.push(r);
          NET.sendTo(id, { t: 'you', id });
          if (G.world) G.world.addPlayer(id, r.name, slot, r.lang);
          broadcastLobby(); refreshBoard(); UI.msg(t('m_joined', r.name));
          if (V.stream) NET.callAll(G.roster, G.myId, V.stream);
          return;
        }
        const W = G.world;
        if (d.t === 'in' && W && W.players[pid]) {
          const p = W.players[pid];
          p.x = d.x; p.y = d.y; p.a = d.a; p.noise = d.n; p.talk = d.k; p.fear = d.f; p.lens = d.l; p.heldOn = d.h; p.anim = d.m;
        } else if (d.t === 'act' && W) W.act(pid, d.a);
        else if (d.t === 'ready') { const r = G.roster.find(x => x.id === pid); if (r) { r.ready = !r.ready; broadcastLobby(); refreshBoard(); } }
      } else {
        if (d.t === 'you') G.myId = d.id;
        else if (d.t === 'lobby') {
          const old = G.lobbyCfg; G.roster = d.roster; G.lobbyCfg = d.cfg;
          if (G.mode !== 'lobby' || G.state !== 'play' || (old && old.era !== d.cfg.era)) G.enterLobby();
          else { for (const r of G.roster) if (!G.world.players[r.id]) G.world.addPlayer(r.id, r.name, r.slot, r.lang); refreshBoard(); }
          if (V.stream) NET.callAll(G.roster, G.myId, V.stream);
        }
        else if (d.t === 'start') { G.roster = d.roster; G.begin(d.cfg); }
        else if (d.t === 'S' && G.world && G.state === 'play') G.world.applySnapshot(d, G.myId);
        else if (d.t === 'ev' && G.world) for (const e of d.l) handleEvent(e);
        else if (d.t === 'err') { NET.close(); G.state = 'menu'; UI.show('join', { err: t(d.k) }); }
      }
    };
    NET.onLeave = (pid) => {
      if (G.role === 'host') {
        const r = G.roster.find(x => x.id === pid);
        G.roster = G.roster.filter(x => x.id !== pid);
        if (G.world) delete G.world.players[pid];
        V.removeRemote(pid);
        if (r && G.state === 'play') UI.msg(t('m_left', r.name));
        broadcastLobby(); refreshBoard();
      } else if (pid === 'h') {
        if (G.state !== 'menu') { stopGame(); NET.close(); G.state = 'menu'; UI.show('main'); UI.msg(t('host_left'), 5); }
      }
    };
    NET.onStream = (pid, stream) => { if (pid) V.addRemote(pid, stream); };
  }

  // ---------------- mission start / stop ----------------
  G.begin = function (cfg) {
    A.init();
    stopGame();
    G.cfg = cfg;
    G.mode = cfg.lobby ? 'lobby' : 'mission';
    const W = G.world = new GH.World({ seed: cfg.seed, era: cfg.era, loc: cfg.loc, diff: cfg.diff, isHost: G.role !== 'client', ghostIdx: cfg.ghostIdx, objective: cfg.objective, deadName: cfg.deadName, lobby: cfg.lobby });
    for (const r of G.roster) W.addPlayer(r.id, r.name, r.slot, r.lang);
    W.onEvent = (e) => handleEvent(e);
    G.state = 'play';
    G.journal = { ev: {}, origin: null };
    pitch = 0; stamina = 3; lightFail = 0; jumpT = 0; huntOn = false; halluc = []; scares = []; schedule = []; hallT = 25 + Math.random() * 30;
    tutStep = cfg.tutorial ? 1 : 0; tutT = 0; journalOpened = false;
    UI.hideScreen(); UI.closeOverlay(); UI.resetInv(); UI.hint('');
    if (GH.isTouch) IN.setupTouch(document.getElementById('touch'));
    IN.enabled = true;
    A.stopMusic(); A.playMusic('game');
    A.loop('drone', 0.35); A.loop('wind', W.loc === 'farm' ? 0.25 : 0.12); A.loop('heart', 0);
    if (cfg.lobby) { A.loop('drone', 0.08); A.loop('wind', 0.06); }
    else { UI.msg(t('ob_' + W.objective), 6); UI.msg(t('j_dead') + ': ' + W.deadName, 6); }
    // voice
    if (G.role !== 'solo' || V.enabled) {
      V.init().then((ok) => { if (ok && G.role !== 'solo') { NET.callAll(G.roster.map(r => ({ id: r.id, peer: r.peer })), G.myId, V.stream); } });
    }
  };
  function stopGame() {
    if (A.ready) A.stopLoops();
    IN.enabled = false;
    document.getElementById('touch').style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();
    UI.closeOverlay(); UI.hint('');
  }
  G.leave = function () {
    stopGame(); V.stop(); NET.close();
    G.state = 'menu'; G.world = null; G.role = 'solo'; G.mode = null; G.lobbyCfg = null;
    UI.show('main'); A.playMusic('menu');
  };
  G.act = function (a) {
    if (!G.world) return;
    if (G.role === 'client') NET.send({ t: 'act', a });
    else G.world.act(G.myId, a);
  };

  // ---------------- events from the world ----------------
  function handleEvent(e) {
    const W = G.world, me = G.me(); if (!W) return;
    switch (e.t) {
      case 'snd': A.play(e.s, e.x, e.y, e.v, e.r); break;
      case 'msg': if (e.pid === -1 || e.pid === G.myId) UI.msg(t('m_' + e.k)); break;
      case 'scare': if (me && !me.dead) { const d = GH.dist(me.x, me.y, e.x, e.y); if (d < 9) me.fear = Math.min(100, me.fear + e.a * (1 - d / 9)); } break;
      case 'steps': {
        const n = e.n || 5;
        for (let k = 0; k < n; k++) { const f = k / n; schedule.push({ at: k * 0.48, fn: () => A.play(e.heavy ? 'stepghost' : 'step', GH.lerp(e.x, e.tx, f * 0.7), GH.lerp(e.y, e.ty, f * 0.7), e.heavy ? 1 : 1.3, 0.8) }); }
        break;
      }
      case 'whisper': if (me && e.pid === G.myId) { A.play('whisper', me.x + Math.cos(me.a + Math.PI / 2) * 0.4, me.y + Math.sin(me.a + Math.PI / 2) * 0.4, 1.2, 0.9); UI.sub(e.name ? t('wh_name', me.name) : t('wh'), 2.5); } break;
      case 'mimic': if (e.pid === G.myId) V.playMimic(e.of === G.myId ? 'self' : e.of, e.x, e.y); break;
      case 'lightfail': if (e.pid === G.myId) { lightFail = e.d; A.play2D('click', 0.6); } break;
      case 'tp': if (me && e.pid === G.myId) { me.x = e.x; me.y = e.y; } break;
      case 'hunt': huntOn = e.on === 1; if (e.on === 2) { lightFail = 1.2; } break;
      case 'kill': {
        const p = W.players[e.pid];
        if (e.pid === G.myId) {
          jumpT = DEATH; jumpForm = W.ghostPub.form; A.play2D('scream', 1.3, 0.85); A.play2D('growl', 1, 0.8); scares = [];
          schedule.push({ at: 1.5, fn: () => A.play2D('thud', 1, 0.6) }, { at: 2.05, fn: () => A.play2D('heart', 0.9, 0.7) }, { at: 3.2, fn: () => UI.msg(t('m_youdied'), 7) });
        }
        else if (p) UI.msg(t('m_dead', p.name), 5);
        break;
      }
      case 'voice': if (me && GH.dist(me.x, me.y, e.x, e.y) < 7) { const word = e.w === 'v_name' ? W.deadName.split(' ')[0] : t(e.w); A.ghostSay(word, GH.LANG); UI.sub('“' + word + '”', 3); } break;
      case 'clue': if (e.pid === G.myId) UI.clue(e.k); break;
      case 'behind': if (me && !me.dead && e.pid === G.myId) { const bx = me.x - Math.cos(me.a) * 1.25, by = me.y - Math.sin(me.a) * 1.25; if (W.cellFree(bx, by)) { scares.push({ type: 'behind', x: bx, y: by, form: e.form, life: e.long ? 16 : 9, seen: 0 }); A.play('breath', bx, by, 0.7, 0.8); } } break;
      case 'corner': if (me && !me.dead && e.pid === G.myId) spawnCorner(W, me, e.form); break;
      case 'guess': if (UI.overlayOpen === 'journal') UI.journal(G); break;
      case 'unflash': if (G.role !== 'client') { const o = W.objs[e.o]; setTimeout(() => { if (o && o.kind === 'item') { o.spr = 'it_' + o.it; o.on = 0; } }, (e.after || 1.5) * 1000); } break;
      case 'end': endMission(e.over); break;
    }
  }

  function endMission(over) {
    if (G.state !== 'play') return;
    if (jumpT > 0 && !over._waited) { over._waited = 1; schedule.push({ at: jumpT + 1.2, fn: () => endMission(over) }); return; }
    G.state = 'results';
    stopGame();
    let unlocked = false;
    if (over.correct) { const list = GH.store.get('pedia', []); if (!list.includes(over.ghost)) { list.push(over.ghost); GH.store.set('pedia', list); unlocked = true; } }
    UI.show('results', { over, era: G.world.era, canLobby: G.role === 'host', unlocked });
    if (G.role === 'host') NET.broadcast({ t: 'ev', l: [{ t: 'end', over }] });
  }

  // ---------------- local player ----------------
  function passable(W, x, y) {
    if (!W.cellFree(x, y)) return false;
    const i = Math.floor(y) * W.map.w + Math.floor(x);
    return W.map.blockObj[i] < 0;
  }
  function tryMove(W, p, nx, ny, ghostMode) {
    const r = 0.22;
    const ok = ghostMode ? (x, y) => { const i = Math.floor(y) * W.map.w + Math.floor(x); return x > 0 && y > 0 && x < W.map.w && y < W.map.h && W.map.cells[i] === 0; } : (x, y) => passable(W, x, y);
    const free = (x, y) => ok(x - r, y - r) && ok(x + r, y - r) && ok(x - r, y + r) && ok(x + r, y + r);
    if (free(nx, p.y)) p.x = nx;
    if (free(p.x, ny)) p.y = ny;
  }

  function findTarget(W, me) {
    if (me.hiding >= 0) return { type: 'unhide' };
    const fx = Math.cos(me.a), fy = Math.sin(me.a);
    let best = null, bs = 1e9;
    const consider = (type, d, ang, data) => { if (ang > 0.75) return; const s = d * (1 + ang * 1.5); if (s < bs) { bs = s; best = Object.assign({ type }, data); } };
    for (const o of W.objs) {
      if (!o || o.kind === 'gone') continue;
      const reach = o.kind === 'lamp' ? 2.2 : (o.kind === 'van' ? 2.0 : 1.6);
      const d = GH.dist(me.x, me.y, o.x, o.y); if (d > reach) continue;
      const ang = Math.abs(GH.angDiff(me.a, Math.atan2(o.y - me.y, o.x - me.x)));
      if (o.kind === 'furn' && o.hide) consider('hide', d, ang, { o: o.id });
      else if (o.kind === 'lamp') consider('lamp', d + 0.3, ang, { l: o.light });
      else if (o.kind === 'item') consider('pick', d, ang, { o: o.id });
      else if (o.kind === 'clue') consider('read', d, ang, { o: o.id });
      else if (o.kind === 'bones') consider('bones', d, ang, { o: o.id });
      else if (o.kind === 'deco') consider('deco', d, ang, { o: o.id });
      else if (o.kind === 'equip') consider('equip', d, ang, {});
      else if (o.kind === 'van') consider('van', d, ang, {});
      else if (o.kind === 'board') consider('board', d - 0.4, ang * 0.6, {});
    }
    // doors in front
    for (const dd of [0.0, 0.5, 0.9, 1.3]) {
      const x = me.x + fx * dd, y = me.y + fy * dd;
      const i = Math.floor(y) * W.map.w + Math.floor(x);
      const di = W.map.doorAt[i];
      if (di >= 0) { const s = dd + 0.2; if (s < bs) { bs = s; best = { type: 'door', i: di }; } break; }
      if (W.map.cells[i] > 0) break;
    }
    return best;
  }
  function promptFor(W, tg) {
    if (!tg) return '';
    switch (tg.type) {
      case 'unhide': return t('p_unhide');
      case 'hide': return t('p_hide');
      case 'door': return W.map.doors[tg.i].target > 0.5 ? t('p_door_close') : t('p_door_open');
      case 'lamp': { const L = W.map.lights[tg.l]; if (!L) return ''; return L.kind === 'torch' ? (L.on ? t('p_torch_out') : t('p_torch_light')) : (L.on ? t('p_lamp_off') : t('p_lamp_on')); }
      case 'pick': return t('p_pick') + ': ' + t('it_' + W.objs[tg.o].it);
      case 'read': return t('p_read');
      case 'bones': return W.hasFire(G.me()) ? t('p_bones_burn') : t('p_bones');
      case 'deco': return t('p_candles');
      case 'equip': return t('p_equip');
      case 'van': return t('p_van');
      case 'board': return t('p_board');
    }
    return '';
  }
  function interact(W, me, tg) {
    if (!tg) return;
    switch (tg.type) {
      case 'unhide': G.act({ t: 'unhide' }); break;
      case 'hide': G.act({ t: 'hide', o: tg.o }); break;
      case 'door': G.act({ t: 'door', i: tg.i }); break;
      case 'lamp': G.act({ t: 'lamp', l: tg.l }); break;
      case 'pick': G.act({ t: 'pick', o: tg.o }); break;
      case 'read': G.act({ t: 'clue', o: tg.o }); break;
      case 'bones': G.act({ t: 'bones', o: tg.o }); break;
      case 'deco': G.act({ t: 'deco', o: tg.o }); break;
      case 'equip': UI.equip(G); break;
      case 'van': UI.van(); break;
      case 'board': UI.board(G); break;
    }
  }

  function deviceState(W, me) {
    let emf = 1;
    for (const e of W.emf) { const d = GH.dist(me.x, me.y, e.x, e.y); if (d < 1.6) emf = Math.max(emf, e.l); else if (d < 2.6) emf = Math.max(emf, Math.max(2, e.l - 1)); }
    if (W.ghostPub.vis > 0.3 && GH.dist(me.x, me.y, W.ghostPub.x, W.ghostPub.y) < 3) emf = Math.max(emf, 3);
    const room = W.roomOf(me.x, me.y);
    const temp = room >= 0 && W.temps[room] !== undefined ? W.temps[room] : 10;
    return { emf, temp, room };
  }

  // ---------------- frame ----------------
  function frame(dt) {
    for (let k = schedule.length - 1; k >= 0; k--) { schedule[k].at -= dt; if (schedule[k].at <= 0) { schedule[k].fn(); schedule.splice(k, 1); } }
    if (G.state !== 'play') { menuFrame(dt); return; }
    const W = G.world, me = G.me();
    if (!W || !me) { menuFrame(dt); return; }
    const inp = IN.frame(dt);
    const P = inp.pressed;
    const overlay = UI.overlayOpen;
    if (P.pause) { if (overlay) UI.closeOverlay(); else UI.pause(); }
    const paused = G.role === 'solo' && overlay === 'pause';
    if (P.journal && !W.lobby) { if (overlay === 'journal') UI.closeOverlay(); else if (!overlay) { UI.journal(G); journalOpened = true; } }

    // ----- look & move -----
    const canAct = !overlay && jumpT <= 0;
    if (canAct) { me.a += inp.lookX; pitch = GH.clamp(pitch - inp.lookY, -55, 55); }
    let moving = 0;
    if (canAct && me.hiding < 0) {
      const running = inp.run && stamina > 0.2 && !me.dead;
      const sp = me.dead ? 2.4 : running ? 2.55 : 1.45;
      if (running && (inp.mx || inp.my)) stamina = Math.max(0, stamina - dt); else stamina = Math.min(3, stamina + dt * 0.6);
      const fx = Math.cos(me.a), fy = Math.sin(me.a);
      const vx = (-inp.my * fx - inp.mx * fy) * sp * dt, vy = (-inp.my * fy + inp.mx * fx) * sp * dt;
      if (vx || vy) { tryMove(W, me, me.x + vx, me.y + vy, me.dead); moving = running ? 2 : 1; }
      me.noise = me.dead ? 0 : moving === 2 ? 0.7 : moving === 1 ? 0.12 : 0;
    } else me.noise = 0;
    if (moving) bobT += dt * (moving === 2 ? 13 : 8.5);
    const bob = moving ? Math.sin(bobT) * 0.018 : 0;
    me.anim = moving ? ((bobT / Math.PI) | 0) % 2 : 0;
    if (moving && !me.dead) { stepT -= dt; if (stepT <= 0) { stepT = moving === 2 ? 0.32 : 0.52; A.play2D('step', moving === 2 ? 0.35 : 0.2, 0.9 + Math.random() * 0.2); } }

    // ----- buttons -----
    const tg = canAct && !me.dead ? findTarget(W, me) : null;
    let ptxt = canAct && tg ? (GH.isTouch ? '' : '[E] ') + promptFor(W, tg) : '';
    if (!ptxt && canAct) { for (const id in W.players) { const q = W.players[id]; if (id === G.myId || (q.dead && !me.dead) || q.hiding >= 0) continue; const d = GH.dist(me.x, me.y, q.x, q.y); if (d < 7 && Math.abs(GH.angDiff(me.a, Math.atan2(q.y - me.y, q.x - me.x))) < 0.12 && GH.los(W.map, me.x, me.y, q.x, q.y, W.blockSight)) { ptxt = q.name; break; } } }
    UI.prompt(ptxt);
    const sel = me.inv[me.sel];
    if (canAct && !me.dead) {
      if (P.interact) interact(W, me, tg);
      if (P.light) G.act({ t: 'light' });
      for (let k = 0; k < 4; k++) if (P['slot' + k]) G.act({ t: 'sel', slot: k });
      if (P.next) G.act({ t: 'sel', slot: (me.sel + 1) % 4 });
      if (P.prev) G.act({ t: 'sel', slot: (me.sel + 3) % 4 });
      const front = { x: me.x + Math.cos(me.a) * 0.7, y: me.y + Math.sin(me.a) * 0.7 };
      if (P.drop && sel && me.hiding < 0) G.act({ t: 'place', x: front.x, y: front.y });
      if (P.toggle && sel) G.act({ t: 'toggle' });
      if (P.ask) G.act({ t: 'ask', q: 0 });
      if (P.callname) { G.act({ t: 'callname' }); UI.sub('“' + W.deadName + '”', 2); }
      if (P.use && sel && me.hiding < 0) {
        const it = sel.it;
        if (GH.PLACEABLE[it]) G.act({ t: 'place', x: front.x, y: front.y });
        else if (['emf', 'spiritbox', 'uv', 'lighter'].includes(it)) G.act({ t: 'toggle' });
        else if (it === 'bell') G.act({ t: 'ask', q: 0 });
        else if (['smudge', 'bible', 'holywater'].includes(it)) G.act({ t: 'ward' });
      }
    }
    const lensUse = canAct && !me.dead && sel && (sel.it === 'camera' || sel.it === 'mirror') && inp.use;
    if (lensUse && !lensWas) mirrorFace = Math.random();
    lensWas = lensUse;
    me.lens = lensUse ? 1 : 0;

    // ----- fear -----
    const dev = deviceState(W, me);
    if (W.lobby) me.fear = 0;
    else if (!me.dead && !paused) {
      R.lmSample(me.x, me.y); const S = R.lmSample(me.x, me.y);
      const lum = (S[0] + S[1] + S[2]) / 3;
      const alone = !Object.values(W.players).some(q => q !== me && !q.dead && GH.dist(q.x, q.y, me.x, me.y) < 4);
      const nearVan = GH.dist(me.x, me.y, W.map.van.x, W.map.van.y) < 4;
      let df = (lum < 0.12 && !me.light ? 1.6 : 0.2) + (alone ? 0.5 : -0.6) + (huntOn ? 3 : 0) - (nearVan ? 5 : 0) - (lum > 0.4 ? 1.2 : 0);
      const gp = W.ghostPub;
      if (gp.vis > 0.3 && GH.dist(me.x, me.y, gp.x, gp.y) < 10 && Math.abs(GH.angDiff(me.a, Math.atan2(gp.y - me.y, gp.x - me.x))) < 0.7) df += 18;
      me.fear = GH.clamp(me.fear + df * dt, 0, 100);
    }
    V.frame(dt, inp.ptt);
    me.talk = me.dead ? 0 : V.talking;
    me.heldOn = sel && sel.on ? 1 : 0;
    lightFail = Math.max(0, lightFail - dt);

    // ----- hallucinations (very scared players only) -----
    if (!W.lobby && !me.dead && me.fear > 70 && (hallT -= dt) <= 0) {
      hallT = 15 + Math.random() * 30;
      const k = Math.random();
      if (k < 0.35) { const a = me.a + Math.PI + (Math.random() - 0.5); for (let s = 0; s < 4; s++) schedule.push({ at: s * 0.5, fn: () => A.play('step', me.x + Math.cos(a) * (3 - s * 0.5), me.y + Math.sin(a) * (3 - s * 0.5), 1, 0.8) }); }
      else if (k < 0.7) { const a = me.a + (Math.random() < 0.5 ? -0.5 : 0.5); halluc.push({ x: me.x + Math.cos(a) * 5, y: me.y + Math.sin(a) * 5, t: 0.35 }); }
      else { A.play('whisper', me.x - Math.cos(me.a) * 0.6, me.y - Math.sin(me.a) * 0.6, 1, 0.7); }
    }
    halluc = halluc.filter(h => (h.t -= dt) > 0);

    // ----- network / simulation -----
    if (!paused) {
      if (G.role !== 'client') {
        W.update(dt);
        if (G.role === 'host') {
          snapT -= dt; fullT -= dt;
          if (snapT <= 0) { snapT = 0.1; const full = fullT <= 0; if (full) fullT = 0.4; NET.broadcast(W.snapshot(full)); }
          if (W.events.length) { NET.broadcast({ t: 'ev', l: W.events.filter(e => e.t !== 'end') }); }
        }
        W.events = [];
      } else {
        sendT -= dt;
        if (sendT <= 0) { sendT = 1 / 15; NET.send({ t: 'in', x: +me.x.toFixed(2), y: +me.y.toFixed(2), a: +me.a.toFixed(2), n: me.noise, k: +me.talk.toFixed(2), f: me.fear | 0, l: me.lens, h: me.heldOn, m: me.anim }); }
        // interpolate others + ghost
        for (const id in W.players) { const p = W.players[id]; if (id === G.myId || p.tx === undefined) continue; p.x += (p.tx - p.x) * Math.min(1, dt * 12); p.y += (p.ty - p.y) * Math.min(1, dt * 12); p.a += GH.angDiff(p.a, p.ta) * Math.min(1, dt * 12); }
        const gp = W.ghostPub; if (gp.tx !== undefined) { gp.x += (gp.tx - gp.x) * Math.min(1, dt * 10); gp.y += (gp.ty - gp.y) * Math.min(1, dt * 10); }
      }
      W.animate(dt);
    }
    // other players' footsteps
    for (const id in W.players) { const p = W.players[id]; if (id === G.myId || p.dead) continue; if (p.lx !== undefined && GH.dist(p.lx, p.ly, p.x, p.y) > 0.6) { A.play('step', p.x, p.y, 0.6, 0.9 + Math.random() * 0.2); p.lx = p.x; p.ly = p.y; } if (p.lx === undefined) { p.lx = p.x; p.ly = p.y; } }

    // ----- audio -----
    A.listener(me.x, me.y, me.a);
    // house ambience: settling wood, wind, distant animals — never the same twice
    if (!W.lobby && (ambT -= dt) <= 0 && A.ready) {
      ambT = 6 + Math.random() * 18;
      const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 10;
      const ax = me.x + Math.cos(a) * d, ay = me.y + Math.sin(a) * d;
      const outside = W.map.outdoor[Math.floor(me.y) * W.map.w + Math.floor(me.x)];
      const pool = outside || W.loc === 'farm' ? ['howl', 'owl', 'settle', 'creak', 'owl'] : ['settle', 'settle', 'creak', 'drip', 'howl', 'tick'];
      const snd = pool[(Math.random() * pool.length) | 0];
      A.play(snd, ax, ay, snd === 'howl' ? 0.5 : 0.7, 0.8 + Math.random() * 0.3);
    }
    if (A.ready && !W.lobby) { A.loop('heart', me.dead ? 0 : Math.max(0, (me.fear - 45) / 55) * 0.9); A.loop('drone', 0.25 + me.fear / 300); }
    V.update(me, W.players, A.occluded);
    if (sel && sel.it === 'emf' && sel.on && dev.emf >= 2) { beepT -= dt; if (beepT <= 0) { beepT = [0, 0, 0.6, 0.4, 0.25, 0.12][dev.emf]; A.play2D('beep', 0.25, 0.8 + dev.emf * 0.1); } }
    if (sel && sel.it === 'spiritbox' && sel.on) { beepT -= dt; if (beepT <= 0) { beepT = 0.5; A.play2D('static', 0.12, 0.8 + Math.random() * 0.6); } }

    // ----- tutorial -----
    if (tutStep) tutorial(W, me, dt);
    if (W.lobby) UI.hint(G.role === 'host' ? t('lobby_hint_host', G.code) : t('lobby_hint_client', G.code));
    else if (W.objective === 'dawn') { const h = Math.min(6, W.time / W.dawnTime * 6); UI.clock(String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0')); } else UI.clock('');
    const rid = dev.room; const rm = rid >= 0 ? W.map.rooms[rid] : null;
    UI.room(rm ? GH.te('room_' + rm.type, W.era) : '');
    document.getElementById('inv').style.visibility = W.lobby ? 'hidden' : 'visible';
    UI.inv(me, W.era);

    updateScares(W, me, dt);
    // ----- render -----
    jumpT = Math.max(0, jumpT - dt); flashT = Math.max(0, flashT - dt);
    renderView(W, me, dev, bob, lensUse, dt);
  }

  function heldLight(W, me, sel, hunting) {
    if (me.dead) return { pow: 0.7, col: [0.55, 0.65, 1], cone: false, k: 0.04 };
    const gp = W.ghostPub;
    const near = hunting && GH.dist(me.x, me.y, gp.x, gp.y) < 10;
    const flick = near ? (Math.sin(W.time * 31) * Math.sin(W.time * 17.3) > 0.1 ? 1 : 0) : 1;
    const fail = lightFail > 0 ? 0 : 1;
    if (W.era === 'modern') {
      if (sel && sel.it === 'uv' && sel.on) return { pow: 1.0 * flick * fail, col: [0.45, 0.2, 1], cone: true, k: 0.12, uv: true };
      if (me.light) return { pow: 1.9 * flick * fail, col: [1, 0.96, 0.86], cone: true, k: 0.05 };
      if (sel && sel.it === 'lighter' && sel.on) return { pow: 0.5 * fail, col: [1, 0.7, 0.35], cone: false, k: 0.5 };
      return null;
    }
    const tf = 0.88 + 0.12 * Math.sin(W.time * 11) * Math.sin(W.time * 7.7);
    let pow = 0, k = 0.22;
    if (me.light) pow += 1.15 * tf * (near ? 0.4 + flick * 0.6 : 1);
    if (sel && sel.it === 'candle') { pow += 0.4 * tf; if (!me.light) k = 0.5; }
    pow *= fail || 0.15;
    return pow > 0 ? { pow, col: [1, 0.62, 0.3], cone: false, k } : null;
  }

  function renderView(W, me, dev, bob, lensUse, dt) {
    const sel = me.inv[me.sel];
    const gp = W.ghostPub;
    const held = heldLight(W, me, sel, huntOn);
    // dynamic lights from other players, candles, fires
    const dyn = [];
    for (const id in W.players) {
      const p = W.players[id]; if (id === G.myId || p.dead || p.hiding >= 0 || !p.light) continue;
      if (W.era === 'modern') dyn.push({ x: p.x + Math.cos(p.a) * 1.6, y: p.y + Math.sin(p.a) * 1.6, rad: 3.2, col: [1, 0.95, 0.85], pow: 0.8 });
      else dyn.push({ x: p.x, y: p.y, rad: 4, col: [1, 0.62, 0.3], pow: 0.8 });
    }
    for (const o of W.objs) { if (!o) continue; if ((o.kind === 'item' && o.it === 'candle') || (o.kind === 'deco' && o.spr === 'candles')) dyn.push({ x: o.x, y: o.y, rad: 2.5, col: [1, 0.65, 0.35], pow: 0.55 }); }
    R.buildLightmap(W.map, W.time, dyn, false);
    // sprites
    const spr = [];
    const uv = held && held.uv;
    for (const o of W.objs) {
      if (!o || o.kind === 'gone') continue;
      let name = o.spr;
      if (o.kind === 'lamp') { const L = W.map.lights[o.light]; if (L) name = L.kind === 'torch' ? (L.on ? 'walltorch' : 'walltorchoff') : (L.on && !L.broken ? 'bulb' : 'bulboff'); }
      if (o.kind === 'print') { if (!uv || me.dead) continue; spr.push({ x: o.x, y: o.y, tex: GH.SPR.hand, sh: o.sh, z: o.z || 0.4, bright: [1.4, 1.4, 1.4] }); continue; }
      const tex = GH.SPR[name]; if (!tex) continue;
      const s = { x: o.x, y: o.y, tex, sh: o.sh || 0.6, z: o.z || 0 };
      if (o.kind === 'lamp') { const L = W.map.lights[o.light]; if (L && L.on && !L.broken) s.bright = [1.6, 1.4, 1.1]; }
      if (o.kind === 'item' && (o.spr === 'motionon' || o.spr === 'threadon')) s.bright = [1.5, 1.5, 1.5];
      spr.push(s);
    }
    const era = W.era;
    for (const id in W.players) {
      const p = W.players[id]; if (id === G.myId || p.hiding >= 0) continue;
      if (p.dead && !me.dead) continue;
      spr.push({ x: p.x, y: p.y, tex: GH.SPR[`pl_${era}_${p.slot}_${p.anim || 0}`], sh: 0.85, alpha: p.dead ? 0.4 : 1 });
    }
    // the ghost
    const gvis = me.dead ? Math.max(0.45, gp.vis) : gp.vis;
    if (gvis > 0.02 && gp.x > 0) {
      const tex = gp.mimic >= 0 ? GH.SPR[`pl_${era}_${gp.mimic}_0`] : GH.SPR['g_' + gp.form];
      spr.push({ x: gp.x, y: gp.y, tex, sh: gp.mimic >= 0 ? 0.85 : 0.98, alpha: Math.min(1, gvis) * 0.92, glitch: gp.glitch + (gp.hunt ? 0.5 : 0), ghost: true, z: Math.sin(W.time * 2) * 0.015 });
    }
    for (const sc of scares) if (sc.vis) spr.push({ x: sc.x, y: sc.y, tex: GH.SPR['g_' + sc.form], sh: 0.98, alpha: sc.fade !== undefined ? sc.fade : 0.95, glitch: 0.25, ghost: true });
    for (const h of halluc) spr.push({ x: h.x, y: h.y, tex: GH.SPR.g_shadow, sh: 0.98, alpha: 0.6, glitch: 0.8, ghost: true });
    // orbs on the night camera
    const lensEv = gp.ev && (gp.ev.includes('lens') || gp.fake === 'lens');
    const nightVision = lensUse && sel.it === 'camera';
    if (nightVision && lensEv && (dev.room === gp.room || GH.dist(me.x, me.y, gp.x, gp.y) < 4)) {
      const rm = W.map.rooms[gp.room];
      for (let k = 0; k < 3; k++) { const a = W.time * (0.3 + k * 0.17) + k * 2; spr.push({ x: (rm ? rm.cx : gp.x) + Math.cos(a) * (0.8 + k * 0.4), y: (rm ? rm.cy : gp.y) + Math.sin(a * 1.3) * (0.8 + k * 0.3), tex: GH.SPR.orb, sh: 0.06, z: 0.4 + Math.sin(a * 2) * 0.2, bright: [3, 3, 3] }); }
    }
    let px = me.x, py = me.y, camZ = 0.5 + bob, pv = pitch;
    const de = jumpT > 0 ? DEATH - jumpT : -1;
    if (de > 1.45) { const f = Math.min(1, (de - 1.45) / 0.5); camZ = 0.5 - 0.4 * f * f; pv = pitch + 70 * f; }
    R.render({ map: W.map, x: px, y: py, a: me.a + (de > 0.2 && de < 1.45 ? (Math.random() - 0.5) * 0.06 : 0), camZ, pitch: pv, held: de >= 0 && de < 0.2 ? null : held, sprites: spr, time: W.time, nightVision });
    // ----- first-person hands -----
    if (!me.dead && me.hiding < 0 && !nightVision && jumpT <= 0) drawHands(W, me, sel, dev, bob, held);
    // breath in freezing rooms
    if (!me.dead && dev.temp < 0) { breathT += dt; const ph = breathT % 3.2; if (ph < 1.1) { const a = Math.sin(ph / 1.1 * Math.PI); for (let k = 0; k < 140; k++) { const x = GH.W / 2 + (Math.random() - 0.5) * 70 * a, y = GH.H - 30 - Math.random() * 40 * a; if (Math.random() < a * 0.5) R.put(x | 0, y | 0, 200, 205, 215); } } }
    // jumpscare
    const fx = { time: W.time, fear: me.dead ? 0.2 : me.fear / 100, nightVision, dead: me.dead && jumpT <= 0, hiding: me.hiding >= 0, flash: flashT * 3 };
    const gd = GH.dist(me.x, me.y, gp.x, gp.y);
    fx.glitch = (gp.vis > 0.2 && gd < 7 ? (1 - gd / 7) * 0.8 : 0) + (huntOn && gd < 9 ? 0.25 : 0) + (jumpT > 0 ? 1 : 0);
    fx.redPulse = huntOn && gd < 6 ? (0.5 + 0.5 * Math.sin(W.time * 8)) * (1 - gd / 6) : 0;
    for (const sc of scares) if (sc.flash > 0) { fx.glitch += sc.flash * 3; fx.flash = Math.max(fx.flash, sc.flash * 0.6); }
    if (de >= 0) {
      // the death: lights cut, the face rushes in screaming, you fall, darkness
      fx.black = de < 0.2 ? 0.92 : de > 1.45 && de < 2.2 ? (de - 1.45) / 0.75 : de >= 2.2 ? Math.max(0, 1 - (de - 2.2) / 0.7) : 0;
      if (de >= 0.2 && de < 1.55) {
        const T = GH.SPR['jf_' + jumpForm] || GH.SPR.jf_shadow;
        const f = Math.min(1, (de - 0.2) / 0.35);
        const scl = Math.round(2 + f * 4 + Math.max(0, de - 0.55) * 1.2);
        const shake = 10 * f;
        R.blitTex(T, (GH.W / 2 - T.w * scl / 2 + (Math.random() - 0.5) * shake) | 0, (GH.H / 2 - T.h * scl / 2 + 8 + (Math.random() - 0.5) * shake) | 0, scl, null, 1.3);
        fx.glitch = 0.9 + Math.random() * 0.6; fx.redPulse = 0.6 + 0.4 * Math.sin(de * 40); fx.fear = 1;
        if (de < 0.3) fx.flash = 0.5;
      }
      fx.dead = false;
    }
    R.post(fx);
    if (nightVision) { R.text('REC', 12, 10, 255, 40, 40, 2); for (const [x, y] of [[8, 8], [GH.W - 24, 8], [8, GH.H - 24], [GH.W - 24, GH.H - 24]]) { R.rect(x, y, 16, 2, 200, 255, 200); R.rect(x, y, 2, 16, 200, 255, 200); } }
    if (lensUse && sel.it === 'mirror') drawMirror(W, me, dev, lensEv);
    R.present();
  }

  function drawHands(W, me, sel, dev, bob, held) {
    const S = R.lmSample(me.x, me.y);
    const lk = Math.min(1.3, 0.25 + (S[0] + S[1] + S[2]) / 3 + (held ? held.pow * 0.3 : 0));
    const by = (Math.abs(bob) * 300) | 0;
    // light source in the left hand
    if (W.era === 'modern') { if (me.light) R.blitTex(GH.SPR.it_flashlight, 6, GH.H - 52 + by, 4, null, lk); }
    else if (me.light) { R.blitTex(GH.SPR.it_torch, 10, GH.H - 70 + by, 5, null, 1.2); const f = Math.random(); R.rect(10 + 30, GH.H - 70 + by + 2, 4, 6, 255, (190 + f * 60) | 0, 80); }
    if (!sel) return;
    const sc = 5, dx = GH.W - 16 * sc - 8, dy = GH.H - 13 * sc + by;
    R.blitTex(GH.SPR['it_' + sel.it], dx, dy, sc, null, lk);
    const it = sel.it;
    if (it === 'emf' && sel.on) {
      const cols = [[40, 200, 60], [120, 220, 40], [220, 220, 40], [230, 140, 30], [230, 40, 30]];
      for (let i = 0; i < 5; i++) { const on = i < dev.emf; const c = cols[i]; R.rect(dx + (5 + i) * sc, dy + 9 * sc, sc - 1, sc * 2, on ? c[0] : c[0] * 0.15 | 0, on ? c[1] : c[1] * 0.15 | 0, on ? c[2] : c[2] * 0.15 | 0); }
    } else if (it === 'thermo') {
      R.rect(dx + 6 * sc, dy + 4 * sc, 4 * sc, 4 * sc, 20, 40, 30);
      const tv = dev.temp + (Math.random() - 0.5) * 0.3; const s = tv.toFixed(1);
      R.text(s, dx + 6 * sc + 1, dy + 4 * sc + 5, 120, 255, 160, 1);
    } else if (it === 'spiritbox' && sel.on) {
      R.text(String((Math.random() * 99) | 0).padStart(2, '0') + '.' + ((Math.random() * 9) | 0), dx + 4 * sc + 2, dy + 5 * sc + 2, 255, 60, 60, 2);
    } else if (it === 'candle') {
      const blue = dev.emf >= 5 && (W.ghostPub.ev.includes('emf') || W.ghostPub.fake === 'emf');
      const wob = dev.emf >= 2 ? ((Math.random() - 0.5) * 6) | 0 : ((Math.random() - 0.5) * 2) | 0;
      R.rect(dx + 7 * sc + wob, dy + 2 * sc, 2 * sc, 3 * sc + (dev.emf >= 2 ? 3 : 0), blue ? 80 : 255, blue ? 140 : 180, blue ? 255 : 60);
      R.rect(dx + 7 * sc + 2 + wob, dy + 3 * sc, sc, sc * 2, blue ? 200 : 255, blue ? 230 : 240, 255);
    } else if (it === 'bowl') {
      if (dev.temp < 0) { R.rect(dx + 3 * sc, dy + 9 * sc, 10 * sc, 2 * sc, 200, 225, 240); R.rect(dx + 5 * sc, dy + 9 * sc, 3 * sc, 1, 255, 255, 255); }
      else if (dev.temp < 5) { R.rect(dx + 3 * sc, dy + 9 * sc, 10 * sc, 2 * sc, 90, 140, 180); R.rect(dx + ((4 + Math.random() * 7) | 0) * sc, dy + 9 * sc, sc, 1, 200, 220, 240); }
    } else if (it === 'lighter' && sel.on) {
      R.rect(dx + 8 * sc, dy, 2 * sc, 3 * sc, 255, (170 + Math.random() * 60) | 0, 60);
    } else if (it === 'uv' && sel.on) { R.rect(dx + 14 * sc, dy + 7 * sc, sc, 3 * sc, 200, 120, 255); }
  }

  function drawMirror(W, me, dev, lensEv) {
    const cx = GH.W / 2, cy = GH.H / 2 + 10, rx = 70, ry = 90;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1.08) continue;
      if (d > 1) { R.put(cx + x, cy + y, 150, 120, 60); continue; }
      const n = Math.random() * 14;
      R.put(cx + x, cy + y, (18 + n) | 0, (20 + n) | 0, (24 + n) | 0);
    }
    const inRoom = dev.room === W.ghostPub.room || GH.dist(me.x, me.y, W.ghostPub.x, W.ghostPub.y) < 4;
    const put = R.put;
    R.put = (px, py, r, g, b) => { const dx = (px - cx) / rx, dy = (py - cy) / ry; if (dx * dx + dy * dy <= 0.98) put(px, py, r, g, b); };
    if (lensEv && inRoom && mirrorFace < 0.75) {
      const T = GH.SPR['jf_' + W.ghostPub.form] || GH.SPR.jf_shadow;
      R.blitTex(T, (cx - 64 + Math.sin(W.time * 3) * 3) | 0, (cy - 70) | 0, 2, [0.8, 0.85, 0.9], 0.5);
    } else {
      const T = GH.SPR[`pl_${W.era}_${me.slot}_0`];
      R.blitTex(T, (cx - 32 * 3 / 2) | 0, (cy - 50) | 0, 3, null, 0.25);
    }
    R.put = put;
  }

  // ---------------- personal scares (only you see them) ----------------
  function spawnCorner(W, me, form) {
    const map = W.map;
    for (let tries = 0; tries < 120; tries++) {
      const needCorner = tries < 70;
      const a = me.a + (Math.random() - 0.5) * 1.6, d = 3 + Math.random() * 5;
      const x = Math.floor(me.x + Math.cos(a) * d), y = Math.floor(me.y + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= map.w - 1 || y >= map.h - 1) continue;
      const i = y * map.w + x;
      if (map.cells[i] !== 0 || map.doorAt[i] >= 0 || map.blockObj[i] >= 0 || map.outdoor[i]) continue;
      const wx = map.cells[i - 1] > 0 ? -1 : map.cells[i + 1] > 0 ? 1 : 0, wy = map.cells[i - map.w] > 0 ? -1 : map.cells[i + map.w] > 0 ? 1 : 0;
      if (needCorner ? (!wx || !wy) : (!wx && !wy)) continue; // a corner if possible, else against a wall
      const cx = x + 0.5 + wx * 0.28, cy = y + 0.5 + wy * 0.28;
      if (!GH.los(map, me.x, me.y, cx, cy, W.blockSight)) continue;
      scares.push({ type: 'corner', x: cx, y: cy, form, life: 25, seen: 0 });
      return;
    }
  }
  function updateScares(W, me, dt) {
    const turn = Math.abs(GH.angDiff(lastA, me.a)) / Math.max(dt, 1e-3); lastA = me.a;
    for (const sc of scares) {
      sc.life -= dt;
      if (sc.flash > 0) sc.flash -= dt;
      if (sc.gone) { sc.vis = false; continue; }
      const d = GH.dist(me.x, me.y, sc.x, sc.y);
      const inView = Math.abs(GH.angDiff(me.a, Math.atan2(sc.y - me.y, sc.x - me.x))) < 0.55 && GH.los(W.map, me.x, me.y, sc.x, sc.y, W.blockSight);
      sc.vis = true;
      if (sc.type === 'behind') {
        // it keeps standing right behind you — unless you spin around fast enough to catch it
        if (!inView && turn < 2.6) { const bx = me.x - Math.cos(me.a) * 1.25, by = me.y - Math.sin(me.a) * 1.25; if (W.cellFree(bx, by)) { sc.x += (bx - sc.x) * Math.min(1, dt * 6); sc.y += (by - sc.y) * Math.min(1, dt * 6); } }
        if (inView) sc.seen += dt;
        if (sc.seen > 0.3) { vanish(sc, me, 35); continue; }
        if (sc.life <= 0) { A.play('whisper', me.x - Math.cos(me.a) * 0.4, me.y - Math.sin(me.a) * 0.4, 1.3, 0.7); UI.sub(t('wh_name', me.name), 2.5); me.fear = Math.min(100, me.fear + 15); sc.gone = true; }
      } else {
        if (inView) sc.seen += dt;
        if (d < 2.6 || sc.seen > 1.4) { vanish(sc, me, 28); continue; }
        if (sc.life <= 0) sc.gone = true;
      }
    }
    scares = scares.filter(sc => !(sc.gone && !(sc.flash > 0)));
  }
  function vanish(sc, me, fear) {
    sc.gone = true; sc.flash = 0.35;
    A.play2D('sting', 0.7, 1.4); A.play(sc.type === 'behind' ? 'scream' : 'hum', sc.x, sc.y, sc.type === 'behind' ? 0.6 : 1, sc.type === 'behind' ? 1.3 : 0.7);
    me.fear = Math.min(100, me.fear + fear);
  }

  // ---------------- tutorial ----------------
  function tutorial(W, me, dt) {
    tutT += dt;
    const has = (it) => me.inv.some(s => s && s.it === it);
    const conds = [
      null,
      () => has('thermo') && has('emf'),
      () => W.roomOf(me.x, me.y) > 0,
      () => W.ghost && W.roomOf(me.x, me.y) === W.ghost.room,
      () => journalOpened,
      () => W.found.length > 0,
      () => tutT > 25,
      () => W.guess >= 0,
    ];
    if (tutStep < conds.length) {
      UI.hint(t('tut_' + tutStep));
      if (conds[tutStep]()) { tutStep++; tutT = 0; A.play2D('bell', 0.25, 1.5); }
    } else { UI.hint(t('tut_done')); if (tutT > 6) { tutStep = 0; UI.hint(''); } }
  }

  // ---------------- menu backdrop ----------------
  function menuFrame(dt) {
    if (!backdrop) return;
    const W = backdrop; W.time += dt;
    bdA += dt * 0.12;
    const flick = Math.random() < 0.02 ? 0 : 1;
    R.buildLightmap(W.map, W.time, [], false);
    const spr = [];
    for (const o of W.objs) { if (!o || o.kind === 'gone') continue; let n = o.spr; if (o.kind === 'lamp') { const L = W.map.lights[o.light]; n = L && L.kind === 'torch' ? (L.on ? 'walltorch' : 'walltorchoff') : (L && L.on ? 'bulb' : 'bulboff'); } const tex = GH.SPR[n]; if (tex) spr.push({ x: o.x, y: o.y, tex, sh: o.sh || 0.6, z: o.z || 0 }); }
    if (Math.sin(W.time * 0.7) > 0.93) spr.push({ x: W.cam.x + Math.cos(bdA) * 3, y: W.cam.y + Math.sin(bdA) * 3, tex: GH.SPR.g_shadow, sh: 0.98, alpha: 0.7, glitch: 0.6, ghost: true });
    const held = W.era === 'modern' ? { pow: 1.7 * flick, col: [1, 0.96, 0.86], cone: true, k: 0.05 } : { pow: 1.1 * flick, col: [1, 0.62, 0.3], cone: false, k: 0.2 };
    R.render({ map: W.map, x: W.cam.x, y: W.cam.y, a: bdA, camZ: 0.5, pitch: 0, held, sprites: spr, time: W.time });
    R.post({ time: W.time, fear: 0.6, glitch: Math.random() < 0.01 ? 0.6 : 0 });
    R.present();
  }

  window.addEventListener('load', () => G.init());
})();
