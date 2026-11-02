// GRAVEHUSH — real 3D renderer (WebGL2): proper buildings with roofs, windows and doors,
// voxel furniture and items, low-resolution pixel look with dithered post-processing.
'use strict';

GH.WALLH = 2.7; GH.EYE = 1.6;

GH.GL3D = function (canvas) {
  const G3 = this;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no webgl2');
  const W = GH.W, H = GH.H;
  canvas.width = W; canvas.height = H;
  G3.gl = gl;
  const WALLH = GH.WALLH;

  // ---------------- shaders ----------------
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name); } return { p, u }; }

  const SCENE_VS = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNorm; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol; layout(location=4) in float aTile;
  uniform mat4 uVP;
  out vec3 vW; out vec3 vN; out vec2 vUV; out vec4 vCol; flat out float vTile;
  void main(){ vW = aPos; vN = aNorm; vUV = aUV; vCol = aCol; vTile = aTile; gl_Position = uVP * vec4(aPos, 1.0); }`;
  const SCENE_FS = `#version 300 es
  precision highp float;
  in vec3 vW; in vec3 vN; in vec2 vUV; in vec4 vCol; flat in float vTile;
  uniform sampler2D uAtlas, uSprites, uLM;
  uniform vec2 uMapSize; uniform vec3 uCam, uCamDir, uHeldPos, uHeldCol; uniform float uHeldPow, uHeldK, uHeldCone, uAmb, uTime, uGain, uHi;
  out vec4 o;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec4 tex; bool spr = vTile < -0.5; float emit = 0.0; float alpha = 1.0;
    if (!spr) {
      vec2 f = clamp(fract(vUV), 0.002, 0.998);
      float t = vTile; vec2 tile = vec2(mod(t, 16.0), floor(t / 16.0));
      tex = texture(uAtlas, (tile + vec2(f.x, f.y)) / 16.0);
      emit = vCol.a;
    } else {
      vec2 uv = vUV;
      if (vN.x > 0.0) { float row = floor(uv.y * 512.0); if (mod(row + floor(uTime * 20.0), 7.0) < 1.0) uv.x += sin(row * 3.0 + uTime * 50.0) * vN.x * 0.004; }
      tex = texture(uSprites, uv);
      if (tex.a < 0.5) discard;
      alpha = vCol.a;
      if (alpha < 0.999) { float h = hash(floor(gl_FragCoord.xy) + floor(uTime * 24.0) * 7.13); if (h > alpha) discard; }
    }
    vec3 base = tex.rgb * vCol.rgb;
    vec3 n = normalize(vN + vec3(0.0001));
    vec3 lm = texture(uLM, (vW.xz + (spr ? vec2(0.0) : n.xz * 0.45)) / uMapSize).rgb * 4.0;
    float face = spr ? 1.0 : 0.72 + 0.28 * abs(n.y) + 0.12 * abs(n.x);
    vec3 L = lm * face + vec3(uAmb);
    if (vW.y > 2.68 && !spr) L += vec3(0.11, 0.12, 0.18) * (0.5 + 0.5 * max(n.y, 0.0)); // moonlight on roofs and upper facades
    vec3 d3 = vW - uHeldPos; float dist = length(d3); vec3 dir = d3 / max(dist, 0.001);
    float lamb = spr ? 0.9 : clamp(dot(n, -dir) * 0.65 + 0.35, 0.0, 1.0);
    float c = dot(dir, uCamDir);
    float cone = uHeldCone > 0.5 ? (smoothstep(0.82, 0.96, c) * 0.8 + smoothstep(0.55, 0.85, c) * 0.2) : 1.0;
    L += uHeldCol * uHeldPow * cone * lamb / (1.0 + uHeldK * dist * dist);
    if (vTile < -2.5) L = vec3(1.4); // fullbright sprite (UV prints, orbs)
    if (vTile > -2.5 && vTile < -1.5) { L *= vec3(0.62, 0.65, 0.78); if (tex.r > 0.78 && tex.g > 0.6) L = max(L, vec3(0.9)); } // ghosts: cold, glowing eyes
    vec3 col = base * L * uGain + base * emit * 1.6 + vec3(uHi);
    float fd = length(vW - uCam);
    col *= exp(-max(0.0, fd - 7.0) * 0.06);
    o = vec4(col, 1.0);
  }`;
  const SKY_VS = `#version 300 es
  layout(location=0) in vec2 aP; out vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
  const SKY_FS = `#version 300 es
  precision highp float; in vec2 vP; uniform mat4 uInvVP; uniform float uTime, uSkyK; out vec4 o;
  float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
  void main(){
    vec4 a = uInvVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(a.xyz / a.w - (uInvVP * vec4(vP, -1.0, 1.0)).xyz / (uInvVP * vec4(vP, -1.0, 1.0)).w);
    float h = clamp(d.y, -0.2, 1.0);
    vec3 col = mix(vec3(0.07,0.08,0.12), vec3(0.015,0.018,0.04), smoothstep(0.0, 0.6, h));
    vec3 q = floor(d * 220.0); float s = hash(q); if (s > 0.996 && d.y > 0.05) col += vec3(0.55) * (s - 0.996) * 250.0 * (0.6 + 0.4 * sin(uTime * 2.0 + s * 90.0));
    vec3 md = normalize(vec3(0.55, 0.42, -0.72)); float m = dot(d, md);
    if (m > 0.9985) { vec3 md2 = normalize(md + vec3(0.012, 0.006, 0.0)); col = dot(d, md2) > 0.9988 ? col : vec3(0.85, 0.85, 0.78); }
    col += vec3(0.08, 0.09, 0.12) * pow(max(m, 0.0), 40.0);
    float cl = sin(d.x * 9.0 + uTime * 0.03) * sin(d.z * 7.0 - uTime * 0.02); if (d.y > 0.0 && d.y < 0.35 && cl > 0.55) col *= 0.6;
    o = vec4(col * uSkyK, 1.0);
  }`;
  const POST_FS = `#version 300 es
  precision highp float; in vec2 vP; uniform sampler2D uScene, uOver; uniform vec2 uRes; uniform float uTime, uFear, uGlitch, uNV, uDead, uHide, uFlash, uBlack, uRed;
  out vec4 o;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  const float bay[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  void main(){
    vec2 px = floor(gl_FragCoord.xy); vec2 uv = (px + 0.5) / uRes;
    if (uGlitch > 0.0) { float band = floor(px.y / (1.0 + floor(hash(floor(uTime * 15.0)) * 4.0))); float r = hash(band * 1.7 + floor(uTime * 18.0)); if (r < uGlitch * 0.22) uv.x += (hash(band + uTime) - 0.5) * 0.14 * uGlitch; }
    vec3 c = texture(uScene, uv).rgb;
    vec4 ov = texture(uOver, vec2(uv.x, 1.0 - uv.y)); c = mix(c, ov.rgb, ov.a);
    if (uNV > 0.5) { float l = dot(c, vec3(0.3, 0.59, 0.11)); float g = min(1.0, l * 1.25 + hash(px.x * 13.1 + px.y * 7.7 + uTime) * 0.12); c = vec3(g * 0.4, g, g * 0.35); }
    if (uDead > 0.5) { float l = (c.r + c.g + c.b) / 3.0; c = vec3(l * 0.8, min(1.0, l * 1.1 + 0.04), min(1.0, l * 1.4 + 0.1)); }
    vec2 vv = (uv - 0.5) * 2.0; float vig = max(0.0, 1.0 - pow(sqrt(vv.x * vv.x * 0.8 + vv.y * vv.y * 0.9), 2.5) * 0.55);
    float k = max(0.0, 1.0 - (1.0 - vig) * (0.35 + uFear * 0.65) * 1.6);
    c *= k; c.r += uRed * (1.0 - vig) * 0.25;
    c += (hash(px.x * 1.31 + px.y * 17.7 + floor(uTime * 30.0)) - 0.5) * (0.03 + uFear * 0.07);
    if (uHide > 0.5) { float yy = mod(px.y, 18.0); bool slit = yy > 12.0 && uv.y > 0.25 && uv.y < 0.75 && uv.x > 0.3 && uv.x < 0.7; if (!slit) c *= 0.08; }
    c = mix(c, vec3(0.85, 0.85, 1.0), uFlash);
    c *= 1.0 - clamp(uBlack, 0.0, 1.0);
    float b = bay[int(mod(px.y, 4.0)) * 4 + int(mod(px.x, 4.0))] / 16.0 - 0.5;
    c = floor(clamp(c, 0.0, 1.0) * 7.0 + 0.5 + b) / 7.0;
    o = vec4(c, 1.0);
  }`;
  const P_SCENE = prog(SCENE_VS, SCENE_FS), P_SKY = prog(SKY_VS, SKY_FS), P_POST = prog(SKY_VS, POST_FS);

  // ---------------- textures ----------------
  function mkTex(w, h, data, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // extra material tiles
  (function extraTiles() {
    const R = GH.rng(909);
    const make = (id, fn) => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); fn(x, R); const d = x.getImageData(0, 0, 32, 32).data; GH.TEX[id] = { w: 32, h: 32, d: new Uint8ClampedArray(d) }; };
    const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
    const noisy = (x, base, amt) => { for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) { const v = base + (R() - 0.5) * amt; x.fillStyle = rgb(v, v, v); x.fillRect(i, y, 1, 1); } };
    make(50, (x) => noisy(x, 215, 40));
    make(51, (x) => { for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) { const v = 190 + Math.sin(y * 0.9 + Math.sin(i * 0.3) * 2) * 22 + (R() - 0.5) * 20; x.fillStyle = rgb(v, v, v); x.fillRect(i, y, 1, 1); } });
    make(52, (x) => { noisy(x, 225, 14); x.fillStyle = rgb(120, 120, 130); for (let y = 6; y < 30; y += 4) x.fillRect(4, y, 18 + (R() * 8 | 0), 1); });
    make(53, (x) => { for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const v = 0.8 + R() * 0.3; x.fillStyle = rgb(120 * v, 52 * v, 38 * v); x.fillRect(c * 8 + (r % 2) * 4, r * 4, 7, 3); x.fillStyle = rgb(60, 25, 20); x.fillRect(c * 8 + (r % 2) * 4, r * 4 + 3, 8, 1); } });
    make(54, (x) => { for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const v = 0.8 + R() * 0.3; x.fillStyle = rgb(62 * v, 66 * v, 76 * v); x.fillRect(c * 8 + (r % 2) * 4, r * 4, 7, 3); x.fillStyle = rgb(28, 30, 35); x.fillRect(c * 8 + (r % 2) * 4, r * 4 + 3, 8, 1); } });
    make(55, (x) => { noisy(x, 120, 30); for (let i = 0; i < 160; i++) { x.fillStyle = rgb(150 + R() * 50, 120 + R() * 40, 60); x.fillRect(R() * 32 | 0, R() * 32 | 0, 1, 3 + R() * 4 | 0); } x.fillStyle = rgb(70, 55, 30); for (let y = 7; y < 32; y += 8) x.fillRect(0, y, 32, 1); });
    make(56, (x) => { x.fillStyle = rgb(18, 26, 40); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 6; i++) { x.fillStyle = rgb(40, 55, 80); x.fillRect(R() * 28 | 0, R() * 28 | 0, 4, 1); } x.fillStyle = rgb(60, 45, 30); x.fillRect(15, 0, 2, 32); x.fillRect(0, 15, 32, 2); });
    make(57, (x) => { for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) { const v = 200 + ((i + y) % 4 < 2 ? 15 : -15) + (R() - 0.5) * 18; x.fillStyle = rgb(v, v, v); x.fillRect(i, y, 1, 1); } });
    make(58, (x) => { x.fillStyle = rgb(10, 22, 16); x.fillRect(0, 0, 32, 32); });
    make(59, (x) => { for (let y = 0; y < 32; y++) for (let i = 0; i < 32; i++) { const v = 185 + (R() - 0.5) * 16 + (i % 7 === 0 ? -20 : 0); x.fillStyle = rgb(v, v, v + 4); x.fillRect(i, y, 1, 1); } });
    make(60, (x) => { for (let i = 0; i < 32; i += 3) { x.fillStyle = rgb(60 + R() * 150, 30 + R() * 90, 30 + R() * 80); x.fillRect(i, 2 + (R() * 4 | 0), 3, 30); x.fillStyle = rgb(200, 180, 120); x.fillRect(i, 10, 3, 1); } });
    make(61, (x) => { x.fillStyle = rgb(26, 44, 24); x.fillRect(0, 0, 32, 32); for (let i = 0; i < 120; i++) { const g = 35 + R() * 35; x.fillStyle = rgb(g * .55, g, g * .45); x.fillRect(R() * 32 | 0, R() * 32 | 0, 1, 2); } });
  })();
  const atlasData = new Uint8Array(512 * 512 * 4);
  for (let id = 0; id < 64; id++) {
    const T = GH.TEX[id]; if (!T) continue;
    const ox = (id % 16) * 32, oy = Math.floor(id / 16) * 32;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const s = (y * 32 + x) * 4, d = ((oy + (31 - y)) * 512 + ox + x) * 4; // flip so v=0 is the bottom of the tile
      atlasData[d] = T.d[s]; atlasData[d + 1] = T.d[s + 1]; atlasData[d + 2] = T.d[s + 2]; atlasData[d + 3] = 255;
    }
  }
  const texAtlas = mkTex(512, 512, atlasData);
  // sprite atlas (shelf packing) — ghosts, trees, prints, orbs
  const SPRITES = {};
  const sprData = new Uint8Array(1024 * 1024 * 4);
  (function packSprites() {
    const names = Object.keys(GH.SPR).filter(n => /^g_|^tree$|^deadtree$|^hand$|^orb$|^note$|^photo$/.test(n));
    let x = 0, y = 0, rowH = 0;
    for (const n of names) {
      const T = GH.SPR[n];
      if (x + T.w > 1024) { x = 0; y += rowH + 2; rowH = 0; }
      for (let yy = 0; yy < T.h; yy++) for (let xx = 0; xx < T.w; xx++) { const s = (yy * T.w + xx) * 4, d = ((y + yy) * 1024 + x + xx) * 4; sprData[d] = T.d[s]; sprData[d + 1] = T.d[s + 1]; sprData[d + 2] = T.d[s + 2]; sprData[d + 3] = T.d[s + 3]; }
      SPRITES[n] = { u0: x / 1024, v0: y / 1024, u1: (x + T.w) / 1024, v1: (y + T.h) / 1024, w: T.w, h: T.h };
      x += T.w + 2; rowH = Math.max(rowH, T.h);
    }
  })();
  const texSprites = mkTex(1024, 1024, sprData);
  const lmTex = mkTex(1, 1, new Uint8Array(4), gl.LINEAR);
  let lmBuf = null;
  const overTex = mkTex(W, H, null);

  // render target
  const fbTex = mkTex(W, H, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
  const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // fullscreen quad
  const quadVAO = gl.createVertexArray(); gl.bindVertexArray(quadVAO);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // ---------------- mesh builder ----------------
  const FL = 13;
  function Mesh() { this.a = new Float32Array(FL * 4096); this.n = 0; this.vao = gl.createVertexArray(); this.buf = gl.createBuffer(); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); const S = FL * 4; [[0, 3, 0], [1, 3, 12], [2, 2, 24], [3, 4, 32], [4, 1, 48]].forEach(([l, sz, off]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, S, off); }); gl.bindVertexArray(null); }
  Mesh.prototype.v = function (x, y, z, nx, ny, nz, u, v, r, g, b, e, t) {
    if ((this.n + 1) * FL > this.a.length) { const na = new Float32Array(this.a.length * 2); na.set(this.a); this.a = na; }
    const a = this.a, i = this.n * FL; a[i] = x; a[i + 1] = y; a[i + 2] = z; a[i + 3] = nx; a[i + 4] = ny; a[i + 5] = nz; a[i + 6] = u; a[i + 7] = v; a[i + 8] = r; a[i + 9] = g; a[i + 10] = b; a[i + 11] = e; a[i + 12] = t; this.n++;
  };
  Mesh.prototype.upload = function (dyn) { gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.a.subarray(0, this.n * FL), dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); };
  Mesh.prototype.draw = function () { if (!this.n) return; gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, this.n); };
  // quad p0..p3 (counter-clockwise), uv per corner
  function quad(M, p, n, uv, c, e, t) {
    const idx = [0, 1, 2, 0, 2, 3];
    for (const k of idx) M.v(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uv[k][0], uv[k][1], c[0], c[1], c[2], e, t);
  }
  function tri(M, p, n, uv, c, e, t) { for (let k = 0; k < 3; k++) M.v(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uv[k][0], uv[k][1], c[0], c[1], c[2], e, t); }
  const add3 = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  // box at center c with basis (r,u,f) and half sizes
  function box(M, c, B, hx, hy, hz, col, tile, e, uvs) {
    const [r, u, f] = B; uvs = uvs === undefined ? 1 : uvs;
    const P = (sx, sy, sz) => [c[0] + r[0] * hx * sx + u[0] * hy * sy + f[0] * hz * sz, c[1] + r[1] * hx * sx + u[1] * hy * sy + f[1] * hz * sz, c[2] + r[2] * hx * sx + u[2] * hy * sy + f[2] * hz * sz];
    const F = (n, a, b, cc, d, w, h) => { const U = w * uvs || 1, V = h * uvs || 1; quad(M, [a, b, cc, d], n, [[0, 0], [U, 0], [U, V], [0, V]], col, e || 0, tile); };
    const neg = (v) => [-v[0], -v[1], -v[2]];
    F(f, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), hx * 2, hy * 2);
    F(neg(f), P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), hx * 2, hy * 2);
    F(r, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), hz * 2, hy * 2);
    F(neg(r), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), hz * 2, hy * 2);
    F(u, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), hx * 2, hz * 2);
    F(neg(u), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), hx * 2, hz * 2);
  }
  const UPV = [0, 1, 0];
  const basisF = (fx, fz) => { const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l; return [[fz, 0, -fx], UPV, [fx, 0, fz]]; };
  function rotB(B, axisIdx, ang) { // rotate the basis around one of its own axes
    const c = Math.cos(ang), s = Math.sin(ang);
    const [r, u, f] = B;
    if (axisIdx === 0) return [r, add3(add3([0, 0, 0], u, c), f, s), add3(add3([0, 0, 0], f, c), u, -s)];
    if (axisIdx === 1) return [add3(add3([0, 0, 0], r, c), f, -s), u, add3(add3([0, 0, 0], f, c), r, s)];
    return [add3(add3([0, 0, 0], r, c), u, s), add3(add3([0, 0, 0], u, c), r, -s), f];
  }
  // local-space model helper: add(x,y,z,w,h,d,col,tile,emit) with origin at the model's base, +z = front
  function modelAdder(M, origin, B, scale) {
    scale = scale || 1;
    return (x, y, z, w, h, d, col, tile, e, uvs) => {
      const c = [origin[0] + (B[0][0] * x + B[1][0] * (y + h / 2) + B[2][0] * z) * scale, origin[1] + (B[0][1] * x + B[1][1] * (y + h / 2) + B[2][1] * z) * scale, origin[2] + (B[0][2] * x + B[1][2] * (y + h / 2) + B[2][2] * z) * scale];
      box(M, c, B, w / 2 * scale, h / 2 * scale, d / 2 * scale, col, tile === undefined ? 50 : tile, e || 0, uvs === undefined ? 1 : uvs);
    };
  }
  G3.box = box; G3.basisF = basisF; G3.modelAdder = modelAdder;

  // ---------------- colours & tiles ----------------
  const C = {
    wood: [0.62, 0.43, 0.27], dark: [0.36, 0.24, 0.15], white: [0.86, 0.85, 0.8], cream: [0.85, 0.8, 0.68], metal: [0.62, 0.65, 0.68], steel: [0.5, 0.56, 0.6], black: [0.12, 0.12, 0.13], red: [0.62, 0.16, 0.14],
    blue: [0.25, 0.32, 0.55], green: [0.3, 0.45, 0.3], gold: [0.85, 0.68, 0.3], stone: [0.62, 0.6, 0.56], bone: [0.86, 0.82, 0.7], hay: [0.85, 0.7, 0.35], skin: [0.85, 0.7, 0.58], glass: [0.5, 0.65, 0.8]
  };
  const T = { plain: 50, wood: 51, paper: 52, fabric: 57, screen: 58, metal: 59, books: 60, hay: 35, stone: 34, crate: 12 };

  // ---------------- furniture models (1 m cell) ----------------
  const FURN = {
    bed(a) { a(0, 0, -0.1, 0.94, 0.32, 0.92, C.dark, T.wood); a(0, 0.32, -0.1, 0.86, 0.14, 0.86, C.white, T.fabric); a(0, 0.46, -0.42, 0.6, 0.1, 0.22, C.white, T.fabric); a(0, 0.46, 0.02, 0.88, 0.06, 0.6, C.red, T.fabric); a(0, 0, -0.52, 0.94, 0.95, 0.08, C.dark, T.wood); },
    hospbed(a) { for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.38], [0.42, 0.38]]) a(x, 0, z, 0.05, 0.5, 0.05, C.metal, T.metal); a(0, 0.5, -0.02, 0.9, 0.06, 0.88, C.metal, T.metal); a(0, 0.56, -0.02, 0.84, 0.12, 0.84, C.white, T.fabric); a(0, 0.68, -0.32, 0.5, 0.08, 0.18, C.white, T.fabric); a(0, 0.5, -0.46, 0.9, 0.55, 0.04, C.metal, T.metal); a(0.44, 0.62, 0, 0.03, 0.25, 0.6, C.metal, T.metal); },
    wardrobe(a) { a(0, 0, -0.18, 0.92, 2.0, 0.56, C.dark, T.wood); a(0, 0.1, 0.105, 0.02, 1.8, 0.01, [0.1, 0.07, 0.05], T.plain); a(-0.06, 1.0, 0.11, 0.03, 0.12, 0.02, C.gold, T.plain); a(0.06, 1.0, 0.11, 0.03, 0.12, 0.02, C.gold, T.plain); a(0, 2.0, -0.18, 0.98, 0.06, 0.6, C.dark, T.wood); },
    locker(a) { a(0, 0, -0.2, 0.84, 1.95, 0.5, [0.35, 0.45, 0.52], T.metal); for (let i = 0; i < 4; i++) a(-0.2, 1.55 + i * 0.07, 0.055, 0.25, 0.02, 0.01, C.black); for (let i = 0; i < 4; i++) a(0.2, 1.55 + i * 0.07, 0.055, 0.25, 0.02, 0.01, C.black); a(0, 0, 0.055, 0.02, 1.95, 0.01, C.black); a(-0.06, 1.0, 0.06, 0.03, 0.1, 0.02, C.metal); a(0.06, 1.0, 0.06, 0.03, 0.1, 0.02, C.metal); },
    table(a) { a(0, 0.72, 0, 0.92, 0.06, 0.82, C.wood, T.wood); for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]]) a(x, 0, z, 0.06, 0.72, 0.06, C.dark, T.wood); a(0.15, 0.78, 0.1, 0.08, 0.1, 0.08, C.white); a(-0.2, 0.78, -0.1, 0.25, 0.03, 0.18, C.cream, T.paper); },
    desk(a) { a(0, 0.72, -0.1, 0.92, 0.05, 0.6, C.wood, T.wood); a(-0.3, 0, -0.1, 0.3, 0.72, 0.58, C.dark, T.wood); a(0.42, 0, -0.1, 0.05, 0.72, 0.58, C.dark, T.wood); a(-0.3, 0.45, 0.2, 0.22, 0.03, 0.01, C.gold); a(0.15, 0.77, -0.2, 0.3, 0.22, 0.04, C.black); },
    chair(a) { a(0, 0.44, 0, 0.44, 0.05, 0.42, C.wood, T.wood); for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) a(x, 0, z, 0.05, 0.44, 0.05, C.dark, T.wood); a(0, 0.49, -0.19, 0.44, 0.5, 0.05, C.wood, T.wood); },
    shelf(a) { a(0, 0, -0.3, 0.94, 1.95, 0.36, C.dark, T.wood); for (let s = 0; s < 4; s++) a(0, 0.12 + s * 0.46, -0.1, 0.86, 0.36, 0.04, [1, 1, 1], T.books, 0, 1.2); },
    bathtub(a) { a(0, 0.08, 0, 0.92, 0.5, 0.9, C.white, T.plain); a(0, 0.58, 0, 0.8, 0.005, 0.78, [0.35, 0.3, 0.22], T.plain); for (const [x, z] of [[-0.4, -0.38], [0.4, -0.38], [-0.4, 0.38], [0.4, 0.38]]) a(x, 0, z, 0.08, 0.08, 0.08, C.gold); },
    toilet(a) { a(0, 0, 0, 0.36, 0.4, 0.5, C.white, T.plain); a(0, 0.4, 0.02, 0.4, 0.04, 0.5, C.white, T.plain); a(0, 0.4, -0.3, 0.4, 0.45, 0.18, C.white, T.plain); },
    crib(a) { a(0, 0.3, 0, 0.9, 0.08, 0.86, C.cream, T.fabric); for (let i = 0; i < 9; i++) { a(-0.42 + i * 0.105, 0.38, 0.42, 0.025, 0.55, 0.025, C.cream); a(-0.42 + i * 0.105, 0.38, -0.42, 0.025, 0.55, 0.025, C.cream); } a(0, 0.93, 0.42, 0.9, 0.04, 0.04, C.cream); a(0, 0.93, -0.42, 0.9, 0.04, 0.04, C.cream); for (const x of [-0.44, 0.44]) a(x, 0, 0, 0.05, 0.97, 0.9, C.cream, T.wood); },
    piano(a) { a(0, 0, -0.2, 0.94, 1.25, 0.5, C.black, T.wood); a(0, 0.72, 0.12, 0.94, 0.05, 0.22, C.black, T.wood); a(0, 0.77, 0.12, 0.86, 0.02, 0.18, C.white); for (let i = 0; i < 12; i++) a(-0.4 + i * 0.075, 0.79, 0.07, 0.02, 0.02, 0.1, C.black); },
    gurney(a) { a(0, 0.75, 0, 0.6, 0.05, 0.95, C.metal, T.metal); for (const [x, z] of [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]]) a(x, 0.05, z, 0.04, 0.7, 0.04, C.metal); a(0, 0.8, 0, 0.58, 0.08, 0.92, C.white, T.fabric); a(0, 0.88, -0.05, 0.32, 0.14, 0.62, C.white, T.fabric); a(0, 0.88, -0.36, 0.18, 0.16, 0.18, C.white, T.fabric); },
    morgue(a) { a(0, 0, -0.2, 0.96, 2.05, 0.6, [0.68, 0.7, 0.72], T.metal); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { a(-0.23 + c * 0.46, 0.15 + r * 0.65, 0.105, 0.4, 0.55, 0.01, [0.55, 0.57, 0.6], T.metal); a(-0.23 + c * 0.46, 0.38 + r * 0.65, 0.115, 0.12, 0.04, 0.03, C.black); } },
    hay(a) { a(0, 0, 0, 0.9, 0.62, 0.85, [1, 0.95, 0.9], T.hay, 0, 2); a(0, 0.2, 0.43, 0.9, 0.03, 0.01, [0.35, 0.25, 0.1]); },
    barrel(a) { a(0, 0, 0, 0.56, 0.9, 0.42, C.wood, T.wood); a(0, 0, 0, 0.42, 0.9, 0.56, C.wood, T.wood); a(0, 0.15, 0, 0.6, 0.05, 0.6, [0.3, 0.3, 0.32], T.metal); a(0, 0.7, 0, 0.6, 0.05, 0.6, [0.3, 0.3, 0.32], T.metal); },
    crate(a) { a(0, 0, 0, 0.78, 0.7, 0.78, [1, 1, 1], T.crate, 0, 1.3); a(0, 0.7, 0, 0.8, 0.03, 0.8, C.dark, T.wood); },
    chest(a) { a(0, 0, 0, 0.82, 0.45, 0.5, C.wood, T.wood); a(0, 0.45, 0, 0.84, 0.14, 0.52, C.dark, T.wood); a(0, 0.32, 0.26, 0.1, 0.12, 0.02, C.gold); a(-0.3, 0, 0, 0.05, 0.6, 0.53, [0.25, 0.25, 0.27], T.metal); a(0.3, 0, 0, 0.05, 0.6, 0.53, [0.25, 0.25, 0.27], T.metal); },
    equip(a) { a(0, 0, 0, 0.84, 0.5, 0.56, [0.32, 0.34, 0.3], T.metal); a(0, 0.5, 0, 0.86, 0.06, 0.58, [0.25, 0.27, 0.24], T.metal); a(0, 0.25, 0.285, 0.3, 0.12, 0.01, C.gold); a(0, 0.56, 0, 0.3, 0.03, 0.06, C.black); },
    grave(a) { a(0, 0, -0.1, 0.55, 0.85, 0.14, C.stone, T.stone, 0, 1.5); a(0, 0.85, -0.1, 0.4, 0.1, 0.14, C.stone, T.stone); a(0, 0, 0.25, 0.5, 0.12, 0.7, [0.35, 0.3, 0.22], T.plain); a(0, 0.55, -0.025, 0.06, 0.22, 0.01, [0.3, 0.3, 0.3]); a(0, 0.62, -0.025, 0.18, 0.05, 0.01, [0.3, 0.3, 0.3]); },
    well(a) { a(0, 0, -0.38, 0.9, 0.8, 0.14, C.stone, T.stone); a(0, 0, 0.38, 0.9, 0.8, 0.14, C.stone, T.stone); a(-0.38, 0, 0, 0.14, 0.8, 0.62, C.stone, T.stone); a(0.38, 0, 0, 0.14, 0.8, 0.62, C.stone, T.stone); a(0, 0.3, 0, 0.62, 0.02, 0.62, [0.05, 0.06, 0.08]); a(-0.42, 0.8, 0, 0.08, 1.1, 0.08, C.dark, T.wood); a(0.42, 0.8, 0, 0.08, 1.1, 0.08, C.dark, T.wood); a(0, 1.9, 0, 1.0, 0.08, 0.1, C.dark, T.wood); a(0, 1.95, 0, 1.1, 0.06, 0.9, [0.4, 0.3, 0.2], T.wood); },
    sarcophagus(a) { a(0, 0, 0, 0.9, 0.62, 0.95, C.stone, T.stone, 0, 1.5); a(0, 0.62, 0, 0.96, 0.1, 1.0, [0.7, 0.68, 0.62], T.stone); a(0, 0.72, 0.05, 0.08, 0.02, 0.5, [0.45, 0.44, 0.4]); a(0, 0.72, 0.15, 0.3, 0.02, 0.08, [0.45, 0.44, 0.4]); },
    coffin(a) { a(0, 0, 0, 0.55, 0.42, 0.95, C.dark, T.wood); a(0, 0.42, 0, 0.6, 0.06, 0.98, [0.3, 0.2, 0.12], T.wood); a(0, 0.48, 0.1, 0.05, 0.01, 0.3, C.gold); a(0, 0.48, 0.18, 0.18, 0.01, 0.05, C.gold); },
    pew(a) { a(0, 0.42, 0.05, 0.98, 0.06, 0.4, C.dark, T.wood); a(0, 0.42, -0.15, 0.98, 0.5, 0.05, C.dark, T.wood); a(-0.46, 0, 0, 0.05, 0.92, 0.45, C.dark, T.wood); a(0.46, 0, 0, 0.05, 0.92, 0.45, C.dark, T.wood); },
    altar(a) { a(0, 0, -0.1, 0.94, 0.9, 0.6, C.stone, T.stone, 0, 1.5); a(0, 0.9, -0.1, 0.98, 0.04, 0.64, C.white, T.fabric); a(0, 0.5, 0.205, 0.4, 0.4, 0.01, C.red, T.fabric); a(0, 0.94, -0.3, 0.05, 0.5, 0.05, C.gold); a(0, 1.24, -0.3, 0.28, 0.05, 0.05, C.gold); for (const x of [-0.38, 0.38]) { a(x, 0.94, -0.1, 0.05, 0.22, 0.05, C.cream); a(x, 1.16, -0.1, 0.03, 0.05, 0.03, [1, 0.7, 0.3], T.plain, 1.2); } },
    throne(a) { a(0, 0, 0, 0.8, 0.5, 0.7, C.dark, T.wood); a(0, 0.5, 0.05, 0.68, 0.08, 0.6, C.red, T.fabric); a(0, 0.5, -0.3, 0.8, 1.6, 0.12, C.dark, T.wood); a(0, 0.7, -0.23, 0.6, 1.2, 0.02, C.red, T.fabric); a(-0.35, 0.5, 0.05, 0.1, 0.35, 0.65, C.dark, T.wood); a(0.35, 0.5, 0.05, 0.1, 0.35, 0.65, C.dark, T.wood); for (const x of [-0.32, 0, 0.32]) a(x, 2.1, -0.3, 0.1, 0.14, 0.1, C.gold); },
    armor(a) { const m = [0.72, 0.74, 0.78]; a(0, 0, 0, 0.5, 0.06, 0.4, C.dark, T.wood); a(-0.09, 0.06, 0, 0.13, 0.8, 0.14, m, T.metal); a(0.09, 0.06, 0, 0.13, 0.8, 0.14, m, T.metal); a(0, 0.86, 0, 0.42, 0.6, 0.26, m, T.metal); a(-0.27, 0.9, 0, 0.12, 0.55, 0.12, m, T.metal); a(0.27, 0.9, 0, 0.12, 0.55, 0.12, m, T.metal); a(0, 1.46, 0, 0.24, 0.3, 0.26, m, T.metal); a(0, 1.58, 0.131, 0.16, 0.03, 0.01, C.black); a(0.35, 0, 0.05, 0.03, 2.2, 0.03, C.dark, T.wood); a(0.35, 2.2, 0.05, 0.06, 0.18, 0.02, m); },
    bonepile(a) { const R = GH.rng(77); for (let k = 0; k < 14; k++) a((R() - 0.5) * 0.7, R() * 0.12, (R() - 0.5) * 0.6, 0.06 + R() * 0.3, 0.04, 0.05, C.bone, T.plain); for (const [x, z] of [[-0.15, 0.05], [0.12, -0.1], [0.2, 0.18]]) { a(x, 0.12, z, 0.16, 0.15, 0.17, C.bone, T.plain); a(x - 0.035, 0.18, z + 0.086, 0.04, 0.04, 0.005, C.black); a(x + 0.035, 0.18, z + 0.086, 0.04, 0.04, 0.005, C.black); } },
    van(a) { const b = [0.22, 0.27, 0.33]; a(0, 0.35, -0.2, 1.0, 1.25, 2.0, b, T.metal); a(0, 0.35, 0.95, 1.0, 0.85, 0.7, b, T.metal); a(0, 0.8, 1.31, 0.86, 0.36, 0.01, [0.4, 0.5, 0.6], T.screen); for (const [x, z] of [[-0.5, -0.7], [0.5, -0.7], [-0.5, 0.9], [0.5, 0.9]]) a(x, 0, z, 0.12, 0.42, 0.42, C.black); a(-0.33, 0.55, 1.31, 0.14, 0.1, 0.01, [1, 0.95, 0.7], T.plain, 1.5); a(0.33, 0.55, 1.31, 0.14, 0.1, 0.01, [1, 0.95, 0.7], T.plain, 1.5); a(0, 0.9, -0.2, 1.01, 0.12, 1.4, [0.5, 0.12, 0.1], T.plain); },
    cart(a) { a(0, 0.5, 0, 1.0, 0.12, 1.8, C.wood, T.wood); a(-0.48, 0.62, 0, 0.05, 0.35, 1.8, C.dark, T.wood); a(0.48, 0.62, 0, 0.05, 0.35, 1.8, C.dark, T.wood); a(0, 0.62, -0.88, 1.0, 0.35, 0.05, C.dark, T.wood); a(0, 0.62, -0.2, 0.85, 0.35, 1.1, [1, 0.95, 0.9], T.hay, 0, 2); for (const [x, z] of [[-0.56, -0.5], [0.56, -0.5]]) a(x, 0, z, 0.08, 0.8, 0.8, C.dark, T.wood); a(-0.2, 0.55, 1.3, 0.06, 0.06, 1.0, C.dark, T.wood); a(0.2, 0.55, 1.3, 0.06, 0.06, 1.0, C.dark, T.wood); a(0.3, 1.0, 0.85, 0.14, 0.22, 0.14, [0.2, 0.2, 0.2], T.metal); a(0.3, 1.05, 0.85, 0.08, 0.12, 0.08, [1, 0.7, 0.3], T.plain, 1.4); },
    board(a) { a(0, 1.0, -0.47, 1.6, 1.0, 0.05, [0.55, 0.38, 0.22], T.plain); for (let i = 0; i < 7; i++) { const R = GH.rng(i * 31 + 5); a(-0.6 + R() * 1.2, 1.1 + R() * 0.7, -0.44, 0.18, 0.22, 0.01, C.cream, T.paper); a(-0.6 + R() * 1.2, 1.15 + R() * 0.65, -0.43, 0.03, 0.03, 0.01, C.red); } },
  };
  FURN.deadtree = null; FURN.tree = null;
  G3.FURN = FURN;

  // ---------------- item models (base at y=0, ~real size) ----------------
  const ITEM = {
    flashlight(a, s) { a(0, 0.02, 0, 0.05, 0.05, 0.22, C.black, T.metal); a(0, 0.015, 0.12, 0.07, 0.07, 0.05, [0.3, 0.3, 0.32], T.metal); a(0, 0.025, 0.146, 0.05, 0.05, 0.005, [1, 0.95, 0.8], T.plain, s.on ? 1.5 : 0); },
    torch(a, s) { a(0, 0, 0, 0.04, 0.4, 0.04, C.dark, T.wood); a(0, 0.36, 0, 0.065, 0.07, 0.065, [0.25, 0.2, 0.15], T.fabric); if (s.on) { const f = s.flick || 1; a(0, 0.43, 0, 0.055, 0.09 * f, 0.055, [1, 0.42, 0.08], T.plain, 1.1); a(0, 0.45, 0, 0.03, 0.08 * f, 0.03, [1, 0.75, 0.3], T.plain, 1.4); a(0.01, 0.52 * f, 0, 0.015, 0.05, 0.015, [1, 0.5, 0.1], T.plain, 1.0); } },
    emf(a, s) { a(0, 0, 0, 0.07, 0.16, 0.03, C.black, T.plain); a(0, 0.1, 0.016, 0.055, 0.04, 0.005, [0.05, 0.05, 0.05]); const cols = [[0.2, 0.9, 0.3], [0.6, 0.95, 0.2], [0.95, 0.9, 0.2], [1, 0.55, 0.15], [1, 0.15, 0.1]]; for (let i = 0; i < 5; i++) a(-0.024 + i * 0.012, 0.06, 0.016, 0.008, 0.012, 0.005, cols[i], T.plain, s.on && i < (s.level || 1) ? 2 : 0.05); },
    thermo(a, s) { a(0, 0, 0, 0.06, 0.15, 0.03, C.white, T.plain); a(0, 0.08, 0.016, 0.045, 0.035, 0.005, [0.1, 0.25, 0.18], T.screen, 0.6); a(0, -0.06, 0, 0.012, 0.08, 0.012, C.metal); },
    spiritbox(a, s) { a(0, 0, 0, 0.09, 0.12, 0.035, [0.55, 0.14, 0.12], T.plain); a(0, 0.07, 0.018, 0.07, 0.03, 0.005, C.black, T.screen, s.on ? 0.3 : 0); a(0.035, 0.12, 0, 0.006, 0.1, 0.006, C.metal); for (let i = 0; i < 3; i++) a(-0.02 + i * 0.02, 0.025, 0.018, 0.012, 0.012, 0.005, C.white); },
    notebook(a, s) { a(0, 0, 0, 0.16, 0.015, 0.21, C.blue, T.fabric); a(0, 0.015, 0, 0.15, 0.006, 0.2, C.white, T.paper); if (s.written) for (let i = 0; i < 5; i++) a(-0.04 + i * 0.02, 0.02, -0.04 + (i % 2) * 0.05, 0.05, 0.002, 0.012, [0.6, 0.05, 0.05], T.plain, 0.3); },
    quill(a, s) { a(0, 0, 0, 0.18, 0.006, 0.22, C.cream, T.paper); a(0.06, 0.01, 0.02, 0.012, 0.012, 0.18, C.white); if (s.written) for (let i = 0; i < 5; i++) a(-0.05 + i * 0.02, 0.008, -0.04 + (i % 2) * 0.05, 0.05, 0.002, 0.012, [0.6, 0.05, 0.05], T.plain, 0.3); },
    uv(a, s) { a(0, 0.02, 0, 0.05, 0.05, 0.2, C.black, T.metal); a(0, 0.015, 0.11, 0.065, 0.065, 0.04, [0.3, 0.15, 0.45], T.metal); a(0, 0.025, 0.131, 0.045, 0.045, 0.005, [0.6, 0.3, 1], T.plain, s.on ? 2 : 0.1); },
    camera(a, s) { a(0, 0, 0, 0.14, 0.09, 0.07, C.black, T.metal); a(0, 0.045, 0.05, 0.05, 0.05, 0.04, [0.2, 0.2, 0.22], T.metal); a(0, 0.045, 0.071, 0.035, 0.035, 0.002, C.glass, T.plain, 0.2); a(0.055, 0.075, 0.036, 0.012, 0.012, 0.003, [1, 0.1, 0.1], T.plain, 1.5); },
    motion(a, s) { a(0, 0, 0, 0.1, 0.1, 0.05, C.white, T.plain); a(0, 0.05, 0.026, 0.05, 0.05, 0.005, C.black); a(0, 0.05, 0.03, 0.02, 0.02, 0.005, [1, 0.15, 0.15], T.plain, s.on ? 2.2 : 0.2); },
    crucifix(a) { a(0, 0, 0, 0.025, 0.2, 0.02, C.gold, T.plain, 0.1); a(0, 0.12, 0, 0.12, 0.025, 0.02, C.gold, T.plain, 0.1); },
    salt(a) { a(0, 0, 0, 0.07, 0.15, 0.07, C.white, T.plain); a(0, 0.05, 0, 0.072, 0.06, 0.072, C.blue); a(0, 0.15, 0, 0.05, 0.02, 0.05, C.metal); },
    smudge(a) { a(0, 0, 0, 0.04, 0.17, 0.04, [0.5, 0.6, 0.4], T.fabric); a(0, 0.05, 0, 0.045, 0.02, 0.045, C.dark); },
    lighter(a, s) { a(0, 0, 0, 0.035, 0.07, 0.015, C.red, T.plain); a(0, 0.07, 0, 0.035, 0.015, 0.015, C.metal); if (s.on) a(0, 0.085, 0, 0.012, 0.03, 0.012, [1, 0.7, 0.25], T.plain, 2); },
    candle(a, s) { a(0, 0, 0, 0.09, 0.015, 0.09, C.gold); a(0, 0.015, 0, 0.035, 0.12, 0.035, C.cream, T.plain); const blue = s.blue, w = s.wild ? (Math.random() - 0.5) * 0.02 : 0; a(w, 0.14, 0, 0.018, s.wild ? 0.05 : 0.035, 0.018, blue ? [0.3, 0.55, 1] : [1, 0.62, 0.2], T.plain, 2.2); a(w, 0.145, 0, 0.008, 0.02, 0.008, blue ? [0.8, 0.9, 1] : [1, 0.95, 0.7], T.plain, 2.5); },
    bowl(a, s) { a(0, 0, 0, 0.18, 0.06, 0.18, C.wood, T.wood); a(0, 0.055, 0, 0.15, 0.008, 0.15, s.frozen ? [0.85, 0.92, 1] : [0.2, 0.35, 0.55], T.plain, s.frozen ? 0.25 : 0.05); },
    bell(a) { a(0, 0.12, 0, 0.02, 0.07, 0.02, C.dark, T.wood); a(0, 0.04, 0, 0.06, 0.08, 0.06, C.gold, T.plain, 0.05); a(0, 0, 0, 0.09, 0.04, 0.09, C.gold, T.plain, 0.05); },
    ash(a) { a(0, 0, 0, 0.1, 0.1, 0.08, [0.45, 0.35, 0.25], T.fabric); a(0, 0.1, 0, 0.05, 0.03, 0.05, [0.35, 0.25, 0.15], T.fabric); },
    mirror(a) { a(0, 0.07, 0, 0.11, 0.15, 0.012, C.gold, T.plain); a(0, 0.075, 0.007, 0.09, 0.13, 0.003, C.glass, T.plain, 0.25); a(0, 0, 0, 0.025, 0.07, 0.02, C.dark, T.wood); },
    thread(a, s) { a(0, 0, 0, 0.07, 0.06, 0.07, C.cream, T.fabric); a(0, 0.03, 0, 0.03, 0.065, 0.03, C.dark); a(0.06, 0.02, 0, 0.025, 0.025, 0.025, C.gold, T.plain, s.on ? 1.5 : 0.05); },
    bible(a) { a(0, 0, 0, 0.13, 0.04, 0.18, [0.15, 0.1, 0.08], T.fabric); a(0, 0.041, 0, 0.015, 0.002, 0.08, C.gold); a(0, 0.041, 0.015, 0.06, 0.002, 0.015, C.gold); },
    holywater(a) { a(0, 0, 0, 0.07, 0.1, 0.07, [0.5, 0.7, 0.9], T.plain, 0.2); a(0, 0.1, 0, 0.03, 0.04, 0.03, [0.6, 0.75, 0.9], T.plain, 0.2); a(0, 0.14, 0, 0.035, 0.015, 0.035, C.dark); a(0, 0.04, 0.036, 0.008, 0.04, 0.002, C.white); a(0, 0.055, 0.036, 0.025, 0.008, 0.002, C.white); },
    // clues, throwables, evidence
    note(a) { a(0, 0, 0, 0.21, 0.004, 0.28, C.cream, T.paper); },
    photo(a) { a(0, 0, 0, 0.13, 0.004, 0.1, C.white); a(0, 0.004, 0, 0.11, 0.002, 0.08, [0.25, 0.22, 0.2], T.plain); },
    toy(a) { a(0, 0, 0, 0.14, 0.14, 0.1, [0.55, 0.38, 0.25], T.fabric); a(0, 0.14, 0, 0.11, 0.1, 0.09, [0.55, 0.38, 0.25], T.fabric); a(-0.04, 0.24, 0, 0.035, 0.035, 0.03, [0.55, 0.38, 0.25], T.fabric); a(0.04, 0.24, 0, 0.035, 0.035, 0.03, [0.55, 0.38, 0.25], T.fabric); a(-0.02, 0.18, 0.046, 0.015, 0.015, 0.002, C.black); a(0.02, 0.18, 0.046, 0.015, 0.015, 0.002, C.black); },
    book(a) { a(0, 0, 0, 0.15, 0.04, 0.2, C.red, T.fabric); a(0.005, 0.005, 0, 0.14, 0.03, 0.19, C.cream, T.paper); },
    cup(a) { a(0, 0, 0, 0.07, 0.09, 0.07, C.white); a(0.045, 0.03, 0, 0.02, 0.04, 0.012, C.white); },
    ball(a) { a(0, 0, 0, 0.13, 0.13, 0.13, C.red, T.plain); a(0, 0.05, 0, 0.135, 0.025, 0.135, C.gold); },
    bones(a) { FURN.bonepile(a); },
    ashbones(a) { a(0, 0, 0, 0.7, 0.06, 0.55, [0.12, 0.11, 0.1], T.plain); for (let k = 0; k < 6; k++) a((k - 3) * 0.1, 0.06, (k % 2) * 0.1, 0.06, 0.03, 0.06, [1, 0.4, 0.1], T.plain, 1.2); },
    salt_pile(a, s) { a(0, 0, 0, 0.3, 0.04, 0.25, C.white, T.plain); a(0, 0.04, 0, 0.18, 0.04, 0.15, C.white, T.plain); if (s.prints) { a(-0.06, 0.081, 0, 0.05, 0.002, 0.1, [0.2, 0.2, 0.2]); a(0.06, 0.081, 0.05, 0.05, 0.002, 0.1, [0.2, 0.2, 0.2]); } },
    ash_pile(a, s) { a(0, 0, 0, 0.34, 0.03, 0.28, [0.4, 0.39, 0.37], T.plain); if (s.prints) { a(-0.07, 0.031, 0, 0.06, 0.002, 0.12, C.black); a(0.07, 0.031, 0.05, 0.06, 0.002, 0.12, C.black); } },
  };
  G3.ITEM = ITEM;

  // ---------------- player figure ----------------
  function figure(M, x, z, yaw, slot, era, phase, opts) {
    opts = opts || {};
    const col = GH.PLAYER_COLORS[slot].map(v => v / 255);
    const body = era === 'modern' ? col.map(v => v * 0.75) : col.map(v => v * 0.55);
    let B = basisF(Math.cos(yaw), Math.sin(yaw));
    let base = [x, 0, z];
    if (opts.lying) { B = [B[0], B[2].map(v => -v), B[1]]; base = [x, 0.12, z]; }
    const a = modelAdder(M, base, B, 1);
    const sw = Math.sin(phase) * 0.45;
    const legB = (side) => rotB(B, 0, side * sw);
    const limb = (ox, oy, oz, w, h, d, c, t, ang) => { const LB = rotB(B, 0, ang); const pivot = [base[0] + B[0][0] * ox + B[1][0] * oy + B[2][0] * oz, base[1] + B[0][1] * ox + B[1][1] * oy + B[2][1] * oz, base[2] + B[0][2] * ox + B[1][2] * oy + B[2][2] * oz]; const cc = [pivot[0] - LB[1][0] * h / 2, pivot[1] - LB[1][1] * h / 2, pivot[2] - LB[1][2] * h / 2]; box(M, cc, LB, w / 2, h / 2, d / 2, c, t, opts.emit || 0, 1); };
    const pants = era === 'modern' ? [0.18, 0.2, 0.26] : [0.25, 0.2, 0.15];
    limb(-0.1, 0.85, 0, 0.15, 0.85, 0.17, pants, T.fabric, sw);
    limb(0.1, 0.85, 0, 0.15, 0.85, 0.17, pants, T.fabric, -sw);
    a(0, 0.85, 0, 0.42, 0.62, 0.24, body, T.fabric);
    a(0, 1.4, 0, 0.44, 0.06, 0.25, col, T.fabric);
    limb(-0.29, 1.45, 0, 0.13, 0.6, 0.14, body, T.fabric, -sw * 0.8);
    limb(0.29, 1.45, 0, 0.13, 0.6, 0.14, body, T.fabric, opts.light ? -1.1 : sw * 0.8);
    a(0, 1.47, 0, 0.26, 0.28, 0.26, C.skin, T.plain);
    a(-0.06, 1.6, 0.131, 0.04, 0.03, 0.005, C.black); a(0.06, 1.6, 0.131, 0.04, 0.03, 0.005, C.black);
    if (era === 'modern') a(0, 1.72, -0.02, 0.28, 0.07, 0.3, [0.2, 0.15, 0.1], T.fabric);
    else { a(0, 1.72, -0.02, 0.32, 0.1, 0.32, body, T.fabric); a(0, 1.45, -0.15, 0.32, 0.32, 0.06, body, T.fabric); }
    if (opts.light) { const lp = [base[0] + B[0][0] * 0.3 + B[2][0] * 0.45, 1.25, base[2] + B[0][2] * 0.3 + B[2][2] * 0.45]; box(M, lp, B, 0.03, 0.03, 0.08, era === 'modern' ? C.black : C.dark, T.metal, 0, 1); box(M, add3(lp, B[2], 0.09), B, 0.035, 0.035, 0.01, era === 'modern' ? [1, 0.95, 0.8] : [1, 0.6, 0.2], T.plain, 2, 1); }
    if (opts.blood) a(0, -0.1, 0, 0.9, 0.01, 1.2, [0.35, 0.02, 0.02], T.plain);
  }
  G3.figure = figure;

  // ---------------- static world geometry ----------------
  const STAT = new Mesh(), DYN = new Mesh(), VM = new Mesh();
  let built = null, builtVer = 0;
  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  G3.build = function (map) {
    const M = STAT; M.n = 0;
    const w = map.w, h = map.h, cells = map.cells, I = (x, y) => y * w + x;
    const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || cells[I(x, y)] > 0;
    const outd = (x, y) => x >= 0 && y >= 0 && x < w && y < h && map.outdoor[I(x, y)] && cells[I(x, y)] === 0;
    const white = [1, 1, 1];
    const edgeTall = (x, y) => x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1;
    const bk = {};
    for (const b of map.buildings || []) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) bk[I(x, y)] = b;
    const wallTop = (x, y, fromOutside) => {
      const i = I(x, y), t = cells[i];
      if (edgeTall(x, y)) return map.loc === 'castle' ? 4.6 : (t === 15 || t === 16) ? (t === 16 ? 1.4 : 4.2) : WALLH;
      if (!fromOutside) return WALLH;
      const b = bk[i];
      if (b && b.kind === 'keep') return WALLH + 1.6;
      if (b && b.kind === 'tower') return WALLH + 3.2;
      if (b && b.kind === 'hill') return WALLH + 0.05;
      return WALLH + 0.15;
    };
    // floors & ceilings
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = I(x, y); if (cells[i] > 0) continue;
      const ft = map.floor[i] || 36;
      quad(M, [[x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y]], [0, 1, 0], [[x, -y - 1], [x + 1, -y - 1], [x + 1, -y], [x, -y]], white, 0, ft);
      if (!map.outdoor[i] || map.doorAt[i] >= 0) { const ct = map.ceil[i] || 40; quad(M, [[x, WALLH, y], [x + 1, WALLH, y], [x + 1, WALLH, y + 1], [x, WALLH, y + 1]], [0, -1, 0], [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], white, 0, ct); }
    }
    // walls: one face wherever a walkable cell meets a wall cell
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = I(x, y); if (cells[i] > 0) continue;
      const fromOut = !!map.outdoor[i] && map.doorAt[i] < 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy; if (!isWall(nx, ny)) continue;
        const tex = nx < 0 || ny < 0 || nx >= w || ny >= h ? 15 : cells[I(nx, ny)];
        const top = nx < 0 || ny < 0 || nx >= w || ny >= h ? 4 : wallTop(nx, ny, fromOut);
        // face on boundary between (x,y) and (nx,ny)
        let p0, p1, n;
        if (dx === 1) { p0 = [x + 1, y + 1]; p1 = [x + 1, y]; n = [-1, 0, 0]; }
        else if (dx === -1) { p0 = [x, y]; p1 = [x, y + 1]; n = [1, 0, 0]; }
        else if (dy === 1) { p0 = [x, y + 1]; p1 = [x + 1, y + 1]; n = [0, 0, -1]; }
        else { p0 = [x + 1, y]; p1 = [x, y]; n = [0, 0, 1]; }
        const vS = tex === 15 || tex === 16 ? 1 / top : 1 / 1.35;
        quad(M, [[p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]]], n, [[0, 0], [1, 0], [1, top * vS], [0, top * vS]], white, 0, tex);
        // skirting board inside, stone plinth outside
        const off = 0.02, ox = n[0] * off, oz = n[2] * off;
        if (!fromOut && !(map.outdoor[i])) quad(M, [[p0[0] + ox, 0, p0[1] + oz], [p1[0] + ox, 0, p1[1] + oz], [p1[0] + ox, 0.12, p1[1] + oz], [p0[0] + ox, 0.12, p0[1] + oz]], n, [[0, 0], [1, 0], [1, 0.12], [0, 0.12]], [0.45, 0.32, 0.22], 0, T.wood);
        if (fromOut && bk[I(nx, ny)] && bk[I(nx, ny)].kind !== 'hill') {
          quad(M, [[p0[0] + ox, 0, p0[1] + oz], [p1[0] + ox, 0, p1[1] + oz], [p1[0] + ox, 0.4, p1[1] + oz], [p0[0] + ox, 0.4, p0[1] + oz]], n, [[0, 0], [1, 0], [1, 0.4], [0, 0.4]], [0.55, 0.53, 0.5], 0, 34);
          quad(M, [[p0[0] + ox, top - 0.15, p0[1] + oz], [p1[0] + ox, top - 0.15, p1[1] + oz], [p1[0] + ox, top, p1[1] + oz], [p0[0] + ox, top, p0[1] + oz]], n, [[0, 0], [1, 0], [1, 0.15], [0, 0.15]], [0.5, 0.48, 0.45], 0, 34);
        }
        // windows in exterior walls (seen from both sides)
        const across = [nx + dx, ny + dy];
        const thin = !isWall(across[0], across[1]);
        const isExt = thin && (outd(x, y) !== outd(across[0], across[1]));
        const sideWalls = dx !== 0 ? isWall(nx, ny - 1) && isWall(nx, ny + 1) : isWall(nx - 1, ny) && isWall(nx + 1, ny);
        const b = bk[I(nx, ny)];
        if (isExt && sideWalls && b && b.kind !== 'hill' && map.doorAt[I(nx, ny)] < 0 && hash2(nx, ny) < (b.kind === 'keep' ? 0.22 : 0.4)) {
          const lit = hash2(ny, nx) < 0.07 && fromOut;
          const mid = [(p0[0] + p1[0]) / 2 + n[0] * 0.03, (p0[1] + p1[1]) / 2 + n[2] * 0.03];
          const tdir = [p1[0] - p0[0], p1[1] - p0[1]];
          const hw = b.kind === 'keep' ? 0.18 : 0.32, y0 = b.kind === 'keep' ? 1.3 : 0.95, y1 = b.kind === 'keep' ? 2.3 : 2.1;
          const A = [mid[0] - tdir[0] * hw, mid[1] - tdir[1] * hw], Bp = [mid[0] + tdir[0] * hw, mid[1] + tdir[1] * hw];
          quad(M, [[A[0], y0, A[1]], [Bp[0], y0, Bp[1]], [Bp[0], y1, Bp[1]], [A[0], y1, A[1]]], n, [[0, 0], [1, 0], [1, 1], [0, 1]], lit ? [1.6, 1.2, 0.6] : [1, 1, 1], lit ? 0.9 : (fromOut ? 0.05 : 0.35), 56);
          const fb = basisF(n[0], n[2]);
          const fc = map.era === 'medieval' ? C.dark : [0.85, 0.83, 0.78];
          box(M, [mid[0], y0 - 0.04, mid[1]], fb, hw + 0.06, 0.04, 0.05, fc, T.wood, 0, 1);
          box(M, [mid[0], y1 + 0.03, mid[1]], fb, hw + 0.06, 0.03, 0.04, fc, T.wood, 0, 1);
          box(M, [A[0], (y0 + y1) / 2, A[1]], fb, 0.03, (y1 - y0) / 2, 0.04, fc, T.wood, 0, 1);
          box(M, [Bp[0], (y0 + y1) / 2, Bp[1]], fb, 0.03, (y1 - y0) / 2, 0.04, fc, T.wood, 0, 1);
          if (fromOut && (map.era === 'medieval' || b.kind === 'house') && b.kind !== 'keep') { // shutters
            const sc = map.era === 'medieval' ? [0.4, 0.28, 0.18] : [0.25, 0.35, 0.3];
            box(M, [A[0] - tdir[0] * 0.2 + n[0] * 0.02, (y0 + y1) / 2, A[1] - tdir[1] * 0.2 + n[2] * 0.02], fb, 0.17, (y1 - y0) / 2, 0.02, sc, T.wood, 0, 1);
            if (hash2(nx * 3, ny) < 0.7) box(M, [Bp[0] + tdir[0] * 0.2 + n[0] * 0.02, (y0 + y1) / 2, Bp[1] + tdir[1] * 0.2 + n[2] * 0.02], fb, 0.17, (y1 - y0) / 2, 0.02, sc, T.wood, 0, 1);
          }
        }
      }
    }
    // door lintels and frames
    for (const d of map.doors) {
      if (d.dead) continue;
      const cx = d.x + 0.5, cz = d.y + 0.5;
      const fb = d.axis === 'h' ? basisF(0, 1) : basisF(1, 0);
      const nb = d.axis === 'h' ? [d.x - 1, d.y] : [d.x, d.y - 1];
      const wt = cells[I(nb[0], nb[1])] || 2;
      box(M, [cx, (2.12 + WALLH) / 2, cz], fb, 0.5, (WALLH - 2.12) / 2, 0.5, white, wt, 0, 1);
      const fc = map.era === 'medieval' ? C.dark : [0.6, 0.58, 0.54];
      box(M, [cx, 2.14, cz], fb, 0.56, 0.05, 0.53, fc, T.wood, 0, 1);
      for (const s of [-1, 1]) box(M, [cx + fb[0][0] * 0.5 * s, 1.07, cz + fb[0][2] * 0.5 * s], fb, 0.06, 1.07, 0.53, fc, T.wood, 0, 1);
      // exterior wall above the front door
      const out1 = d.axis === 'h' ? outd(d.x, d.y + 1) || outd(d.x, d.y - 1) : outd(d.x + 1, d.y) || outd(d.x - 1, d.y);
      if (out1) { const tb = wallTop(nb[0], nb[1], true); if (tb > WALLH) box(M, [cx, (WALLH + tb) / 2, cz], fb, 0.5, (tb - WALLH) / 2, 0.5, white, wt, 0, 1); }
    }
    // roofs
    for (const b of map.buildings || []) buildRoof(M, map, b);
    // castle battlements on the curtain wall
    if (map.loc === 'castle') { for (let x = 0; x < w; x += 2) for (const y of [0, h - 1]) box(M, [x + 0.5, 4.85, y + 0.5], basisF(0, 1), 0.5, 0.25, 0.5, white, 14, 0, 1); for (let y = 0; y < h; y += 2) for (const x of [0, w - 1]) box(M, [x + 0.5, 4.85, y + 0.5], basisF(0, 1), 0.5, 0.25, 0.5, white, 14, 0, 1); }
    // trees as crossed sprites, other furniture as voxel models
    for (const o of map.objects) {
      if (o.kind === 'furn' && (o.spr === 'tree' || o.spr === 'deadtree')) { crossSprite(M, o.x, o.y, o.spr, o.spr === 'tree' ? 4.2 : 3.8); continue; }
      if (o.kind === 'furn' || o.kind === 'van' || o.kind === 'equip' || o.kind === 'board') {
        if (o.hide) continue; // hiding places are drawn dynamically (they can glow)
        drawFurn(M, map, o, 0);
      }
    }
    M.upload(false);
    built = map; G3.modsN = (map._modsN || 0);
  };
  function furnBasis(map, o) {
    const w = map.w, cx = Math.floor(o.x), cy = Math.floor(o.y), i = cy * w + cx;
    if (o.kind === 'van') return basisF(0, 1);
    const fx = o.x - cx, fy = o.y - cy;
    let f = [0, 1];
    if (fx < 0.45) f = [1, 0]; else if (fx > 0.55) f = [-1, 0]; else if (fy < 0.45) f = [0, 1]; else if (fy > 0.55) f = [0, -1];
    else { for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (map.cells[i + dy * w + dx] > 0) { f = [-dx, -dy]; break; } }
    return basisF(f[0], f[1]);
  }
  function drawFurn(M, map, o, emit) {
    const fn = FURN[o.spr]; if (!fn) return;
    const B = furnBasis(map, o);
    const base = [Math.floor(o.x) + 0.5, 0, Math.floor(o.y) + 0.5];
    if (o.kind === 'van') { base[0] = o.x; base[2] = o.y; }
    const a = modelAdder(M, base, B, 1);
    fn(emit ? (x, y, z, ww, hh, d, col, t, e, u) => a(x, y, z, ww * 1.02, hh * 1.01, d * 1.02, col, t, (e || 0) + emit, u) : a);
  }
  function crossSprite(M, x, z, name, hgt) {
    const S = SPRITES[name]; if (!S) return;
    const wd = hgt * S.w / S.h;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const p = [[x - dx * wd / 2, 0, z - dz * wd / 2], [x + dx * wd / 2, 0, z + dz * wd / 2], [x + dx * wd / 2, hgt, z + dz * wd / 2], [x - dx * wd / 2, hgt, z - dz * wd / 2]];
      quad(M, p, [0, 0, 0], [[S.u0, S.v1], [S.u1, S.v1], [S.u1, S.v0], [S.u0, S.v0]], [1, 1, 1], 1, -1);
    }
  }
  function buildRoof(M, map, b) {
    const white = [1, 1, 1];
    const med = map.era === 'medieval';
    const x0 = b.x, x1 = b.x + b.w, z0 = b.y, z1 = b.y + b.h;
    if (b.kind === 'hill') {
      // grassy mound over the catacombs, with a stone entrance facade
      const peak = [(x0 + x1) / 2, WALLH + 2.6, (z0 + z1) / 2 - 2];
      const e = WALLH + 0.05;
      const corners = [[x0, e, z1], [x1, e, z1], [x1, e, z0], [x0, e, z0]];
      for (let k = 0; k < 4; k++) { const a = corners[k], c = corners[(k + 1) % 4]; tri(M, [a, c, peak], [0, 1, 0], [[a[0] * 0.5, a[2] * 0.5], [c[0] * 0.5, c[2] * 0.5], [peak[0] * 0.5, peak[2] * 0.5]], [0.8, 0.85, 0.8], 0, 61); }
      const fd = map.doors[map.frontDoor];
      if (fd) {
        const fb = basisF(0, 1), cx = fd.x + 0.5, cz = fd.y + 1.02;
        for (const s of [-1, 1]) box(M, [cx + s * 1.0, 1.35, cz], fb, 0.18, 1.35, 0.18, [0.75, 0.73, 0.68], 34, 0, 1);
        box(M, [cx, 2.8, cz], fb, 1.35, 0.12, 0.25, [0.75, 0.73, 0.68], 34, 0, 1);
        tri(M, [[cx - 1.35, 2.92, cz + 0.2], [cx + 1.35, 2.92, cz + 0.2], [cx, 3.7, cz + 0.2]], [0, 0, 1], [[0, 0], [2.7, 0], [1.35, 0.8]], [0.75, 0.73, 0.68], 0, 34);
        box(M, [cx, 3.85, cz + 0.1], fb, 0.04, 0.2, 0.04, C.dark, T.metal, 0, 1); box(M, [cx, 3.9, cz + 0.1], fb, 0.13, 0.035, 0.04, C.dark, T.metal, 0, 1);
      }
      return;
    }
    if (b.kind === 'keep') {
      const top = WALLH + 1.6;
      quad(M, [[x0, top - 0.3, z0], [x1, top - 0.3, z0], [x1, top - 0.3, z1], [x0, top - 0.3, z1]], [0, 1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], white, 0, 34);
      for (let x = x0; x < x1; x += 2) for (const z of [z0, z1 - 1]) box(M, [x + 0.5, top + 0.3, z + 0.5], basisF(0, 1), 0.5, 0.3, 0.5, white, 14, 0, 1);
      for (let z = z0; z < z1; z += 2) for (const x of [x0, x1 - 1]) box(M, [x + 0.5, top + 0.3, z + 0.5], basisF(0, 1), 0.5, 0.3, 0.5, white, 14, 0, 1);
      // a flag on the keep
      box(M, [x0 + 2, top + 2, z0 + 2], basisF(0, 1), 0.04, 2, 0.04, C.dark, T.wood, 0, 1);
      box(M, [x0 + 2.5, top + 3.5, z0 + 2], basisF(0, 1), 0.5, 0.3, 0.02, C.red, T.fabric, 0, 1);
      return;
    }
    if (b.kind === 'tower') {
      const top = WALLH + 3.2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (let x = x0; x < x1; x += 2) for (const z of [z0, z1 - 1]) box(M, [x + 0.5, top + 0.3, z + 0.5], basisF(0, 1), 0.5, 0.3, 0.5, white, 14, 0, 1);
      pyramid(M, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, top + 0.6, top + 4.5, 54);
      return;
    }
    // gable roofs
    const tile = b.kind === 'barn' ? (med ? 55 : 54) : b.kind === 'church' || b.kind === 'mausoleum' || b.kind === 'big' ? 54 : (med ? 55 : 53);
    const eave = WALLH + 0.15, ov = 0.45;
    const alongX = b.w >= b.h;
    const span = alongX ? b.h : b.w;
    const rise = Math.min(span * (b.kind === 'church' ? 0.6 : b.kind === 'big' ? 0.28 : 0.45), b.kind === 'big' ? 3.5 : 5.5);
    if (alongX) {
      const zm = (z0 + z1) / 2, ry = eave + rise;
      const s1 = [[x0 - ov, eave - 0.2, z0 - ov], [x1 + ov, eave - 0.2, z0 - ov], [x1 + ov, ry, zm], [x0 - ov, ry, zm]];
      const s2 = [[x1 + ov, eave - 0.2, z1 + ov], [x0 - ov, eave - 0.2, z1 + ov], [x0 - ov, ry, zm], [x1 + ov, ry, zm]];
      const L = Math.hypot(span / 2 + ov, rise + 0.2);
      quad(M, s1, [0, 0.7, -0.7], [[0, 0], [b.w + 2 * ov, 0], [b.w + 2 * ov, L], [0, L]], white, 0, tile);
      quad(M, s2, [0, 0.7, 0.7], [[0, 0], [b.w + 2 * ov, 0], [b.w + 2 * ov, L], [0, L]], white, 0, tile);
      for (const x of [x0, x1]) tri(M, [[x, eave, z0], [x, eave, z1], [x, eave + rise - 0.1, zm]], [x === x0 ? -1 : 1, 0, 0], [[0, 0], [b.h, 0], [b.h / 2, rise]], white, 0, b.ext);
      box(M, [(x0 + x1) / 2, ry + 0.05, zm], basisF(0, 1), (b.w + 2 * ov) / 2, 0.06, 0.08, [0.3, 0.25, 0.22], T.wood, 0, 1);
    } else {
      const xm = (x0 + x1) / 2, ry = eave + rise;
      const s1 = [[x0 - ov, eave - 0.2, z1 + ov], [x0 - ov, eave - 0.2, z0 - ov], [xm, ry, z0 - ov], [xm, ry, z1 + ov]];
      const s2 = [[x1 + ov, eave - 0.2, z0 - ov], [x1 + ov, eave - 0.2, z1 + ov], [xm, ry, z1 + ov], [xm, ry, z0 - ov]];
      const L = Math.hypot(span / 2 + ov, rise + 0.2);
      quad(M, s1, [-0.7, 0.7, 0], [[0, 0], [b.h + 2 * ov, 0], [b.h + 2 * ov, L], [0, L]], white, 0, tile);
      quad(M, s2, [0.7, 0.7, 0], [[0, 0], [b.h + 2 * ov, 0], [b.h + 2 * ov, L], [0, L]], white, 0, tile);
      for (const z of [z0, z1]) tri(M, [[x0, eave, z], [x1, eave, z], [xm, eave + rise - 0.1, z]], [0, 0, z === z0 ? -1 : 1], [[0, 0], [b.w, 0], [b.w / 2, rise]], white, 0, b.ext);
      box(M, [xm, ry + 0.05, (z0 + z1) / 2], basisF(1, 0), (b.h + 2 * ov) / 2, 0.06, 0.08, [0.3, 0.25, 0.22], T.wood, 0, 1);
    }
    // chimney
    if (b.kind === 'house' || b.kind === 'big') {
      const cx = x0 + Math.max(1.5, b.w * 0.25), cz = z0 + Math.max(1.5, b.h * 0.3);
      box(M, [cx, eave + rise * 0.5 + 0.9, cz], basisF(0, 1), 0.35, rise * 0.5 + 1.0, 0.35, white, med ? 9 : 3, 0, 1);
      box(M, [cx, eave + rise + 1.95, cz], basisF(0, 1), 0.42, 0.06, 0.42, [0.4, 0.38, 0.36], 34, 0, 1);
    }
    // church bell tower with spire
    if (b.kind === 'church' && b.tower) {
      const t = b.tower, tx0 = t.x - 0.5, tz0 = t.y - 1, tx1 = t.x + t.w + 0.5, tz1 = t.y + t.h - 1;
      const top = eave + rise + 4;
      for (const [p, n] of [[[[tx0, eave, tz0], [tx1, eave, tz0], [tx1, top, tz0], [tx0, top, tz0]], [0, 0, -1]], [[[tx1, eave, tz1], [tx0, eave, tz1], [tx0, top, tz1], [tx1, top, tz1]], [0, 0, 1]], [[[tx0, eave, tz1], [tx0, eave, tz0], [tx0, top, tz0], [tx0, top, tz1]], [-1, 0, 0]], [[[tx1, eave, tz0], [tx1, eave, tz1], [tx1, top, tz1], [tx1, top, tz0]], [1, 0, 0]]])
        quad(M, p, n, [[0, 0], [t.w, 0], [t.w, (top - eave) / 1.35], [0, (top - eave) / 1.35]], white, 0, 14);
      // belfry openings
      const bc = [(tx0 + tx1) / 2, top - 1.4];
      box(M, [bc[0], bc[1], tz1 + 0.01], basisF(0, 1), 0.6, 0.8, 0.02, [0.03, 0.03, 0.04], T.plain, 0, 1);
      box(M, [bc[0], bc[1], tz0 - 0.01], basisF(0, 1), 0.6, 0.8, 0.02, [0.03, 0.03, 0.04], T.plain, 0, 1);
      pyramid(M, tx0 - 0.2, tz0 - 0.2, tx1 + 0.2, tz1 + 0.2, top, top + 6, 54);
      box(M, [(tx0 + tx1) / 2, top + 6.5, (tz0 + tz1) / 2], basisF(0, 1), 0.05, 0.5, 0.05, C.gold, T.plain, 0.2, 1);
      box(M, [(tx0 + tx1) / 2, top + 6.7, (tz0 + tz1) / 2], basisF(0, 1), 0.25, 0.05, 0.05, C.gold, T.plain, 0.2, 1);
    }
    if (b.kind === 'mausoleum') {
      const cx = (x0 + x1) / 2;
      for (const s of [-1.2, 1.2]) box(M, [cx + s, 1.3, z0 - 0.4], basisF(0, 1), 0.15, 1.3, 0.15, [0.75, 0.73, 0.68], 34, 0, 1);
    }
  }
  function pyramid(M, x0, z0, x1, z1, y0, y1, tile) {
    const ap = [(x0 + x1) / 2, y1, (z0 + z1) / 2], c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
    for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; const L = Math.hypot(x1 - x0, z1 - z0); tri(M, [a, b, ap], [0, 0.5, 0], [[0, 0], [L * 0.7, 0], [L * 0.35, y1 - y0]], [1, 1, 1], 0, tile); }
  }

  // ---------------- matrices ----------------
  function persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); }
  function lookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }
  function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
  function inv(m) {
    const a = m, o = new Float32Array(16);
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  }

  // ---------------- per-frame rendering ----------------
  let VP = null, camInfo = null;
  G3.project = function (p) {
    if (!VP) return null;
    const x = p[0], y = p[1], z = p[2];
    const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (cw <= 0) return null;
    return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H];
  };
  G3.cam = () => camInfo;
  G3.mesh = { DYN, VM };

  // v: { map, x, y, a, pitch(rad), eye, roll, held, lm(Float32Array), lmW, lmH, nightVision, time, dyn(fn(M)), vm(fn(M)), sprites:[{x,z,y0,h,name,alpha,glitch,mode}], over(Uint8 RGBA), fx }
  G3.render = function (v) {
    if (built !== v.map || builtVer !== (v.map._ver || 0)) { G3.build(v.map); builtVer = v.map._ver || 0; }
    // camera
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    const f = [Math.cos(v.a) * cp, sp, Math.sin(v.a) * cp];
    const eye = [v.x, v.eye, v.y];
    let up = [0, 1, 0];
    if (v.roll) { const r = [-Math.sin(v.a), 0, Math.cos(v.a)]; up = [Math.sin(v.roll) * r[0], Math.cos(v.roll), Math.sin(v.roll) * r[2]]; }
    const view = lookAt(eye, [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]], up);
    const proj = persp(1.15, W / H, 0.04, 80);
    VP = mul(proj, view);
    const right = [-Math.sin(v.a), 0, Math.cos(v.a)];
    const camUp = [-cp * 0 - sp * Math.cos(v.a) * 0, 1, 0];
    const cu = [-(sp) * Math.cos(v.a), cp, -(sp) * Math.sin(v.a)];
    camInfo = { eye, f, right, up: cu };
    // lightmap upload
    const N = v.lmW * v.lmH;
    if (!lmBuf || lmBuf.length !== N * 4) lmBuf = new Uint8Array(N * 4);
    for (let i = 0, j = 0; i < N; i++, j += 3) { lmBuf[i * 4] = Math.min(255, v.lm[j] * 64); lmBuf[i * 4 + 1] = Math.min(255, v.lm[j + 1] * 64); lmBuf[i * 4 + 2] = Math.min(255, v.lm[j + 2] * 64); lmBuf[i * 4 + 3] = 255; }
    gl.bindTexture(gl.TEXTURE_2D, lmTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, v.lmW, v.lmH, 0, gl.RGBA, gl.UNSIGNED_BYTE, lmBuf);
    // dynamic geometry
    DYN.n = 0; if (v.dyn) v.dyn(DYN, G3);
    for (const s of v.sprites || []) billboard(DYN, s, right);
    DYN.upload(true);
    VM.n = 0; if (v.vm) v.vm(VM, G3, camInfo); VM.upload(true);
    // draw scene to low-res target
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    // sky
    gl.disable(gl.DEPTH_TEST); gl.useProgram(P_SKY.p);
    gl.uniformMatrix4fv(P_SKY.u.uInvVP, false, inv(VP)); gl.uniform1f(P_SKY.u.uTime, v.time); gl.uniform1f(P_SKY.u.uSkyK, v.nightVision ? 2.2 : 1);
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    const P = P_SCENE; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texAtlas); gl.uniform1i(P.u.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texSprites); gl.uniform1i(P.u.uSprites, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, lmTex); gl.uniform1i(P.u.uLM, 2);
    gl.uniformMatrix4fv(P.u.uVP, false, VP);
    gl.uniform2f(P.u.uMapSize, v.lmW, v.lmH);
    gl.uniform3f(P.u.uCam, eye[0], eye[1], eye[2]);
    gl.uniform3f(P.u.uCamDir, f[0], f[1], f[2]);
    const held = v.held;
    const hp = held && held.cone ? [eye[0] + right[0] * 0.2 - f[0] * 0.1, eye[1] - 0.25, eye[2] + right[2] * 0.2 - f[2] * 0.1] : [eye[0] - right[0] * 0.25 + f[0] * 0.3, eye[1] - 0.2, eye[2] - right[2] * 0.25 + f[2] * 0.3];
    gl.uniform3f(P.u.uHeldPos, hp[0], hp[1], hp[2]);
    gl.uniform3f(P.u.uHeldCol, held ? held.col[0] : 0, held ? held.col[1] : 0, held ? held.col[2] : 0);
    gl.uniform1f(P.u.uHeldPow, held ? held.pow * (held.cone ? 1.7 : 1.5) : 0);
    gl.uniform1f(P.u.uHeldK, held ? (held.cone ? 0.16 : held.k * 0.7) : 1);
    gl.uniform1f(P.u.uHeldCone, held && held.cone ? 1 : 0);
    gl.uniform1f(P.u.uAmb, v.nightVision ? 0.12 : 0.004);
    gl.uniform1f(P.u.uGain, v.nightVision ? 3.0 : 1);
    gl.uniform1f(P.u.uTime, v.time); gl.uniform1f(P.u.uHi, 0);
    STAT.draw(); DYN.draw();
    if (VM.n) { gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniform1f(P.u.uHeldPow, held ? held.pow * 0.35 : 0); gl.uniform1f(P.u.uAmb, v.nightVision ? 0.12 : 0.03); VM.draw(); }
    gl.bindVertexArray(null);
    if (v.over) G3.post(v.over, v.fx, v.time);
  };
  G3.post = function (over, fx, time) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, overTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, over);
    const Q = P_POST; gl.useProgram(Q.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbTex); gl.uniform1i(Q.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, overTex); gl.uniform1i(Q.u.uOver, 1);
    fx = fx || {};
    gl.uniform2f(Q.u.uRes, W, H); gl.uniform1f(Q.u.uTime, time);
    gl.uniform1f(Q.u.uFear, fx.fear || 0); gl.uniform1f(Q.u.uGlitch, Math.min(2, fx.glitch || 0)); gl.uniform1f(Q.u.uNV, fx.nightVision ? 1 : 0); gl.uniform1f(Q.u.uDead, fx.dead ? 1 : 0);
    gl.uniform1f(Q.u.uHide, fx.hiding ? 1 : 0); gl.uniform1f(Q.u.uFlash, Math.min(1, fx.flash || 0)); gl.uniform1f(Q.u.uBlack, fx.black || 0); gl.uniform1f(Q.u.uRed, fx.redPulse || 0);
    gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  };
  function billboard(M, s, right) {
    const S = SPRITES[s.name]; if (!S) return;
    const hh = s.h, ww = hh * S.w / S.h, y0 = s.y0 || 0;
    const r = [right[0] * ww / 2, 0, right[2] * ww / 2];
    const p = [[s.x - r[0], y0, s.z - r[2]], [s.x + r[0], y0, s.z + r[2]], [s.x + r[0], y0 + hh, s.z + r[2]], [s.x - r[0], y0 + hh, s.z - r[2]]];
    const mode = s.mode === 'ghost' ? -2 : s.mode === 'bright' ? -3 : -1;
    const g = s.glitch || 0;
    for (const k of [0, 1, 2, 0, 2, 3]) { const uv = [[S.u0, S.v1], [S.u1, S.v1], [S.u1, S.v0], [S.u0, S.v0]][k]; M.v(p[k][0], p[k][1], p[k][2], g, 0, 0, uv[0], uv[1], 1, 1, 1, s.alpha === undefined ? 1 : s.alpha, mode); }
  }
  G3.drawFurn = (M, map, o, emit) => drawFurn(M, map, o, emit);
  G3.item = (M, name, pos, B, scale, state) => { const fn = ITEM[name]; if (!fn) return; fn(modelAdder(M, pos, B, scale || 1), state || {}); };
};
