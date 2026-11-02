// GRAVEHUSH — shared helpers
'use strict';
const GH = window.GH = {};

GH.VERSION = '1.0';
GH.GITHUB = 'https://github.com/RBlackwood224';

// ---------- seeded RNG (mulberry32) ----------
GH.rng = function (seed) {
  let a = seed >>> 0;
  const r = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  // exponential distribution — long tails make timing unpredictable
  r.expo = (mean) => -Math.log(1 - r() * 0.9999) * mean;
  return r;
};
GH.R = GH.rng((Math.random() * 1e9) | 0); // non-deterministic local rng

GH.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
GH.lerp = (a, b, t) => a + (b - a) * t;
GH.dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
GH.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
GH.smooth = (t) => t * t * (3 - 2 * t);

// ---------- grid line of sight (DDA) ----------
// blockFn(cellIndex) -> true when the cell blocks sight
GH.los = function (map, x0, y0, x1, y1, blockFn) {
  let mx = Math.floor(x0), my = Math.floor(y0);
  const tx = Math.floor(x1), ty = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
  let sdx = dx > 0 ? (mx + 1 - x0) * ddx : (x0 - mx) * ddx;
  let sdy = dy > 0 ? (my + 1 - y0) * ddy : (y0 - my) * ddy;
  let n = 0;
  while ((mx !== tx || my !== ty) && n++ < 200) {
    if (sdx < sdy) { sdx += ddx; mx += sx; } else { sdy += ddy; my += sy; }
    if (mx === tx && my === ty) return true;
    if (mx < 0 || my < 0 || mx >= map.w || my >= map.h) return false;
    if (blockFn(my * map.w + mx)) return false;
  }
  return true;
};

GH.makeCode = function () {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

GH.store = {
  get(k, d) { try { const v = localStorage.getItem('gravehush_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gravehush_' + k, JSON.stringify(v)); } catch (e) { } }
};

GH.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
