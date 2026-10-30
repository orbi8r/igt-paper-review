// Part 6: when the spread is even, and the numbers. Every frame is a pure function of time (window.seek).
// World units: the region the next guess can reach has radius 1, the ball r_t has radius 2.5 (alpha 0.6, so 1 = (1 - alpha) r_t).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

const J = async f => (await fetch(f)).json();
const [TM, DT] = await Promise.all([J('timing6.json'), J('part6_data.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
window.TOTAL = TM._total;

const WHT = '#ffffff', BLU = '#3DA5FF';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vl = (a, b, k) => a.clone().lerp(b, k);
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));
const REG = [];

// ---------- renderer, camera
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(devicePixelRatio); R.setSize(1920, 1080); document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
scene.add(new THREE.AmbientLight(0xffffff, 0.75));

class FL {
  constructor(color, w, dashed = false, ds = .08, gs = .06) {
    this.mat = new LineMaterial({ color, linewidth: w, dashed, dashSize: ds, gapSize: gs, worldUnits: false, transparent: true });
    this.mat.resolution.set(1920, 1080);
    this.obj = new Line2(new LineGeometry(), this.mat); this.obj.frustumCulled = false; this.obj.visible = false; scene.add(this.obj); REG.push(this);
  }
  set(pts, op = 1) {
    if (op <= .004 || pts.length < 2) { this.obj.visible = false; return; }
    const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    this.obj.geometry.dispose(); this.obj.geometry = g; this.obj.computeLineDistances();
    this.mat.opacity = op; this.obj.visible = true;
  }
  hide() { this.obj.visible = false; }
}
class FS {   // fat line segments: consecutive pairs of points
  constructor(color, w) {
    this.mat = new LineMaterial({ color, linewidth: w, worldUnits: false, transparent: true }); this.mat.resolution.set(1920, 1080);
    this.obj = new LineSegments2(new LineSegmentsGeometry(), this.mat); this.obj.frustumCulled = false; this.obj.visible = false; scene.add(this.obj); REG.push(this);
  }
  set(pts, op = 1) {
    if (op <= .004 || pts.length < 2) { this.obj.visible = false; return; }
    const g = new LineSegmentsGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    this.obj.geometry.dispose(); this.obj.geometry = g; this.mat.opacity = op; this.obj.visible = true;
  }
  hide() { this.obj.visible = false; }
}
const SPH = new THREE.SphereGeometry(1, 20, 14);
class Dot {
  constructor(color) { this.m = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color, transparent: true })); this.m.visible = false; scene.add(this.m); REG.push(this); }
  set(p, r, op = 1) { const v = r > 1e-4 && op > .004; this.m.visible = v; if (!v) return; this.m.position.copy(p); this.m.scale.setScalar(r); this.m.material.opacity = op; }
  hide() { this.m.visible = false; }
}
const TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
class Cloud {
  constructor(size, max) {
    this.max = max; this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.obj = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, map: TEX, alphaTest: .5, transparent: true, vertexColors: true, depthWrite: false }));
    this.obj.frustumCulled = false; this.obj.visible = false; scene.add(this.obj); REG.push(this); this.n = 0;
  }
  begin() { this.n = 0; }
  add(p, b = 1, c = [1, 1, 1]) {
    if (b <= .02 || this.n >= this.max) return; const i = 3 * this.n++;
    this.pos[i] = p.x; this.pos[i + 1] = p.y; this.pos[i + 2] = p.z; this.col[i] = c[0] * b; this.col[i + 1] = c[1] * b; this.col[i + 2] = c[2] * b;
  }
  end() { const g = this.obj.geometry; g.setDrawRange(0, this.n); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; this.obj.visible = this.n > 0; }
  hide() { this.obj.visible = false; }
}
class Surf {   // indexed triangle mesh with vertex colours, rewritten every frame
  constructor(nv, idx, op) {
    this.pos = new Float32Array(nv * 3); this.col = new Float32Array(nv * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: op })); this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh); REG.push(this);
  }
  done(op) { const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; this.mesh.material.opacity = op; this.mesh.visible = op > .004; }
  hide() { this.mesh.visible = false; }
}
let RIGHT = V(1, 0, 0), UP = V(0, 1, 0), CD = 8;
const circ = (c, r, u = RIGHT, w = UP, n = 100) => { const o = []; for (let k = 0; k <= n; k++) { const a = 2 * Math.PI * k / n; o.push(c.clone().addScaledVector(u, r * Math.cos(a)).addScaledVector(w, r * Math.sin(a))); } return o; };
const PL = [[V(1, 0, 0), V(0, 1, 0)], [V(1, 0, 0), V(0, 0, 1)], [V(0, 1, 0), V(0, 0, 1)]];
const O3 = V(0, 0, 0);

// ---------- DOM overlay
const OV = document.getElementById('ov'); const pool = new Map(); let used = new Set();
function el(key, cls) { let e = pool.get(key); if (!e) { e = document.createElement('div'); e.className = cls; OV.appendChild(e); pool.set(key, e); e._h = null; } used.add(key); e.style.display = ''; return e; }
function html(e, h) { if (e._h !== h) { e.innerHTML = h; e._h = h; } }
function scr(v) { const p = v.clone().project(cam); return { x: (p.x + 1) * 960, y: (1 - p.y) * 540 }; }
function lab(key, h, pos, op, o = {}) {
  if (op <= .004) return; const e = el(key, 'lab'); html(e, h);
  const p = pos.isVector3 ? scr(pos) : pos;
  e.style.left = (p.x + (o.dx || 0)) + 'px'; e.style.top = (p.y + (o.dy || 0)) + 'px'; e.style.opacity = op;
  e.style.color = o.color || WHT; e.style.fontSize = (o.size || 56) + 'px';
}
function bar(key, x, y, w, h, op, o = {}) {
  if (op <= .004 || w < .5 || h < .5) return; const e = el(key, 'fill');
  e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.width = w + 'px'; e.style.height = h + 'px'; e.style.opacity = op;
  e.style.background = o.fill === undefined ? WHT : o.fill; e.style.border = o.border ? `${o.border}px solid ${WHT}` : 'none'; e.style.boxSizing = 'border-box'; e.style.backgroundSize = '';
}
const ctx2 = document.createElement('canvas').getContext('2d');
const textW = (s, px) => { ctx2.font = `700 ${px}px "Noto Sans"`; return ctx2.measureText(s.replace(/<[^>]+>/g, '')).width; };

