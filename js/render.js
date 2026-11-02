// GRAVEHUSH — Doom-style raycaster with dithered dynamic lighting
'use strict';

GH.W = 384; GH.H = 216;

GH.Renderer = function (canvas) {
  const W = GH.W, H = GH.H;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const buf = new Uint32Array(img.data.buffer);
  const zbuf = new Float32Array(W);
  const PLANE = 0.72;
  const F = W / (2 * PLANE);
  // Bayer 4x4
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.5));
  const STEP = 255 / 7;
  // quantize lookup: q[(v)|0 + bayerIdx*512]
  const QT = new Uint8Array(16 * 768);
  for (let b = 0; b < 16; b++) for (let v = 0; v < 768; v++) {
    const vv = Math.min(255, v) + BAY[b] * STEP;
    QT[b * 768 + v] = Math.max(0, Math.min(255, Math.round(vv / STEP) * STEP));
  }
  // flashlight cone and vignette tables
  const CONE = new Float32Array(W * H), VIG = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W * 0.30), dy = (y - H / 2 - 6) / (W * 0.27);
    const r = Math.sqrt(dx * dx + dy * dy);
    CONE[y * W + x] = r < 1 ? 0.25 + 0.75 * GH.smooth(1 - r) : Math.max(0, 0.25 - (r - 1) * 0.5);
    const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2);
    VIG[y * W + x] = Math.max(0, 1 - Math.pow(Math.sqrt(vx * vx * 0.8 + vy * vy * 0.9), 2.5) * 0.55);
  }
  let lm = null, LW = 0, LH = 0;
  const S = [0, 0, 0];
  function lmSample(x, y) {
    let fx = x - 0.5, fy = y - 0.5;
    if (fx < 0) fx = 0; if (fy < 0) fy = 0;
    let ix = fx | 0, iy = fy | 0;
    if (ix >= LW - 1) ix = LW - 2; if (iy >= LH - 1) iy = LH - 2;
    const tx = fx - ix, ty = fy - iy;
    const i00 = (iy * LW + ix) * 3, i10 = i00 + 3, i01 = i00 + LW * 3, i11 = i01 + 3;
    const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
    S[0] = lm[i00] * a + lm[i10] * b + lm[i01] * c + lm[i11] * d;
    S[1] = lm[i00 + 1] * a + lm[i10 + 1] * b + lm[i01 + 1] * c + lm[i11 + 1] * d;
    S[2] = lm[i00 + 2] * a + lm[i10 + 2] * b + lm[i01 + 2] * c + lm[i11 + 2] * d;
  }
  this.lmSample = (x, y) => { lmSample(x, y); return S; };

  const self = this;
  this.W = W; this.H = H; this.F = F; this.PLANE = PLANE;

  // ---------- lightmap ----------
  this.buildLightmap = function (map, time, dyn, nightVision) {
    const N = map.w * map.h;
    if (!lm || lm.length !== N * 3) { lm = new Float32Array(N * 3); }
    LW = map.w; LH = map.h;
    const out = map.outdoor;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (out[i]) { lm[j] = 0.07; lm[j + 1] = 0.08; lm[j + 2] = 0.13; } else { lm[j] = 0.012; lm[j + 1] = 0.012; lm[j + 2] = 0.016; }
    }
    for (const L of map.lights) {
      if (!L.on || L.broken) continue;
      let k = L.pow;
      if (L.kind === 'torch' || L.kind === 'van' && map.era === 'medieval') k *= 0.85 + 0.15 * Math.sin(time * 9 + L.id * 3.1) * Math.sin(time * 5.3 + L.id);
      if (L.flicker > 0) k *= (Math.sin(time * 37 + L.id) > 0.2 ? 1 : 0.1);
      const c = L.cells, cr = L.col[0] * k, cg = L.col[1] * k, cb = L.col[2] * k;
      for (let n = 0; n < c.length; n += 2) { const j = c[n] * 3, f = c[n + 1]; lm[j] += cr * f; lm[j + 1] += cg * f; lm[j + 2] += cb * f; }
    }
    // dynamic point lights (other players, candles, fire)
    for (const D of dyn) {
      const R = Math.ceil(D.rad), lx = Math.floor(D.x), ly = Math.floor(D.y);
      for (let y = ly - R; y <= ly + R; y++) for (let x = lx - R; x <= lx + R; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
        const d = Math.hypot(x + 0.5 - D.x, y + 0.5 - D.y); if (d > D.rad) continue;
        const i = y * map.w + x;
        if (!GH.los(map, D.x, D.y, x + 0.5, y + 0.5, (ii) => map.cells[ii] > 0)) continue;
        const f = Math.pow(1 - d / D.rad, 1.5) * D.pow, j = i * 3;
        lm[j] += D.col[0] * f; lm[j + 1] += D.col[1] * f; lm[j + 2] += D.col[2] * f;
      }
    }
  };

  // ---------- main render ----------
  this.render = function (v) {
    const map = v.map, mw = map.w, mh = map.h;
    const cells = map.cells, doorAt = map.doorAt, doors = map.doors, floorT = map.floor, ceilT = map.ceil;
    const px = v.x, py = v.y;
    const dirX = Math.cos(v.a), dirY = Math.sin(v.a);
    const plX = -dirY * PLANE, plY = dirX * PLANE;
    const camZ = v.camZ, hor = (H / 2 + v.pitch) | 0;
    const held = v.held; // {pow, col:[r,g,b], cone:bool, k}
    const hp = held ? held.pow : 0, hr = held ? held.col[0] : 0, hg = held ? held.col[1] : 0, hb = held ? held.col[2] : 0;
    const hk = held ? held.k : 0.1, cone = held && held.cone;
    const nv = v.nightVision;
    const gain = nv ? 3.2 : 1, amb = nv ? 0.10 : 0;
    const TEX = GH.TEX, SKY = GH.SKY;
    const rdx0 = dirX - plX, rdy0 = dirY - plY, rdx1 = dirX + plX, rdy1 = dirY + plY;
    let bi;
    // ----- floor & ceiling -----
    for (let y = 0; y < H; y++) {
      const isFloor = y > hor;
      if (y === hor) { for (let x = 0; x < W; x++) buf[y * W + x] = 0xff000000; continue; }
      const rowDist = isFloor ? F * camZ / (y - hor) : F * (1 - camZ) / (hor - y);
      const stX = rowDist * (rdx1 - rdx0) / W, stY = rowDist * (rdy1 - rdy0) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const att = 1 / (1 + hk * rowDist * rowDist);
      const tooFar = rowDist > 28;
      const row = y * W;
      const byRow = (y & 3) * 4;
      for (let x = 0; x < W; x++, fx += stX, fy += stY) {
        const p = row + x;
        if (tooFar) { buf[p] = 0xff000000; continue; }
        const cx = fx | 0, cy = fy | 0;
        if (cx < 0 || cy < 0 || cx >= mw || cy >= mh) { buf[p] = 0xff000000; continue; }
        const ci = cy * mw + cx;
        const tid = isFloor ? floorT[ci] : ceilT[ci];
        let r, g, b;
        if (!isFloor && tid === 0) {
          // sky
          const ang = v.a + Math.atan((2 * x / W - 1) * PLANE);
          let su = ((ang / (Math.PI * 2)) * 512) % 512; if (su < 0) su += 512;
          let sy = 119 - ((hor - y) * 0.9 | 0); if (sy < 0) sy = 0;
          const si = (sy * 512 + (su | 0)) * 4;
          const sg = nv ? 2.2 : 1;
          r = SKY.d[si] * sg; g = SKY.d[si + 1] * sg; b = SKY.d[si + 2] * sg;
        } else {
          const T = TEX[tid] || TEX[30];
          const ti = (((fy - cy) * 32 | 0) * 32 + ((fx - cx) * 32 | 0)) * 4;
          lmSample(fx, fy);
          let hl = hp * att; if (cone) hl *= CONE[p];
          const lr = (S[0] + hl * hr) * gain + amb, lg = (S[1] + hl * hg) * gain + amb, lb = (S[2] + hl * hb) * gain + amb;
          r = T.d[ti] * lr; g = T.d[ti + 1] * lg; b = T.d[ti + 2] * lb;
        }
        bi = (byRow + (x & 3)) * 768;
        r = r > 767 ? 767 : r; g = g > 767 ? 767 : g; b = b > 767 ? 767 : b;
        buf[p] = 0xff000000 | (QT[bi + (b | 0)] << 16) | (QT[bi + (g | 0)] << 8) | QT[bi + (r | 0)];
      }
    }
    // ----- walls -----
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
      let mx = px | 0, my = py | 0;
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) { stepX = -1; sdx = (px - mx) * ddx; } else { stepX = 1; sdx = (mx + 1 - px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (py - my) * ddy; } else { stepY = 1; sdy = (my + 1 - py) * ddy; }
      let dist = 40, tex = null, u = 0, side = 0, hit = false;
      for (let n = 0; n < 80; n++) {
        let tIn;
        if (sdx < sdy) { tIn = sdx; sdx += ddx; mx += stepX; side = 0; } else { tIn = sdy; sdy += ddy; my += stepY; side = 1; }
        if (mx < 0 || my < 0 || mx >= mw || my >= mh) break;
        const ci = my * mw + mx;
        const di = doorAt[ci];
        if (di >= 0) {
          const D = doors[di];
          const tExit = sdx < sdy ? sdx : sdy;
          let tp, uu;
          if (D.axis === 'h') { if (rdy === 0) continue; tp = (my + 0.5 - py) / rdy; uu = px + rdx * tp - mx; }
          else { if (rdx === 0) continue; tp = (mx + 0.5 - px) / rdx; uu = py + rdy * tp - my; }
          if (tp >= tIn - 1e-6 && tp <= tExit + 1e-6 && uu >= D.open) {
            dist = tp; tex = TEX[D.tex]; u = uu - D.open; side = D.axis === 'h' ? 1 : 0; hit = true; break;
          }
          continue;
        }
        const c = cells[ci];
        if (c > 0) {
          dist = tIn; tex = TEX[c] || TEX[1];
          let wx = side === 0 ? py + tIn * rdy : px + tIn * rdx; wx -= Math.floor(wx);
          if (side === 0 && rdx > 0) wx = 1 - wx; if (side === 1 && rdy < 0) wx = 1 - wx;
          u = wx; hit = true; break;
        }
      }
      zbuf[x] = dist;
      if (!hit || dist > 28) continue;
      const lineH = F / dist;
      const top = hor - (1 - camZ) * lineH, bot = hor + camZ * lineH;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bot));
      const tx = Math.min(31, (u * 32) | 0);
      const rl = Math.hypot(rdx, rdy);
      lmSample(px + rdx * dist - rdx / rl * 0.06, py + rdy * dist - rdy / rl * 0.06);
      const shade = side === 1 ? 0.78 : 1;
      const lr0 = S[0] * shade, lg0 = S[1] * shade, lb0 = S[2] * shade;
      const att = hp / (1 + hk * dist * dist) * shade;
      const inv = 32 / (bot - top);
      for (let y = y0; y <= y1; y++) {
        const p = y * W + x;
        const ty = Math.min(31, ((y - top) * inv) | 0);
        const ti = (ty * 32 + tx) * 4;
        const hl = cone ? att * CONE[p] : att;
        let r = tex.d[ti] * ((lr0 + hl * hr) * gain + amb), g = tex.d[ti + 1] * ((lg0 + hl * hg) * gain + amb), b = tex.d[ti + 2] * ((lb0 + hl * hb) * gain + amb);
        r = r > 767 ? 767 : r; g = g > 767 ? 767 : g; b = b > 767 ? 767 : b;
        bi = ((y & 3) * 4 + (x & 3)) * 768;
        buf[p] = 0xff000000 | (QT[bi + (b | 0)] << 16) | (QT[bi + (g | 0)] << 8) | QT[bi + (r | 0)];
      }
    }
    // ----- sprites -----
    const invDet = 1 / (plX * dirY - dirX * plY);
    const list = v.sprites;
    for (const s of list) { const sx = s.x - px, sy = s.y - py; s._d = invDet * (-plY * sx + plX * sy); s._t = invDet * (dirY * sx - dirX * sy); }
    list.sort((a, b) => b._d - a._d);
    const time = v.time;
    for (const s of list) {
      const tY = s._d; if (tY < 0.12 || tY > 26) continue;
      const T = s.tex; if (!T) continue;
      const sxc = (W / 2) * (1 + s._t / tY);
      const hpx = F * s.sh / tY, wpx = hpx * T.w / T.h;
      const z = s.z || 0;
      const bottom = hor + F * (camZ - z) / tY, top = bottom - hpx;
      const x0 = Math.max(0, Math.ceil(sxc - wpx / 2)), x1 = Math.min(W - 1, Math.floor(sxc + wpx / 2));
      if (x0 > x1) continue;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(H - 1, Math.floor(bottom));
      let lr, lg, lb;
      if (s.bright) { lr = s.bright[0]; lg = s.bright[1]; lb = s.bright[2]; }
      else { lmSample(s.x, s.y); lr = S[0]; lg = S[1]; lb = S[2]; }
      const att = hp / (1 + hk * tY * tY);
      const alpha = s.alpha === undefined ? 1 : s.alpha;
      const glitch = s.glitch || 0;
      const emit = s.emit || 0;
      const gk = s.ghost ? 0.62 : 1;
      if (s.ghost) { lr *= gk; lg *= gk * 1.05; lb *= gk * 1.25; }
      const fseed = ((time * 24) | 0) * 2654435761;
      for (let x = x0; x <= x1; x++) {
        if (tY >= zbuf[x]) continue;
        let txx = ((x - (sxc - wpx / 2)) / wpx * T.w) | 0;
        if (txx < 0 || txx >= T.w) continue;
        for (let y = y0; y <= y1; y++) {
          let tyy = ((y - top) / hpx * T.h) | 0;
          if (tyy < 0 || tyy >= T.h) continue;
          let tx2 = txx;
          if (glitch && ((tyy + (time * 20 | 0)) % 7 === 0)) tx2 = (txx + ((Math.sin(tyy * 3 + time * 50) * glitch * 4) | 0) + T.w) % T.w;
          const ti = (tyy * T.w + tx2) * 4;
          if (T.d[ti + 3] < 128) continue;
          const bidx = (y & 3) * 4 + (x & 3);
          if (alpha < 1) { let hsh = (x * 73856093) ^ (y * 19349663) ^ fseed; hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177); if (((hsh >>> 8) & 255) / 255 > alpha) continue; }
          const p = y * W + x;
          const hl = (cone ? att * CONE[p] : att) * gk;
          let r = T.d[ti] * ((lr + hl * hr + emit) * gain + amb), g = T.d[ti + 1] * ((lg + hl * hg + emit) * gain + amb), b = T.d[ti + 2] * ((lb + hl * hb + emit) * gain + amb);
          // glowing eyes / fire: very bright pixels stay visible in darkness
          if (s.ghost && T.d[ti] > 200 && T.d[ti + 1] > 150) { r = Math.max(r, T.d[ti] * 0.9); g = Math.max(g, T.d[ti + 1] * 0.9); b = Math.max(b, T.d[ti + 2] * 0.9); }
          r = r > 767 ? 767 : r; g = g > 767 ? 767 : g; b = b > 767 ? 767 : b;
          bi = bidx * 768;
          buf[p] = 0xff000000 | (QT[bi + (b | 0)] << 16) | (QT[bi + (g | 0)] << 8) | QT[bi + (r | 0)];
        }
      }
    }
  };

  // ---------- 2D overlay helpers on the pixel buffer ----------
  function put(x, y, r, g, b) { if (x < 0 || y < 0 || x >= W || y >= H) return; buf[(y | 0) * W + (x | 0)] = 0xff000000 | (b << 16) | (g << 8) | r; }
  this.put = put;
  this.blitTex = function (T, dx, dy, scale, tint, lightK) {
    const k = lightK === undefined ? 1 : lightK;
    for (let y = 0; y < T.h * scale; y++) for (let x = 0; x < T.w * scale; x++) {
      const ti = (((y / scale) | 0) * T.w + ((x / scale) | 0)) * 4;
      if (T.d[ti + 3] < 128) continue;
      let r = T.d[ti] * k, g = T.d[ti + 1] * k, b = T.d[ti + 2] * k;
      if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
      self.put(dx + x, dy + y, Math.min(255, r) | 0, Math.min(255, g) | 0, Math.min(255, b) | 0);
    }
  };
  this.rect = function (x, y, w, h, r, g, b) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, r, g, b); };
  // tiny 3x5 font for device readouts
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
    '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '-': '000000111000000', '.': '000000000000010',
    'C': '111100100100111', 'R': '110101110101101', 'E': '111100111100111', '?': '111001011000010', ' ': '000000000000000', 'O': '111101101101111', 'F': '111100111100100'
  };
  this.text = function (s, x, y, r, g, b, sc) {
    sc = sc || 1;
    for (let k = 0; k < s.length; k++) {
      const f = FONT[s[k]] || FONT['?'];
      for (let i = 0; i < 15; i++) if (f[i] === '1') for (let a = 0; a < sc; a++) for (let c = 0; c < sc; c++) put(x + k * 4 * sc + (i % 3) * sc + a, y + ((i / 3) | 0) * sc + c, r, g, b);
    }
  };

  // ---------- post effects ----------
  this.post = function (fx) {
    const time = fx.time;
    // night vision (camera)
    if (fx.nightVision) {
      for (let p = 0; p < W * H; p++) { const c = buf[p]; const l = ((c & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + ((c >> 16) & 255) * 0.11); const g = Math.min(255, l * 1.2 + (Math.random() * 30)); buf[p] = 0xff000000 | ((g * 0.35) << 16) | (g << 8) | (g * 0.4); }
    }
    // dead: cold desaturated
    if (fx.dead) {
      for (let p = 0; p < W * H; p++) { const c = buf[p]; const l = ((c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255)) / 3; buf[p] = 0xff000000 | (Math.min(255, l * 1.4 + 25) << 16) | (Math.min(255, l * 1.1 + 10) << 8) | (l * 0.8); }
    }
    // glitch / tearing
    if (fx.glitch > 0) {
      const rows = (fx.glitch * 22) | 0;
      for (let k = 0; k < rows; k++) {
        const y = (Math.random() * H) | 0, h = 1 + (Math.random() * 4 | 0), off = ((Math.random() - 0.5) * 30 * fx.glitch) | 0;
        for (let yy = y; yy < Math.min(H, y + h); yy++) {
          const row = buf.slice(yy * W, yy * W + W);
          for (let x = 0; x < W; x++) buf[yy * W + x] = row[(x - off + W) % W];
        }
      }
    }
    // vignette + fear darkening + grain
    const fear = fx.fear || 0;
    const vk = 0.35 + fear * 0.65;
    const red = fx.redPulse || 0;
    for (let p = 0; p < W * H; p++) {
      let k = 1 - (1 - VIG[p]) * vk * 1.6; if (k < 0) k = 0;
      const n = (Math.random() - 0.5) * (8 + fear * 18);
      const c = buf[p];
      let r = (c & 255) * k + n + red * (1 - VIG[p]) * 60, g = ((c >> 8) & 255) * k + n, b = ((c >> 16) & 255) * k + n;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      buf[p] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
    // hiding: wardrobe slits
    if (fx.hiding) {
      for (let y = 0; y < H; y++) {
        const slit = (y % 18) > 12 && y > H * 0.25 && y < H * 0.75;
        for (let x = 0; x < W; x++) if (!slit || x < W * 0.3 || x > W * 0.7) { const p = y * W + x; const c = buf[p]; buf[p] = 0xff000000 | ((((c >> 16) & 255) * 0.08) << 16) | ((((c >> 8) & 255) * 0.08) << 8) | ((c & 255) * 0.08); }
      }
    }
    if (fx.black > 0) { const k = 1 - Math.min(1, fx.black); for (let p = 0; p < W * H; p++) { const c = buf[p]; buf[p] = 0xff000000 | ((((c >> 16) & 255) * k) << 16) | ((((c >> 8) & 255) * k) << 8) | ((c & 255) * k); } }
    // flash (jumpscare / strike)
    if (fx.flash > 0) { const a = fx.flash; for (let p = 0; p < W * H; p++) { const c = buf[p]; buf[p] = 0xff000000 | ((((c >> 16) & 255) * (1 - a) + 255 * a * 0.8) << 16) | ((((c >> 8) & 255) * (1 - a) + 255 * a * 0.8) << 8) | ((c & 255) * (1 - a) + 255 * a); } }
  };

  this.present = function () { ctx.putImageData(img, 0, 0); };
  this.clear = function () { buf.fill(0xff000000); };
};
