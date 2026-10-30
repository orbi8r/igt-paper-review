// Part 5: how close to the best (Theorem 1 with its proof, Proposition 1 with its proof). Pure function of time: window.seek(t).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const J = async f => (await fetch(f)).json();
const [TM, DT] = await Promise.all([J('timing5.json'), J('part5_data.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
window.TOTAL = TM._total;

const YEL = '#FFE600', BLU = '#3DA5FF', WHT = '#ffffff', GRY = '#9a9a9a', DIM = '#bdbdbd';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vl = (a, b, k) => a.clone().lerp(b, k);
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));

const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(devicePixelRatio); R.setSize(1920, 1080); document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
cam.setViewOffset(1920, 1080, 0, 50, 1920, 1080);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.55); scene.add(sun);

// ---------- pooled primitives: every frame draws what it needs by key, unused ones hide
class FL {
  constructor(color, w, dashed, ds, gs) {
    this.mat = new LineMaterial({ color, linewidth: w, dashed, dashSize: ds, gapSize: gs, worldUnits: false, transparent: true });
    this.mat.resolution.set(1920, 1080);
    this.obj = new Line2(new LineGeometry(), this.mat); this.obj.frustumCulled = false; this.obj.visible = false; scene.add(this.obj);
  }
  set(pts, op) {
    const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    this.obj.geometry.dispose(); this.obj.geometry = g; this.obj.computeLineDistances(); this.mat.opacity = op; this.obj.visible = true;
  }
}
const FLS = new Map(), DOTS = new Map(), BOXES = new Map(); let uF, uD, uB;
function line(key, pts, op = 1, color = WHT, w = 6, dashed = false, ds = .06, gs = .045) {
  if (op <= .004 || pts.length < 2) return;
  let f = FLS.get(key); if (!f) { f = new FL(color, w, dashed, ds, gs); FLS.set(key, f); }
  f.mat.color.set(color); f.mat.linewidth = w; f.set(pts, op); uF.add(key);
}
const SPH = new THREE.SphereGeometry(1, 24, 16), BOXG = new THREE.BoxGeometry(1, 1, 1);
function dot(key, p, r, op = 1, color = WHT) {
  if (op <= .004 || r <= 1e-4) return;
  let d = DOTS.get(key); if (!d) { d = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: !key.startsWith('mcd') })); if (key.startsWith('mcd')) d.renderOrder = 9; scene.add(d); DOTS.set(key, d); }
  d.material.color.set(color); d.material.opacity = op; d.position.copy(p); d.scale.setScalar(r); d.visible = true; uD.add(key);
}
function box(key, cx, y0, y1, w, dp, color, op = 1, z = 0) {
  if (op <= .004 || y1 - y0 < 1e-4) return;
  let b = BOXES.get(key); if (!b) { b = new THREE.Mesh(BOXG, new THREE.MeshLambertMaterial({ color, transparent: true })); scene.add(b); BOXES.set(key, b); }
  b.material.color.set(color); b.material.opacity = op; b.position.set(cx, (y0 + y1) / 2, z); b.scale.set(w, y1 - y0, dp); b.visible = true; uB.add(key);
}
function boxEdges(key, cx, y0, y1, w, dp, color, op, px = 6, dashed = false, z = 0) {
  if (y1 - y0 < 1e-4) return;
  const a = cx - w / 2, b = cx + w / 2, c = z - dp / 2, d = z + dp / 2;
  const p = (x, y, zz) => V(x, y, zz);
  line(key, [p(a, y0, c), p(b, y0, c), p(b, y0, d), p(a, y0, d), p(a, y0, c), p(a, y1, c), p(b, y1, c), p(b, y0, c), p(b, y1, c), p(b, y1, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), p(a, y0, d), p(a, y1, d), p(a, y1, c)], op, color, px, dashed);
}
const circ = (c, r, n = 100) => { const o = []; for (let k = 0; k <= n; k++) { const a = 2 * Math.PI * k / n; o.push(V(c.x + r * Math.cos(a), c.y + r * Math.sin(a), c.z)); } return o; };
const brace = (x, y0, y1, s = .16) => [V(x - s, y0, 0), V(x, y0, 0), V(x, y1, 0), V(x - s, y1, 0)];

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
const ctx2 = document.createElement('canvas').getContext('2d');
const textW = (s, px) => { ctx2.font = `700 ${px}px "Noto Sans"`; return ctx2.measureText(s.replace(/<[^>]+>/g, '')).width; };
// label to the left of a 3D point, right aligned
const labL = (key, h, pos, op, o = {}) => { const p = scr(pos); lab(key, h, { x: p.x - textW(h, o.size || 56) / 2 - 24, y: p.y }, op, o); };
const labR = (key, h, pos, op, o = {}) => { const p = scr(pos); lab(key, h, { x: p.x + textW(h, o.size || 56) / 2 + 24, y: p.y }, op, o); };

// ---------- surfaces
function Surf(nx, nz, op = 1) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
  const idx = []; for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + 1, c = a + nz, d = c + 1; idx.push(a, c, b, b, c, d); } g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: op })); m.visible = false; scene.add(m);
  return { m, g, nx, nz, set(fn, vis) { this.m.visible = vis > .004; if (!(vis > .004)) return; this.m.material.opacity = vis; const P = g.attributes.position.array, C = g.attributes.color.array;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const [x, y, z, c] = fn(i, j), k = (i * nz + j) * 3; P[k] = x; P[k + 1] = y; P[k + 2] = z; C[k] = C[k + 1] = C[k + 2] = c; }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals(); } };
}

