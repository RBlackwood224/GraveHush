// GRAVEHUSH — procedural pixel-art textures and sprites (no external images)
'use strict';

GH.TEX = [];   // wall / floor / ceiling textures by id (32x32)
GH.SPR = {};   // sprites by name

(function () {
  const R = GH.rng(4242);
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function toTex(c) { const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; return { w: c.width, h: c.height, d: new Uint8ClampedArray(d) }; }
  const rgb = (r, g, b, a) => a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  function noise(x, w, h, amt, alpha) {
    const id = x.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (alpha && d[i + 3] === 0) continue;
      const n = (R() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(id, 0, 0);
  }
  function stain(x, w, h, n, col) {
    for (let i = 0; i < n; i++) {
      const cx = R() * w, cy = R() * h, rr = 1 + R() * 5;
      x.fillStyle = col;
      for (let k = 0; k < rr * 4; k++) x.fillRect((cx + (R() - .5) * rr * 2) | 0, (cy + (R() - .5) * rr * 2 + k * 0.3) | 0, 1, 1 + (R() * 2 | 0));
    }
  }
  function tex(id, fn) { const [c, x] = canvas(32, 32); fn(x); GH.TEX[id] = toTex(c); }

  // ---------- MODERN WALLS ----------
  tex(1, x => { // faded wallpaper
    x.fillStyle = rgb(118, 102, 84); x.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 32; i += 8) { x.fillStyle = rgb(100, 84, 70); x.fillRect(i, 0, 3, 32); }
    for (let y = 2; y < 32; y += 8) for (let i = 4; i < 32; i += 8) { x.fillStyle = rgb(140, 90, 80); x.fillRect(i + 1, y, 2, 2); x.fillStyle = rgb(90, 110, 80); x.fillRect(i + 1, y + 2, 2, 1); }
    stain(x, 32, 32, 3, rgb(70, 60, 45)); x.fillStyle = rgb(60, 45, 35); x.fillRect(0, 29, 32, 3); noise(x, 32, 32, 18);
  });
  tex(2, x => { // cracked plaster
    x.fillStyle = rgb(130, 128, 118); x.fillRect(0, 0, 32, 32);
    x.strokeStyle = rgb(70, 68, 60); x.beginPath(); x.moveTo(5, 0); x.lineTo(9, 8); x.lineTo(7, 14); x.lineTo(12, 22); x.stroke();
    stain(x, 32, 32, 4, rgb(95, 90, 75)); noise(x, 32, 32, 22);
  });
  tex(3, x => { // brick
    x.fillStyle = rgb(60, 50, 45); x.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const off = (r % 2) * 4; x.fillStyle = rgb(110 + R() * 30, 52 + R() * 15, 40 + R() * 10);
      x.fillRect(c * 8 + off + 1, r * 4 + 1, 7, 3);
    }
    noise(x, 32, 32, 20);
  });
  tex(4, x => { // hospital tiles
    x.fillStyle = rgb(150, 165, 150); x.fillRect(0, 0, 32, 32);
    x.fillStyle = rgb(105, 120, 108);
    for (let i = 0; i < 32; i += 8) { x.fillRect(i, 0, 1, 32); x.fillRect(0, i, 32, 1); }
    x.fillStyle = rgb(90, 110, 95); x.fillRect(0, 22, 32, 10);
    stain(x, 32, 32, 5, rgb(110, 95, 60)); stain(x, 32, 32, 1, rgb(90, 30, 25)); noise(x, 32, 32, 16);
  });
  tex(5, x => { // school wall with wainscot
    x.fillStyle = rgb(150, 140, 100); x.fillRect(0, 0, 32, 32);
    x.fillStyle = rgb(70, 90, 110); x.fillRect(0, 18, 32, 14);
    x.fillStyle = rgb(50, 60, 75); x.fillRect(0, 18, 32, 1);
    stain(x, 32, 32, 3, rgb(110, 100, 70)); noise(x, 32, 32, 18);
  });
  tex(6, x => { // barn planks
    for (let i = 0; i < 32; i += 4) { x.fillStyle = rgb(90 + R() * 25, 62 + R() * 15, 40); x.fillRect(i, 0, 4, 32); x.fillStyle = rgb(45, 30, 20); x.fillRect(i, 0, 1, 32); }
    x.fillStyle = rgb(40, 28, 18); x.fillRect(0, 6, 32, 1); x.fillRect(0, 25, 32, 1); noise(x, 32, 32, 22);
  });
  tex(7, x => { // dark wood panels
    x.fillStyle = rgb(70, 45, 30); x.fillRect(0, 0, 32, 32);
    x.fillStyle = rgb(55, 34, 22); x.fillRect(2, 2, 12, 28); x.fillRect(18, 2, 12, 28);
    x.fillStyle = rgb(88, 58, 38); x.fillRect(3, 3, 10, 26); x.fillRect(19, 3, 10, 26); noise(x, 32, 32, 14);
  });
  tex(8, x => { // concrete
    x.fillStyle = rgb(105, 105, 102); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(80, 80, 78); x.fillRect(0, 15, 32, 1);
    stain(x, 32, 32, 6, rgb(80, 85, 70)); noise(x, 32, 32, 28);
  });
  // ---------- MEDIEVAL WALLS ----------
  tex(9, x => { // stone blocks
    x.fillStyle = rgb(45, 42, 38); x.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
      const off = (r % 2) * 6; const v = 85 + R() * 30; x.fillStyle = rgb(v, v - 4, v - 10);
      x.fillRect(c * 12 + off + 1, r * 8 + 1, 11, 7);
    }
    noise(x, 32, 32, 26);
  });
  tex(10, x => { // half-timber
    x.fillStyle = rgb(150, 140, 115); x.fillRect(0, 0, 32, 32);
    x.fillStyle = rgb(55, 38, 25); x.fillRect(0, 0, 32, 3); x.fillRect(0, 29, 32, 3); x.fillRect(0, 0, 3, 32); x.fillRect(29, 0, 3, 32);
    x.strokeStyle = rgb(55, 38, 25); x.lineWidth = 3; x.beginPath(); x.moveTo(2, 30); x.lineTo(30, 2); x.stroke();
    stain(x, 32, 32, 3, rgb(110, 100, 75)); noise(x, 32, 32, 22);
  });
  tex(11, x => { // rough dungeon stone
    x.fillStyle = rgb(55, 55, 50); x.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 14; i++) { const v = 60 + R() * 40; x.fillStyle = rgb(v, v, v - 6); x.fillRect(R() * 28 | 0, R() * 28 | 0, 4 + R() * 7 | 0, 3 + R() * 5 | 0); }
    stain(x, 32, 32, 4, rgb(40, 60, 35)); noise(x, 32, 32, 30);
  });
  tex(12, x => { // old planks
    for (let i = 0; i < 32; i += 5) { x.fillStyle = rgb(75 + R() * 20, 55 + R() * 10, 35); x.fillRect(i, 0, 5, 32); x.fillStyle = rgb(35, 25, 15); x.fillRect(i, 0, 1, 32); }
    x.fillStyle = rgb(30, 30, 32); x.fillRect(0, 8, 32, 2); x.fillRect(0, 22, 32, 2); noise(x, 32, 32, 22);
  });
  tex(13, x => { // whitewash
    x.fillStyle = rgb(150, 148, 135); x.fillRect(0, 0, 32, 32); stain(x, 32, 32, 6, rgb(115, 110, 95));
    x.fillStyle = rgb(90, 85, 75); x.fillRect(0, 28, 32, 4); noise(x, 32, 32, 20);
  });
  tex(14, x => { // big exterior stone
    x.fillStyle = rgb(40, 40, 40); x.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 2; r++) for (let c = -1; c < 2; c++) { const v = 70 + R() * 25; x.fillStyle = rgb(v, v, v + 4); x.fillRect(c * 16 + (r % 2) * 8 + 1, r * 16 + 1, 15, 15); }
    noise(x, 32, 32, 30);
  });
  tex(15, x => { // treeline / dark forest
    x.fillStyle = rgb(10, 18, 12); x.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 60; i++) { const g = 25 + R() * 30; x.fillStyle = rgb(g * 0.5, g, g * 0.6); x.fillRect(R() * 32 | 0, R() * 26 | 0, 2 + R() * 4 | 0, 2 + R() * 3 | 0); }
    x.fillStyle = rgb(35, 25, 18); x.fillRect(6, 20, 3, 12); x.fillRect(21, 18, 3, 14); noise(x, 32, 32, 12);
  });
  tex(16, x => { // fence + hedge
    x.fillStyle = rgb(12, 22, 14); x.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 40; i++) { const g = 20 + R() * 25; x.fillStyle = rgb(g * .5, g, g * .5); x.fillRect(R() * 32 | 0, R() * 18 | 0, 3, 3); }
    x.fillStyle = rgb(80, 60, 40); for (let i = 1; i < 32; i += 8) x.fillRect(i, 14, 3, 18); x.fillRect(0, 18, 32, 2); x.fillRect(0, 26, 32, 2); noise(x, 32, 32, 16);
  });
  tex(17, x => { // castle stone with a hanging banner
    x.fillStyle = rgb(45, 42, 38); x.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) { const v = 75 + R() * 25; x.fillStyle = rgb(v, v - 4, v - 10); x.fillRect(c * 12 + (r % 2) * 6 + 1, r * 8 + 1, 11, 7); }
    x.fillStyle = rgb(110, 20, 22); x.fillRect(9, 2, 14, 24); x.beginPath(); x.moveTo(9, 26); x.lineTo(16, 31); x.lineTo(23, 26); x.fill();
    x.fillStyle = rgb(190, 150, 60); x.fillRect(9, 2, 14, 2); x.fillRect(14, 9, 4, 10); x.fillRect(11, 12, 10, 3);
    noise(x, 32, 32, 20);
  });
  tex(18, x => { // catacomb niches full of skulls
    x.fillStyle = rgb(50, 47, 42); x.fillRect(0, 0, 32, 32);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      x.fillStyle = rgb(12, 10, 9); x.fillRect(c * 16 + 2, r * 16 + 3, 12, 10);
      for (let k = 0; k < 3; k++) { const sx = c * 16 + 3 + k * 4, sy = r * 16 + 7; x.fillStyle = rgb(185, 175, 150); x.fillRect(sx, sy, 3, 3); x.fillRect(sx, sy + 3, 3, 2); x.fillStyle = rgb(20, 18, 15); x.fillRect(sx, sy + 1, 1, 1); x.fillRect(sx + 2, sy + 1, 1, 1); }
    }
    noise(x, 32, 32, 24);
  });
  // ---------- DOORS ----------
  tex(20, x => { x.fillStyle = rgb(85, 55, 35); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(65, 40, 25); x.fillRect(4, 3, 10, 12); x.fillRect(18, 3, 10, 12); x.fillRect(4, 18, 10, 11); x.fillRect(18, 18, 10, 11); x.fillStyle = rgb(170, 150, 80); x.fillRect(26, 16, 3, 2); noise(x, 32, 32, 14); });
  tex(21, x => { x.fillStyle = rgb(120, 130, 125); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(25, 35, 40); x.fillRect(10, 4, 12, 9); x.fillStyle = rgb(90, 95, 92); x.fillRect(0, 26, 32, 6); x.fillStyle = rgb(60, 60, 60); x.fillRect(25, 16, 4, 2); stain(x, 32, 32, 3, rgb(100, 80, 60)); noise(x, 32, 32, 14); });
  tex(22, x => { for (let i = 0; i < 32; i += 6) { x.fillStyle = rgb(80 + R() * 15, 52, 30); x.fillRect(i, 0, 6, 32); x.fillStyle = rgb(40, 25, 15); x.fillRect(i, 0, 1, 32); } x.fillStyle = rgb(40, 40, 44); x.fillRect(0, 6, 32, 3); x.fillRect(0, 23, 32, 3); x.fillRect(24, 14, 4, 4); noise(x, 32, 32, 16); });
  tex(23, x => { x.fillStyle = rgb(95, 40, 30); x.fillRect(0, 0, 32, 32); x.strokeStyle = rgb(150, 140, 120); x.lineWidth = 2; x.strokeRect(2, 2, 28, 28); x.beginPath(); x.moveTo(2, 2); x.lineTo(30, 30); x.moveTo(30, 2); x.lineTo(2, 30); x.stroke(); noise(x, 32, 32, 18); });
  // ---------- FLOORS ----------
  tex(30, x => { for (let r = 0; r < 32; r += 4) { x.fillStyle = rgb(80 + R() * 15, 55 + R() * 8, 35); x.fillRect(0, r, 32, 4); x.fillStyle = rgb(45, 30, 20); x.fillRect(0, r, 32, 1); x.fillRect((R() * 32) | 0, r, 1, 4); } noise(x, 32, 32, 14); });
  tex(31, x => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? rgb(40, 40, 42) : rgb(140, 138, 128); x.fillRect(c * 8, r * 8, 8, 8); } stain(x, 32, 32, 4, rgb(90, 80, 50)); noise(x, 32, 32, 14); });
  tex(32, x => { x.fillStyle = rgb(90, 35, 35); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(120, 90, 40); x.fillRect(2, 2, 28, 1); x.fillRect(2, 29, 28, 1); x.fillRect(2, 2, 1, 28); x.fillRect(29, 2, 1, 28); stain(x, 32, 32, 4, rgb(60, 25, 25)); noise(x, 32, 32, 18); });
  tex(33, x => { x.fillStyle = rgb(110, 118, 105); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(90, 98, 88); for (let i = 0; i < 32; i += 16) { x.fillRect(i, 0, 1, 32); x.fillRect(0, i, 32, 1); } stain(x, 32, 32, 5, rgb(80, 75, 55)); noise(x, 32, 32, 14); });
  tex(34, x => { x.fillStyle = rgb(40, 38, 35); x.fillRect(0, 0, 32, 32); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const v = 65 + R() * 25; x.fillStyle = rgb(v, v - 3, v - 8); x.fillRect(c * 11 + (r % 2) * 5, r * 8 + 1, 10, 7); } noise(x, 32, 32, 22); });
  tex(35, x => { x.fillStyle = rgb(70, 55, 35); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 70; i++) { x.fillStyle = rgb(140 + R() * 40, 120 + R() * 30, 60); x.fillRect(R() * 32 | 0, R() * 32 | 0, 3 + R() * 3 | 0, 1); } noise(x, 32, 32, 18); });
  tex(36, x => { x.fillStyle = rgb(22, 40, 22); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 90; i++) { const g = 35 + R() * 35; x.fillStyle = rgb(g * .5, g, g * .45); x.fillRect(R() * 32 | 0, R() * 32 | 0, 1, 2); } noise(x, 32, 32, 10); });
  tex(37, x => { x.fillStyle = rgb(55, 42, 30); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 30; i++) { x.fillStyle = rgb(70, 58, 45); x.fillRect(R() * 32 | 0, R() * 32 | 0, 2, 1); } stain(x, 32, 32, 3, rgb(35, 30, 25)); noise(x, 32, 32, 16); });
  tex(38, x => { x.fillStyle = rgb(30, 30, 30); x.fillRect(0, 0, 32, 32); for (let r = 0; r < 32; r += 5) for (let c = 0; c < 32; c += 6) { const v = 60 + R() * 30; x.fillStyle = rgb(v, v, v); x.fillRect(c + (r % 2) * 3, r, 5, 4); } noise(x, 32, 32, 18); });
  // ---------- CEILINGS ----------
  tex(40, x => { x.fillStyle = rgb(110, 108, 100); x.fillRect(0, 0, 32, 32); stain(x, 32, 32, 5, rgb(85, 75, 55)); noise(x, 32, 32, 14); });
  tex(41, x => { x.fillStyle = rgb(60, 50, 40); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(40, 28, 18); x.fillRect(0, 0, 32, 6); x.fillRect(0, 16, 32, 6); noise(x, 32, 32, 16); });
  tex(42, x => { x.fillStyle = rgb(130, 130, 122); x.fillRect(0, 0, 32, 32); x.fillStyle = rgb(95, 95, 90); for (let i = 0; i < 32; i += 16) { x.fillRect(i, 0, 1, 32); x.fillRect(0, i, 32, 1); } stain(x, 32, 32, 4, rgb(110, 100, 70)); noise(x, 32, 32, 12); });
  tex(43, x => { x.fillStyle = rgb(50, 48, 45); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 10; i++) { const v = 55 + R() * 25; x.fillStyle = rgb(v, v, v); x.fillRect(R() * 28 | 0, R() * 28 | 0, 6, 4); } noise(x, 32, 32, 20); });

  // ---------- SKY (512 x 120) ----------
  {
    const [c, x] = canvas(512, 120);
    const g = x.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, rgb(4, 5, 12)); g.addColorStop(1, rgb(16, 20, 32));
    x.fillStyle = g; x.fillRect(0, 0, 512, 120);
    for (let i = 0; i < 160; i++) { const v = 90 + R() * 120; x.fillStyle = rgb(v, v, v + 20); x.fillRect(R() * 512 | 0, R() * 90 | 0, 1, 1); }
    x.fillStyle = rgb(200, 200, 185); x.beginPath(); x.arc(380, 30, 9, 0, 7); x.fill(); x.fillStyle = rgb(16, 20, 32); x.beginPath(); x.arc(384, 27, 8, 0, 7); x.fill();
    for (let i = 0; i < 6; i++) { x.fillStyle = rgba(40, 45, 60, 0.5); x.fillRect(R() * 512 | 0, 40 + R() * 50 | 0, 60 + R() * 80 | 0, 3); }
    GH.SKY = toTex(c);
  }
  function rgba(r, g, b, a) { return rgb(r, g, b, a); }

  // ---------- SPRITES ----------
  function spr(name, w, h, fn) { const [c, x] = canvas(w, h); fn(x, w, h); noise(x, w, h, 14, true); GH.SPR[name] = toTex(c); GH.SPR[name].canvas = c; }
  const P = (x, c, X, Y, W, H) => { x.fillStyle = c; x.fillRect(X, Y, W, H); };

  spr('bed', 32, 32, (x) => { P(x, rgb(60, 40, 25), 1, 18, 30, 6); P(x, rgb(50, 32, 20), 1, 10, 3, 20); P(x, rgb(50, 32, 20), 28, 14, 3, 16); P(x, rgb(150, 145, 130), 4, 14, 24, 5); P(x, rgb(170, 165, 155), 4, 12, 7, 3); P(x, rgb(110, 50, 45), 11, 13, 17, 6); });
  spr('hospbed', 32, 32, (x) => { P(x, rgb(120, 125, 130), 2, 17, 28, 2); P(x, rgb(100, 105, 110), 2, 19, 2, 11); P(x, rgb(100, 105, 110), 28, 19, 2, 11); P(x, rgb(100, 105, 110), 2, 9, 2, 10); P(x, rgb(170, 175, 170), 4, 14, 24, 4); P(x, rgb(120, 110, 90), 14, 15, 6, 2); });
  spr('wardrobe', 32, 48, (x) => { P(x, rgb(55, 35, 22), 3, 2, 26, 46); P(x, rgb(75, 48, 30), 5, 4, 10, 42); P(x, rgb(75, 48, 30), 17, 4, 10, 42); P(x, rgb(25, 15, 10), 15, 4, 2, 42); P(x, rgb(160, 140, 70), 13, 24, 1, 3); P(x, rgb(160, 140, 70), 18, 24, 1, 3); });
  spr('locker', 32, 48, (x) => { P(x, rgb(70, 85, 95), 4, 2, 24, 46); P(x, rgb(50, 62, 70), 15, 2, 2, 46); for (let i = 6; i < 14; i += 2) { P(x, rgb(30, 38, 44), 7, i, 6, 1); P(x, rgb(30, 38, 44), 19, i, 6, 1); } P(x, rgb(150, 150, 140), 12, 24, 2, 3); P(x, rgb(150, 150, 140), 18, 24, 2, 3); });
  spr('table', 32, 32, (x) => { P(x, rgb(80, 52, 32), 1, 16, 30, 3); P(x, rgb(55, 35, 22), 3, 19, 3, 13); P(x, rgb(55, 35, 22), 26, 19, 3, 13); P(x, rgb(150, 150, 140), 8, 13, 5, 3); P(x, rgb(120, 100, 60), 18, 14, 4, 2); });
  spr('desk', 32, 32, (x) => { P(x, rgb(90, 70, 45), 2, 17, 28, 3); P(x, rgb(70, 52, 32), 2, 20, 6, 12); P(x, rgb(70, 52, 32), 24, 20, 6, 12); P(x, rgb(60, 60, 60), 13, 12, 6, 5); });
  spr('chair', 32, 32, (x) => { P(x, rgb(65, 42, 26), 10, 8, 3, 24); P(x, rgb(65, 42, 26), 10, 19, 12, 3); P(x, rgb(65, 42, 26), 20, 22, 2, 10); P(x, rgb(65, 42, 26), 10, 8, 10, 2); });
  spr('shelf', 32, 48, (x) => { P(x, rgb(55, 35, 22), 2, 2, 28, 46); for (let s = 0; s < 4; s++) { P(x, rgb(35, 22, 14), 4, 4 + s * 11, 24, 9); for (let b = 0; b < 7; b++) P(x, rgb(60 + R() * 90, 30 + R() * 50, 30 + R() * 40), 5 + b * 3, 6 + s * 11 + (R() * 2 | 0), 2, 7); } });
  spr('bathtub', 32, 32, (x) => { P(x, rgb(170, 170, 160), 1, 18, 30, 9); P(x, rgb(120, 120, 112), 3, 19, 26, 3); P(x, rgb(80, 60, 40), 3, 27, 3, 4); P(x, rgb(80, 60, 40), 26, 27, 3, 4); P(x, rgb(90, 40, 35), 8, 19, 10, 1); });
  spr('toilet', 32, 32, (x) => { P(x, rgb(165, 165, 155), 18, 10, 9, 10); P(x, rgb(165, 165, 155), 8, 20, 16, 5); P(x, rgb(140, 140, 132), 12, 25, 8, 6); });
  spr('crib', 32, 32, (x) => { P(x, rgb(150, 140, 120), 3, 14, 26, 2); P(x, rgb(150, 140, 120), 3, 28, 26, 2); for (let i = 3; i < 30; i += 4) P(x, rgb(150, 140, 120), i, 14, 1, 16); P(x, rgb(200, 180, 180), 6, 24, 20, 4); });
  spr('piano', 32, 32, (x) => { P(x, rgb(25, 20, 18), 2, 8, 28, 22); P(x, rgb(180, 175, 160), 4, 17, 24, 3); for (let i = 5; i < 28; i += 3) P(x, rgb(20, 20, 20), i, 17, 1, 2); P(x, rgb(25, 20, 18), 3, 30, 3, 2); P(x, rgb(25, 20, 18), 26, 30, 3, 2); });
  spr('gurney', 32, 32, (x) => { P(x, rgb(130, 135, 140), 2, 18, 28, 2); P(x, rgb(100, 105, 110), 5, 20, 1, 9); P(x, rgb(100, 105, 110), 26, 20, 1, 9); P(x, rgb(20, 20, 20), 4, 29, 3, 3); P(x, rgb(20, 20, 20), 25, 29, 3, 3); P(x, rgb(180, 180, 172), 3, 14, 26, 4); P(x, rgb(190, 190, 182), 6, 11, 9, 4); });
  spr('morgue', 32, 48, (x) => { P(x, rgb(140, 145, 145), 1, 4, 30, 44); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { P(x, rgb(110, 115, 115), 3 + c * 14, 6 + r * 14, 12, 12); P(x, rgb(70, 70, 70), 7 + c * 14, 11 + r * 14, 4, 2); } });
  spr('hay', 32, 32, (x) => { P(x, rgb(160, 130, 60), 2, 14, 28, 18); for (let i = 0; i < 40; i++) P(x, rgb(190, 160, 80), 2 + R() * 27 | 0, 14 + R() * 17 | 0, 3, 1); P(x, rgb(90, 70, 40), 2, 20, 28, 1); P(x, rgb(90, 70, 40), 2, 26, 28, 1); });
  spr('barrel', 32, 32, (x) => { P(x, rgb(90, 58, 35), 8, 8, 16, 24); P(x, rgb(60, 60, 64), 8, 11, 16, 2); P(x, rgb(60, 60, 64), 8, 26, 16, 2); P(x, rgb(70, 45, 28), 15, 8, 1, 24); });
  spr('crate', 32, 32, (x) => { P(x, rgb(105, 75, 45), 4, 12, 24, 20); P(x, rgb(70, 50, 30), 4, 12, 24, 2); P(x, rgb(70, 50, 30), 4, 21, 24, 2); P(x, rgb(70, 50, 30), 4, 12, 2, 20); P(x, rgb(70, 50, 30), 26, 12, 2, 20); });
  spr('van', 64, 40, (x) => { P(x, rgb(35, 45, 55), 2, 8, 60, 24); P(x, rgb(25, 30, 38), 44, 10, 14, 10); P(x, rgb(140, 160, 170), 46, 12, 10, 6); P(x, rgb(15, 15, 15), 8, 30, 10, 10); P(x, rgb(15, 15, 15), 44, 30, 10, 10); P(x, rgb(200, 190, 120), 59, 22, 3, 3); P(x, rgb(90, 20, 20), 4, 18, 36, 3); });
  spr('cart', 64, 40, (x) => { P(x, rgb(80, 55, 32), 4, 14, 44, 14); P(x, rgb(55, 36, 22), 4, 14, 44, 2); P(x, rgb(140, 125, 100), 6, 4, 40, 10); P(x, rgb(45, 30, 18), 12, 24, 14, 14); P(x, rgb(70, 50, 30), 18, 30, 2, 2); P(x, rgb(45, 30, 18), 46, 20, 18, 2); });
  spr('tree', 48, 64, (x) => { P(x, rgb(30, 22, 16), 21, 30, 6, 34); x.fillStyle = rgb(8, 22, 12); x.beginPath(); x.arc(24, 22, 20, 0, 7); x.fill(); for (let i = 0; i < 50; i++) P(x, rgb(10 + R() * 15, 30 + R() * 25, 15), 6 + R() * 36 | 0, 4 + R() * 34 | 0, 3, 2); });
  spr('deadtree', 48, 64, (x) => { P(x, rgb(40, 34, 30), 21, 20, 5, 44); x.strokeStyle = rgb(40, 34, 30); x.lineWidth = 2; x.beginPath(); x.moveTo(23, 30); x.lineTo(8, 14); x.moveTo(23, 26); x.lineTo(38, 8); x.moveTo(30, 18); x.lineTo(40, 20); x.moveTo(14, 20); x.lineTo(10, 4); x.stroke(); });
  spr('grave', 32, 32, (x) => { P(x, rgb(90, 90, 92), 9, 12, 14, 20); P(x, rgb(90, 90, 92), 11, 10, 10, 2); P(x, rgb(55, 55, 58), 13, 16, 6, 1); P(x, rgb(55, 55, 58), 15, 14, 2, 6); });
  spr('well', 32, 32, (x) => { P(x, rgb(80, 80, 82), 4, 18, 24, 14); P(x, rgb(10, 10, 12), 6, 18, 20, 3); P(x, rgb(60, 40, 25), 5, 2, 2, 16); P(x, rgb(60, 40, 25), 25, 2, 2, 16); P(x, rgb(60, 40, 25), 3, 2, 26, 2); });
  spr('bulb', 16, 32, (x) => { P(x, rgb(30, 30, 30), 7, 0, 1, 18); P(x, rgb(220, 210, 160), 5, 18, 5, 6); P(x, rgb(80, 80, 70), 6, 17, 3, 2); });
  spr('bulboff', 16, 32, (x) => { P(x, rgb(30, 30, 30), 7, 0, 1, 18); P(x, rgb(90, 90, 80), 5, 18, 5, 6); P(x, rgb(60, 60, 55), 6, 17, 3, 2); });
  spr('walltorch', 16, 32, (x) => { P(x, rgb(60, 40, 25), 7, 14, 2, 12); P(x, rgb(255, 170, 60), 6, 8, 4, 6); P(x, rgb(255, 230, 140), 7, 10, 2, 3); });
  spr('walltorchoff', 16, 32, (x) => { P(x, rgb(60, 40, 25), 7, 14, 2, 12); P(x, rgb(30, 25, 22), 6, 11, 4, 3); });
  spr('candles', 16, 16, (x) => { P(x, rgb(200, 190, 160), 3, 8, 2, 8); P(x, rgb(200, 190, 160), 8, 6, 2, 10); P(x, rgb(200, 190, 160), 12, 9, 2, 7); P(x, rgb(255, 190, 80), 3, 6, 2, 2); P(x, rgb(255, 190, 80), 8, 4, 2, 2); P(x, rgb(255, 190, 80), 12, 7, 2, 2); });
  spr('candlesoff', 16, 16, (x) => { P(x, rgb(200, 190, 160), 3, 8, 2, 8); P(x, rgb(200, 190, 160), 8, 6, 2, 10); P(x, rgb(200, 190, 160), 12, 9, 2, 7); });
  spr('equip', 32, 32, (x) => { P(x, rgb(60, 60, 50), 2, 16, 28, 16); P(x, rgb(80, 80, 66), 2, 16, 28, 3); P(x, rgb(140, 120, 50), 14, 20, 4, 3); P(x, rgb(150, 150, 150), 6, 12, 5, 4); P(x, rgb(120, 40, 30), 20, 11, 6, 5); });
  spr('chest', 32, 32, (x) => { P(x, rgb(80, 52, 30), 3, 16, 26, 16); P(x, rgb(95, 62, 36), 3, 12, 26, 5); P(x, rgb(50, 50, 55), 3, 16, 26, 2); P(x, rgb(180, 160, 70), 14, 18, 4, 4); });
  // clues & evidence objects
  spr('note', 16, 16, (x) => { P(x, rgb(200, 190, 160), 3, 6, 10, 9); P(x, rgb(90, 80, 70), 5, 8, 6, 1); P(x, rgb(90, 80, 70), 5, 10, 5, 1); P(x, rgb(90, 80, 70), 5, 12, 6, 1); });
  spr('photo', 16, 16, (x) => { P(x, rgb(210, 205, 195), 3, 5, 10, 10); P(x, rgb(50, 45, 40), 4, 6, 8, 7); P(x, rgb(150, 140, 120), 7, 7, 3, 4); });
  spr('toy', 16, 16, (x) => { P(x, rgb(170, 140, 110), 6, 4, 5, 5); P(x, rgb(120, 40, 50), 5, 9, 7, 6); P(x, rgb(20, 20, 20), 7, 6, 1, 1); P(x, rgb(20, 20, 20), 9, 6, 1, 1); });
  spr('bones', 32, 16, (x) => { P(x, rgb(200, 195, 175), 6, 9, 18, 2); P(x, rgb(200, 195, 175), 4, 8, 3, 4); P(x, rgb(200, 195, 175), 23, 8, 3, 4); P(x, rgb(200, 195, 175), 14, 4, 7, 6); P(x, rgb(20, 20, 20), 15, 6, 2, 2); P(x, rgb(20, 20, 20), 18, 6, 2, 2); P(x, rgb(190, 185, 165), 10, 12, 14, 2); });
  spr('ashbones', 32, 16, (x) => { P(x, rgb(40, 38, 36), 4, 10, 24, 5); P(x, rgb(90, 50, 30), 10, 9, 4, 2); P(x, rgb(70, 66, 62), 16, 8, 6, 3); });
  spr('hand', 16, 16, (x) => { P(x, rgb(120, 255, 140), 5, 7, 6, 6); for (let i = 0; i < 4; i++) P(x, rgb(120, 255, 140), 5 + i * 2 - (i > 1 ? 0 : 0), 2 + (i === 0 || i === 3 ? 2 : 0), 1, 5); P(x, rgb(120, 255, 140), 11, 8, 3, 1); });
  spr('feet', 16, 16, (x) => { P(x, rgb(25, 22, 20), 3, 4, 3, 5); P(x, rgb(25, 22, 20), 9, 9, 3, 5); });
  spr('saltpile', 16, 8, (x) => { P(x, rgb(220, 220, 215), 2, 4, 12, 4); P(x, rgb(235, 235, 230), 5, 3, 6, 2); });
  spr('saltprint', 16, 8, (x) => { P(x, rgb(220, 220, 215), 2, 4, 12, 4); P(x, rgb(60, 60, 60), 5, 4, 2, 3); P(x, rgb(60, 60, 60), 10, 4, 2, 3); });
  spr('ashpile', 16, 8, (x) => { P(x, rgb(90, 88, 84), 1, 4, 14, 4); P(x, rgb(110, 108, 104), 4, 3, 8, 2); });
  spr('ashprint', 16, 8, (x) => { P(x, rgb(90, 88, 84), 1, 4, 14, 4); P(x, rgb(20, 20, 20), 4, 4, 2, 3); P(x, rgb(20, 20, 20), 10, 5, 2, 3); });
  spr('board', 48, 40, (x) => { P(x, rgb(70, 45, 25), 0, 0, 48, 40); P(x, rgb(150, 110, 70), 2, 2, 44, 36); for (let i = 0; i < 7; i++) { const px = 4 + (R() * 34 | 0), py = 4 + (R() * 24 | 0); P(x, rgb(210, 200, 175), px, py, 8, 9); P(x, rgb(80, 70, 60), px + 1, py + 2, 6, 1); P(x, rgb(80, 70, 60), px + 1, py + 4, 5, 1); P(x, rgb(200, 30, 30), px + 3, py, 2, 2); } x.strokeStyle = rgb(170, 20, 20); x.beginPath(); x.moveTo(8, 6); x.lineTo(30, 20); x.lineTo(40, 8); x.moveTo(12, 28); x.lineTo(30, 20); x.stroke(); P(x, rgb(25, 25, 25), 16, 14, 10, 12); P(x, rgb(180, 170, 150), 18, 16, 6, 6); });
  spr('lantern', 16, 32, (x) => { P(x, rgb(40, 40, 40), 5, 10, 6, 10); P(x, rgb(255, 200, 100), 6, 12, 4, 6); P(x, rgb(40, 40, 40), 7, 4, 2, 6); });
  spr('sarcophagus', 32, 32, (x) => { P(x, rgb(105, 100, 92), 2, 16, 28, 16); P(x, rgb(130, 125, 115), 1, 12, 30, 5); P(x, rgb(80, 76, 70), 2, 21, 28, 1); P(x, rgb(80, 76, 70), 15, 13, 2, 3); P(x, rgb(80, 76, 70), 12, 14, 8, 1); P(x, rgb(70, 66, 60), 4, 24, 6, 6); P(x, rgb(70, 66, 60), 22, 24, 6, 6); });
  spr('coffin', 32, 32, (x) => { x.fillStyle = rgb(60, 38, 24); x.beginPath(); x.moveTo(3, 20); x.lineTo(8, 15); x.lineTo(26, 15); x.lineTo(30, 20); x.lineTo(26, 31); x.lineTo(8, 31); x.closePath(); x.fill(); P(x, rgb(40, 25, 15), 4, 20, 25, 1); P(x, rgb(170, 150, 80), 15, 22, 2, 6); P(x, rgb(170, 150, 80), 13, 24, 6, 1); });
  spr('pew', 32, 32, (x) => { P(x, rgb(70, 45, 28), 1, 10, 30, 10); P(x, rgb(55, 35, 22), 1, 20, 30, 3); P(x, rgb(50, 32, 20), 2, 23, 3, 9); P(x, rgb(50, 32, 20), 27, 23, 3, 9); P(x, rgb(85, 56, 34), 1, 10, 30, 2); });
  spr('altar', 32, 32, (x) => { P(x, rgb(120, 115, 105), 3, 16, 26, 16); P(x, rgb(200, 195, 180), 2, 14, 28, 6); P(x, rgb(130, 20, 20), 12, 14, 8, 10); P(x, rgb(190, 160, 70), 15, 2, 2, 12); P(x, rgb(190, 160, 70), 12, 5, 8, 2); P(x, rgb(220, 210, 180), 4, 9, 2, 5); P(x, rgb(220, 210, 180), 26, 9, 2, 5); P(x, rgb(255, 190, 80), 4, 7, 2, 2); P(x, rgb(255, 190, 80), 26, 7, 2, 2); });
  spr('throne', 32, 48, (x) => { P(x, rgb(70, 45, 25), 6, 2, 20, 30); P(x, rgb(120, 20, 22), 9, 6, 14, 24); P(x, rgb(190, 160, 70), 6, 2, 20, 2); P(x, rgb(190, 160, 70), 10, 0, 3, 3); P(x, rgb(190, 160, 70), 19, 0, 3, 3); P(x, rgb(70, 45, 25), 3, 28, 26, 6); P(x, rgb(120, 20, 22), 6, 28, 20, 4); P(x, rgb(60, 38, 20), 4, 34, 4, 14); P(x, rgb(60, 38, 20), 24, 34, 4, 14); });
  spr('armor', 32, 48, (x) => { const m = rgb(140, 145, 150), d = rgb(90, 95, 100); P(x, m, 12, 2, 8, 9); P(x, rgb(15, 15, 18), 13, 6, 6, 1); P(x, m, 9, 11, 14, 14); P(x, d, 15, 12, 2, 12); P(x, m, 6, 12, 3, 13); P(x, m, 23, 12, 3, 13); P(x, d, 10, 25, 12, 3); P(x, m, 11, 28, 4, 16); P(x, m, 17, 28, 4, 16); P(x, rgb(60, 45, 30), 15, 44, 2, 4); P(x, rgb(60, 45, 30), 8, 46, 16, 2); P(x, rgb(170, 175, 180), 27, 2, 1, 30); P(x, rgb(90, 60, 30), 26, 30, 3, 4); });
  spr('bonepile', 32, 16, (x) => { for (let k = 0; k < 14; k++) P(x, rgb(170 + R() * 30, 160 + R() * 25, 135), 2 + R() * 26 | 0, 8 + R() * 7 | 0, 4 + R() * 4 | 0, 1); for (const sx of [6, 14, 21]) { P(x, rgb(195, 185, 160), sx, 6, 5, 5); P(x, rgb(20, 18, 15), sx + 1, 7, 1, 2); P(x, rgb(20, 18, 15), sx + 3, 7, 1, 2); } });
  spr('written', 16, 16, (x) => { P(x, rgb(220, 215, 200), 2, 6, 12, 9); P(x, rgb(40, 40, 40), 8, 6, 1, 9); for (let i = 0; i < 9; i++) P(x, rgb(120 + R() * 60, 10, 10), 3 + (R() * 10 | 0), 7 + (R() * 7 | 0), 2, 1); });
  spr('motionon', 16, 16, (x) => { P(x, rgb(220, 220, 210), 4, 4, 8, 8); P(x, rgb(30, 30, 30), 6, 6, 4, 4); P(x, rgb(255, 60, 60), 6, 6, 4, 4); });
  spr('threadon', 16, 16, (x) => { P(x, rgb(255, 220, 90), 1, 7, 3, 3); P(x, rgb(255, 220, 90), 12, 7, 3, 3); P(x, rgb(255, 250, 220), 3, 8, 10, 1); });
  spr('orb', 4, 4, (x) => { P(x, rgb(220, 255, 220), 1, 0, 2, 4); P(x, rgb(220, 255, 220), 0, 1, 4, 2); });
  spr('book', 16, 16, (x) => { P(x, rgb(120, 40, 30), 3, 9, 10, 4); P(x, rgb(220, 210, 180), 4, 10, 8, 2); });
  spr('cup', 16, 16, (x) => { P(x, rgb(180, 180, 170), 6, 9, 5, 5); P(x, rgb(180, 180, 170), 11, 10, 2, 2); });
  spr('ball', 16, 16, (x) => { x.fillStyle = rgb(170, 50, 40); x.beginPath(); x.arc(8, 11, 4, 0, 7); x.fill(); P(x, rgb(220, 200, 80), 5, 10, 6, 1); });

  // ---------- ITEM ICONS (16x16) — used on floor, in HUD and scaled in hand ----------
  const I = {};
  I.flashlight = x => { P(x, rgb(40, 40, 44), 3, 7, 9, 3); P(x, rgb(70, 70, 76), 11, 6, 3, 5); P(x, rgb(230, 220, 160), 14, 7, 1, 3); };
  I.emf = x => { P(x, rgb(30, 30, 34), 4, 2, 8, 13); P(x, rgb(10, 10, 10), 5, 3, 6, 4); for (let i = 0; i < 5; i++) P(x, [rgb(40, 200, 60), rgb(120, 220, 40), rgb(220, 220, 40), rgb(230, 140, 30), rgb(230, 40, 30)][i], 5 + i, 9, 1, 2); };
  I.thermo = x => { P(x, rgb(200, 200, 190), 5, 2, 6, 12); P(x, rgb(20, 40, 30), 6, 4, 4, 4); P(x, rgb(80, 80, 80), 7, 10, 2, 4); };
  I.spiritbox = x => { P(x, rgb(140, 40, 30), 3, 4, 10, 10); P(x, rgb(20, 20, 20), 4, 5, 8, 3); P(x, rgb(200, 200, 200), 6, 10, 4, 1); P(x, rgb(60, 60, 60), 12, 1, 1, 4); };
  I.notebook = x => { P(x, rgb(60, 70, 120), 3, 3, 10, 12); P(x, rgb(220, 215, 200), 4, 4, 8, 10); P(x, rgb(40, 40, 40), 3, 4, 1, 10); };
  I.uv = x => { P(x, rgb(40, 40, 44), 3, 7, 9, 3); P(x, rgb(60, 30, 90), 11, 6, 3, 5); P(x, rgb(170, 90, 255), 14, 7, 1, 3); };
  I.camera = x => { P(x, rgb(30, 30, 30), 2, 5, 12, 8); P(x, rgb(80, 80, 90), 5, 6, 5, 5); P(x, rgb(150, 160, 200), 6, 7, 3, 3); P(x, rgb(200, 30, 30), 12, 6, 1, 1); };
  I.motion = x => { P(x, rgb(220, 220, 210), 4, 4, 8, 8); P(x, rgb(30, 30, 30), 6, 6, 4, 4); P(x, rgb(200, 40, 40), 7, 7, 2, 2); };
  I.crucifix = x => { P(x, rgb(150, 120, 60), 7, 2, 2, 12); P(x, rgb(150, 120, 60), 4, 5, 8, 2); };
  I.salt = x => { P(x, rgb(220, 220, 215), 5, 3, 6, 11); P(x, rgb(40, 80, 160), 5, 6, 6, 4); P(x, rgb(150, 150, 150), 6, 2, 4, 1); };
  I.smudge = x => { P(x, rgb(110, 130, 90), 6, 3, 4, 10); P(x, rgb(80, 60, 40), 6, 11, 4, 2); P(x, rgb(150, 150, 150), 7, 1, 2, 2); };
  I.lighter = x => { P(x, rgb(160, 40, 40), 6, 7, 5, 7); P(x, rgb(170, 170, 170), 6, 5, 5, 2); P(x, rgb(255, 180, 60), 8, 2, 2, 3); };
  I.torch = x => { P(x, rgb(80, 50, 30), 7, 6, 2, 10); P(x, rgb(255, 140, 40), 6, 1, 4, 5); P(x, rgb(255, 230, 120), 7, 3, 2, 2); };
  I.candle = x => { P(x, rgb(220, 210, 180), 6, 6, 4, 9); P(x, rgb(255, 190, 70), 7, 3, 2, 3); P(x, rgb(140, 120, 60), 4, 14, 8, 2); };
  I.bowl = x => { P(x, rgb(110, 80, 50), 2, 9, 12, 5); P(x, rgb(70, 110, 150), 3, 9, 10, 2); };
  I.bell = x => { P(x, rgb(190, 160, 70), 4, 5, 8, 7); P(x, rgb(190, 160, 70), 6, 3, 4, 2); P(x, rgb(90, 70, 30), 7, 12, 2, 2); P(x, rgb(80, 50, 30), 7, 1, 2, 2); };
  I.quill = x => { P(x, rgb(210, 200, 170), 2, 6, 10, 8); P(x, rgb(230, 230, 230), 10, 1, 3, 8); P(x, rgb(60, 50, 40), 10, 9, 1, 3); };
  I.ash = x => { P(x, rgb(100, 80, 60), 4, 5, 8, 9); P(x, rgb(70, 55, 40), 5, 3, 6, 2); P(x, rgb(90, 88, 84), 6, 4, 4, 1); };
  I.mirror = x => { P(x, rgb(150, 120, 60), 4, 2, 8, 10); P(x, rgb(140, 160, 170), 5, 3, 6, 8); P(x, rgb(80, 60, 30), 7, 12, 2, 3); };
  I.thread = x => { P(x, rgb(120, 100, 80), 5, 5, 6, 6); P(x, rgb(190, 160, 70), 2, 8, 2, 2); P(x, rgb(190, 160, 70), 12, 8, 2, 2); P(x, rgb(200, 190, 170), 3, 8, 10, 1); };
  I.bible = x => { P(x, rgb(50, 30, 20), 3, 3, 10, 12); P(x, rgb(190, 160, 70), 7, 5, 2, 7); P(x, rgb(190, 160, 70), 5, 7, 6, 2); };
  I.holywater = x => { P(x, rgb(120, 160, 200), 5, 6, 6, 8); P(x, rgb(200, 200, 210), 6, 3, 4, 3); P(x, rgb(220, 220, 220), 7, 8, 2, 4); P(x, rgb(220, 220, 220), 6, 9, 4, 1); };
  GH.ITEM_DRAW = I;
  for (const k in I) spr('it_' + k, 16, 16, I[k]);

  // ---------- GHOST FORMS (32x64) ----------
  function eyes(x, X, Y, col) { P(x, col || rgb(230, 230, 210), X, Y, 2, 1); P(x, col || rgb(230, 230, 210), X + 5, Y, 2, 1); }
  const G = {};
  G.shadow = x => { x.fillStyle = rgb(4, 4, 6); x.beginPath(); x.ellipse(16, 14, 6, 7, 0, 0, 7); x.fill(); x.fillRect(8, 20, 16, 30); for (let i = 0; i < 14; i++) x.fillRect(8 + i, 50, 1, 4 + R() * 10); eyes(x, 12, 13, rgb(255, 255, 240)); };
  G.woman = x => { P(x, rgb(190, 190, 185), 10, 20, 12, 40); P(x, rgb(150, 150, 148), 9, 40, 14, 22); P(x, rgb(170, 160, 150), 12, 8, 8, 10); P(x, rgb(15, 12, 10), 10, 6, 12, 22); P(x, rgb(170, 160, 150), 13, 11, 6, 6); eyes(x, 13, 13, rgb(10, 10, 10)); P(x, rgb(40, 10, 10), 15, 16, 2, 1); P(x, rgb(170, 160, 150), 7, 26, 3, 16); P(x, rgb(170, 160, 150), 22, 26, 3, 16); };
  G.child = x => { P(x, rgb(150, 140, 130), 12, 26, 9, 20); P(x, rgb(90, 60, 60), 11, 34, 11, 14); P(x, rgb(180, 170, 160), 12, 16, 9, 10); P(x, rgb(40, 30, 20), 11, 14, 11, 5); eyes(x, 13, 20, rgb(5, 5, 5)); P(x, rgb(5, 5, 5), 14, 19, 2, 3); P(x, rgb(5, 5, 5), 18, 19, 2, 3); P(x, rgb(150, 140, 130), 12, 48, 3, 10); P(x, rgb(150, 140, 130), 18, 48, 3, 10); };
  G.hanged = x => { P(x, rgb(120, 100, 70), 15, 0, 1, 12); P(x, rgb(150, 140, 125), 12, 10, 8, 9); P(x, rgb(80, 70, 70), 10, 19, 12, 22); P(x, rgb(60, 55, 55), 11, 41, 4, 18); P(x, rgb(60, 55, 55), 17, 41, 4, 16); P(x, rgb(150, 140, 125), 8, 20, 2, 18); P(x, rgb(150, 140, 125), 22, 20, 2, 18); eyes(x, 13, 13, rgb(240, 240, 230)); P(x, rgb(30, 10, 30), 14, 16, 4, 2); };
  G.drowned = x => { P(x, rgb(90, 120, 125), 10, 18, 12, 44); P(x, rgb(10, 15, 15), 9, 4, 14, 34); P(x, rgb(120, 150, 150), 13, 8, 6, 3); P(x, rgb(90, 120, 125), 6, 22, 3, 22); P(x, rgb(90, 120, 125), 23, 22, 3, 22); for (let i = 0; i < 12; i++) P(x, rgb(10, 15, 15), 9 + (R() * 14 | 0), 30 + (R() * 14 | 0), 1, 6); };
  G.burned = x => { P(x, rgb(30, 22, 18), 10, 18, 12, 42); P(x, rgb(40, 28, 20), 11, 6, 10, 12); for (let i = 0; i < 25; i++) P(x, rgb(220, 90 + R() * 80, 20), 10 + (R() * 12 | 0), 6 + (R() * 54 | 0), 1, 1); eyes(x, 13, 10, rgb(255, 180, 60)); P(x, rgb(30, 22, 18), 7, 22, 3, 18); P(x, rgb(30, 22, 18), 22, 22, 3, 18); };
  G.monk = x => { x.fillStyle = rgb(25, 20, 18); x.beginPath(); x.moveTo(16, 4); x.lineTo(26, 18); x.lineTo(28, 63); x.lineTo(4, 63); x.lineTo(6, 18); x.closePath(); x.fill(); P(x, rgb(5, 5, 5), 12, 10, 8, 10); eyes(x, 13, 14, rgb(200, 30, 20)); P(x, rgb(120, 100, 80), 13, 36, 6, 4); };
  G.tall = x => { P(x, rgb(10, 10, 12), 13, 2, 6, 8); P(x, rgb(10, 10, 12), 12, 10, 8, 30); P(x, rgb(10, 10, 12), 8, 12, 2, 36); P(x, rgb(10, 10, 12), 22, 12, 2, 36); P(x, rgb(10, 10, 12), 13, 40, 2, 24); P(x, rgb(10, 10, 12), 17, 40, 2, 24); P(x, rgb(10, 10, 12), 6, 46, 3, 4); P(x, rgb(10, 10, 12), 23, 46, 3, 4); eyes(x, 13, 5, rgb(255, 255, 255)); };
  G.faceless = x => { P(x, rgb(60, 55, 60), 10, 20, 12, 40); P(x, rgb(200, 195, 185), 11, 6, 10, 13); P(x, rgb(25, 20, 20), 10, 4, 12, 4); P(x, rgb(185, 180, 170), 13, 10, 6, 6); P(x, rgb(200, 195, 185), 7, 24, 3, 16); P(x, rgb(200, 195, 185), 22, 24, 3, 16); };
  G.plague = x => { P(x, rgb(20, 18, 16), 9, 18, 14, 46); P(x, rgb(20, 18, 16), 8, 4, 16, 4); P(x, rgb(25, 22, 20), 10, 8, 12, 10); P(x, rgb(150, 140, 110), 11, 10, 9, 6); x.fillStyle = rgb(150, 140, 110); x.beginPath(); x.moveTo(18, 13); x.lineTo(28, 20); x.lineTo(18, 16); x.fill(); P(x, rgb(220, 60, 40), 13, 11, 2, 2); P(x, rgb(70, 50, 30), 24, 26, 2, 30); };
  G.bride = x => { P(x, rgb(215, 212, 205), 9, 16, 14, 46); P(x, rgb(225, 222, 218), 6, 4, 20, 34); P(x, rgb(160, 150, 145), 12, 9, 8, 9); eyes(x, 13, 12, rgb(5, 5, 5)); P(x, rgb(120, 20, 20), 12, 28, 8, 2); P(x, rgb(120, 20, 20), 15, 30, 2, 12); };
  GH.GHOST_FORMS = Object.keys(G);
  for (const k in G) spr('g_' + k, 32, 64, G[k]);

  // ---------- PLAYERS ----------
  GH.PLAYER_COLORS = [[200, 60, 50], [60, 120, 200], [70, 170, 80], [210, 170, 50]];
  for (let p = 0; p < 4; p++) for (const era of ['modern', 'medieval']) for (let f = 0; f < 2; f++) {
    const c = GH.PLAYER_COLORS[p];
    spr(`pl_${era}_${p}_${f}`, 32, 56, x => {
      const body = era === 'modern' ? rgb(c[0] * 0.6, c[1] * 0.6, c[2] * 0.6) : rgb(c[0] * 0.45, c[1] * 0.4, c[2] * 0.35);
      P(x, rgb(180, 150, 125), 12, 4, 8, 9); P(x, era === 'modern' ? rgb(50, 40, 30) : body, 11, 2, 10, 4);
      if (era === 'medieval') { P(x, body, 9, 2, 14, 3); P(x, body, 9, 2, 2, 14); P(x, body, 21, 2, 2, 14); }
      P(x, body, 9, 13, 14, 20); P(x, rgb(c[0], c[1], c[2]), 9, 13, 14, 2);
      P(x, body, 6, 14, 3, 14); P(x, body, 23, 14, 3, 14);
      P(x, rgb(35, 35, 45), 10, 33, 5, 18 + (f ? 1 : -1)); P(x, rgb(35, 35, 45), 17, 33, 5, 18 + (f ? -1 : 1));
      P(x, rgb(20, 20, 20), 10, 51, 5, 3); P(x, rgb(20, 20, 20), 17, 51, 5, 3);
      P(x, rgb(10, 10, 10), 13, 8, 2, 1); P(x, rgb(10, 10, 10), 17, 8, 2, 1);
    });
  }
})();
