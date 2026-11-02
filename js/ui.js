// GRAVEHUSH — menus, journal, HUD (DOM)
'use strict';

GH.UI = (function () {
  const $ = (id) => document.getElementById(id);
  const t = GH.t;
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const U = {};
  let handlers = {};
  U.cfg = GH.store.get('cfg', { era: 'modern', loc: 'random', diff: 1 });
  U.name = GH.store.get('name', '');

  function icon(it) { const s = GH.SPR['it_' + it]; return s ? `<img class="pix" src="${s.canvas.toDataURL()}" alt="">` : ''; }
  U.icon = icon;
  const screen = () => $('screen'), overlay = () => $('overlay');

  function bind(root) {
    root.querySelectorAll('[data-a]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = el.getAttribute('data-a'), v = el.getAttribute('data-v');
        if (GH.audio) { GH.audio.init(); GH.audio.play2D('click', 0.5, 0.8); }
        if (handlers[a]) handlers[a](v, el);
      });
    });
  }
  U.on = (name, fn) => { handlers[name] = fn; };

  function chips(key, opts, cur) {
    return `<div class="chips">${opts.map(([v, label]) => `<button class="chip ${String(cur) === String(v) ? 'sel' : ''}" data-a="cfg" data-v="${key}:${v}">${esc(label)}</button>`).join('')}</div>`;
  }
  function locLabel(l, era) { return l === 'random' ? t('loc_random') : (era === 'medieval' && GH.STR.en['loc_' + l + '_m'] ? t('loc_' + l + '_m') : t('loc_' + l)); }
  U.locLabel = locLabel;
  function cfgBlock(cfg, editable) {
    if (!editable) return `<div class="cfgro">${t('era')}: <b>${t('era_' + cfg.era)}</b> · ${t('loc')}: <b>${locLabel(cfg.loc, cfg.era)}</b> · ${t('diff')}: <b>${t('diff_' + cfg.diff)}</b></div>`;
    return `<div class="cfg">
      <label>${t('era')}</label>${chips('era', [['modern', t('era_modern')], ['medieval', t('era_medieval')]], cfg.era)}
      <label>${t('loc')}</label>${chips('loc', [['random', t('loc_random')], ...GH.LOCS[cfg.era].map(l => [l, locLabel(l, cfg.era)])], cfg.loc)}
      <label>${t('diff')}</label>${chips('diff', [[0, t('diff_0')], [1, t('diff_1')], [2, t('diff_2')]], cfg.diff)}
    </div>`;
  }

  U.show = function (name, data) {
    data = data || {};
    const S = screen(); S.style.display = 'flex'; S.className = 'scr scr-' + name;
    $('hud').classList.add('hidden');
    let h = '';
    if (name === 'main') {
      h = `<div class="title">GRAVEHUSH</div><div class="subt">${t('subtitle')}</div>
      <div class="menu">
        <button data-a="go" data-v="solo">${t('solo')}</button>
        <button data-a="go" data-v="host">${t('host')}</button>
        <button data-a="go" data-v="join">${t('join')}</button>
        <button data-a="go" data-v="help">${t('tutorial')}</button>
        <button data-a="go" data-v="pedia">${t('pedia')}</button>
        <button data-a="go" data-v="settings">${t('settings')}</button>
      </div>
      <div class="langs">${['en', 'fr', 'hu'].map(l => `<button class="chip ${GH.LANG === l ? 'sel' : ''}" data-a="lang" data-v="${l}">${l.toUpperCase()}</button>`).join('')}</div>
      <div class="foot"><a href="${GH.GITHUB}" target="_blank" rel="noopener">${t('github')}: RBlackwood224</a> · ${t('version')}${GH.VERSION}</div>`;
    } else if (name === 'setup') {
      h = `<div class="h1">${data.mode === 'host' ? t('host') : t('solo')}</div>
      <div class="field"><label>${t('name')}</label><input id="in-name" maxlength="14" value="${esc(U.name)}"></div>
      ${cfgBlock(U.cfg, true)}
      <div class="row"><button data-a="go" data-v="main">${t('back')}</button><button class="primary" data-a="${data.mode === 'host' ? 'create' : 'startsolo'}">${t('start')}</button></div>
      ${data.mode === 'host' ? `<div class="note">${t('online_note')}</div>` : ''}`;
    } else if (name === 'join') {
      h = `<div class="h1">${t('join')}</div>
      <div class="field"><label>${t('name')}</label><input id="in-name" maxlength="14" value="${esc(U.name)}"></div>
      <div class="field"><label>${t('code')}</label><input id="in-code" maxlength="5" class="code" value="${esc(data.code || '')}" autocapitalize="characters"></div>
      <div class="err">${data.err ? esc(data.err) : ''}</div>
      <div class="row"><button data-a="go" data-v="main">${t('back')}</button><button class="primary" data-a="dojoin">${t('joinbtn')}</button></div>`;
    } else if (name === 'lobby') {
      const isHost = data.host;
      h = `<div class="h1">${t('players')}</div>
      ${isHost ? `<div class="codebox"><div>${t('room_code')}</div><div class="bigcode">${esc(data.code)}</div><div class="note">${t('share_code')}</div></div>` : ''}
      <div class="plist">${data.roster.map(p => `<div class="pl" style="border-color:rgb(${GH.PLAYER_COLORS[p.slot].join(',')})">${esc(p.name)}${p.mic ? ' 🎙' : ''}</div>`).join('')}</div>
      ${cfgBlock(data.cfg, isHost)}
      ${isHost ? `<div class="row"><button data-a="leave">${t('leave')}</button><button class="primary" data-a="hoststart">${t('start')}</button></div>` : `<div class="note blink">${t('waiting_host')}</div><div class="row"><button data-a="leave">${t('leave')}</button></div>`}`;
    } else if (name === 'connecting') {
      h = `<div class="h1 blink">${t('connecting')}</div>`;
    } else if (name === 'settings') {
      h = `<div class="h1">${t('settings')}</div>${U.settingsHTML()}<div class="row"><button data-a="go" data-v="main">${t('back')}</button></div>`;
    } else if (name === 'help') {
      h = `<div class="h1">${t('help_title')}</div><div class="help">${t('help_text')}</div>
      <div class="row"><button data-a="go" data-v="main">${t('back')}</button><button class="primary" data-a="practice">${t('practice')}</button></div>`;
    } else if (name === 'pedia') {
      const found = GH.store.get('pedia', []);
      h = `<div class="h1">${t('pedia')}</div><div class="note">${t('pedia_found', found.length)}</div>
      <div class="pedia">${GH.GHOSTS.map(g => found.includes(g.idx) ? `<button class="pg" data-a="pg" data-v="${g.idx}">${esc(g.name)}</button>` : `<button class="pg locked" disabled>${t('pedia_locked')}</button>`).join('')}</div>
      <div id="pdetail"></div>
      <div class="row"><button data-a="go" data-v="main">${t('back')}</button></div>`;
    } else if (name === 'results') {
      const o = data.over, g = GH.GHOSTS[o.ghost];
      h = `<div class="h1 ${o.success ? 'win' : 'lose'}">${o.success ? t('res_win') : t('res_lose')}</div>
      <div class="note">${t('ob_' + o.objective)} · ${t('res_survivors', o.alive)}</div>
      <div class="note">${o.guess < 0 ? t('res_noguess') : (o.correct ? t('res_correct') : t('res_wrong') + ' (' + esc(GH.GHOSTS[o.guess].name) + ')')}</div>
      <div class="reveal"><div class="small">${t('res_ghost')}</div>${U.ghostCard(g, data.era)}<div class="small">${t('j_dead')}: ${esc(o.deadName)}</div></div>
      ${data.unlocked ? `<div class="note gold">${t('res_unlocked')}</div>` : ''}
      <div class="row">${data.canLobby ? `<button class="primary" data-a="tolobby">${t('res_lobby')}</button>` : ''}<button data-a="leave">${t('res_menu')}</button></div>`;
    }
    S.innerHTML = `<div class="panel">${h}</div>`;
    bind(S);
    const nm = $('in-name'); if (nm) nm.addEventListener('input', () => { U.name = nm.value.trim(); GH.store.set('name', U.name); });
  };
  U.hideScreen = function () { screen().style.display = 'none'; screen().innerHTML = ''; $('hud').classList.remove('hidden'); };

  U.ghostCard = function (g, era) {
    return `<div class="gcard"><div class="gname">${esc(g.name)}</div><div class="small">${t('rg_' + g.region)}</div>
      <div><b>${t('pedia_origin')}:</b> ${t('or_' + g.origin)} — <i>${t('ord_' + g.origin)}</i></div>
      <div><b>${t('pedia_ev')}:</b> ${g.evidence.map(e => GH.te('ev_' + e, era)).join(', ')}</div>
      <div><b>${t('pedia_beh')}:</b> ${g.beh.map(b => t('b_' + b)).join(' ')}</div>
      <div><b>${t('pedia_weak')}:</b> ${t('w_' + g.weak)}${g.immune !== 'none' ? ` · <b>${t('pedia_imm')}:</b> ${t('w_' + g.immune)}` : ''}</div></div>`;
  };

  U.settingsHTML = function () {
    const sl = (id, label, v, min, max, step) => `<div class="field"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
    const tog = (k, label, v) => `<div class="field"><label>${label}</label>${chips('set_' + k, [[1, t('on')], [0, t('off')]], v ? 1 : 0)}</div>`;
    return `<div class="field"><label>${t('language')}</label><div class="chips">${['en', 'fr', 'hu'].map(l => `<button class="chip ${GH.LANG === l ? 'sel' : ''}" data-a="lang" data-v="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
      ${sl('s-vol', t('vol'), GH.store.get('vol', 0.8), 0, 1, 0.05)}
      ${sl('s-sens', t('sens'), GH.store.get('sens', 1), 0.3, 2.5, 0.05)}
      ${tog('mic', t('mic'), GH.store.get('mic', true))}
      <div class="field"><label>${t('micmode')}</label>${chips('set_micMode', [['open', t('open_mic')], ['ptt', t('ptt')]], GH.store.get('micMode', 'open'))}</div>
      ${tog('speech', t('speech'), GH.store.get('speech', true))}
      ${tog('mimicRec', t('mimicrec'), GH.store.get('mimicRec', true))}
      <div class="note">${t('mic_note')}</div>`;
  };
  U.bindSettings = function () {
    const v = $('s-vol'), m = $('s-mvol'), s = $('s-sens');
    if (v) v.oninput = () => GH.audio.setVol(+v.value);
    if (s) s.oninput = () => { GH.store.set('sens', +s.value); if (GH.input) GH.input.sens = +s.value; };
  };

  // ---------- overlays (in game) ----------
  U.overlayOpen = null;
  U.openOverlay = function (name, html) {
    const O = overlay(); O.style.display = 'flex'; O.className = 'ov ov-' + name;
    O.innerHTML = `<div class="panel">${html}</div>`;
    U.overlayOpen = name; bind(O); U.bindSettings();
    if (document.pointerLockElement) document.exitPointerLock();
  };
  U.closeOverlay = function () { const O = overlay(); O.style.display = 'none'; O.innerHTML = ''; U.overlayOpen = null; };

  U.journal = function (G) {
    const W = G.world, era = W.era, J = G.journal;
    const evRows = GH.EVIDENCE.map(e => { const s = J.ev[e] || 0; return `<button class="ev s${s}" data-a="jev" data-v="${e}">${s === 1 ? '✓' : s === 2 ? '✗' : '·'} ${GH.te('ev_' + e, era)}</button>`; }).join('');
    const orRows = GH.ORIGINS.map(o => `<button class="chip ${J.origin === o ? 'sel' : ''}" data-a="jor" data-v="${o}">${t('or_' + o)}</button>`).join('');
    const cands = GH.GHOSTS.filter(g => GH.EVIDENCE.every(e => (J.ev[e] === 1 ? g.evidence.includes(e) : J.ev[e] === 2 ? !g.evidence.includes(e) : true)) && (!J.origin || g.origin === J.origin));
    const clues = W.found.length ? W.found.map(k => `<div class="clue">${esc(t(k))}</div>`).join('') : `<div class="small">${t('j_none')}</div>`;
    const ob = W.objective;
    const html = `<div class="h1">${t('journal')}</div>
      <div class="jgrid">
        <div class="jcol"><div class="h2">${t('j_objective')}</div><div><b>${t('ob_' + ob)}</b></div><div class="small">${ob === 'identify' ? t('obd_identify', t('van_at_' + era)) : t('obd_' + ob)}</div>${ob !== 'identify' ? `<div class="small">${t('bonus_identify')}</div>` : ''}
          <div class="h2">${t('j_dead')}</div><div class="deadname">${esc(W.deadName)}</div><button data-a="callname">🗣 ${t('j_callname')}</button>
          <div class="h2">${t('j_clues')}</div>${clues}</div>
        <div class="jcol"><div class="h2">${t('j_evidence')}</div><div class="evs">${evRows}</div><div class="h2">${t('j_origin')}</div><div class="chips">${orRows}</div><div class="small">${t('j_hint')}</div></div>
        <div class="jcol"><div class="h2">${t('j_cands')} (${cands.length})</div><div class="cands">${cands.map(g => `<button class="cand ${W.guess === g.idx ? 'sel' : ''}" data-a="jguess" data-v="${g.idx}" title="${esc(t('or_' + g.origin))}">${esc(g.name)}</button>`).join('')}</div>
          <div class="h2">${t('j_guess')}</div><div class="guess">${W.guess >= 0 ? esc(GH.GHOSTS[W.guess].name) : '—'}</div></div>
      </div><div class="row"><button class="primary" data-a="closeov">${t('j_close')}</button></div>`;
    U.openOverlay('journal', html);
  };

  U.equip = function (G) {
    const W = G.world, me = G.me();
    const items = GH.ITEMS[W.era];
    const html = `<div class="h1">${t('equip_title')}</div>
      <div class="eqgrid">${items.map(it => `<button class="eq ${W.stock[it] ? '' : 'empty'}" data-a="take" data-v="${it}">${icon(it)}<div><b>${t('it_' + it)}</b> <span class="small">×${W.stock[it] || 0}</span><div class="small">${t('itd_' + it)}</div></div></button>`).join('')}</div>
      <div class="h2">${t('equip_yours')}</div>
      <div class="slots">${me.inv.map((s, k) => s ? `<button class="slot" data-a="ret" data-v="${k}">${icon(s.it)}<span>${t('it_' + s.it)}</span> ✕</button>` : `<div class="slot emptyslot">—</div>`).join('')}</div>
      <div class="row"><button class="primary" data-a="closeov">${t('j_close')}</button></div>`;
    U.openOverlay('equip', html);
  };

  U.board = function (G) {
    const host = G.role === 'host';
    const cfg = host ? U.cfg : (G.lobbyCfg || U.cfg);
    const me = G.roster.find(r => r.id === G.myId);
    const html = `<div class="h1">${t('board_title')}</div>
      <div class="codebox"><div class="small">${t('room_code')}</div><div class="bigcode">${esc(G.code)}</div><div class="note">${t('share_code')}</div></div>
      <div class="plist">${G.roster.map(p => `<div class="pl" style="border-color:rgb(${GH.PLAYER_COLORS[p.slot].join(',')})">${p.ready ? '✓ ' : '… '}${esc(p.name)}${p.mic ? ' 🎙' : ''}</div>`).join('')}</div>
      ${cfgBlock(cfg, host)}
      <div class="row"><button data-a="leave">${t('leave')}</button><button data-a="closeov">${t('j_close')}</button>
      ${host ? `<button class="primary" data-a="hoststart">${t('start')}</button>` : `<button class="primary" data-a="ready">${me && me.ready ? t('not_ready') : t('ready')}</button>`}</div>`;
    U.openOverlay('board', html);
  };
  U.van = function () {
    U.openOverlay('van', `<div class="h1">${t('van_title')}</div><div class="row"><button data-a="closeov">${t('van_cancel')}</button><button class="primary" data-a="endmission">${t('van_end')}</button></div>`);
  };
  U.pause = function () {
    U.openOverlay('pause', `<div class="h1">${t('paused')}</div>${U.settingsHTML()}<div class="row"><button data-a="leave">${t('leave')}</button><button class="primary" data-a="closeov">${t('resume')}</button></div>`);
  };
  U.clue = function (k) {
    U.openOverlay('clue', `<div class="small">${t('clue_title')}</div><div class="cluebig">${esc(t(k))}</div><div class="row"><button class="primary" data-a="closeov">${t('j_close')}</button></div>`);
  };

  // ---------- HUD ----------
  U.prompt = (s) => { const p = $('prompt'); if (p.textContent !== s) p.textContent = s; };
  U.msg = function (s, dur) {
    const box = $('msgs'); const d = document.createElement('div'); d.className = 'msg'; d.textContent = s; box.appendChild(d);
    setTimeout(() => d.classList.add('fade'), (dur || 4) * 1000); setTimeout(() => d.remove(), (dur || 4) * 1000 + 1200);
    while (box.children.length > 4) box.firstChild.remove();
  };
  let subT = 0;
  U.sub = function (s, dur) { const e = $('sub'); e.textContent = s; e.style.opacity = 1; clearTimeout(subT); subT = setTimeout(() => e.style.opacity = 0, (dur || 3) * 1000); };
  U.hint = (s) => { const e = $('hint'); e.style.display = s ? 'block' : 'none'; e.textContent = s || ''; };
  U.clock = (s) => { const e = $('clock'); if (e.textContent !== s) e.textContent = s; };
  U.room = (s) => { const e = $('roomname'); if (e.textContent !== s) e.textContent = s; };
  let invKey = '';
  U.inv = function (me, era) {
    const key = JSON.stringify(me.inv) + me.sel + GH.LANG;
    if (key === invKey) return; invKey = key;
    $('inv').innerHTML = me.inv.map((s, k) => `<div class="islot ${k === me.sel ? 'sel' : ''}" data-k="${k}">${s ? icon(s.it) : ''}<span>${k + 1}</span></div>`).join('') +
      `<div class="iname">${me.inv[me.sel] ? t('it_' + me.inv[me.sel].it) + (me.inv[me.sel].n > 1 ? ' ×' + me.inv[me.sel].n : '') : ''}</div>`;
    $('inv').querySelectorAll('.islot').forEach(el => el.onclick = () => handlers.slot && handlers.slot(el.getAttribute('data-k')));
  };
  U.resetInv = () => { invKey = ''; };
  return U;
})();
