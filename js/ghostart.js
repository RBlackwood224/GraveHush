// GRAVEHUSH — detailed ghost sprites (48x96), screaming jumpscare faces (64x64) and bodies of the fallen
'use strict';

(function () {
  const R = GH.rng(6660);
  const rgb = (r, g, b, a) => a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function finish(c, opts) {
    opts = opts || {};
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const id = x.getImageData(0, 0, w, h), d = id.data;
    const A = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : d[(yy * w + xx) * 4 + 3];
    const out = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4;
      if (d[i + 3] < 100) { out[i + 3] = 0; continue; }
      out[i + 3] = 255;
      // darken silhouette edges — gives volume
      const edge = (A(xx - 1, y) < 100) + (A(xx + 1, y) < 100) + (A(xx, y - 1) < 100) + (A(xx, y + 1) < 100);
      let k = 1 - edge * 0.18;
      // vertical light falloff (lit from above, like a hanging bulb)
      k *= 1.08 - (y / h) * 0.35;
      const n = (R() - 0.5) * 22;
      out[i] = d[i] * k + n; out[i + 1] = d[i + 1] * k + n; out[i + 2] = d[i + 2] * k + n;
      // ragged, fading lower edge
      if (opts.fade && y > h * opts.fade) { const f = (y - h * opts.fade) / (h * (1 - opts.fade)); if (R() < f * 0.9) out[i + 3] = 0; }
    }
    id.data.set(out); x.putImageData(id, 0, 0);
    const T = { w, h, d: new Uint8ClampedArray(out), canvas: c };
    return T;
  }
  const P = (x, c, X, Y, W, H) => { x.fillStyle = c; x.fillRect(X, Y, W, H); };
  function poly(x, col, pts) { x.fillStyle = col; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); }
  function ell(x, col, cx, cy, rx, ry, rot) { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2); x.fill(); }
  function line(x, col, w, pts) { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); }
  function strands(x, col, x0, x1, y0, len, n) { x.strokeStyle = col; x.lineWidth = 1; for (let i = 0; i < n; i++) { const sx = x0 + R() * (x1 - x0); x.beginPath(); x.moveTo(sx, y0); x.lineTo(sx + (R() - 0.5) * 3, y0 + len * (0.7 + R() * 0.5)); x.stroke(); } }
  function eye(x, cx, cy, col, glow) { if (glow) ell(x, rgb(col[0] * 0.5, col[1] * 0.5, col[2] * 0.5), cx, cy, 2.2, 1.6); P(x, rgb(col[0], col[1], col[2]), cx - 1, cy - 1, 2, 2); }
  function hand(x, col, cx, cy, down) { ell(x, col, cx, cy, 2, 2.5); for (let i = -1; i <= 1; i++) line(x, col, 1, [cx + i * 1.2, cy + 1, cx + i * 1.6, cy + (down ? 7 : 5)]); }

  const F = {};
  F.shadow = (x) => {
    const c = rgb(5, 5, 8);
    for (let i = 0; i < 6; i++) ell(x, rgb(10, 10, 14, 0.9), 24 + (R() - 0.5) * 6, 40 + i * 9, 13 - i * 0.5, 12);
    ell(x, c, 25, 16, 8, 9, 0.15);                         // head, tilted
    poly(x, c, [14, 26, 34, 26, 38, 60, 36, 90, 12, 90, 10, 60]); // body
    poly(x, c, [14, 28, 6, 40, 2, 70, 5, 72, 9, 44, 16, 34]);     // long arm L
    poly(x, c, [34, 28, 42, 42, 46, 72, 43, 73, 39, 46, 32, 34]); // long arm R
    line(x, c, 1, [2, 70, 0, 78]); line(x, c, 1, [4, 71, 3, 80]); line(x, c, 1, [45, 72, 47, 80]); line(x, c, 1, [43, 73, 44, 81]);
    eye(x, 21, 15, [255, 255, 235], true); eye(x, 29, 16, [255, 255, 235], true);
    line(x, rgb(70, 60, 55), 1, [19, 22, 22, 24, 28, 24, 31, 22]); // thin grin
  };
  F.woman = (x) => {
    const skin = rgb(178, 172, 162), gown = rgb(196, 194, 186), dirt = rgb(120, 110, 95), hair = rgb(12, 10, 10);
    poly(x, gown, [15, 30, 33, 30, 38, 92, 10, 92]);
    for (let i = 0; i < 8; i++) P(x, dirt, 12 + R() * 22, 50 + R() * 40, 2 + R() * 4, 1 + R() * 3);
    P(x, rgb(120, 30, 25), 22, 52, 3, 14); P(x, rgb(100, 20, 20), 21, 64, 5, 3);
    line(x, skin, 3, [15, 32, 9, 52, 8, 70]); line(x, skin, 3, [33, 32, 39, 52, 40, 70]);
    hand(x, skin, 8, 72, true); hand(x, skin, 40, 72, true);
    ell(x, skin, 25, 17, 6.5, 8, 0.25);
    ell(x, hair, 24, 13, 9, 8);
    strands(x, hair, 15, 33, 12, 30, 40);
    poly(x, hair, [16, 12, 33, 12, 31, 34, 18, 36]);
    P(x, skin, 26, 18, 3, 6); eye(x, 27, 19, [10, 10, 10]); P(x, rgb(230, 230, 220), 26, 18, 1, 1);
    P(x, rgb(50, 15, 15), 26, 24, 2, 3);
    P(x, skin, 18, 90, 4, 6); P(x, skin, 27, 90, 4, 6);
  };
  F.child = (x) => {
    const skin = rgb(190, 182, 172), shirt = rgb(170, 168, 160), hair = rgb(35, 25, 18);
    poly(x, shirt, [17, 52, 31, 52, 34, 86, 14, 86]);
    P(x, rgb(130, 128, 120), 14, 84, 20, 2);
    line(x, skin, 2.5, [17, 54, 13, 70]); line(x, skin, 2.5, [31, 54, 34, 66]);
    // doll hanging from one hand
    ell(x, rgb(150, 120, 100), 36, 70, 3, 3); P(x, rgb(110, 40, 50), 34, 72, 5, 8); P(x, rgb(10, 10, 10), 35, 69, 1, 1);
    hand(x, skin, 13, 72, true);
    ell(x, skin, 24, 42, 7, 8);
    ell(x, hair, 24, 37, 8, 5); P(x, hair, 16, 37, 16, 4); strands(x, hair, 17, 31, 38, 6, 12);
    ell(x, rgb(5, 5, 5), 21, 43, 1.8, 2.4); ell(x, rgb(5, 5, 5), 27, 43, 1.8, 2.4);
    line(x, rgb(20, 20, 20), 1, [20, 46, 20, 52]); line(x, rgb(20, 20, 20), 1, [28, 46, 28, 51]); // black tears
    P(x, rgb(40, 20, 20), 23, 48, 3, 1);
    P(x, skin, 18, 86, 3, 8); P(x, skin, 27, 86, 3, 8);
  };
  F.hanged = (x) => {
    const skin = rgb(150, 130, 150), cloth = rgb(70, 62, 60), rope = rgb(130, 105, 65);
    line(x, rope, 2, [26, 0, 26, 12]);
    ell(x, rope, 25, 14, 3.5, 2);
    // head tilted hard to one side, stretched neck
    P(x, skin, 23, 14, 4, 7);
    ell(x, skin, 30, 11, 6, 7, 0.9);
    eye(x, 28, 8, [230, 230, 225]); eye(x, 33, 12, [230, 230, 225]);
    P(x, rgb(120, 40, 70), 31, 15, 3, 3); // tongue
    poly(x, cloth, [16, 21, 34, 21, 35, 58, 15, 58]);
    line(x, skin, 3, [16, 23, 13, 46, 13, 60]); line(x, skin, 3, [34, 23, 37, 46, 37, 60]);
    hand(x, skin, 13, 61, true); hand(x, skin, 37, 61, true);
    poly(x, rgb(45, 40, 40), [17, 58, 24, 58, 23, 84, 18, 84]);
    poly(x, rgb(45, 40, 40), [26, 58, 33, 58, 31, 82, 27, 82]);
    P(x, skin, 19, 84, 3, 8); P(x, skin, 28, 82, 3, 9); // toes pointing down, feet off the ground
  };
  F.drowned = (x) => {
    const skin = rgb(110, 145, 140), dress = rgb(70, 95, 95), hair = rgb(10, 18, 16);
    poly(x, dress, [14, 32, 34, 32, 38, 92, 10, 92]);
    for (let i = 0; i < 18; i++) P(x, rgb(140, 180, 185), 12 + R() * 24, 34 + R() * 56, 1, 2 + R() * 3); // dripping
    line(x, skin, 3, [14, 34, 9, 56, 9, 74]); line(x, skin, 3, [34, 34, 39, 56, 39, 74]);
    hand(x, skin, 9, 76, true); hand(x, skin, 39, 76, true);
    ell(x, skin, 24, 18, 7, 9);
    ell(x, hair, 24, 13, 10, 7);
    strands(x, hair, 13, 35, 12, 44, 55); // wet hair hanging to the waist
    P(x, skin, 21, 18, 7, 9);
    eye(x, 22, 20, [235, 245, 240]); eye(x, 27, 20, [235, 245, 240]);
    ell(x, rgb(5, 10, 10), 24.5, 26, 2.2, 3); // open mouth
  };
  F.burned = (x) => {
    const char = rgb(32, 24, 20), dark = rgb(18, 12, 10);
    poly(x, char, [14, 28, 34, 28, 36, 90, 12, 90]);
    line(x, char, 3.5, [14, 30, 8, 50, 6, 68]); line(x, char, 3.5, [34, 30, 40, 50, 42, 66]);
    hand(x, char, 6, 70, true); hand(x, char, 42, 68, true);
    ell(x, char, 24, 16, 7, 9);
    // glowing cracks
    for (let i = 0; i < 26; i++) { const sx = 10 + R() * 30, sy = 10 + R() * 78; line(x, rgb(255, 120 + R() * 80, 30), 1, [sx, sy, sx + (R() - 0.5) * 5, sy + R() * 4]); }
    eye(x, 21, 15, [255, 200, 90], true); eye(x, 27, 15, [255, 200, 90], true);
    ell(x, dark, 24, 22, 3, 2.5); P(x, rgb(255, 140, 40), 23, 22, 2, 1);
    for (let i = 0; i < 6; i++) ell(x, rgb(60, 55, 55, 0.6), 22 + R() * 6, 4 - i * 0.5 + R() * 3, 2, 1.5); // smoke
  };
  F.monk = (x) => {
    const robe = rgb(28, 22, 20), fold = rgb(18, 14, 12);
    poly(x, robe, [24, 2, 36, 14, 40, 40, 44, 94, 4, 94, 8, 40, 12, 14]);
    for (let i = 0; i < 5; i++) line(x, fold, 1, [12 + i * 6, 40, 9 + i * 7, 94]);
    ell(x, rgb(2, 2, 2), 24, 20, 7, 9);
    eye(x, 21, 19, [220, 30, 20], true); eye(x, 27, 19, [220, 30, 20], true);
    // hands clasped with a rosary
    ell(x, rgb(150, 135, 120), 24, 50, 4, 3);
    line(x, rgb(170, 150, 90), 1, [22, 52, 21, 62, 24, 66, 27, 62, 26, 52]);
    P(x, rgb(170, 150, 90), 23, 66, 2, 4);
  };
  F.tall = (x) => {
    const c = rgb(12, 11, 14), pale = rgb(200, 195, 190);
    ell(x, c, 24, 9, 4.5, 8);
    P(x, c, 22, 16, 4, 6);
    poly(x, c, [17, 22, 31, 22, 29, 52, 19, 52]);
    line(x, c, 2, [17, 24, 9, 46, 5, 70]); line(x, c, 2, [31, 24, 39, 46, 43, 70]);
    for (const [hx, hy] of [[5, 70], [43, 70]]) for (let i = -2; i <= 2; i++) line(x, c, 1, [hx, hy, hx + i * 1.5, hy + 9]); // claws
    line(x, c, 2.5, [21, 52, 19, 94]); line(x, c, 2.5, [27, 52, 30, 94]);
    // just a mouth, far too wide
    line(x, pale, 1, [19, 11, 21, 13, 27, 13, 29, 11]);
    for (let i = 0; i < 4; i++) P(x, pale, 21 + i * 2, 12, 1, 2);
  };
  F.faceless = (x) => {
    const suit = rgb(40, 38, 44), skin = rgb(205, 198, 188), shirt = rgb(170, 168, 165);
    poly(x, suit, [14, 28, 34, 28, 35, 62, 13, 62]);
    poly(x, shirt, [22, 28, 26, 28, 24, 40]); P(x, rgb(90, 15, 15), 23, 30, 2, 8);
    poly(x, suit, [14, 62, 23, 62, 22, 92, 15, 92]); poly(x, suit, [25, 62, 34, 62, 33, 92, 26, 92]);
    line(x, suit, 3.5, [14, 30, 11, 50, 11, 64]); line(x, suit, 3.5, [34, 30, 37, 50, 37, 64]);
    hand(x, skin, 11, 66, true); hand(x, skin, 37, 66, true);
    P(x, skin, 22, 22, 4, 6);
    ell(x, skin, 24, 14, 7, 9);
    P(x, rgb(25, 20, 18), 17, 4, 14, 5);
    line(x, rgb(185, 178, 168), 1, [24, 12, 24, 17]); // only the faint ridge of a nose
  };
  F.plague = (x) => {
    const coat = rgb(22, 20, 18), hat = rgb(14, 12, 10), mask = rgb(160, 145, 115);
    poly(x, coat, [13, 24, 35, 24, 40, 94, 8, 94]);
    for (let i = 0; i < 4; i++) line(x, rgb(12, 10, 9), 1, [14 + i * 6, 30, 11 + i * 7, 94]);
    P(x, hat, 10, 4, 28, 3); poly(x, hat, [15, 4, 33, 4, 31, -3, 17, -3]);
    ell(x, mask, 24, 14, 7, 7);
    poly(x, mask, [27, 12, 44, 24, 42, 26, 26, 19]); // beak
    ell(x, rgb(200, 40, 30), 21, 12, 2, 2); ell(x, rgb(200, 40, 30), 27, 12, 2, 2);
    P(x, rgb(255, 120, 100), 20, 11, 1, 1); P(x, rgb(255, 120, 100), 26, 11, 1, 1);
    line(x, rgb(70, 50, 30), 2, [38, 34, 40, 94]); // cane
    hand(x, rgb(40, 32, 28), 37, 40, false);
  };
  F.bride = (x) => {
    const dress = rgb(218, 214, 206), veil = rgb(232, 230, 226, 0.92), skin = rgb(165, 155, 150);
    poly(x, dress, [17, 30, 31, 30, 42, 94, 6, 94]);
    for (let i = 0; i < 6; i++) line(x, rgb(190, 186, 178), 1, [20 + i * 2, 40, 10 + i * 6, 94]);
    P(x, rgb(130, 20, 20), 20, 40, 8, 4); line(x, rgb(120, 15, 15), 2, [24, 44, 22, 70]); line(x, rgb(120, 15, 15), 1, [26, 44, 28, 60]);
    line(x, skin, 2.5, [17, 32, 13, 48, 20, 54]); line(x, skin, 2.5, [31, 32, 35, 48, 28, 54]);
    // dead bouquet
    for (let i = 0; i < 6; i++) ell(x, rgb(60 + R() * 30, 30, 30), 21 + R() * 6, 54 + R() * 4, 2, 2);
    line(x, rgb(50, 60, 30), 1, [24, 57, 23, 66]);
    ell(x, skin, 24, 17, 6, 8);
    ell(x, rgb(8, 8, 8), 21.5, 16, 2, 2.6); ell(x, rgb(8, 8, 8), 26.5, 16, 2, 2.6); // hollow sockets
    P(x, rgb(30, 10, 10), 22, 22, 5, 2); for (let i = 0; i < 4; i++) P(x, rgb(200, 195, 180), 22 + i * 1.3, 22, 1, 1);
    poly(x, veil, [24, 4, 36, 12, 42, 60, 30, 46, 18, 46, 6, 60, 12, 12]);
  };

  for (const k in F) {
    const [c, x] = canvas(48, 96);
    F[k](x);
    GH.SPR['g_' + k] = finish(c, { fade: k === 'shadow' || k === 'drowned' || k === 'monk' ? 0.82 : 0.93 });
  }

  // ---------- jumpscare faces (64x64): wide open screaming mouth, every form its own ----------
  const FACE = {
    shadow: { skin: [8, 8, 10], eyes: [255, 255, 240], hair: null },
    woman: { skin: [180, 172, 160], eyes: [8, 8, 8], hair: [12, 10, 10] },
    child: { skin: [192, 184, 174], eyes: [5, 5, 5], hair: [35, 25, 18], tears: 1 },
    hanged: { skin: [150, 125, 150], eyes: [235, 235, 230], hair: [40, 32, 28], tongue: 1 },
    drowned: { skin: [110, 150, 145], eyes: [240, 250, 245], hair: [10, 18, 16] },
    burned: { skin: [35, 25, 20], eyes: [255, 190, 80], hair: null, embers: 1 },
    monk: { skin: [6, 5, 5], eyes: [230, 30, 20], hood: [28, 22, 20] },
    tall: { skin: [14, 13, 16], eyes: null, hair: null, teeth: 1 },
    faceless: { skin: [205, 198, 188], eyes: null, blank: 1 },
    plague: { skin: [160, 145, 115], eyes: [210, 40, 30], beak: 1 },
    bride: { skin: [168, 158, 152], eyes: [8, 8, 8], veil: 1 }
  };
  for (const k in FACE) {
    const f = FACE[k];
    const [c, x] = canvas(64, 64);
    const s = rgb(f.skin[0], f.skin[1], f.skin[2]);
    if (f.hood) ell(x, rgb(f.hood[0], f.hood[1], f.hood[2]), 32, 30, 30, 34);
    if (f.hair) ell(x, rgb(f.hair[0], f.hair[1], f.hair[2]), 32, 26, 28, 28);
    ell(x, s, 32, 34, 21, 27);
    if (f.hair) { strands(x, rgb(f.hair[0], f.hair[1], f.hair[2]), 10, 22, 14, 44, 18); strands(x, rgb(f.hair[0], f.hair[1], f.hair[2]), 42, 54, 14, 44, 18); }
    if (!f.blank) {
      if (f.eyes) { ell(x, rgb(5, 5, 5), 23, 26, 6, 7); ell(x, rgb(5, 5, 5), 41, 26, 6, 7); ell(x, rgb(f.eyes[0], f.eyes[1], f.eyes[2]), 23, 27, 2.5, 3); ell(x, rgb(f.eyes[0], f.eyes[1], f.eyes[2]), 41, 27, 2.5, 3); }
      if (f.beak) { poly(x, s, [26, 34, 38, 34, 32, 62]); ell(x, rgb(5, 5, 5), 32, 46, 4, 6); }
      else {
        ell(x, rgb(10, 4, 4), 32, 47, 10, 13); // the scream
        if (f.teeth || k === 'shadow' || k === 'bride') for (let i = 0; i < 7; i++) { P(x, rgb(215, 205, 185), 24 + i * 2.4, 35, 1.6, 4); P(x, rgb(215, 205, 185), 24 + i * 2.4, 56, 1.6, 3); }
        if (f.tongue) ell(x, rgb(130, 40, 70), 32, 54, 4, 5);
      }
      if (f.tears) { line(x, rgb(10, 10, 10), 2, [23, 33, 21, 52]); line(x, rgb(10, 10, 10), 2, [41, 33, 43, 50]); }
      if (f.embers) for (let i = 0; i < 30; i++) P(x, rgb(255, 110 + R() * 100, 30), 12 + R() * 40, 8 + R() * 50, 1, 1);
    } else {
      // a face that is not there — only a mouth opening where nothing should be
      ell(x, rgb(10, 4, 4), 32, 40, 4, 14);
    }
    if (f.veil) poly(x, rgb(235, 232, 228, 0.55), [32, 0, 60, 18, 64, 64, 0, 64, 4, 18]);
    GH.SPR['jf_' + k] = finish(c, {});
  }

  // ---------- bodies of fallen players ----------
  for (let p = 0; p < 4; p++) for (const era of ['modern', 'medieval']) {
    const src = GH.SPR[`pl_${era}_${p}_0`].canvas;
    const [c, x] = canvas(56, 32);
    x.translate(56, 0); x.rotate(Math.PI / 2); x.drawImage(src, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    P(x, rgb(80, 10, 10), 14, 29, 26, 3);
    GH.SPR[`body_${era}_${p}`] = finish(c, {});
  }
})();
