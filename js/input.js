// GRAVEHUSH — keyboard / mouse / gamepad / touch input
'use strict';

GH.Input = function (canvas) {
  const I = this;
  I.keys = {}; I.mx = 0; I.my = 0; I.lookX = 0; I.lookY = 0;
  I.pressed = {}; I.useHeld = false; I.locked = false;
  I.sens = GH.store.get('sens', 1);
  I.touch = { mx: 0, my: 0, active: false };
  const press = (k) => { I.pressed[k] = true; };
  const KEYMAP = { KeyE: 'interact', KeyF: 'light', KeyQ: 'drop', KeyG: 'drop', KeyJ: 'journal', Tab: 'journal', KeyT: 'ask', KeyR: 'toggle', Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'slot3', Escape: 'pause', KeyV: 'ptt', KeyN: 'callname' };
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (!I.keys[e.code] && KEYMAP[e.code]) press(KEYMAP[e.code]);
    I.keys[e.code] = true;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (I.enabled && !I.locked && !GH.isTouchActive) { canvas.requestPointerLock && canvas.requestPointerLock(); }
    if (e.button === 0) { I.useHeld = true; press('use'); }
    if (e.button === 2) press('interact');
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) I.useHeld = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas; });
  window.addEventListener('mousemove', (e) => { if (I.locked) { I.lookX += e.movementX * 0.0025 * I.sens; I.lookY += e.movementY * 0.25 * I.sens; } });
  window.addEventListener('wheel', (e) => { if (I.enabled) press(e.deltaY > 0 ? 'next' : 'prev'); }, { passive: true });

  // ---------- touch controls ----------
  I.setupTouch = function (root) {
    GH.isTouchActive = true;
    root.innerHTML = '';
    root.style.display = 'block';
    const stick = document.createElement('div'); stick.className = 't-stick'; root.appendChild(stick);
    const knob = document.createElement('div'); knob.className = 't-knob'; stick.appendChild(knob);
    const look = document.createElement('div'); look.className = 't-look'; root.appendChild(look);
    const btns = [['use', '✋', 't-b1'], ['interact', 'E', 't-b2'], ['light', '💡', 't-b3'], ['drop', '⬇', 't-b4'], ['next', '⟳', 't-b5'], ['journal', '📖', 't-b6'], ['ask', '?', 't-b7'], ['run', '»', 't-b8'], ['pause', 'II', 't-b9']];
    for (const [k, label, cls] of btns) {
      const b = document.createElement('div'); b.className = 't-btn ' + cls; b.textContent = label; root.appendChild(b);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if (k === 'run') I.touch.run = !I.touch.run, b.classList.toggle('on', I.touch.run); else { press(k); if (k === 'use') I.useHeld = true; } }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); if (k === 'use') I.useHeld = false; }, { passive: false });
    }
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; }, { passive: false });
    const lookIds = {};
    look.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) lookIds[t.identifier] = { x: t.clientX, y: t.clientY }; }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) {
          let dx = (t.clientX - sx) / 50, dy = (t.clientY - sy) / 50; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
          I.touch.mx = dx; I.touch.my = dy; knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`;
        } else if (lookIds[t.identifier]) {
          const L = lookIds[t.identifier];
          I.lookX += (t.clientX - L.x) * 0.006 * I.sens; I.lookY += (t.clientY - L.y) * 0.4 * I.sens;
          L.x = t.clientX; L.y = t.clientY;
        }
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; I.touch.mx = I.touch.my = 0; knob.style.transform = ''; } delete lookIds[t.identifier]; } };
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
  };

  // ---------- gamepad ----------
  let prevPad = [];
  I.pollPad = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find(p => p);
    I.pad = null;
    if (!gp) return;
    const dz = (v) => Math.abs(v) < 0.18 ? 0 : v;
    I.pad = { mx: dz(gp.axes[0]), my: dz(gp.axes[1]), lx: dz(gp.axes[2] || 0), ly: dz(gp.axes[3] || 0) };
    const b = gp.buttons.map(x => x.pressed);
    const map = { 0: 'interact', 2: 'use', 3: 'light', 1: 'drop', 4: 'prev', 5: 'next', 8: 'journal', 9: 'pause', 12: 'ask', 13: 'toggle', 6: 'ptt' };
    for (const k in map) if (b[k] && !prevPad[k]) press(map[k]);
    I.padUse = !!b[2] || !!b[7];
    I.padRun = !!b[10] || (gp.buttons[6] && gp.buttons[6].value > 0.5);
    prevPad = b;
  };

  I.frame = function (dt) {
    I.pollPad();
    let mx = 0, my = 0;
    if (I.keys.KeyW || I.keys.ArrowUp) my -= 1; if (I.keys.KeyS || I.keys.ArrowDown) my += 1;
    if (I.keys.KeyA) mx -= 1; if (I.keys.KeyD) mx += 1;
    let turn = 0; if (I.keys.ArrowLeft) turn -= 1; if (I.keys.ArrowRight) turn += 1;
    mx += I.touch.mx; my += I.touch.my;
    if (I.pad) { mx += I.pad.mx; my += I.pad.my; I.lookX += I.pad.lx * dt * 2.6 * I.sens; I.lookY += I.pad.ly * dt * 140 * I.sens; }
    I.lookX += turn * dt * 2.4;
    const run = I.keys.ShiftLeft || I.keys.ShiftRight || I.touch.run || (I.pad && I.padRun);
    const out = { mx: GH.clamp(mx, -1, 1), my: GH.clamp(my, -1, 1), lookX: I.lookX, lookY: I.lookY, run: !!run, use: I.useHeld || !!I.padUse, pressed: I.pressed, ptt: !!I.keys.KeyV };
    I.lookX = 0; I.lookY = 0; I.pressed = {};
    return out;
  };
};