// ---------- formulas (same engine as Part 1)
const measCache = new Map();
function layout(toks, size) {
  const key = toks.map(t => t.k + '|' + t.h).join('#') + size;
  if (measCache.has(key)) return measCache.get(key);
  const m = document.createElement('div'); m.className = 'meas'; m.style.fontSize = size + 'px'; OV.appendChild(m);
  m.innerHTML = toks.map(t => `<span style="margin:0 ${t.sp ?? .1}em">${t.h}</span>`).join('');
  const r0 = m.getBoundingClientRect(), out = {}, W = r0.width;
  [...m.children].forEach((c, i) => { const r = c.getBoundingClientRect(); out[toks[i].k] = { x: r.left - r0.left + r.width / 2 - W / 2, w: r.width }; });
  m.remove(); measCache.set(key, out); return out;
}
function formula(name, states, t, cx, cy) {
  let j = -1; states.forEach((s, i) => { if (s.t <= t) j = i; });
  if (j < 0) return;
  const cur = states[j], prev = j > 0 ? states[j - 1] : { toks: [] }, size = cur.size || 72, k = prog(t, cur.t, .7);
  const lc = layout(cur.toks, size), lp = layout(prev.toks, prev.size || size);
  const pk = new Map(prev.toks.map(x => [x.k, x]));
  const draw = (id, h, x, y, op, sz) => { if (op <= .004) return; const e = el(name + id, 'tok'); html(e, h); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = op; e.style.fontSize = sz + 'px'; e.style.color = WHT; };
  for (const x of cur.toks) {
    const tx = cx + lc[x.k].x; const old = pk.get(x.k);
    let sx = tx, sy = cy, op = 1;
    if (old) { sx = cx + lp[x.k].x; }
    else if (x.from && k < 1) { const f = x.from(); sx = f.x; sy = f.y; op = clamp(k * 4); }
    else op = clamp((k - .75) / .25);
    const px = lerp(sx, tx, k), py = lerp(sy, cy, k);
    if (old && old.h !== x.h) { draw(x.k + 'o', old.h, px, py, 1 - k, size); draw(x.k, x.h, px, py, k, size); }
    else draw(x.k, x.h, px, py, op, size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = px + 'px'; c.style.top = (py + size * .62) + 'px'; c.style.opacity = old && old.cap ? 1 : k; }
    if (x.box && t > x.box) { const q = prog(t, x.box, .5), w = lc[x.k].w + 24; const b = el(name + x.k + 'b', 'box'); b.style.left = (px - w / 2) + 'px'; b.style.top = (py - size * .62) + 'px'; b.style.width = w + 'px'; b.style.height = size * 1.24 + 'px'; b.style.opacity = q; }
  }
  for (const x of prev.toks) if (!cur.toks.find(y => y.k === x.k)) {
    draw(x.k, x.h, cx + lp[x.k].x, cy, 1 - k, prev.size || size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = (cx + lp[x.k].x) + 'px'; c.style.top = (cy + size * .62) + 'px'; c.style.opacity = 1 - k; }
  }
}
const sub = s => `<sub>${s}</sub>`, sup = s => `<sup>${s}</sup>`;
const r_t = 'r' + sub('t'), mu_t = 'μ' + sub('t');
const T = (k, h, o = {}) => ({ k, h, ...o });
const fr = (x, y) => () => ({ x, y });
const fromS = v => () => scr(v);