// ---------- camera
const KEYS = [];
const P0 = { az: 8, el: 6, dist: 11, tg: V(0, 1.5, 0) };
const key = (t, d, p) => KEYS.push([t, d, p]);
function camAt(t) {
  let p = { ...P0, tg: P0.tg.clone() };
  for (const [s, d, q] of KEYS) { const k = prog(t, s, d); if (k <= 0) break; p = { az: lerp(p.az, q.az, k), el: lerp(p.el, q.el, k), dist: lerp(p.dist, q.dist, k), tg: vl(p.tg, q.tg, k) }; }
  const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  cam.position.copy(p.tg).add(V(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(p.dist));
  cam.up.set(0, 1, 0); cam.lookAt(p.tg); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  sun.position.copy(cam.position).add(V(0, 3, 0));
}

// ---------- formulas (token states: shared keys slide, new ones fade or fly in)
const measCache = new Map();
function layout(toks, size) {
  const k = toks.map(t => t.k + '|' + t.h).join('#') + size; if (measCache.has(k)) return measCache.get(k);
  const m = document.createElement('div'); m.className = 'meas'; m.style.fontSize = size + 'px'; OV.appendChild(m);
  m.innerHTML = toks.map(t => `<span style="margin:0 ${t.sp ?? .1}em">${t.h}</span>`).join('');
  const r0 = m.getBoundingClientRect(), out = {}, W = r0.width;
  [...m.children].forEach((c, i) => { const r = c.getBoundingClientRect(); out[toks[i].k] = { x: r.left - r0.left + r.width / 2 - W / 2, w: r.width }; });
  m.remove(); measCache.set(k, out); return out;
}
function formula(name, states, t, cx, cy) {
  let j = -1; states.forEach((s, i) => { if (s.t <= t) j = i; }); if (j < 0) return;
  const cur = states[j], prev = j > 0 ? states[j - 1] : { toks: [] }, size = cur.size || 72, k = prog(t, cur.t, .6);
  const lc = layout(cur.toks, size), lp = layout(prev.toks, prev.size || size);
  const pk = new Map(prev.toks.map(x => [x.k, x]));
  const draw = (id, h, x, y, op, sz) => { if (op <= .004) return; const e = el(name + id, 'tok'); html(e, h); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = op; e.style.fontSize = sz + 'px'; e.style.color = WHT; };
  for (const x of cur.toks) {
    const tx = cx + lc[x.k].x, old = pk.get(x.k); let sx = tx, sy = cy, op = 1;
    if (old) sx = cx + lp[x.k].x; else if (x.from && k < 1) { const f = x.from(); sx = f.x; sy = f.y; op = clamp(k * 4); } else op = clamp((k - .7) / .3);
    const px = lerp(sx, tx, k), py = lerp(sy, cy, k);
    if (old && old.h !== x.h) { draw(x.k + 'o', old.h, px, py, 1 - k, size); draw(x.k, x.h, px, py, k, size); } else draw(x.k, x.h, px, py, op, size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = px + 'px'; c.style.top = (py + size * .62) + 'px'; c.style.opacity = old && old.cap ? 1 : k; }
  }
  for (const x of prev.toks) if (!cur.toks.find(y => y.k === x.k)) {
    draw(x.k, x.h, cx + lp[x.k].x, cy, 1 - k, prev.size || size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = (cx + lp[x.k].x) + 'px'; c.style.top = (cy + size * .62) + 'px'; c.style.opacity = 1 - k; }
  }
}
const sub = s => `<sub>${s}</sub>`, sup = s => `<sup style="font-size:.6em">${s}</sup>`;
const T = (k, h, o = {}) => ({ k, h, ...o });
const fromW = (x, y, z = 0) => () => scr(V(x, y, z));
const rt = 'r' + sub('t');

// ---------- constants from the check script
const AL = .6, PP = .2, Q = 1 - PP;
const Cf = (a, p) => { let m = 0; for (let k = 1; k < 300; k++) m = Math.max(m, Math.pow(1 - p, k) * (1 - Math.pow(a, k))); return m; };
const gridC = (a, p) => { const x = clamp((a - .05) / .05, 0, 17.999), y = clamp((p - .05) / .05, 0, 17.999), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, G = DT.Cgrid;
  return G[j][i] * (1 - fx) * (1 - fy) + G[j][i + 1] * fx * (1 - fy) + G[j + 1][i] * (1 - fx) * fy + G[j + 1][i + 1] * fx * fy; };
const f2 = x => x.toFixed(2), f3 = x => x.toFixed(3);

// ==================== SCENE A: bracket width (p01 to p07)
const YA = 3.0;
const xL = -1.9, xP = -0.3, xG = 1.5, xR = 2.9, WA = .8;
const Ltop = DT.A_L * YA, fitTop = DT.A_fit2 * YA, Utop = DT.A_U * YA, gainH = DT.A_gain2 * YA;
// ==================== SCENE B bars
const bx = k => -2.0 + (k - 1) * .8, YB = 2.4, ROWZ = { gain: 1.5, stay: 0, prod: -1.5 };
const gainK = k => 1 - Math.pow(AL, k), stayK = k => Math.pow(Q, k), prodK = k => gainK(k) * stayK(k);
// ==================== SCENE B surface
const sx = a => (a - .5) * 4.8, sz = p => (.5 - p) * 4.8, YS = 2.4;
const surfC = Surf(19, 19);
// ==================== SCENE C tower
const YT = 4.2, SLAB_W = 1.6, LAND = [at('p15', .62), at('p16', .72), ...[.12, .24, .36, .48, .6, .72].map(f => at('p17', f))];
const RING = V(-3.4, 2.4, 0), R0 = .85, BARX = 2.7, BARL = 1.6;
// ==================== SCENE D gap surface
const MU = 21, RN = 26, XM = 3.4, YG = 6.0;
const gapAt = x => { const X = DT.ex.x, G = DT.ex.gap; const a = Math.abs(x); if (a >= 1) return 0; const f = (a + 1) / .01 * 1; /* x grid is -1..1 step 0.01 */ const i = Math.floor((x + 1) / .01); const w = (x + 1) / .01 - i; return G[Math.min(i, G.length - 2)] * (1 - w) + G[Math.min(i + 1, G.length - 1)] * w; };
const gapS = Surf(71, RN), planeS = Surf(2, 2, .22);
const gpos = (mu, r) => V(mu * XM, 0, (.5 - r) * 3.4);
const gh = (mu, r) => r < 1e-6 ? 0 : r * gapAt(mu / r) * YG;

// ---------- timeline anchors
const FADEEND = E('p37'), TITLE_END = 2.2;
const tAfade = at('p08', .1), tBend = at('p12', .55), tSurfEnd = at('p15', .12), tTowEnd = at('p24', .03), tGapEnd = at('p28', .1);
key(S('p03') - .3, 2.0, { az: 8, el: 8, dist: 11, tg: V(0, 1.5, 0) });
key(at('p08', .02), 2.2, { az: 4, el: 6, dist: 11, tg: V(0, 1.4, 0) });
key(at('p12', .25), 2.4, { az: 24, el: 36, dist: 11, tg: V(0, .5, 0) });
key(S('p13'), D('p13') + D('p14'), { az: 34, el: 36, dist: 11, tg: V(0, .5, 0) });
key(at('p15', .0), 2.2, { az: 4, el: 8, dist: 10, tg: V(0, 1.6, 0) });
key(at('p22', .25), 2.0, { az: 4, el: 8, dist: 13, tg: V(0, 2.4, 0) });
key(at('p25', .0), 2.2, { az: 28, el: 24, dist: 9, tg: V(0, .6, 0) });
key(S('p26'), D('p26') + D('p27'), { az: 52, el: 22, dist: 9, tg: V(0, .6, 0) });
key(at('p27', .7), 2.2, { az: 0, el: 0, dist: 10, tg: V(0, 0, 0) });

// ---------- formulas
const TOP = [
  { t: at('p05', .55), toks: [T('D', 'D', { from: fromW(xR, 3.0), sp: .02 }), T('r', rt, { from: fromW(xR, 2.2) })] },
  { t: at('p06', .6), toks: [T('D', 'D', { sp: .02 }), T('r', rt, { sp: .25 }), T('g', `(1 − p)${sup('k')}(1 − α${sup('k')})`, { from: fromW(xP, 2.0), cap: 'top block' })] },
  { t: at('p07', .35), toks: [T('ul', 'U − L'), T('le', '≤'), T('D', 'D', { sp: .02 }), T('r', rt, { sp: .25 }), T('g', `max${sub('k')} (1 − p)${sup('k')}(1 − α${sup('k')})`)] },
  { t: at('p11', .55), toks: [T('ul', 'U − L'), T('le', '≤'), T('D', 'D', { sp: .02 }), T('r', rt, { sp: .25 }), T('g', 'C', { cap: 'best wait' })] },
  { t: at('p14', .9), toks: [] },
  { t: at('p15', .55), size: 64, toks: [T('h', '½', { from: fromW(0, 1.0), sp: .02 }), T('D', 'D', { sp: .02 }), T('C', 'C', { sp: .02 }), T('r', rt, { sp: .02 })] },
  { t: at('p16', .78), size: 64, toks: [T('h', '½', { sp: .02 }), T('D', 'D', { sp: .02 }), T('C', 'C', { sp: .02 }), T('r', rt, { sp: .1 }), T('o', '(1 +'), T('q', '(1 − p)', { from: fromW(BARX, 2.4) }), T('a', 'α', { from: fromW(-3.4, 2.4), sp: .02 }), T('c', `+ ((1 − p)α)${sup('2')} + … )`)] },
  { t: at('p18', .45), size: 64, toks: [T('h', '½', { sp: .02 }), T('D', 'D', { sp: .02 }), T('C', 'C', { sp: .02 }), T('r', rt, { sp: .1 }), T('o', '×'), T('q', '1 / (1 − (1 − p)α)', { cap: 'a tower that stops growing' })] },
  { t: at('p19', .55), size: 64, toks: [T('lhs', `V${sup('*')} − V${sup('π')}`, { cap: 'Theorem 1' }), T('le', '≤'), T('h', 'D C ' + rt, { sp: .02 }), T('o', '/'), T('q', '(2(1 − (1 − p)α))')] },
  { t: at('p23', .98), toks: [] },
  { t: at('p35', .3), size: 64, toks: [T('S', 'S', { from: fromW(-2.3, -1.0), cap: 'showing now' }), T('x', '×'), T('f', 'p / (1 + p)', { from: fromW(-1.6, -1.6) })] },
  { t: at('p35', .62), size: 64, toks: [T('S', `(1 − p)(1 − α) D ${rt} / 4`, { cap: 'showing now' }), T('x', '×'), T('f', 'p / (1 + p)')] },
  { t: at('p36', .0), size: 64, toks: [T('lhs', `V${sup('*')} − V${sup('π')}`, { cap: 'Proposition 1' }), T('le', '≥'), T('S', `p(1 − p)(1 − α) D ${rt} / 4(1 + p)`)] },
  { t: at('p37', .0), toks: [] },
];

// ==================== the frame
function draw(t) {
  used = new Set(); uF = new Set(); uD = new Set(); uB = new Set();
  camAt(t);
  const ZERO = V(0, 0, 0);

  // ---- title that morphs into the first scene
  const tt = win(t, 0, 1.45, .3, .6), ty = prog(t, 1.4, .8) * -150;
  lab('t1', 'Part 5', { x: 960, y: 430 + ty }, tt, { size: 128 });
  lab('t2', 'How close to the best', { x: 960, y: 570 + ty }, tt, { size: 96 });

  // ---- scene A
  const oA = win(t, 1.9, tAfade, .5, .6);
  if (oA > 0) {
    line('gnd', [V(-3.6, 0, 0), V(3.6, 0, 0)], oA * .6, DIM, 3);
    const gw = prog(t, at('p01', .3), .8) * oA;
    line('gC', [V(-3.4, Utop, 0), V(3.4, Utop, 0)], gw * .7, WHT, 3, true);
    line('gF', [V(-3.4, Ltop, 0), V(3.4, Ltop, 0)], gw * .7, WHT, 3, true);
    labL('cl', 'ceiling', V(-3.4, Utop, 0), gw, {}); labL('fl', 'floor', V(-3.4, Ltop, 0), gw, {});
    const gwb = prog(t, at('p01', .6), .8) * oA * (1 - prog(t, S('p07') + 3.4, .6));
    line('br', brace(3.9, Ltop, Utop), gwb, WHT, 6); labR('wd', 'width', V(3.9, (Ltop + Utop) / 2, 0), gwb, {});
    const fade7 = 1 - prog(t, at('p07', .45), .7);
    const fade6 = 1 - prog(t, at('p06', .2), .6);
    // floor column
    const gl = prog(t, at('p02', .15), .6);
    box('L', xL, 0, Ltop * gl, WA, WA, WHT, oA * (.25 + .75 * fade7)); lab('lL', 'floor', V(xL, -.45, 0), oA * win(t, at('p02', .4), S('p07'), .3, .5), {});
    // plan column outline, fit block, top block
    const po = win(t, at('p03', .2), 1e9, .5) * oA;
    boxEdges('Pe', xP, 0, Utop, WA, WA, WHT, po * .8 * (1 - prog(t, at('p05', .8), .4)), 5, true);
    const gf = prog(t, at('p04', .15), .6);
    box('fit', xP, 0, fitTop * gf, WA, WA, GRY, oA * (.25 + .75 * fade7));
    lab('lP', 'wait two', V(xP, -.45, 0), po, {});
    // shortfall marker
    const sh = win(t, at('p04', .45), at('p06', .3), .4, .4) * oA;
    line('sf', [V(xP + .6, fitTop, 0), V(xP + .6, Ltop, 0)], sh, WHT, 6); line('sf1', [V(xP + .5, fitTop, 0), V(xP + .7, fitTop, 0)], sh, WHT, 4); line('sf2', [V(xP + .5, Ltop, 0), V(xP + .7, Ltop, 0)], sh, WHT, 4);
    labR('lsf', 'short', V(xP + .6, (fitTop + Ltop) / 2, 0), sh, {});
    // ruler
    const rl = prog(t, at('p05', .25), .7) * oA * (1 - prog(t, S('p07') + 3.4, .6) * 0);
    line('rul', [V(xR, 0, 0), V(xR, YA * rl, 0)], oA, WHT, 6); line('ru1', [V(xR - .15, YA * rl, 0), V(xR + .15, YA * rl, 0)], oA, WHT, 6); line('ru0', [V(xR - .15, 0, 0), V(xR + .15, 0, 0)], oA, WHT, 6);
    lab('lru', 'D r', V(xR, YA + .45, 0), rl * oA * (1 - prog(t, at('p07', .2), .4)), { size: 72 });
    // top block: grows on the plan, then slides to stand beside the ruler
    const gb = prog(t, at('p05', .55), .7), mv = prog(t, at('p06', .5), 1.2);
    const gx = lerp(xP, xG, mv), gy0 = lerp(fitTop, 0, mv), gtop = gy0 + gainH * gb;
    box('gain', gx, gy0, gtop, WA, WA, WHT, oA);
    lab('lG', 'top block', V(xG, -.45, 0), mv * oA, {});
  }

  // ---- scene B bars: three rows in one plane, baselines stacked, no occlusion
  const oB = win(t, at('p08', .1), tBend, .5, .5);
  if (oB > 0) {
    const shr = 1 - prog(t, at('p12', .12), .7);
    const RB = { gain: 1.95, stay: .85, prod: -.25 }, SC1 = 1.0, SCP = 2.5;
    for (const k of ['gain', 'stay', 'prod']) line('gB' + k, [V(bx(1) - .4, RB[k], 0), V(bx(8) + .4, RB[k], 0)], oB * .5 * shr * (k === 'gain' ? 1 : win(t, k === 'stay' ? at('p09', .1) : at('p10', .1))), DIM, 3);
    for (let k = 1; k <= 8; k++) {
      const gk = prog(t, at('p08', .35) + k * .09, .5), sk = prog(t, at('p09', .3) + k * .09, .5), pk = prog(t, at('p10', .25) + k * .1, .5);
      box('bg' + k, bx(k), RB.gain, RB.gain + gainK(k) * SC1 * gk * shr, .5, .5, GRY, oB);
      box('bs' + k, bx(k), RB.stay, RB.stay + stayK(k) * SC1 * sk * shr, .5, .5, YEL, oB);
      box('bp' + k, bx(k), RB.prod, RB.prod + prodK(k) * SCP * pk * shr, .5, .5, WHT, oB);
      lab('bk' + k, String(k), V(bx(k), RB.prod - .42, 0), oB * win(t, at('p08', .3)) * shr, { size: 56 });
    }
    labL('rg', 'gain', V(bx(1) - .5, RB.gain + .45, 0), oB * win(t, at('p08', .4)) * shr, {});
    labL('rs', 'Sam stays', V(bx(1) - .5, RB.stay + .4, 0), oB * win(t, at('p09', .3)) * shr, { color: YEL });
    labL('rp', 'gain × stays', V(bx(1) - .5, RB.prod + .4, 0), oB * win(t, at('p10', .2)) * shr, {});
    labL('rk', 'wait k', V(bx(1) - .5, RB.prod - .42, 0), oB * win(t, at('p08', .3)) * shr, {});
    const pk2 = win(t, at('p10', .75), at('p11', .9), .4, .5) * oB * shr, ptop = RB.prod + prodK(2) * SCP;
    line('pkl', [V(bx(1) - .3, ptop, 0), V(bx(8) + .4, ptop, 0)], pk2, WHT, 3, true);
    dot('pkd', V(bx(2), ptop + .22, 0), .1, pk2);
    lab('pkC', 'C ≈ ' + f2(DT.C0), V(bx(4) + .4, RB.prod - 1.05, 0), win(t, at('p11', .25), at('p12', .1), .4, .4) * oB, { size: 72 });
    lab('pk2', 'best: k = 2', V(bx(4) + .4, RB.prod - 1.05, 0), win(t, at('p10', .78), at('p11', .25), .3, .3) * oB, {});
  }

  // ---- scene B surface
  const oS = win(t, at('p12', .3), tSurfEnd, .5, .6);
  if (oS > 0) {
    const rise = prog(t, at('p12', .3), 1.4);
    surfC.set((i, j) => { const a = DT.A[i], p = DT.P[j], c = DT.Cgrid[j][i]; return [sx(a), c * YS * rise, sz(p), .35 + .55 * c]; }, oS);
    for (let i = 0; i < 19; i += 3) line('sa' + i, DT.P.map((p, j) => V(sx(DT.A[i]), DT.Cgrid[j][i] * YS * rise + .012, sz(p))), oS * .85, WHT, 2.5);
    for (let j = 0; j < 19; j += 3) line('sp' + j, DT.A.map((a, i) => V(sx(a), DT.Cgrid[j][i] * YS * rise + .012, sz(DT.P[j]))), oS * .85, WHT, 2.5);
    line('fax1', [V(sx(.05), 0, sz(.05) + .35), V(sx(.95), 0, sz(.05) + .35)], oS, DIM, 4); line('fax2', [V(sx(.95) + .35, 0, sz(.05)), V(sx(.95) + .35, 0, sz(.95))], oS, DIM, 4);
    lab('sla', 'α: slower ball →', scr(V(0, 0, sz(.05) + .35)).x ? { x: scr(V(0, 0, sz(.05) + .35)).x, y: scr(V(0, 0, sz(.05) + .35)).y + 55 } : ZERO, oS * win(t, at('p12', .6)), {});
    { const pp = scr(V(sx(.95) + .35, 0, sz(.5))); lab('slp', 'p: Sam leaves more →', { x: Math.min(pp.x + 120, 1500), y: pp.y + 60 }, oS * win(t, at('p12', .8)), { size: 56 }); }
    // marker
    const m0 = S('p13'), L = D('p13');
    const ph = f => clamp((t - m0 - f * L) / (.16 * L));
    let a = AL, p = PP;
    if (t >= m0) { a = AL + .32 * Math.sin(Math.PI * clamp(ease(ph(0) * 1) + 0)) * 0; }
    const upA = ease(ph(0)), dnA = ease(ph(.2)), upP = ease(ph(.4)), dnP = ease(ph(.6));
    a = AL + .3 * (upA - dnA); p = PP + .6 * (upP - dnP);
    const mpos = V(sx(a), gridC(a, p) * YS * rise + .02, sz(p));
    const trail = []; const nT = 40;
    for (let n = 0; n <= nT; n++) { const tq = m0 + (t - m0) * n / nT; const A2 = AL + .3 * (ease(clamp((tq - m0) / (.16 * L))) - ease(clamp((tq - m0 - .2 * L) / (.16 * L)))), P2 = PP + .6 * (ease(clamp((tq - m0 - .4 * L) / (.16 * L))) - ease(clamp((tq - m0 - .6 * L) / (.16 * L)))); trail.push(V(sx(A2), gridC(A2, P2) * YS * rise + .03, sz(P2))); }
    if (t > m0 + .1) line('trail', trail, oS, WHT, 12);
    dot('mk', mpos, .13, oS * win(t, at('p12', .85), 1e9, .4)); line('mkl', [V(mpos.x, 0, mpos.z), mpos], oS * win(t, at('p12', .85), 1e9, .4), WHT, 3, true);
    lab('mkC', 'C ≈ ' + f2(gridC(a, p)), { x: scr(mpos).x + 20, y: scr(mpos).y - 100 }, oS * win(t, at('p12', .9), 1e9, .4), { size: 72 });
  }

  // ---- scene C tower
  const oT = win(t, at('p15', .1), tTowEnd, .5, .6);
  if (oT > 0) {
    line('gndT', [V(-4.4, 0, 0), V(4.4, 0, 0)], oT * .6, DIM, 3);
    const ds = prog(t, at('p22', .3), .8), pp = lerp(PP, .5, prog(t, at('p23', .3), .9)), q = 1 - pp;
    const rs = 1 - .9 * (prog(t, at('p21', .3), .6) * .5 + prog(t, at('p21', .55), .6) * .3 + prog(t, at('p21', .78), .6) * .2) + 0.0;
    const Ds = lerp(1, 2, ds); const Cc = Cf(AL, pp);
    const rsEff = t < at('p21', .2) ? 1 : (t < at('p22', .0) ? rs : (t < at('p23', .3) ? .1 + (rs <= 0 ? 0 : 0) : .1));
    const rsUse = t < at('p21', .2) ? 1 : (t < at('p22', 0) ? rs : 1);  // r demo returns to full after p21
    const rback = prog(t, at('p22', .02), .5);
    const rdemo = t < at('p22', 0) ? rsUse : lerp(.1, 1, rback);
    const rS = t < at('p21', .2) ? 1 : rdemo;
    const unit = YT * .5 * Ds * Cc * rS;
    let sCur = 0; for (let k = 1; k < 8; k++) sCur += prog(t, LAND[k] - .55, .5);
    const ratio = Q * AL, ratioNow = q * AL;
    let y = 0, total = 0;
    for (let s = 0; s < 8; s++) {
      const h = unit * Math.pow(t < at('p23', .3) ? ratio : ratioNow, s), gk = prog(t, LAND[s], .5);
      total += h;
      box('sl' + s, 0, y, y + h * gk, SLAB_W, SLAB_W, s % 2 ? GRY : WHT, oT);
      if (s < 3 && h * gk > .28) lab('sn' + s, String(s + 1), V(-1.25, y + h * gk / 2, 0), oT * gk, { size: 56 });
      y += h * gk;
    }
    // ring (the ball) and bar (Sam stays)
    const ringOp = oT * win(t, at('p15', .45), at('p19', .5), .5, .6) + oT * win(t, at('p21', .1), at('p22', .1), .4, .4);
    const rr = t < at('p21', .1) ? R0 * Math.pow(AL, sCur) : R0 * rS;
    line('ring', circ(RING, rr), ringOp, WHT, 6); lab('lring', 'ball', V(RING.x, RING.y - 1.2, 0), ringOp, {});
    const barOp = oT * win(t, at('p16', .1), at('p19', .5), .5, .6) + oT * win(t, at('p23', .0), at('p24', .0), .4, .4);
    const bl = t < at('p23', .0) ? BARL * Math.pow(Q, sCur) : BARL * q;
    line('bar', [V(BARX, 2.4, 0), V(BARX + bl, 2.4, 0)], barOp, YEL, 26); line('barb', [V(BARX, 2.1, 0), V(BARX, 2.7, 0)], barOp, YEL, 4);
    lab('lbar', 'Sam stays', V(BARX + .8, 1.7, 0), barOp, { color: YEL });
    // D pair
    const dOp = oT * win(t, at('p22', .1), at('p23', .0), .4, .4), dg = .7 * Ds;
    dot('d1', V(3.7 - dg, 3.4, 0), .12, dOp, BLU); dot('d2', V(3.7 + dg, 3.4, 0), .12, dOp, BLU); line('dl', [V(3.7 - dg, 3.4, 0), V(3.7 + dg, 3.4, 0)], dOp, WHT, 5); lab('ldd', 'D', V(3.7, 3.9, 0), dOp, { size: 72 });
    // brace and limit
    const bo = win(t, at('p18', .15), 1e9, .5) * oT;
    line('lim', brace(1.2, 0, total), bo, WHT, 6);
    lab('limt', t < at('p20', .15) ? 'limit' : '≈ ' + f2(Cc / (2 * (1 - ratioNow))) + ' D r', { x: scr(V(1.2, total / 2, 0)).x + 170, y: scr(V(1.2, total / 2, 0)).y }, bo, { size: 64 });
    // demo labels
    lab('dr', 'ball r shrinks', { x: 960, y: 960 }, oT * win(t, at('p21', .25), at('p22', .0), .4, .4), { size: 64 });
    lab('dd', 'ads far apart', { x: 960, y: 960 }, oT * win(t, at('p22', .25), at('p23', .0), .4, .4), { size: 64 });
    lab('dp', 'Sam impatient', { x: 960, y: 960 }, oT * win(t, at('p23', .15), at('p24', .0), .4, .4), { size: 64 });
  }

  // ---- p24: Part 2's world, a line with a shrinking ball and an impatient Sam
  const o24 = win(t, at('p24', .06), at('p25', .02), .5, .5);
  if (o24 > 0) {
    const LYY = 2.4, hw = 3.2;
    line('l24', [V(-hw, LYY, 0), V(hw, LYY, 0)], o24, DIM, 4); line('l24c', [V(0, LYY - .2, 0), V(0, LYY + .2, 0)], o24, DIM, 4);
    labL('raf24', 'rafting', V(-hw, LYY - .6, 0).add(V(.9, 0, 0)), o24, {}); lab('spa24', 'spa day', scr(V(hw - .9, LYY - .6, 0)), o24, {});
    const n = clamp((t - at('p24', .45)) / (D('p24') * .45)) * 3, kk = Math.min(2, Math.floor(n)), fr = n - kk, rr = 2.4 * Math.pow(.5, kk + ease(fr)), mu = .35;
    line('b24', [V(mu - rr, LYY, 0), V(mu + rr, LYY, 0)], o24 * win(t, at('p24', .3)), WHT, 12); line('b240', [V(mu - rr, LYY - .15, 0), V(mu - rr, LYY + .15, 0)], o24 * win(t, at('p24', .3)), WHT, 6); line('b241', [V(mu + rr, LYY - .15, 0), V(mu + rr, LYY + .15, 0)], o24 * win(t, at('p24', .3)), WHT, 6);
    lab('lb24', 'the ball halves each message', { x: 960, y: 740 }, o24 * win(t, at('p24', .4)), { size: 64 });
    lab('ls24', 'Sam leaves half the time', { x: 960, y: 850 }, o24 * win(t, at('p24', .65)), { size: 64, color: YEL });
  }

  // ---- scene D: real shortfall surface against the Theorem 1 plane
  const oG = win(t, at('p25', .0), tGapEnd, .6, .6);
  if (oG > 0) {
    const rise = prog(t, at('p25', .08), 1.4), pr = prog(t, at('p25', .5), 1.0);
    gapS.set((i, j) => { const mu = -.7 + 1.4 * i / 70, r = j / (RN - 1), h = gh(mu, r) * rise; return [mu * XM, h, (.5 - r) * 3.4, .4 + .5 * clamp(h / 1.6)]; }, oG);
    const bnd = DT.ex.bound * YG;
    planeS.set((i, j) => { const mu = i ? .7 : -.7, r = j ? 1 : 0; return [mu * XM, bnd * r * pr, (.5 - r) * 3.4, .9]; }, .28 * oG * (pr > 0 ? 1 : 0));
    line('pl1', [V(-.7 * XM, 0, 1.7), V(-.7 * XM, bnd * pr, -1.7), V(.7 * XM, bnd * pr, -1.7), V(.7 * XM, 0, 1.7)], oG * pr, WHT, 4);
    line('pl2', [V(-.7 * XM, 0, 1.7), V(.7 * XM, 0, 1.7)], oG * pr, WHT, 4);
    for (let n = 1; n < 6; n++) { const r = n / 6; line('plr' + n, [V(-.7 * XM, bnd * r * pr, (.5 - r) * 3.4), V(.7 * XM, bnd * r * pr, (.5 - r) * 3.4)], oG * pr * .8, WHT, 2.5); }
    for (let k = 0; k < RN; k += 5) { const r = k / (RN - 1); if (r > 0.02) line('gr' + k, Array.from({ length: 71 }, (_, i) => { const mu = -.7 + 1.4 * i / 70; return V(mu * XM, gh(mu, r) * rise + .012, (.5 - r) * 3.4); }), oG * .9, WHT, 2.5); }
    for (let i = 0; i < 71; i += 14) line('gm' + i, Array.from({ length: RN }, (_, j) => { const mu = -.7 + 1.4 * i / 70, r = j / (RN - 1); return V(mu * XM, gh(mu, r) * rise + .012, (.5 - r) * 3.4); }), oG * .9, WHT, 2.5);
    line('fx1', [V(-.7 * XM, 0, 2.05), V(.7 * XM, 0, 2.05)], oG, DIM, 4); line('fx2', [V(.7 * XM + .3, 0, 1.7), V(.7 * XM + .3, 0, -1.7)], oG, DIM, 4);
    const ep = scr(V(0, 0, 2.05)); lab('gxl', 'guess →', { x: ep.x, y: ep.y + 50 }, oG * win(t, at('p25', .15), 1e9, .4), {});
    labR('grl', 'ball r →', V(.7 * XM + .3, 0, 0), oG * win(t, at('p25', .15), 1e9, .4), {});
    lab('gsl', 'surface: real shortfall', { x: 960, y: 1020 }, oG * win(t, at('p25', .3), at('p27', .1), .4, .4), {});
    lab('gpl', 'Theorem 1 limit', V(-.5 * XM, bnd * .82 + .4, -1.1), oG * win(t, at('p25', .55), 1e9, .4), {});
    // worst point and wedge edges
    const wk = win(t, at('p26', .15), at('p27', .0), .4, .5) * oG, wx = DT.ex.worst_x, wh = DT.ex.worst * YG;
    line('wg1', [V(0, 0, -1.7), V(.5 * XM, 0, -1.7 + 3.4 * 1 - 3.4 * 1 + 0)].map((v, i) => i ? V(.5 * XM, 0, -1.7) : V(0, 0, 1.7)), wk, WHT, 4, true);
    line('wg2', [V(0, 0, 1.7), V(-.5 * XM, 0, -1.7)], wk, WHT, 4, true);
    line('wg3', [V(0, 0, 1.7), V(.136 * XM, 0, -1.7)], wk, GRY, 4, true);
    line('wg4', [V(0, 0, 1.7), V(-.136 * XM, 0, -1.7)], wk, GRY, 4, true);
    const wp = V(wx * XM, wh, -1.7); dot('wd', wp, .14, wk); line('wl', [wp, V(wx * XM, bnd, -1.7)], wk, WHT, 5, true);
    lab('wpc', Math.round(100 * DT.ex.worst / DT.ex.bound) + '% of the limit', { x: scr(wp).x - 40, y: scr(wp).y + 80 }, wk, { size: 64 });
    // simulated chats
    const mo = win(t, at('p27', .15), 1e9, .5) * oG;
    DT.ex.mc.forEach(([x0, g], i) => { const sp = V(x0 * XM, g * YG, -1.7); dot('mcd' + i, sp, .13, mo, YEL); line('mcr' + i, circ(sp, .2, 40).map(v => V(v.x, v.y, -1.7)), 0, WHT); });
    lab('mcl', '400,000 simulated chats', { x: 960, y: 1020 }, mo, { size: 64 }); lab('gsl2', '', { x: 0, y: 0 }, 0, {});
  }

  // ---- scene E: Proposition 1
  const oE = win(t, at('p28', .05), E('p36') + .1, .6, .6);
  const cA = -2.3, cB = 2.3, SC = 1.0, dl = DT.p1.delta / DT.p1.r * SC, rho = DT.p1.rho / DT.p1.r * SC, LY = .95;
  if (oE > 0) {
    // lanes
    const lan = win(t, at('p28', .15), at('p33', .02), .6, .6) * oE;
    [[cA, 'world A'], [cB, 'world B']].forEach(([cx, nm], i) => {
      line('ln' + i, [V(cx - 1.25, LY, 0), V(cx + 1.25, LY, 0)], lan, DIM, 3);
      lab('wn' + i, nm, V(cx, LY + .95, 0), lan, { size: 64 });
      const bo = lan * win(t, at('p29', .15), 1e9, .5);
      line('bl' + i, [V(cx + dl - SC, LY, 0), V(cx + dl + SC, LY, 0)], bo, WHT, 12); line('b0' + i, [V(cx + dl - SC, LY - .15, 0), V(cx + dl - SC, LY + .15, 0)], bo, WHT, 6); line('b1' + i, [V(cx + dl + SC, LY - .15, 0), V(cx + dl + SC, LY + .15, 0)], bo, WHT, 6);
      line('cr' + i, [V(cx, LY - .25, 0), V(cx, LY + .25, 0)], bo, DIM, 4);
      lab('rf' + i, 'rafting', V(cx - 1.0, LY - .45, 0), bo, { size: 56 }); lab('sp' + i, 'spa day', V(cx + 1.0, LY - .45, 0), bo, { size: 56 });
      const stay = i === 1 || t < at('p30', .25);
      dot('g' + i, V(cx + dl, LY, 0), .11, bo * (stay ? 1 : .35));
    });
    const bo2 = lan * win(t, at('p29', .15), 1e9, .5);
    lab('eq', '=', V(0, LY, 0), win(t, at('p29', .5), at('p30', .1), .4, .4) * oE, { size: 128 });
    // world A jump
    const jp = prog(t, at('p30', .3), .8);
    [[1, 'a1'], [-1, 'a2']].forEach(([sg, n]) => { const to = V(cA + dl + sg * rho, LY, 0), fr = V(cA + dl, LY, 0); line('ja' + n, [fr, vl(fr, to, jp)], lan * jp, WHT, 5, true); dot('da' + n, vl(fr, to, jp), .11, lan * jp); lab('h' + n, '50%', V(to.x, LY + .42, 0), lan * jp * win(t, at('p30', .55), 1e9, .3), { size: 56 }); });
    lab('stB', 'never changes', V(cB + dl, LY - 1.0, 0), lan * win(t, at('p30', .65), at('p31', .05), .4, .4), { size: 56 });
    // value bars
    const SU = .8, BY = -1.95;
    const vb = (cx, i, w1, w2, h2, l1, l2, tag2, ta, tb) => {
      const o = win(t, ta, at('p33', .02), .5, .6) * oE, o2 = win(t, tb, at('p33', .02), .5, .6) * oE, g1 = prog(t, ta + .2, .6), g2 = prog(t, tb + .2, .6);
      box('v1' + i, cx - .9, BY, BY + SU * g1, .8, .8, WHT, o); lab('vl1' + i, 'S', V(cx - .9, BY + SU * g1 + .4, 0), o * g1, { size: 72 }); lab('vt1' + i, 'show now', V(cx - .9, BY - .45, 0), o, {});
      boxEdges('v2' + i, cx + .9, BY, BY + h2 * g2, .8, .8, WHT, o2, 8); lab('vl2' + i, tag2, V(cx + .9, BY + h2 * g2 + .4, 0), o2 * g2, { size: 72 }); lab('vt2' + i, 'wait', V(cx + .9, BY - .45, 0), o2, {});
    };
    vb(cA, 0, 0, 0, 2 * SU, '', '', '2S', at('p31', .08), at('p31', .4));
    vb(cB, 1, 0, 0, Q * SU, '', '', '(1 − p)S', at('p32', .05), at('p32', .15));
    // chart
    const co = win(t, at('p33', .1), at('p36', .0), .6, .6) * oE;
    if (co > 0) {
      const X0 = -2.4, X1 = 2.4, Y0 = -1.6, SY = 2.6, xm = x => X0 + (X1 - X0) * x;
      line('cx', [V(X0, Y0, 0), V(X1 + .2, Y0, 0)], co, DIM, 4); line('cy', [V(X0, Y0, 0), V(X0, Y0 + SY + .3, 0)], co, DIM, 4);
      const g1 = prog(t, at('p33', .3), 1.0), g2 = prog(t, at('p33', .6), 1.0);
      const pa = []; const pb = [];
      for (let n = 0; n <= 20; n++) { const x = n / 20 * g1; pa.push(V(xm(x), Y0 + SY * x, 0)); } for (let n = 0; n <= 20; n++) { const x = n / 20 * g2; pb.push(V(xm(x), Y0 + SY * (1 - x) * PP, 0)); }
      line('cA', pa, co, WHT, 10); line('cB', pb, co, GRY, 10);
      lab('cAl', 'world A loses', V(X1 - .7, Y0 + SY + .45, 0), co * win(t, at('p33', .55), 1e9, .4), { size: 56 });
      lab('cBl', 'world B loses', V(X1 - 1.1, Y0 + .6, 0), co * win(t, at('p33', .8), 1e9, .4), { size: 56, color: DIM });
      lab('cxl', 'x: chance of showing now', V(0, Y0 - .5, 0), co * win(t, at('p33', .35), 1e9, .4), {});
      lab('cyl', 'loss', V(X0 - .55, Y0 + SY * .5, 0), co * win(t, at('p33', .35), 1e9, .4), {});
      const xs = DT.p1.cross, ck = win(t, at('p34', .3), 1e9, .5) * co, cp = V(xm(xs), Y0 + SY * xs, 0);
      line('cvx', [cp, V(xm(xs), Y0, 0)], ck, WHT, 4, true); line('cring', circ(cp, .2, 40), ck, WHT, 7);
      lab('cxs', 'p / (1 + p)', V(xm(xs) + .1, Y0 - 1.05, 0), ck * win(t, at('p34', .55), 1e9, .4), { size: 64 });
      line('chz', [cp, V(X0, cp.y, 0)], ck, WHT, 4, true);
    }
    // comparison of the two limits
    const ko = win(t, at('p36', .3), E('p36') + .1, .6, .6) * oE;
    if (ko > 0) {
      const H = 3.0, lo = DT.p1.form / DT.p1.D / DT.p1.r, up = DT.p1.upper / DT.p1.D / DT.p1.r, yy = -1.9;
      const g1 = prog(t, at('p36', .35), .7), g2 = prog(t, at('p36', .55), .9);
      box('k1', -1.5, yy, yy + Math.max(lo / up * H, .03) * g1, 1.0, .6, GRY, ko); box('k2', 1.5, yy, yy + H * g2, 1.0, .6, WHT, ko);
      lab('kl1', 'no rule can beat', V(-1.5, yy - .45, 0), ko, {}); lab('kl2', 'midpoint rule', V(1.5, yy - .45, 0), ko, {});
      lab('kv1', f3(lo) + ' D r', V(-1.5, yy + Math.max(lo / up * H, .03) + .5, 0), ko * g1, { size: 64 }); lab('kv2', f2(up) + ' D r', V(1.5, yy + H + .5, 0), ko * g2, { size: 64 });
    }
  }

  // ---- closing question: an evenly filled ball
  const qo = win(t, at('p37', .25), 1e9, .6);
  if (qo > 0) {
    const C0 = V(0, -.3, 0); line('qr', circ(C0, 1.4, 120), qo, WHT, 6);
    for (let n = 0; n < 70; n++) { const r = 1.3 * Math.sqrt((n + .5) / 70), a = n * 2.399963; dot('qd' + n, V(r * Math.cos(a), -.3 + r * Math.sin(a), 0), .06, qo * clamp(prog(t, at('p37', .3) + n * .02, .3))); }
    lab('qq', 'evenly?', { x: 960, y: 128 }, qo, { size: 96 });
  }

  formula('top', TOP, t, 960, 128);
  const fd = clamp((t - (FADEEND + .1)) / 1.3); let fe = el('fade', 'tok'); fe.style.cssText = `position:absolute;left:0;top:0;width:1920px;height:1080px;background:#000;transform:none;opacity:${fd};font-size:0`;
  fe.style.display = fd > .002 ? '' : 'none';
  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  for (const [k, f] of FLS) if (!uF.has(k)) f.obj.visible = false;
  for (const [k, d] of DOTS) if (!uD.has(k)) d.visible = false;
  for (const [k, b] of BOXES) if (!uB.has(k)) b.visible = false;
  if (!(oS > 0)) surfC.m.visible = false;
  if (!(oG > 0)) { gapS.m.visible = false; planeS.m.visible = false; }
  R.render(scene, cam);
}
window.seek = t => draw(t);
window.ready = true;
draw(0);