// ---------- camera keys: [start, duration, pose]
const P = (az, el, dist, tg = [0, 0, 0], ox = 0) => ({ az, el, dist, tg: V(...tg), ox });
const P0 = P(20, 12, 7);
const KEYS = [
  [S('b02') + .3, 2.5, P(30, 18, 7.2)],
  [at('b03', .1), 2.2, P(25, 16, 15.5, [0, -.3, 0])],
  [S('b04'), 1.8, P(15, 10, 7.5, [0, 0, 0], 360)],
  [S('b10'), 2.2, P(25, 18, 15)],
  [S('b11') + .2, 1.6, P(22, 16, 15, [0, 0, 0], 360)],
  [S('b12'), 1.8, P(30, 22, 13, [0, -.3, 0])],
  [S('b13'), 1.8, P(0, 0, 10, [-.2, .15, 0])],
  [S('b14'), 1.8, P(20, 15, 9, [0, 0, 0], 360)],
  [S('b17'), 1.6, P(20, 15, 15)],
  [S('b19'), 2.0, P(35, 35, 10.5, [0, .6, 0])],
  [at('b20', .05), 2.6, P(0, 86, 9)],
  [S('b22'), 1.8, P(20, 40, 5.6, [0, -.15, 0])],
  [at('b23', .1), 3, P(50, 30, 5.6, [0, -.15, 0])],
  [S('b24'), 1.8, P(20, 15, 11)],
  [S('b25'), 1.6, P(0, 0, 8)],
  [S('b27'), 1.4, P(0, 0, 6.4)],
];
function camAt(t) {
  let p = { ...P0, tg: P0.tg.clone() };
  for (const [s, d, q] of KEYS) { const k = prog(t, s, d); if (k <= 0) break; p = { az: lerp(p.az, q.az, k), el: lerp(p.el, q.el, k), dist: lerp(p.dist, q.dist, k), tg: vl(p.tg, q.tg, k), ox: lerp(p.ox, q.ox, k) }; }
  CD = p.dist; const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  cam.setViewOffset(1920, 1080, p.ox, 0, 1920, 1080);
  cam.position.copy(p.tg).add(V(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(p.dist));
  cam.up.set(0, 1, 0); cam.lookAt(p.tg); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  RIGHT = V(1, 0, 0).applyQuaternion(cam.quaternion); UP = V(0, 1, 0).applyQuaternion(cam.quaternion);
}

// ---------- data and seeded shapes
const RNG = (() => { let s = 6061; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const gauss = () => Math.sqrt(-2 * Math.log(RNG() + 1e-9)) * Math.cos(2 * Math.PI * RNG());
function shape(kind) {
  const pts = [];
  for (let k = 0; k < 48; k++) {
    let v;
    if (kind === 0) v = V(gauss(), gauss(), gauss()).multiplyScalar(.35);
    else if (kind === 1) v = V(k % 2 ? .8 : -.8, .1, 0).add(V(gauss(), gauss(), gauss()).multiplyScalar(.12));
    else { const a = 2 * Math.PI * k / 48; v = V(Math.cos(a), Math.sin(a) * .3, Math.sin(a)).normalize().multiplyScalar(.85); }
    pts.push(v);
  }
  const mean = pts.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / 48); pts.forEach(p => p.sub(mean));
  const mx = Math.max(...pts.map(p => p.length())); pts.forEach(p => p.multiplyScalar(.95 / Math.max(mx, 1)));
  return pts;
}
const SHAPES = [shape(0), shape(1), shape(2)];
const U3 = DT.pts3.map(p => V(p[0], p[1], p[2])), P2 = DT.pts2.map(p => V(p[0], p[1], 0)), P1 = DT.pts1.map(x => V(x, 0, 0));
const PATHS = DT.paths.map(p => p.map(q => V(q[0], q[1], q[2]).multiplyScalar(2.5)));
const RMS = d => DT.rms[String(d)];
const SAMP = [3, 17, 40, 66, 90, 130];
const stair = DT.stair.slice(0, 8);

// ---------- scene objects
const cirs = PL.map(() => new FL(WHT, 5)), cirsO = PL.map(() => new FL(WHT, 5)), rmsR = PL.map(() => new FL(WHT, 4, true, .07, .05)), uR = PL.map(() => new FL(WHT, 4, true, .07, .05));
const rmsTick = [new FL(WHT, 6), new FL(WHT, 6)];
const stepRing = [0, 1, 2, 3].map(() => new FL(WHT, 5, true, .07, .05)), stepIn = [0, 1, 2, 3].map(() => new FL(WHT, 4, true, .05, .04));
const meanRing = new FL(WHT, 5), newBall = new FL(WHT, 5), worst = new FL(WHT, 5, true, .1, .07), pathL = [...Array(36)].map(() => new FL(WHT, 3));
const guess = new Dot(WHT), gNext = new Dot(WHT), cloud = new Cloud(9, 1000), ends = new Cloud(16, 80);
const sampL = SAMP.map(() => new FL(WHT, 4)), sampD = new Cloud(18, 10);
const A = [new Dot(WHT), new Dot(WHT), new Dot(WHT)];
const legs = [new FL(WHT, 7), new FL(WHT, 7), new FL(WHT, 7)], sqs = [new FL(WHT, 5), new FL(WHT, 5), new FL(WHT, 5)], rA = new FL(WHT, 4);
// Figure 1
const NA = 21, ND = 10;
const idxG = []; for (let j = 0; j < ND - 1; j++) for (let i = 0; i < NA - 1; i++) { const a = j * NA + i; idxG.push(a, a + 1, a + NA, a + 1, a + NA + 1, a + NA); }
const surf = new Surf(NA * ND, idxG, 1);
const wA = [...Array(ND)].map(() => new FL(WHT, 3)), wD = [0, 5, 10, 15, 20].map(() => new FL(WHT, 3)), axF = [new FL('#d0d0d0', 3), new FL('#d0d0d0', 3), new FL('#d0d0d0', 3)];
const mk = [new Dot(WHT), new Dot(WHT), new Dot(WHT)];
// Proposition 3 disk, ramp, tie line
const NX = 14, NZ = 8, idxR = []; for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j; idxR.push(a, a + 1, a + NZ + 1, a + 1, a + NZ + 2, a + NZ + 1); }
const ramp = new Surf((NX + 1) * (NZ + 1), idxR, .5), diskR = new FL(WHT, 5), tie = new FL(WHT, 10), kRing = new FL(WHT, 5, true, .07, .05), rampEdge = new FL(WHT, 4);
const dcl = new Cloud(8, 560);
// Section 5
const sph = PL.map(() => new FL(WHT, 4)), adD = [...Array(10)].map(() => new Dot(BLU)), ball5 = PL.map(() => new FL(WHT, 5)), ghost5 = [PL.map(() => new FL(WHT, 3, true, .07, .05)), PL.map(() => new FL(WHT, 3, true, .07, .05))];
const g0 = new Dot(WHT), noAd = new Dot(WHT);
const treeE = new FS(WHT, 4), nodeD = [...Array(22)].map(() => new Dot(WHT)), stopE = new FS('#808080', 4);
const chAx = [new FL('#d0d0d0', 4), new FL('#d0d0d0', 4)], chCurve = new FL(WHT, 7), chPts = [...Array(10)].map(() => new Dot(WHT)), chGuide = new FL(WHT, 3, true, .08, .06), chBound = new FL(WHT, 6, true, .12, .08), chRing = new FL(WHT, 5);

// ---------- ramp colour (dark blue = tight, white = loose)
const rampC = v => { v = clamp(v); return v < .5 ? [lerp(.03, .24, v * 2), lerp(.06, .65, v * 2), lerp(.25, 1, v * 2)] : [lerp(.24, 1, (v - .5) * 2), lerp(.65, 1, (v - .5) * 2), 1]; };
const Kd2 = u => { if (u >= 1) return 0; let s = 0; const n = 400; for (let i = 0; i < n; i++) { const z = u + (1 - u) * (i + .5) / n; s += (z - u) * Math.sqrt(1 - z * z); } return s * (1 - u) / n / (Math.PI / 2); };   // K_2 (d = 2): mean of (Z - u)+ over the disk

// ---------- tree for Section 5
const TN = [];   // {x, y, lvl, parent, val, tw}
(() => {
  TN.push({ x: 0, y: 1.5, l: 0, p: -1 });
  [-1.9, 0, 1.9].forEach(x => TN.push({ x, y: .5, l: 1, p: 0 }));
  for (let i = 1; i <= 3; i++) [-.6, .6].forEach(dx => TN.push({ x: TN[i].x + dx, y: -.5, l: 2, p: i }));
  for (let i = 4; i <= 9; i++) [-.28, .28].forEach(dx => TN.push({ x: TN[i].x + dx, y: -1.5, l: 3, p: i }));
  TN.forEach(n => { n.c = []; }); TN.forEach((n, i) => { if (n.p >= 0) TN[n.p].c.push(i); });
  for (let l = 3; l >= 0; l--) TN.forEach(n => {
    if (n.l !== l) return;
    if (l === 3) n.v = .3 + .6 * RNG(); else { const s = .2 + .5 * RNG(); n.v = Math.max(s, .95 * n.c.reduce((a, c) => a + TN[c].v, 0) / n.c.length); }
  });
})();
const kids = i => { const o = []; const st = [i]; while (st.length) { const k = st.pop(); TN[k].c.forEach(c => { o.push(c); st.push(c); }); } return o; };
const STOPSUB = new Set(kids(3));

// ---------- formulas
const Uf = c => [T('U', 'U'), T('eq', '='), T('fl', '(1−p)h'), T('pl', '+', { sp: .3 }), T('D', 'D', { sp: .2 }), T('rt', r_t, { sp: .1 }), c];
const RG = c => [T('reg', 'V* − V' + sup('π')), T('le', '≤', { sp: .3 }), T('D', 'D', { sp: .2 }), c, T('f', `${r_t} / (2(1−(1−p)α))`)];
const TOP = [
  { t: at('b08', .04), toks: [T('s', 'share within u'), T('eq', '='), T('p', 'u' + sup('d'))] },
  { t: at('b08', .3), toks: [T('s', 'share at u'), T('eq', '='), T('p', 'd·u' + sup('d−1'))] },
  { t: at('b08', .56), toks: [T('s', 'typical distance' + sup('2')), T('eq', '='), T('p', 'd/(d+2)')] },
  { t: at('b08', .8), toks: [T('s', 'typical distance'), T('eq', '='), T('p', '√(d/(d+2))')] },
  { t: S('b09'), toks: [] },
  { t: at('b10', .35), toks: Uf(T('C', 'C', { box: at('b10', .78) })) },
  { t: S('b16'), toks: [T('G', 'G'), T('eq', '=')] },
  { t: at('b16', .22), toks: [T('G', 'G'), T('eq', '='), T('p', '(1−p)', { from: fr(1180, 520) })] },
  { t: at('b16', .4), toks: [T('G', 'G'), T('eq', '='), T('p', '(1−p)'), T('al', '(1−α)', { from: () => scr(V(0, 1, 0)) })] },
  { t: at('b16', .58), toks: [T('G', 'G'), T('eq', '='), T('p', '(1−p)'), T('al', '(1−α)'), T('m', '√(d/(d+2))', { from: () => scr(V(0, .775, 0)) })] },
  { t: at('b16', .78), toks: [T('G', 'G'), T('eq', '='), T('p', '(1−p)'), T('al', '(1−α)'), T('m', '√( d/(d+2) ×'), T('tw', '1/(1−(1−p)α' + sup('2') + ') )', { from: fr(1400, 870) })] },
  { t: S('b17'), toks: Uf(T('G', 'G')) },
  { t: S('b18'), toks: RG(T('C', 'C')) },
  { t: at('b18', .45), toks: RG(T('C', 'C' + sup('unif'))) },
  { t: at('b19', .08), toks: [T('ra', 'ratio'), T('eq', '='), T('cu', 'C' + sup('unif') + ' / C')] },
  { t: S('b22'), toks: [T('L', 'L'), T('eq', '='), T('o', '(1−p)h')] },
  { t: at('b23', .72), toks: [T('L', 'L'), T('eq', '='), T('o', '(1−p)(h +'), T('B', 'B', { from: () => scr(V(0, 1.2 * Kd2(.35) * 1.3, 0)) }), T('c', ')')] },
  { t: S('b24'), toks: [] },
];
const BOT = [
  { t: at('b11', .2), size: 64, toks: [T('h0', 'h(' + mu_t + ')'), T('l1', '≤'), T('h1', 'E h(μ' + sub('t+1') + ')'), T('l2', '≤'), T('h2', 'E h(μ' + sub('t+2') + ')'), T('l3', '≤ …')] },
  { t: at('b11', .7), toks: [T('p', 'any plan'), T('le', '≤', { sp: .3 }), T('c', 'clairvoyant')] },
  { t: S('b12'), toks: [] },
  { t: at('b13', .15), toks: [T('l', '‖ξ' + sub('1') + ' + ξ' + sub('2') + '‖' + sup('2'), { from: fr(960, 330) }), T('eq', '='), T('a', '‖ξ' + sub('1') + '‖' + sup('2'), { from: fr(560, 700) }), T('pl', '+'), T('b', '‖ξ' + sub('2') + '‖' + sup('2'), { from: fr(1180, 470) })] },
  { t: at('b13', .72), toks: [T('l', 'E‖μ' + sub('t+N') + ' − ' + mu_t + '‖' + sup('2')), T('eq', '='), T('s', 'Σ' + sub('k')), T('w', '(1−p)' + sup('k'), { cap: 'still there' }), T('x', 'E‖ξ' + sub('k') + '‖' + sup('2'))] },
  { t: at('b14', .15), toks: [T('x', 'E‖ξ' + sub('k') + '‖' + sup('2')), T('eq', '='), T('m', 'd/(d+2)', { cap: 'inside the ball', sp: .7 }), T('R', 'R' + sub('k') + sup('2'), { cap: 'ring size', sp: .7 })] },
  { t: at('b14', .42), toks: [T('x', 'E‖ξ' + sub('k') + '‖' + sup('2')), T('eq', '='), T('m', 'd/(d+2)'), T('R', '(1−α)' + sup('2') + 'α' + sup('2k') + r_t + sup('2'))] },
  { t: at('b14', .72), toks: [T('w', '(1−p)' + sup('k'), { cap: 'still there', from: fr(1150, 520) }), T('t1', '×'), T('m', 'd/(d+2)'), T('t2', '×'), T('R', '(1−α)' + sup('2') + 'α' + sup('2k') + r_t + sup('2'))] },
  { t: at('b15', .02), toks: [T('q', 'q = (1−p)α' + sup('2') + ' = 0.34')] },
  { t: at('b15', .28), toks: [T('q', '1 + q + q' + sup('2') + ' + …'), T('eq', '='), T('fr', '1 / (1 − q)'), T('eq2', '='), T('v', DT.tower_sum.toFixed(2))] },
  { t: at('b15', .64), toks: [T('a', 'E‖Z‖', { cap: 'average distance' }), T('le', '≤', { sp: .6 }), T('rt', '√(E‖Z‖' + sup('2') + ')', { cap: 'average of squares' })] },
  { t: S('b16'), toks: [] },
  { t: at('b17', .52), toks: [T('cu', 'C' + sup('unif')), T('eq', '='), T('mn', 'min{ C , G }')] },
  { t: S('b18'), toks: [] },
  { t: at('b23', .15), toks: [T('B', 'B'), T('eq', '='), T('S', 'S', { sp: 1.6, cap: 'steepness', from: () => scr(V(1.3, 0, 0)) }), T('K', 'K( g / S )', { sp: 1.6, cap: 'position', from: () => scr(V(.45, 0, 0)) })] },
  { t: at('b23', .78), toks: [] },
];

// ---------- the frame
const fmtPct = v => { const p = v * 100; return (p >= 20 ? p.toFixed(0) : p.toFixed(1).replace(/\.0$/, '')) + '%'; };
const HS = [[at('b05', 0), 1], [at('b06', 0), 2], [at('b07', 0), 3], [at('b09', 0), 1], [at('b09', .12), 2], [at('b09', .24), 3], [at('b09', .37), 5], [at('b09', .52), 10]];
const DL = [[S('b04'), '1 aspect'], [S('b06'), '2 aspects'], [S('b07'), '3 aspects'], [S('b08'), 'd = 3'], [at('b09', 0), 'd = 1'], [at('b09', .12), 'd = 2'], [at('b09', .24), 'd = 3'], [at('b09', .37), 'd = 5'], [at('b09', .52), 'd = 10']];
const hv = t => {   // current histogram and marker: crossfade between the distance shapes of consecutive d
  let cur = null, prev = null, k = 1;
  HS.forEach(([tt, d]) => { if (t >= tt) { prev = cur; cur = { d, tt }; k = prog(t, tt, .5); } });
  if (!cur) return null;
  const hc = DT.hist[String(cur.d)], hp = prev ? DT.hist[String(prev.d)] : hc.map(() => 0);
  return { h: hc.map((v, i) => lerp(hp[i], v, k)), rms: lerp(prev ? RMS(prev.d) : 0, RMS(cur.d), k), d: cur.d };
};

function draw(t) {
  used = new Set(); REG.forEach(o => o.hide()); camAt(t);
  const TT = (a, b) => win(t, S(a), S(b), .45, .45);

  // title morphs up and out while the ball of scene one grows in
  { const to = win(t, .05, 1.45, .45, .6), td = -90 * prog(t, 1.4, .9);
    lab('tl1', 'Part 6', { x: 960, y: 470 + td }, to, { size: 96 }); lab('tl2', 'When the spread is even', { x: 960, y: 590 + td }, to, { size: 80 }); }

  // ===== scene 1 and 2: the ball, the guess, the cloud
  const sOp = win(t, 1.0, S('b10'), .6, .5);
  { const o1 = win(t, 1.5, S('b04'), .6, .4), o2 = win(t, at('b06', .05), S('b10'), .5, .5), o3 = win(t, at('b07', .05), S('b10'), .5, .5);
    PL.forEach(([u, w], i) => cirs[i].set(circ(O3, 1, u, w, 120), Math.max(o1, i === 0 ? o2 : o3))); }
  guess.set(O3, .05 * CD / 8, Math.max(win(t, 1.6, S('b13'), .5, .3), win(t, at('b13', .95), at('b16', .9), .4, .5)));
  lab('mu0', mu_t, O3, win(t, at('b02', .55), at('b04', 0), .4, .4) * 0, { size: 72 });
  lab('any', 'any spread', { x: 960, y: 130 }, win(t, at('b01', .2), at('b02', .05), .4, .4), { size: 72 });
  lab('even', 'even spread', { x: 960, y: 130 }, win(t, at('b02', .15), at('b03', .15), .4, .4), { size: 72 });
  { // old ball, next guess and its new ball (b03)
    const oo = win(t, at('b03', .4), S('b04'), .5, .4);
    PL.forEach(([u, w], i) => cirsO[i].set(circ(O3, 2.5, u, w, 120), Math.max(oo, win(t, S('b10') + .1, at('b13', 0), .5, .5))));
    const g = V(.7, .45, .2);
    gNext.set(g, .04 * CD / 8, win(t, at('b03', .6), S('b04'), .4, .4));
    newBall.set(circ(g, 1.5, RIGHT, UP, 100), win(t, at('b03', .65), S('b04'), .5, .4));
    lab('rtO', r_t, V(0, 2.5, 0), oo, { size: 72, dy: -48 });
    lab('rtN', 'r' + sub('t+1'), g.clone().addScaledVector(UP, 1.5), win(t, at('b03', .72), S('b04'), .5, .4), { size: 72, dy: -46 });
    const mo = win(t, at('b03', .05), at('b03', .45), .4, .4);
    meanRing.set(circ(O3, .14, RIGHT, UP, 40), mo);
    lab('avg', 'average = guess', O3, mo, { dx: 360, dy: 0 });
  }
  { // the cloud: three worst spreads, then the even fill, then 1D, 2D, 3D
    const T1 = S('b04') + .2, T2 = S('b06') + .1, T3 = S('b07') + .1;
    const qU = prog(t, at('b02', .1), 1.0), q1 = prog(t, T1, .9), q2 = prog(t, T2, .9), q3 = prog(t, T3, .9);
    const sh = [at('b01', .3), at('b01', .62)];
    const fadeOut = 1 - prog(t, at('b10', .5), .6);
    const ub = t > at('b08', .02) && t < at('b08', .48) ? .5 : 0, uk = win(t, at('b08', .02), at('b08', .48), .3, .3);
    cloud.begin();
    const n = t < T2 ? 240 : t < T3 ? 520 : 900;
    for (let k = 0; k < n; k++) {
      let p0, b;
      if (k < 48) { const s0 = SHAPES[0][k].clone(); sh.forEach((s, j) => s0.lerp(SHAPES[j + 1][k], prog(t, s, .8))); p0 = vl(s0, U3[k], qU); b = win(t, at('b01', .05) + k * .008, 1e9, .3); }
      else { p0 = U3[k % 900].clone().multiplyScalar(qU); b = qU; }
      let p, bb = b;
      if (t < T2) p = vl(p0, P1[k % 240], q1);
      else if (t < T3) { p = vl(P1[k % 240], P2[k % 520], q2); if (k >= 240) bb = q2; }
      else { p = vl(P2[k % 520], U3[k], q3); if (k >= 520) bb = q3; else if (k >= 240) bb = 1; }
      if (uk > 0) bb *= lerp(1, p.length() <= ub ? 1 : .3, uk);
      cloud.add(p, bb * fadeOut * .0 + bb * fadeOut * 1);
    }
    cloud.end();
    // sample lines: how far each point is from the centre
    const sl = win(t, at('b05', .1), at('b08', 0), .4, .4);
    sampD.begin();
    SAMP.forEach((k, j) => {
      let p;
      if (t < T2) p = vl(p0of(k), P1[k], q1);
      else if (t < T3) p = vl(P1[k], P2[k], q2);
      else p = vl(P2[k], U3[k], q3);
      const off = V(0, (.1 + .1 * j) * (1 - q2), 0); p = p.clone().add(off);
      sampL[j].set([off.clone(), p], sl); sampD.add(p, sl);
    });
    sampD.end();
    // typical distance marks
    const rv = lerp(lerp(RMS(1), RMS(2), q2), RMS(3), q3), ro = win(t, at('b05', .55), S('b10'), .5, .4);
    rmsTick.forEach((f, i) => f.set([V(rv * (i ? 1 : -1), -.14, 0), V(rv * (i ? 1 : -1), .14, 0)], ro * (1 - q2)));
    PL.forEach(([u, w], i) => rmsR[i].set(circ(O3, rv, u, w, 90), ro * (i === 0 ? q2 : q3)));
    // the shrinking share u^d: a ring of radius one half (b08)
    PL.forEach(([u, w], i) => uR[i].set(circ(O3, .5, u, w, 90), uk));
    lab('uL', 'u', V(0, .5, 0), uk, { dy: -40, size: 64 });
    lab('uS', fmtPct(.5 ** 3) + ' inside', V(0, -1.45, 0), uk, { size: 64 });
  }
  function p0of(k) { return k < 48 ? U3[k] : U3[k]; }

  // histogram of distances (right side)
  { const ho = win(t, at('b05', 0), S('b10'), .5, .5), H = hv(t);
    if (H && ho > 0) {
      const x0 = 1090, W = 640, yb = 830, HH = 250;
      lab('hT', 'distance from the center', { x: 1410, y: 300 }, ho);
      H.h.forEach((v, i) => bar('hb' + i, x0 + W * i / 20 + 2, yb - HH * v, W / 20 - 4, HH * v, ho));
      bar('hax', x0, yb, W, 5, ho, { fill: '#d0d0d0' });
      lab('hc', 'center', { x: x0, y: 880 }, ho); lab('he', 'edge', { x: x0 + W, y: 880 }, ho);
      const mo = win(t, at('b05', .55), S('b10'), .5, .5), mx = x0 + W * H.rms;
      bar('hm', mx - 3, 525, 6, yb - 525, mo);
      lab('hmv', 'typical ' + H.rms.toFixed(2), { x: clamp(mx, 1290, 1560), y: 480 }, mo, { size: 72 });
      const hh = win(t, at('b09', .6), at('b10', 0), .4, .4);
      bar('hh', x0 + W * .5 - 2, yb - HH, 4, HH, hh * .8, { fill: '#d0d0d0' });
      lab('hhv', 'inside half: ' + fmtPct(DT.share_half[String(H.d)]), { x: 1410, y: 960 }, hh);
    }
    DL.forEach(([tt, tx], i) => lab('dl' + i, tx, { x: 1410, y: 385 }, win(t, tt, i + 1 < DL.length ? DL[i + 1][0] : S('b10'), .3, .3), { size: 84 }));
  }

  // ===== scene 3: the proof of Proposition 2
  // b10: the worst case runs straight to the rim
  { const w = win(t, at('b10', .45), at('b10', .9), .3, .3), dir = V(1, .5, .3).normalize();
    worst.set([O3, dir.clone().multiplyScalar(2.5 * prog(t, at('b10', .45), .5))], w);
    lab('rimL', 'the rim', dir.clone().multiplyScalar(2.5), w, { dx: 110, dy: -10 }); }
  // b11: the clairvoyant and the rising staircase
  { const o = win(t, at('b11', .08), at('b12', 0), .4, .4), x0 = 1150, yb = 800, HH = 300;
    const mx = Math.max(...stair);
    lab('stT', 'average h', { x: 1450, y: 470 }, o);
    stair.forEach((v, s) => { const k = prog(t, at('b11', .14) + s * .05, .5), nb = s === 5, hi = nb ? win(t, at('b11', .5), at('b12', 0), .3, .3) : 0;
      bar('st' + s, x0 + s * 76, yb - HH * v / mx * k, 62, HH * v / mx * k, o * (.55 + .45 * hi), {}); });
    bar('stax', x0 - 6, yb, 8 * 76 + 6, 5, o, { fill: '#d0d0d0' });
    lab('stX', 'messages later', { x: 1300, y: 880 }, o);
    lab('stN', 'N', { x: x0 + 5 * 76 + 31, y: yb + 40 }, win(t, at('b11', .5), at('b12', 0), .3, .3) * 0 + win(t, at('b11', .5), at('b12', 0), .3, .3), { size: 72 });
    // the first journey, step by step in time with the bars
    const pth = PATHS[0], s = clamp((t - at('b11', .16)) / (D('b11') * .42)) * 7, i = Math.min(6, Math.floor(s)), pts = [];
    for (let j = 0; j <= i; j++) pts.push(pth[j]); if (i < 7) pts.push(vl(pth[i], pth[i + 1], s - i));
    pathL[0].set(pts, o); A[0].set(pts[pts.length - 1], .06 * CD / 8, o);
  }
  // b12: 36 journeys, the average end point, the straight worst case
  { const o = win(t, at('b12', .08), S('b13'), .4, .4), s = clamp((t - at('b12', .12)) / (D('b12') * .4)) * 7;
    if (t >= S('b12')) {
      PATHS.forEach((pth, n) => { const i = Math.min(6, Math.floor(s)), pts = []; for (let j = 0; j <= i; j++) pts.push(pth[j]); if (i < 7) pts.push(vl(pth[i], pth[i + 1], s - i)); pathL[n].set(pts, o * .85); });
      ends.begin(); PATHS.forEach(pth => ends.add(pth[7], o * clamp(s - 6.6) * 3)); ends.end();
      const mr = win(t, at('b12', .66), S('b13'), .4, .4);
      meanRing.set(circ(O3, DT.mean_final * 2.5, RIGHT, UP, 80), mr);
      lab('mf', DT.mean_final.toFixed(2), O3.clone().addScaledVector(UP, DT.mean_final * 2.5), mr, { dy: -52, size: 84 });
      stepRing[0].set(circ(O3, 1, RIGHT, UP, 100), win(t, at('b12', .02), at('b12', .5), .4, .4) * .8);
      lab('r1', 'first step', O3.clone().addScaledVector(UP, 1), win(t, at('b12', .02), at('b12', .3), .4, .4), { dy: -48 });
      const dir = V(1, .5, .3).normalize(), wo = win(t, at('b12', .5), at('b12', .8), .3, .3);
      worst.set([O3, dir.clone().multiplyScalar(2.43)], wo * .9); lab('wst', 'straight to the rim', dir.clone().multiplyScalar(2.45), wo, { dx: 20, dy: -50 });
    } }
  // b13: squares on the sides of a right angle
  { const o = win(t, at('b13', .02), at('b14', .0), .4, .5);
    if (o > 0) {
      const O = V(-1.2, -.2, 0), Aa = V(.1, -.2, 0), B = V(.1, .58, 0), n = V(-.78, 1.3, 0), kk = prog(t, at('b13', .05), .6), ks = prog(t, at('b13', .22), .8);
      legs[0].set([O, vl(O, Aa, kk)], o); legs[1].set([Aa, vl(Aa, B, kk)], o); legs[2].set([O, vl(O, B, kk)], o * .8);
      rA.set([V(-.1, -.2, 0), V(-.1, -.08, 0), V(.1, -.08, 0)], o * kk);
      const sq1 = [O, Aa, V(.1, -1.5, 0), V(-1.2, -1.5, 0), O], sq2 = [Aa, B, V(.88, .58, 0), V(.88, -.2, 0), Aa], sq3 = [O, B, B.clone().add(n), O.clone().add(n), O];
      [sq1, sq2, sq3].forEach((s, i) => { const L = prog(t, at('b13', .22 + i * .08), .6); const pts = []; const m = s.length - 1; const q = L * m; for (let j = 0; j <= Math.floor(q) && j <= m; j++) pts.push(s[j]); if (q < m) pts.push(vl(s[Math.floor(q)], s[Math.floor(q) + 1], q - Math.floor(q)));
        sqs[i].set(pts, o * .9); });
      lab('s1', 'step 1', V(-.55, -.85, 0), o * ks); lab('s2', 'step 2', V(.5, .19, 0), o * ks);
    } }
  // b14 and b15: rings of the steps, the tower of blocks
  { const o = win(t, S('b14') - .1, at('b16', .95), .5, .5);
    if (o > 0) {
      for (let k = 0; k < 4; k++) { const ko = prog(t, at('b14', .06 + .1 * k), .5) * o; const Rk = Math.pow(.6, k);
        stepRing[k].set(circ(O3, Rk, RIGHT, UP, 100), ko * (k ? .85 : 1)); stepIn[k].set(circ(O3, Rk * .775, RIGHT, UP, 100), ko * (t > at('b14', .1) ? 1 : 0) * (k === 0 ? 1 : .8)); }
      lab('stepR', 'R' + sub('k'), V(0, 1, 0), prog(t, at('b14', .08), .4) * win(t, 0, at('b15', .5), .1, .5) * o, { dy: -46, size: 64 });
      lab('typ', 'typical', V(0, .775, 0), win(t, at('b14', .22), at('b15', 0), .4, .4) * o, { dx: 190, dy: 30 });
      const x0 = 1100, W = 330;
      lab('twT', 'blocks', { x: 1450, y: 450 }, prog(t, at('b14', .5), .5) * o);
      for (let k = 0; k < 4; k++) { const kk = prog(t, at('b14', .5) + k * .35, .5) * o, y = 500 + k * 85, w = Math.max(W * DT.tower[k], 6);
        bar('tw' + k, x0, y, w * kk, 60, kk);
        lab('tk' + k, 'k = ' + k, { x: x0 - 80, y: y + 30 }, kk, { size: 56 });
        if (k) lab('tr' + k, '× 0.34', { x: x0 + W * DT.tower[k] + 130, y: y + 30 }, kk, { size: 56 }); }
      const sm = prog(t, at('b15', .28), .6) * o;
      bar('twS', x0, 850, W * DT.tower_sum * sm, 60, sm, { border: 5, fill: 'transparent' });
      lab('twV', DT.tower_sum.toFixed(2), { x: x0 + W * DT.tower_sum + 110, y: 880 }, sm, { size: 84 });
    } }
  // b17: two ceilings, take the lower; b18: the same brackets shrink
  { const o = win(t, at('b17', .08), S('b18'), .5, .4);
    if (o > 0) {
      const x0 = 560, W = 1000; const kc = prog(t, at('b17', .15), .7), kg = prog(t, at('b17', .4), .7), lo = prog(t, at('b17', .62), .5);
      lab('cA', 'any spread', { x: x0 + 150, y: 330 }, o * kc); bar('cb', x0, 370, W * DT.C_06_005 * kc, 90, o * kc, { fill: 'transparent', border: 6 });
      lab('cAv', DT.C_06_005.toFixed(2), { x: x0 + W * DT.C_06_005 + 130, y: 415 }, o * kc, { size: 84 });
      lab('cG', 'even spread', { x: x0 + 160, y: 580 }, o * kg); bar('gb', x0, 620, W * DT.G_06_005_d5 * kg, 90, o * kg, { fill: WHT });
      lab('cGv', DT.G_06_005_d5.toFixed(2), { x: x0 + W * DT.G_06_005_d5 + 130, y: 665 }, o * kg, { size: 84 });
      lab('low', 'the lower one', { x: x0 + W * DT.G_06_005_d5 + 420, y: 665 }, o * lo);
    } }
  { const o = win(t, at('b18', .1), S('b19') + .3, .4, .4);
    for (let k = 0; k < 5; k++) { const kk = prog(t, at('b18', .1) + k * .12, .5) * o, w = 800 * Math.pow(.6, k); bar('br' + k, 960 - w / 2, 330 + k * 100, w * kk, 62, kk, { fill: 'transparent', border: 6 }); }
    lab('brT', 'bracket', { x: 960, y: 270 }, o); }

  // ===== scene 4: Figure 1
  { const o = win(t, at('b19', .0), S('b22'), .5, .5);
    if (o > 0) {
      const hs = prog(t, at('b19', .22), 1.6), hCol = prog(t, at('b19', .22), 1.6);
      const X = i => -1.5 + 3 * i / (NA - 1), Z = j => -1.2 + 2.4 * j / (ND - 1), Y = (j, i) => 2.0 * hs * DT.ratio[j][i];
      for (let j = 0; j < ND; j++) for (let i = 0; i < NA; i++) { const q = (j * NA + i) * 3, c = rampC((DT.ratio[j][i] - .25) / .7); surf.pos[q] = X(i); surf.pos[q + 1] = Y(j, i); surf.pos[q + 2] = Z(j); surf.col[q] = lerp(.7, c[0], hCol); surf.col[q + 1] = lerp(.7, c[1], hCol); surf.col[q + 2] = lerp(.7, c[2], hCol); }
      surf.done(o * .95);
      for (let j = 0; j < ND; j++) wA[j].set([...Array(NA)].map((_, i) => V(X(i), Y(j, i) + .01, Z(j))), o * .55);
      [0, 5, 10, 15, 20].forEach((i, k) => wD[k].set([...Array(ND)].map((_, j) => V(X(i), Y(j, i) + .01, Z(j))), o * .55));
      const ax = prog(t, at('b19', .06), .6);
      axF[0].set([V(-1.7, 0, 1.45), vl(V(-1.7, 0, 1.45), V(1.7, 0, 1.45), ax)], o); axF[1].set([V(-1.7, 0, 1.45), vl(V(-1.7, 0, 1.45), V(-1.7, 0, -1.3), ax)], o); axF[2].set([V(-1.7, 0, 1.45), vl(V(-1.7, 0, 1.45), V(-1.7, 2.0, 1.45), ax)], o * (1 - prog(t, at('b20', .02), .8)));
      lab('aA', 'α', V(1.95, 0, 1.45), o * ax, { size: 72 }); lab('aD', 'd', V(-2.3, 0, 0), o * ax, { size: 72 });
      lab('aR', 'ratio', V(-1.7, 2.0, 1.45), o * prog(t, at('b19', .3), .5) * (1 - prog(t, at('b20', .02), .8)), { size: 72, dy: -50 });
      { const ao = win(t, at('b20', .1), S('b22'), .5, .5) * o; lab('a0', '0', V(-1.5, 0, 1.45), ao, { dy: 50 }); lab('a1', '0.95', V(1.5, 0, 1.45), ao, { dy: 50 }); lab('d1', '1', V(-1.7, 0, -1.2), ao, { dx: -55 }); lab('d2', '10', V(-1.7, 0, 1.2), ao, { dx: -60 }); }
      // colour bar and the three callouts
      const co = win(t, at('b20', .1), S('b22'), .5, .5) * o;
      if (co > 0) {
        const e = el('cbar', 'fill'); e.style.left = '1640px'; e.style.top = '320px'; e.style.width = '50px'; e.style.height = '460px'; e.style.opacity = co;
        e.style.background = 'linear-gradient(to top,rgb(8,15,64),rgb(61,166,255),#fff)'; e.style.border = 'none';
        lab('cb0', '0.3', { x: 1735, y: 770 }, co); lab('cb1', '0.9', { x: 1735, y: 330 }, co); lab('cbT', 'ratio', { x: 1665, y: 270 }, co);
      }
      const cs = [[19, 0, at('b20', .18), '0.29'], [0, 9, at('b20', .5), '0.91'], [12, 4, at('b21', .0), '0.56']];
      cs.forEach(([i, j, tt, txt], k) => { const p = V(X(i), Y(j, i) + .02, Z(j)), w = win(t, tt, k === 2 ? S('b22') : (k === 0 ? at('b20', .5) : at('b21', 0)) + .4, .3, .3) * o;
        mk[k].set(p, .06 * CD / 9, w);
        lab('cl' + k, txt, p, w, { size: 84, dx: k === 1 ? -270 : k === 2 ? 420 : 150, dy: 0 }); });
      lab('ours', 'our experiment', scr(V(X(12), Y(4, 12), Z(4))), win(t, at('b21', .25), S('b22'), .3, .3) * o, { dx: 420, dy: 70, size: 56 });
    } }

  // ===== scene 5: Proposition 3, the lift
  { const o = win(t, at('b22', .0), S('b24'), .5, .5);
    if (o > 0) {
      const Rd = 1.3, u = (() => { const m = prog(t, at('b23', .42), .9) - prog(t, at('b23', .62), .8); return .35 + .9 * m; })();
      diskR.set(circ(O3, Rd, PL[1][0], PL[1][1], 100), o);
      const fl = prog(t, at('b22', .08), .5); dcl.begin();
      for (let k = 0; k < 400; k++) { const p = P2[k]; const q = V(p.x * Rd, 0, p.y * Rd); const beyond = p.x > u; dcl.add(q, o * fl * (beyond ? 1 : .35)); } dcl.end();
      const tl = prog(t, at('b22', .4), .6), w = Math.sqrt(Math.max(0, 1 - u * u)) * Rd;
      tie.set(u < 1 ? [V(u * Rd, 0, -w), V(u * Rd, 0, w)] : [], o * tl);
      lab('tieL', 'challenger ties', V(u * Rd, 0, -w - .1), o * tl * win(t, 0, at('b23', .25), .1, .3) * (u < 1 ? 1 : 0), { dy: -50 });
      // ramp: gain beyond the line
      const rk = prog(t, at('b22', .66), .9), ro = o * rk * (u < .985 ? 1 : 0);
      if (ro > 0) {
        for (let i = 0; i <= NX; i++) { const x = u + (1 - u) * i / NX, ww = Math.sqrt(Math.max(0, 1 - x * x)); for (let j = 0; j <= NZ; j++) { const z = -ww + 2 * ww * j / NZ, h = (x - u) * Rd * rk, q = (i * (NZ + 1) + j) * 3;
          ramp.pos[q] = x * Rd; ramp.pos[q + 1] = h; ramp.pos[q + 2] = z * Rd; { const cc = rampC(.45 + .55 * (x - u) / Math.max(1 - u, .05)); ramp.col[q] = cc[0]; ramp.col[q + 1] = cc[1]; ramp.col[q + 2] = cc[2]; } } }
        ramp.done(ro);
        const e1 = [], e2 = []; for (let i = 0; i <= NX; i++) { const x = u + (1 - u) * i / NX, ww = Math.sqrt(Math.max(0, 1 - x * x)); e1.push(V(x * Rd, (x - u) * Rd * rk, ww * Rd)); e2.push(V(x * Rd, (x - u) * Rd * rk, -ww * Rd)); }
        rampEdge.set([...e1, ...e2.reverse()], ro);
        lab('gain', 'gain', V(.95 * Rd, .6 * Rd * rk, 0), win(t, at('b22', .8), S('b23'), .4, .4) * o, { dx: 70, dy: -40 });
      }
      // the average gain B as a flat level
      const Kh = Kd2(u) * Rd, bo = win(t, at('b23', .08), at('b24', 0), .4, .4) * o * (u < .985 ? 1 : 0);
      kRing.set(circ(V(0, Kh, 0), Rd, PL[1][0], PL[1][1], 100), bo); lab('Bl', 'B', V(Rd, Kh, 0), bo, { dx: 60, size: 84 });
      lab('nol', 'no lift', O3, o * win(t, at('b23', .56), at('b23', .7), .1, .15) * (u >= .985 ? 1 : 0), { size: 84, dy: -80 });
    } }

  // ===== scene 6: Section 5
  { const o = win(t, at('b24', 0), at('b25', .1), .5, .4);
    if (o > 0) {
      const sk = prog(t, at('b24', .0), .8);
      PL.forEach(([u, w], i) => sph[i].set(circ(O3, 2, u, w, 100), o * sk));
      const ADp = [...Array(10)].map((_, i) => { const a = i * 2.399 + .5, z = 1 - 2 * (i + .5) / 10, r = Math.sqrt(1 - z * z); return V(r * Math.cos(a), z, r * Math.sin(a)).multiplyScalar(2); });
      adD.forEach((d, i) => d.set(ADp[i], .08 * CD / 11, o * prog(t, at('b24', .14) + i * .02, .3)));
      lab('t10', '10 ads', ADp[4], o * win(t, at('b24', .2), at('b24', .55), .3, .3) * 0, { color: BLU });
      lab('n10', '10 ads', { x: 1560, y: 330 }, o * win(t, at('b24', .16), at('b24', .5), .3, .3), { color: BLU });
      noAd.set(O3, .05 * CD / 11, o * win(t, at('b24', .34), 1e9, .3)); lab('noA', 'no ad', O3, o * win(t, at('b24', .34), at('b24', .55), .3, .3), { dx: 130, dy: 30 });
      // ball sweep 0.1 to 1.0, settle at 0.4, shrinking by 0.6
      const gp = V(.9, .6, -.3), sw = prog(t, at('b24', .5), .22), bk = prog(t, at('b24', .76), .1);
      const rho = t < at('b24', .72) ? lerp(.1, 1.0, sw) : lerp(1.0, .4, prog(t, at('b24', .72), .12));
      g0.set(gp, .05 * CD / 11, o * win(t, at('b24', .46), 1e9, .3));
      PL.forEach(([u, w], i) => ball5[i].set(circ(gp, 2 * rho, u, w, 90), o * win(t, at('b24', .46), 1e9, .3)));
      [1, 2].forEach(m => PL.forEach(([u, w], i) => ghost5[m - 1][i].set(circ(gp, 2 * .4 * Math.pow(.6, m), u, w, 90), o * prog(t, at('b24', .8 + .07 * m), .4))));
      const hu = win(t, at('b24', .5), at('b25', .0), .4, .4) * o;
      lab('hk', 'starting radius', { x: 330, y: 330 }, hu); lab('hv', rho.toFixed(1), { x: 330, y: 410 }, hu, { size: 84 });
      lab('sk', 'shrinks each message', { x: 330, y: 520 }, o * prog(t, at('b24', .8), .4) * win(t, 0, at('b25', 0), .1, .4), { size: 56 });
    } }
  { const o = win(t, S('b25'), at('b27', .0), .5, .5);
    if (o > 0) {
      const lv = [0, at('b25', .1), at('b25', .55), at('b26', .02), at('b26', .16)];
      const vis = n => prog(t, lv[n.l], .5) * o;
      const dim = i => STOPSUB.has(i) ? 1 - .7 * prog(t, at('b26', .86), .5) : 1;
      const pairs = [], dpairs = [];
      TN.forEach((n, i) => { if (n.p >= 0) { const a = TN[n.p], v = Math.min(vis(n), 1); if (v > .01) { const P0_ = V(a.x, a.y, 0), P1_ = vl(P0_, V(n.x, n.y, 0), v); (STOPSUB.has(i) ? dpairs : pairs).push(P0_, P1_); } } });
      treeE.set(pairs, o); stopE.set(dpairs, o * (1 - .6 * prog(t, at('b26', .86), .5)));
      const wv = [0, 0, at('b26', .74), at('b26', .6), at('b26', .5)];   // wave: leaves 3 (value), L2 .5, L1 .6, root .74
      TN.forEach((n, i) => { const v = vis(n), tw = n.l === 3 ? at('b26', .32) : wv[n.l === 2 ? 4 : n.l === 1 ? 3 : 2]; const r = lerp(.05, .03 + .1 * n.v, prog(t, tw, .4));
        nodeD[i].set(V(n.x, n.y, 0), r * (v > 0 ? 1 : 0), v * dim(i)); });
      lab('cur', 'current guess', V(0, 1.5, 0), o * win(t, at('b25', .12), at('b25', .6), .3, .3), { dx: 260 });
      lab('evn', 'even spread', { x: 330, y: 200 }, o * win(t, at('b26', .02), at('b26', .3), .3, .3));
      lab('few', 'fewer branches', { x: 330, y: 290 }, o * win(t, at('b26', .16), at('b26', .34), .3, .3));
      lab('bst', 'value = best ad', { x: 960, y: 985 }, o * win(t, at('b26', .3), at('b26', .52), .3, .3));
      lab('mx1', 'max', V(-1.9, .5, 0), o * win(t, at('b26', .5), at('b26', .7), .3, .3), { dx: -110, size: 72 });
      lab('mx0', 'max', V(0, 1.5, 0), o * win(t, at('b26', .72), at('b26', .86), .3, .3), { dx: 140, size: 72 });
      lab('stp', 'stops early', V(1.9, .5, 0), o * win(t, at('b26', .86), at('b27', 0), .3, .3), { dx: 190, size: 56 });
    } }
  { const o = win(t, at('b27', .0), at('b30', .0), .5, .5);
    if (o > 0) {
      const X = r => -2 + 4 * (r - .1) / .9, Y = l => -1 + 2 * l / .25, ax = prog(t, at('b27', .04), .5);
      chAx[0].set([V(-2.2, -1, 0), vl(V(-2.2, -1, 0), V(2.2, -1, 0), ax)], o); chAx[1].set([V(-2.2, -1, 0), vl(V(-2.2, -1, 0), V(-2.2, 1.1, 0), ax)], o);
      lab('xT', 'starting radius', { x: 960, y: 930 }, o * ax); lab('x0', '0.1', V(-2, -1, 0), o * ax, { dy: 50 }); lab('x1', '1.0', V(2, -1, 0), o * ax, { dy: 50 });
      lab('yT', 'value lost vs the best plan', { x: 960, y: 140 }, o * ax);
      [[0, '0'], [.1, '10%'], [.2, '20%']].forEach(([l, s], i) => lab('y' + i, s, V(-2.2, Y(l), 0), o * ax, { dx: -80 }));
      const cs = clamp((t - at('b27', .3)) / (D('b27') * .6)) * 9, ip = Math.floor(cs), pts = [];
      for (let i = 0; i <= Math.min(ip, 9); i++) pts.push(V(X(.1 * (i + 1)), Y(DT.paper_fig3[i]), 0));
      if (ip < 9) pts.push(vl(pts[pts.length - 1], V(X(.1 * (ip + 2)), Y(DT.paper_fig3[ip + 1]), 0), cs - ip));
      chCurve.set(pts, o);
      DT.paper_fig3.forEach((v, i) => chPts[i].set(V(X(.1 * (i + 1)), Y(v), 0), .07 * CD / 6.4, o * clamp(cs - i + .3)));
      // b28: the 84 percent
      const p4 = V(X(.4), Y(DT.paper_fig3[3]), 0), c4 = win(t, at('b28', .02), at('b29', 0), .4, .4) * o;
      chGuide.set([V(X(.4), -1, 0), p4], c4); chRing.set(circ(p4, .12, RIGHT, UP, 40), c4);
      lab('c84', Math.round((1 - DT.paper_fig3[3]) * 100) + '%', { x: 1400, y: 760 }, c4, { size: 96 }); lab('c84b', 'of the best plan', { x: 1400, y: 850 }, c4); lab('c04', '0.4', V(X(.4), -1, 0), c4, { dy: 50 });
      lab('c05', 'under 5% lost', V(X(.1), Y(DT.paper_fig3[0]), 0), win(t, at('b28', .45), at('b28', .72), .3, .3) * o, { dx: 270, dy: 20 });
      lab('c20', '20% lost', V(X(1), Y(DT.paper_fig3[9]), 0), win(t, at('b28', .66), at('b29', 0), .3, .3) * o, { dx: -140, dy: -70 });
      // b29: the guarantee line leaves the chart
      const gb = prog(t, at('b29', .1), .8), x1 = lerp(-2, X(.4), gb), y1 = lerp(-1, 1, gb);
      chBound.set([V(-2, -1, 0), V(x1, y1, 0)], o * win(t, at('b29', .1), 1e9, .3));
      lab('gar', 'guarantee', V(X(.4), 1, 0), o * win(t, at('b29', .45), 1e9, .3), { dx: 150, dy: 20 });
    } }
  { const o = win(t, at('b30', .0), 1e9, .6);
    lab('q1', 'Why would advertisers', { x: 960, y: 480 }, o, { size: 96 }); lab('q2', 'tell the truth?', { x: 960, y: 600 }, o * win(t, at('b30', .35), 1e9, .6), { size: 96 }); }

  formula('top', TOP, t, 960, 128); formula('bot', BOT, t, 960, 950);
  { const f = prog(t, E('b30') + .2, 1.2), e = el('fade', 'fill'); e.style.left = '0px'; e.style.top = '0px'; e.style.width = '1920px'; e.style.height = '1080px'; e.style.background = '#000'; e.style.opacity = f; e.style.border = 'none'; e.style.zIndex = 9; if (f <= .004) e.style.display = 'none'; }
  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  R.render(scene, cam);
}
window.seek = t => draw(t);
window.ready = true;
draw(0);
