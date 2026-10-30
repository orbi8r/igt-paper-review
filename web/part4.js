// Part 4: a floor and a ceiling. Every frame is a pure function of time: window.seek(t).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const J = async f => (await fetch(f)).json();
const [DT, TM] = await Promise.all([J('part4_data.json'), J('timing4.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
const FADE0 = E('h02') + .35;
window.TOTAL = FADE0 + 1.5;

const YEL = '#FFE600', BLU = '#3DA5FF', WHT = '#ffffff', GRY = '#d0d0d0';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vl = (a, b, k) => a.clone().lerp(b, k);
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));

// ---------- renderer, camera
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(devicePixelRatio); R.setSize(1920, 1080); document.body.prepend(R.domElement);
// the top band (formulas) stays clear of 3D: the cone used to run through it
R.domElement.style.maskImage = R.domElement.style.webkitMaskImage = 'linear-gradient(#0000 0 165px, #000 225px)';
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); scene.add(sun);

class FL {
  constructor(color, w, dashed = false, ds = .05, gs = .035) {
    this.mat = new LineMaterial({ color, linewidth: w, dashed, dashSize: ds, gapSize: gs, worldUnits: false, transparent: true });
    this.mat.resolution.set(1920, 1080);
    this.obj = new Line2(new LineGeometry(), this.mat); this.obj.frustumCulled = false; this.obj.visible = false; scene.add(this.obj);
  }
  set(pts, op = 1) {
    if (op <= .004 || pts.length < 2) { this.obj.visible = false; return; }
    const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    this.obj.geometry.dispose(); this.obj.geometry = g; this.obj.computeLineDistances();
    this.mat.opacity = op; this.obj.visible = true;
  }
}
const SPH = new THREE.SphereGeometry(1, 24, 16);
class Dot {
  constructor(color, basic = false) {
    this.m = new THREE.Mesh(SPH, basic ? new THREE.MeshBasicMaterial({ color, transparent: true }) : new THREE.MeshLambertMaterial({ color, transparent: true }));
    scene.add(this.m);
  }
  set(p, r, op = 1) { const v = r > 1e-4 && op > .004; this.m.visible = v; if (!v) return; this.m.position.copy(p); this.m.scale.setScalar(r); this.m.material.opacity = op; }
}

// ---------- DOM overlay and an SVG layer for the 2D parts (meter, bars)
const OV = document.getElementById('ov'); const pool = new Map(); let used = new Set();
const NS = 'http://www.w3.org/2000/svg';
const SV = document.createElementNS(NS, 'svg'); SV.setAttribute('width', 1920); SV.setAttribute('height', 1080);
SV.style.cssText = 'position:absolute;left:0;top:0'; OV.appendChild(SV);
const spool = new Map(); let sused = new Set();
function sh(key, tag) { let e = spool.get(key); if (!e) { e = document.createElementNS(NS, tag); SV.appendChild(e); spool.set(key, e); } sused.add(key); e.style.display = ''; return e; }
function line2(key, x1, y1, x2, y2, col, w, op, dash = '') {
  if (op <= .004) return; const e = sh(key, 'line');
  e.setAttribute('x1', x1); e.setAttribute('y1', y1); e.setAttribute('x2', x2); e.setAttribute('y2', y2);
  e.setAttribute('stroke', col); e.setAttribute('stroke-width', w); e.setAttribute('opacity', op); e.setAttribute('stroke-dasharray', dash);
}
function rect2(key, x, y, w, h, fill, stroke, sw, op, dash = '') {
  if (op <= .004 || h < .5) return; const e = sh(key, 'rect');
  e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('width', w); e.setAttribute('height', Math.max(h, 0));
  e.setAttribute('fill', fill); e.setAttribute('stroke', stroke); e.setAttribute('stroke-width', sw); e.setAttribute('opacity', op); e.setAttribute('stroke-dasharray', dash);
}
function circ2(key, cx, cy, r, fill, stroke, sw, op) {
  if (op <= .004) return; const e = sh(key, 'circle');
  e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('r', r); e.setAttribute('fill', fill); e.setAttribute('stroke', stroke); e.setAttribute('stroke-width', sw); e.setAttribute('opacity', op);
}
function el(key, cls) {
  let e = pool.get(key); if (!e) { e = document.createElement('div'); e.className = cls; OV.appendChild(e); pool.set(key, e); e._h = null; }
  used.add(key); e.style.display = ''; return e;
}
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

// ---------- data and plane geometry (math plane x,y, height z; three.js gets V(x, z, -y))
const Wd = DT.W, MU = DT.mus[0], S0 = DT.steps[0], DD = DT.D, AL = DT.alpha, PP = DT.p, RHO = DT.rho1, R1 = DT.r1;
const NAMES = ['yoga retreat', 'beach cottage', 'rafting', 'camping'];
const SCAT = DT.scatter['1'], SCMIN = Math.min(...SCAT), SCMAX = Math.max(...SCAT);
const Pm = (x, y, z = 0) => V(x, z, -y);
const hv = (x, y) => Math.max(0, ...Wd.map(w => w[0] * x + w[1] * y));
const RD = 1.3, DOM = [...Array(36)].map((_, k) => [RD * Math.cos(2 * Math.PI * k / 36), RD * Math.sin(2 * Math.PI * k / 36)]);
function clip(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const k = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
  }
  return out;
}
const FV = [...Wd, [0, 0]];
const FACES = FV.map((f, i) => { let poly = DOM; FV.forEach((g, j) => { if (j !== i) poly = clip(poly, f[0] - g[0], f[1] - g[1], 0); }); return poly; });
const SHEETS = Wd.map(w => clip(DOM, w[0], w[1], 0));
function polyMesh(poly, F, color, opacity) {
  const v = poly.map(p => Pm(p[0], p[1], F[0] * p[0] + F[1] * p[1])), pos = [];
  for (let i = 1; i < v.length - 1; i++) pos.push(v[0].x, v[0].y, v[0].z, v[i].x, v[i].y, v[i].z, v[i + 1].x, v[i + 1].y, v[i + 1].z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.visible = false; m.userData.base = opacity; scene.add(m); return m;
}
const setM = (m, op) => { m.visible = op > .004; m.material.opacity = op; };
const faceM = FACES.map((p, i) => p.length > 2 ? polyMesh(p, FV[i], WHT, .5) : null);
const faceL = FACES.map(p => new FL(WHT, 4));
const sheetM = SHEETS.map((p, i) => p.length > 2 ? polyMesh(p, Wd[i], BLU, .4) : null);
const CONE = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.0001, 1, 48, 1, true), new THREE.MeshLambertMaterial({ color: WHT, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
CONE.visible = false; scene.add(CONE);
// shared crease between yoga (0) and cottage (1) faces, for the "crease" label
function sharedEdge(i, j) {
  const s = FACES[i].filter(p => FACES[j].some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6));
  return s.length >= 2 ? [s[0], s[1]] : null;
}
const CR = sharedEdge(0, 1) || sharedEdge(1, 2) || [[0, 0], [0, 0]];
const CRM = [(CR[0][0] + CR[1][0]) / 2, (CR[0][1] + CR[1][1]) / 2];
const cpts = (cx, cy, r, z = 0, n = 96, f = hv) => [...Array(n + 1)].map((_, k) => { const a = 2 * Math.PI * k / n; return Pm(cx + r * Math.cos(a), cy + r * Math.sin(a), z); });

// longest gap between the five points (four ads and the no ad origin)
const PTS5 = [...Wd, [0, 0]];
let LG = [0, 1], LGD = 0;
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { const d = Math.hypot(PTS5[i][0] - PTS5[j][0], PTS5[i][1] - PTS5[j][1]); if (d > LGD) { LGD = d; LG = [i, j]; } }
// the new spot of the Claim 1 pictures
const UDIR = [-0.45, -0.893], NS_ = [MU[0] + .5 * UDIR[0], MU[1] + .5 * UDIR[1]];
const HN = hv(NS_[0], NS_[1]), JB = Wd.reduce((b, w, i) => (w[0] * NS_[0] + w[1] * NS_[1] > Wd[b][0] * NS_[0] + Wd[b][1] * NS_[1] ? i : b), 0), WJ = Wd[JB];
const PZ = WJ[0] * MU[0] + WJ[1] * MU[1];                 // the best face at the new spot, slid back to the guess
const H0 = S0.h;
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

// ---------- camera
const P0 = { az: 0, el: 64, dist: 9.4, tg: V(0, 0, 0) };
const GP = (z = 0) => Pm(MU[0], MU[1], z);
const KEYS = [
  [at('e06', .2), 2.5, { az: 20, el: 58, dist: 8.4, tg: V(-.3, .2, 0) }],
  [S('e08'), 2.5, { az: 30, el: 62, dist: 7.8, tg: V(0, .6, 0) }],
  [S('f01') - .3, 2.4, { az: 28, el: 58, dist: 7.4, tg: GP(.55) }],
  [S('g01') - .2, 2.2, { az: 0, el: 68, dist: 8.6, tg: V(0, 0, 0) }],
  [S('g02') - .2, 2.2, { az: 22, el: 30, dist: 6.4, tg: Pm(-.25, -.1, .45) }],
  [S('g03') - .2, 2.4, { az: 32, el: 24, dist: 8.8, tg: GP(.9) }],
  [S('g04') - .2, 2.2, { az: 42, el: 32, dist: 5.4, tg: Pm(-.4, 0, .3) }],
  [S('g06') - .2, 2.4, { az: 14, el: 56, dist: 7.4, tg: GP(0) }],
  [S('g07') - .2, 2.4, { az: 30, el: 26, dist: 9.2, tg: GP(1.0) }],
];
let CD = 8;
function camAt(t) {
  let p = { ...P0, tg: P0.tg.clone() };
  for (const [s, d, q] of KEYS) { const k = prog(t, s, d); if (k <= 0) break; p = { az: lerp(p.az, q.az, k), el: lerp(p.el, q.el, k), dist: lerp(p.dist, q.dist, k), tg: vl(p.tg, q.tg, k) }; }
  CD = p.dist; const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  cam.setViewOffset(1920, 1080, 260 * prog(t, S('e04'), 1.6), 50, 1920, 1080);
  cam.position.copy(p.tg).add(V(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(p.dist));
  cam.up.set(0, 1, 0); cam.lookAt(p.tg); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  sun.position.copy(cam.position).add(V(0, 3, 0));
}

// ---------- scene objects
const adDot = Wd.map(() => new Dot(BLU)), orgDot = new Dot(WHT), guessDot = new Dot(WHT), bowlDot = new Dot(WHT);
const axes = [0, 1].map(() => new FL(GRY, 3));
const ballRing = new FL(WHT, 6), regionRing = new FL(WHT, 4, true, .04, .03), hDrop = new FL(WHT, 10);
const twoDot = [0, 1].map(() => new Dot(WHT)), twoLift = [0, 1].map(() => new Dot(WHT)), twoDrop = [0, 1].map(() => new FL(WHT, 3, true, .03, .03));
const chord = new FL(WHT, 6), gainSeg = new FL(WHT, 12), avgDot = new Dot(WHT);
const cloud = [...Array(48)].map(() => new Dot(WHT, true)), cloudL = [...Array(48)].map(() => new Dot(WHT, true));
const pairL = [...Array(10)].map(() => new FL(GRY, 3)), longL = new FL(WHT, 10);
const stepFloor = new FL(WHT, 10), stepFace = new FL(WHT, 10), stepRise = new FL(WHT, 4, true, .03, .03), arrowW = new FL(WHT, 6);
const gens = [...Array(16)].map(() => new FL(WHT, 2.5)), coneRing = [0, 1, 2, 3].map(() => new FL(WHT, 2.5));
const distSeg = new FL(WHT, 10), dropB = new FL(WHT, 4, true, .03, .03), dropC = new FL(WHT, 4, true, .03, .03), spotDot = new Dot(WHT), spotBowl = new Dot(WHT), spotCone = new Dot(WHT);
const planeDot = new Dot(BLU), slideV = new FL(WHT, 4, true, .03, .03), bowlPath = new FL(WHT, 10), facePath = new FL(BLU, 10);
const ringF = [...Array(6)].map(() => new FL(GRY, 5)), ringL = [...Array(6)].map(() => new FL(WHT, 5));

// ---------- formulas (from part1.js): shared token keys slide, new ones fade or fly in
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
  const cur = states[j], prev = j > 0 ? states[j - 1] : { toks: [] }, size = cur.size || 72, k = prog(t, cur.t, .6);
  const lc = layout(cur.toks, size), lp = layout(prev.toks, prev.size || size);
  const pk = new Map(prev.toks.map(x => [x.k, x]));
  const draw = (id, h, x, y, op, sz) => { if (op <= .004) return; const e = el(name + id, 'tok'); html(e, h); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = op; e.style.fontSize = sz + 'px'; e.style.color = WHT; };
  for (const x of cur.toks) {
    const tx = cx + lc[x.k].x; const old = pk.get(x.k);
    let sx = tx, sy = cy, op = 1;
    if (old) { sx = cx + lp[x.k].x; }
    else if (x.from && k < 1) { const f = x.from(); sx = f.x; sy = f.y; op = clamp(k * 4); }
    else op = clamp((k - .7) / .3);
    const px = lerp(sx, tx, k), py = lerp(sy, cy, k);
    if (old && old.h !== x.h) { draw(x.k + 'o', old.h, px, py, 1 - k, size); draw(x.k, x.h, px, py, k, size); }
    else draw(x.k, x.h, px, py, op, size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = px + 'px'; c.style.top = (py + size * .62) + 'px'; c.style.opacity = old && old.cap ? 1 : k; c.style.fontSize = '56px'; }
    if (x.box && t > x.box) { const q = prog(t, x.box, .5), w = lc[x.k].w + 24; const b = el(name + x.k + 'b', 'box'); b.style.left = (px - w / 2) + 'px'; b.style.top = (py - size * .62) + 'px'; b.style.width = w + 'px'; b.style.height = size * 1.24 + 'px'; b.style.opacity = q; }
  }
  for (const x of prev.toks) if (!cur.toks.find(y => y.k === x.k)) {
    draw(x.k, x.h, cx + lp[x.k].x, cy, 1 - k, prev.size || size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = (cx + lp[x.k].x) + 'px'; c.style.top = (cy + size * .62) + 'px'; c.style.opacity = 1 - k; c.style.fontSize = '56px'; }
  }
}
const sub = s => `<sub>${s}</sub>`, sup = s => `<sup>${s}</sup>`;
const T = (k, h, o = {}) => ({ k, h, ...o });
const fromScr = v => () => scr(v);
const fromXY = (x, y) => () => ({ x, y });
// meter geometry (also used by the formula flights)
const BY = 910, SCL = 320, yv = v => BY - v * SCL;
const msx = t => lerp(-520, 0, prog(t, S('e04'), 1.3));
const mu_t = 'μ' + sub('t'), mu_t1 = 'μ' + sub('t+1'), r_t = 'r' + sub('t');
const mp = 'μ′', mm = 'μ', dist = `‖${mp} − ${mm}‖`;
const hGuess = () => Pm(MU[0], MU[1], H0), NSP3 = Pm(NS_[0], NS_[1], HN), NSF = Pm(NS_[0], NS_[1], 0);
const gapMid = () => vl(Pm(PTS5[LG[0]][0], PTS5[LG[0]][1]), Pm(PTS5[LG[1]][0], PTS5[LG[1]][1]), .5);
const mT = [at('h02', .1)];
const rg = `(1 − α${sup('s')})`, sv = `(1 − p)${sup('s')}`;
const TOP = [
  { t: S('e01') + .5, size: 64, toks: [T('mx', 'max{', { sp: .05 }), T('h', 'h', { cap: 'show now' }), T('cm', ',', { sp: .05 }), T('pp', '(1 − p)'), T('nx', `E[V(next)]`, { cap: 'unknown spread', box: at('e01', .55), sp: .3 }), T('cl', '}', { sp: .05 })] },
  { t: at('e02', .5), size: 64, toks: [T('mx', 'max{', { sp: .05 }), T('h', 'h', { from: () => ({ x: 1390 + msx(at('e02', .5)) + 40, y: yv(H0) }) }), T('cm', ',', { sp: .05 }), T('nx', 'C'), T('cl', '}', { sp: .05 })] },
  { t: at('e03', .55), size: 72, toks: [T('L', 'L', { from: fromXY(1710, yv(S0.L)) }), T('le1', '≤'), T('nx', 'C'), T('le2', '≤'), T('U', 'U', { from: fromXY(1700, yv(S0.U)) })] },
  { t: S('e04') + .3, toks: [] },
  { t: at('f04', .55), toks: [T('av', `E${sub('t')}[h(${mu_t1})]`, { from: () => scr(Pm(MU[0], MU[1], H0 + .07)) }), T('ge', '≥'), T('h', `h(${mu_t})`, { from: () => scr(hGuess()) })] },
  { t: at('f06', .15), toks: [T('L', 'L', { from: fromXY(1700, yv(S0.L)) }), T('eq', '='), T('pp', '(1 − p)'), T('h', `h(${mu_t})`)] },
  { t: S('g01') - .1, toks: [] },
  { t: at('g01', .66), toks: [T('D', 'D', { from: () => scr(gapMid()) }), T('eq', '='), T('lg', 'longest gap', { sp: .3 })] },
  { t: at('g02', .62), toks: [T('sl', 'slope'), T('le', '≤'), T('D', 'D')] },
  { t: at('g03', .5), toks: [T('hp', `h(${mp})`, { from: () => scr(NSP3) }), T('le1', '≤'), T('h', `h(${mm})`, { from: () => scr(hGuess()) }), T('pl', '+'), T('D', 'D'), T('dist', dist, { from: () => scr(vl(GP(0), NSF, .5)) })] },
  { t: at('g04', .62), toks: [T('hd', `h(${mp}) − h(${mm})`), T('le1', '≤'), T('wd', `⟨w, ${mp} − ${mm}⟩`)] },
  { t: at('g05', .22), toks: [T('wd', `⟨w, ${mp} − ${mm}⟩`), T('le1', '≤'), T('nw', `‖w‖ ${dist}`)] },
  { t: at('g05', .55), toks: [T('nw', `‖w‖ ${dist}`), T('le1', '≤'), T('Dd', `D ${dist}`)] },
  { t: S('g06') + .4, toks: [] },
  { t: at('g06', .62), toks: [T('mv', `‖μ${sub('t+s')} − ${mu_t}‖`), T('le1', '≤'), T('rr', `${r_t}${rg}`, { from: () => scr(cpts(MU[0], MU[1], DT.rings[2])[20]) })] },
  { t: at('g07', .2), toks: [T('h', `h(${mu_t})`), T('pl', '+'), T('D', 'D'), T('rt', r_t), T('rg', rg)] },
  { t: at('g09', .4), toks: [T('sv', sv), T('lp', '(', { sp: .02 }), T('h', `h(${mu_t})`), T('pl', '+'), T('D', 'D'), T('rt', r_t), T('rg', rg), T('rp', ')', { sp: .02 })], size: 64 },
  { t: at('g10', .3), toks: [T('U', 'U' + sub('t')), T('eq', '='), T('mx', 'max' + sub('s')), T('sv', sv), T('lp', '(', { sp: .02 }), T('h', `h(${mu_t})`), T('pl', '+'), T('D', 'D'), T('rt', r_t), T('rg', rg), T('rp', ')', { sp: .02 })], size: 64 },
  { t: at('h01', .0), toks: [], size: 64 },
  { t: at('h02', .25), toks: [T('q', 'where do we draw the line?')], size: 80 },
];

// ---------- the meter: h, hidden worth C, and the fence from the floor L to the ceiling U
const cTop = t => {
  const f = prog(t, at('e03', .5), .9), lo = lerp(.12, S0.L, f), hi = lerp(1.08, S0.U, f);
  return lo + (hi - lo) * (.5 + .5 * Math.sin(2.1 * (t - S('e02'))));
};
function meter(t) {
  const ox = msx(t), AX = 1370 + ox, HX = 1390 + ox, CX = 1490 + ox, CW = 80, BR = 1590 + ox;
  const mo = win(t, S('e02') - .1, 1e9, .5);
  if (mo <= 0) return;
  const hh = H0 * prog(t, at('e02', .12), .8);
  const dots = prog(t, at('h01', .1), .5), cOp = 1 - .75 * dots;
  line2('ax', AX, BY, AX, yv(1.1), GRY, 3, mo); line2('bs', AX, BY, CX + CW + 20, BY, GRY, 3, mo);
  rect2('hc', HX, yv(hh), CW, hh * SCL, WHT, 'none', 0, mo);
  const ct = cTop(t);
  rect2('cc', CX, yv(ct), CW, ct * SCL, 'none', WHT, 5, mo * cOp * prog(t, at('e02', .5), .6), '14 10');
  lab('cq', '?', { x: CX + CW / 2, y: yv(ct) + 44 }, mo * (1 - dots) * prog(t, at('e02', .5), .6), { size: 72 });
  lab('mh', 'h', { x: HX + CW / 2, y: BY + 48 }, mo); lab('mc', 'C', { x: CX + CW / 2, y: BY + 48 }, mo * prog(t, at('e02', .5), .5));
  // the fence
  const tk = win(t, at('e03', .3), 1e9, .5);
  const pf = win(t, at('f06', .0), at('f06', .8), .2, .4), pc = win(t, at('g10', .3), at('g10', .95), .2, .4);
  line2('tL', AX, yv(S0.L), BR, yv(S0.L), GRY, 4 + 6 * pf, tk); line2('tU', AX, yv(S0.U), BR, yv(S0.U), GRY, 4 + 6 * pc, tk);
  line2('brk', BR, yv(S0.U), BR, yv(S0.L), GRY, 4, tk);
  lab('lfl', 'floor', { x: BR + 26 + textW('floor', 56) / 2, y: yv(S0.L) }, tk, { color: GRY });
  lab('lce', 'ceiling', { x: BR + 26 + textW('ceiling', 56) / 2, y: yv(S0.U) }, tk, { color: GRY });
  // the price arrow from h down to the floor
  const pa = win(t, at('f05', .5), at('f06', .85), .4, .4);
  if (pa > 0) {
    const x = AX - 36;
    line2('pa1', x - 18, yv(H0), AX, yv(H0), WHT, 4, pa); line2('pa2', x - 18, yv(S0.L), AX, yv(S0.L), WHT, 4, pa); line2('pa3', x, yv(H0), x, yv(S0.L), WHT, 6, pa);
    lab('pal', `× ${(1 - PP).toFixed(1)}`, { x: x - 14 - textW('× 0.8', 56) / 2, y: (yv(H0) + yv(S0.L)) / 2 }, pa);
  }
  // h of the bowl is the white column
  const lk = win(t, at('e09', .55), S('f01') + .6, .4, .5);
  if (lk > 0) { const p = scr(hGuess()); line2('lk', p.x + 40, p.y, HX, yv(H0), GRY, 3, lk * .9, '10 8'); }
  // sixty exact solutions, all inside the fence
  SCAT.forEach((v, k) => { const o = clamp((t - (at('h01', .14) + .4 * D('h01') * k / SCAT.length)) / .25); if (o > 0) circ2('sc' + k, CX + CW * (.14 + .72 * ((k * .618) % 1)), yv(v), 7, WHT, 'none', 0, o * mo); });
  const n60 = win(t, at('h01', .1), S('h02') - .4, .4, .5);
  lab('n60', `${DT.nspreads} spreads`, { x: 700, y: 400 }, n60, { size: 72 });
  lab('nvi', `outside the fence: ${DT.tests.violations}`, { x: 700, y: 520 }, win(t, at('h01', .6), S('h02') - .4, .4, .5), { size: 72 });
  // the question: the bar sweeps the fence
  const bq = win(t, at('h02', .2), 1e9, .5);
  if (bq > 0) { const yb = yv(S0.L + (S0.U - S0.L) * (.5 + .5 * Math.sin(2.4 * (t - S('h02'))))); line2('bar', AX - 20, yb, BR + 20, yb, WHT, 8, bq); lab('bq', '?', { x: AX - 70, y: yb }, bq, { size: 96 }); }
}

// ---------- bars (scene E): h plus the cone's gain, then shrunk by the chance Sam stays
function bars(t) {
  const bo = win(t, at('g08', .12), S('h01'), .3, .5); if (bo <= 0) return;
  const X0 = 200, PI = 135, BW = 100, k9 = prog(t, at('g09', .3), 1.0);
  const pk = prog(t, at('g10', .25), .5);
  DT.bars.forEach((b, k) => {
    const g = prog(t, at('g08', .12) + k * .28, .6), hgt = lerp(b.gain, b.bar, k9) * SCL * g;
    const peak = b.bar === Math.max(...DT.bars.map(x => x.bar));
    const dim = 1 - .65 * pk * (peak ? 0 : 1);
    rect2('b' + k, X0 + PI * k, BY - hgt, BW, hgt, `rgba(255,255,255,${peak && pk > 0 ? .28 + .6 * pk : .28})`, WHT, 6, bo * dim);
    lab('bn' + k, `${b.s}`, { x: X0 + PI * k + BW / 2, y: BY + 46 }, bo * g);
  });
  lab('bcap', 'messages we wait', { x: 720, y: BY + 106 }, bo);
  line2('bh', X0 - 20, yv(H0), X0 + PI * 7 + BW + 20, yv(H0), GRY, 3, bo * prog(t, at('g08', .3), .6), '12 9');
  lab('bhl', 'h', { x: X0 - 52, y: yv(H0) }, bo * prog(t, at('g08', .3), .6));
  const sl = win(t, at('g09', .15), at('g10', .0), .4, .4);
  lab('bsv', `× (1 − p)${sup('s')}`, { x: 560, y: 300 }, sl);
  const pb = DT.bars.findIndex(b => b.bar === Math.max(...DT.bars.map(x => x.bar)));
  const px = X0 + PI * pb + BW, py = yv(DT.bars[pb].bar);
  line2('bpk', px, py, 1370 + 0, py, WHT, 4, pk * bo, '12 9');
}

// ---------- title and fade
function title(t) {
  const o = 1 - prog(t, 1.5, .8), dy = -80 * prog(t, 1.5, .9);
  lab('ti1', 'Part 4', { x: 960, y: 450 + dy }, o, { size: 96, color: GRY });
  lab('ti2', 'A floor and a ceiling', { x: 960, y: 570 + dy }, o, { size: 96 });
}

// ---------- the frame
function draw(t) {
  used = new Set(); sused = new Set(); camAt(t);
  const SG = prog(t, S('e04'), .8) * (1 - prog(t, at('g08', .0), .6));
  const dimA = 1 - .65 * Math.max(win(t, at('g01', .05), at('g02', .1), .4, .5), win(t, S('g06'), S('g07') + 1, .5, .6) * .8);
  if (SG > 0) {
    // axes with end labels
    [[V(1, 0, 0), at('e04', .08), 'relaxing', 'adventurous'], [V(0, 0, -1), at('e04', .35), 'cheap', 'luxury']].forEach(([d, s0, lo, hi], i) => {
      const g = prog(t, s0, .8) * RD; axes[i].set([d.clone().multiplyScalar(-g), d.clone().multiplyScalar(g)], SG * (g > 0 ? 1 : 0));
      const o = win(t, s0 + .3, at('e06', .05), .5, .5) * SG; if (o <= 0) return;
      const c = scr(V(0, 0, 0));
      [[-1, lo], [1, hi]].forEach(([sg, txt]) => {
        const e = scr(d.clone().multiplyScalar(RD * sg)); let dx = e.x - c.x, dy = e.y - c.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const w = textW(txt, 56) / 2 + 16, push = Math.abs(dx) * w + Math.abs(dy) * 36 + 10;
        lab('ax' + i + sg, txt, { x: e.x + dx * push, y: e.y + dy * push }, o, { color: GRY });
      });
    });
    // ads and the no ad point
    const adOp = win(t, at('e05', .1), 1e9, .5) * SG, dsz = .05 * CD / 8;
    Wd.forEach((w, i) => {
      adDot[i].set(Pm(w[0], w[1]), dsz * (adOp > 0 ? 1 : 0), adOp);
      const p = scr(Pm(w[0], w[1])), left = w[0] < 0 || i === 3, tw = textW(NAMES[i], 56);
      lab('ad' + i, NAMES[i], { x: p.x + (left ? -1 : 1) * (tw / 2 + 36), y: p.y }, win(t, at('e05', .25) + i * .15, i === 1 ? at('e07', .6) : at('e06', .05), .4, .5) * SG, { color: BLU });
    });
    orgDot.set(Pm(0, 0), dsz * 1.1, adOp);
    lab('nad', 'no ad', Pm(0, 0), win(t, at('e05', .7), at('e08', .3), .4, .5) * SG, { dx: textW('no ad', 56) / 2 + 24, dy: 52 });

    // sheets, then the bowl
    const fo = 1 - prog(t, at('e07', .62), .7);
    SHEETS.forEach((p, i) => {
      if (!sheetM[i]) return;
      const st = i === 1 ? at('e06', .35) : [at('e07', .12), 0, at('e07', .22), at('e07', .32)][i];
      let o = prog(t, st, .6) * fo; if (i === 1) o = Math.max(o, win(t, at('g04', .12), at('g05', .95), .5, .5));
      if (t > S('g01')) o = i === 1 ? win(t, at('g02', .1), at('g03', .1), .5, .5) * 1 + win(t, at('g04', .12), at('g05', .95), .5, .5) : 0;
      setM(sheetM[i], o * SG * .36);
    });
    const bo = prog(t, at('e07', .55), .8) * dimA * SG;
    FACES.forEach((p, i) => { if (faceM[i]) setM(faceM[i], bo * (i === 4 ? .12 : .3)); faceL[i].set(p.length > 2 ? [...p.map(q => Pm(q[0], q[1], FV[i][0] * q[0] + FV[i][1] * q[1])), Pm(p[0][0], p[0][1], FV[i][0] * p[0][0] + FV[i][1] * p[0][1])] : [], bo * prog(t, at('e08', .0), .6)); });
    lab('crease', 'crease', Pm(CRM[0], CRM[1], hv(CRM[0], CRM[1])), win(t, at('e08', .35), at('e09', .0), .4, .5) * SG, { dy: -60 });

    // guess, its ball, and h straight above it
    const gOp = win(t, at('e09', .1), 1e9, .4) * SG;
    guessDot.set(Pm(MU[0], MU[1]), dsz, gOp);
    bowlDot.set(hGuess(), dsz * 1.1, gOp * bo / Math.max(SG * dimA, 1e-6) * (bo > 0 ? 1 : 0));
    const br = R1 * prog(t, at('e09', .25), .9);
    ballRing.set(cpts(MU[0], MU[1], br), SG * (br > .01 ? 1 : 0));
    hDrop.set([Pm(MU[0], MU[1]), hGuess()], gOp * prog(t, at('e09', .45), .5) * dimA);
    lab('hb', 'h', hGuess(), win(t, at('e09', .5), at('g01', .0), .4, .5) * SG, { dx: 46, dy: 30 });
    lab('ball', 'ball', Pm(MU[0] + R1 * .71, MU[1] + R1 * .71), win(t, at('e09', .3), at('f01', .1), .4, .5) * SG, { dx: 60, dy: -10 });

    // floor, scene C: the region the next guess can reach, two points, then the clouds
    const rgo = win(t, at('f01', .3), at('g01', .0), .5, .5) * SG;
    regionRing.set(cpts(MU[0], MU[1], RHO), rgo);
    const two = win(t, at('f02', .25), at('f04', .0), .4, .5) * SG, lift2 = prog(t, at('f02', .72), .9);
    DT.two.forEach((q, k) => {
      const x = MU[0] + RHO * q[0], y = MU[1] + RHO * q[1], hz = DT.h_two[k];
      twoDot[k].set(Pm(x, y), dsz * .8, two); twoLift[k].set(Pm(x, y, hz * lift2), dsz * .8, two * lift2);
      twoDrop[k].set([Pm(x, y), Pm(x, y, hz * lift2)], two * lift2);
    });
    const A2 = Pm(MU[0] + RHO * DT.two[0][0], MU[1] + RHO * DT.two[0][1], DT.h_two[0]), B2 = Pm(MU[0] + RHO * DT.two[1][0], MU[1] + RHO * DT.two[1][1], DT.h_two[1]);
    const ch = prog(t, at('f03', .05), .6), chO = win(t, at('f03', .05), at('f04', .0), .3, .5) * SG;
    chord.set([A2, vl(A2, B2, ch)], chO);
    const av2 = Pm(MU[0], MU[1], DT.avg_two), avo = win(t, at('f03', .3), at('f04', .0), .4, .5) * SG;
    avgDot.set(av2, dsz * 1.2, avo); gainSeg.set([hGuess(), av2], avo);
    lab('avl', 'average', av2, avo, { dx: 140, dy: -34 }); lab('gnl', 'gain', vl(hGuess(), av2, .5), avo, { dx: -90, dy: -4 });
    // clouds: round, two clusters, a ring
    const co = win(t, at('f04', .06), at('f05', .0), .4, .6) * SG, m1 = prog(t, at('f04', .3), .8), m2 = prog(t, at('f04', .58), .8);
    let sumH = 0;
    cloud.forEach((d, k) => {
      let v = DT.shapes[0][k]; v = lerp2(v, DT.shapes[1][k], m1); v = lerp2(v, DT.shapes[2][k], m2);
      const x = MU[0] + RHO * v[0], y = MU[1] + RHO * v[1], hz = hv(x, y); sumH += hz;
      d.set(Pm(x, y), .0085 * CD / 8 * 1.6, co); cloudL[k].set(Pm(x, y, hz), .0085 * CD / 8 * 1.6, co * .85);
    });
    const av = Pm(MU[0], MU[1], sumH / 48);
    avgDot.set(co > 0 ? av : av2, dsz * 1.2, Math.max(avo, co));
    if (co > 0) gainSeg.set([hGuess(), av], co);
    lab('avl2', 'average', av, co, { dx: 140, dy: -34 });
    // the price of waiting: five pictograms
    const pic = win(t, at('f05', .1), at('f06', .55), .4, .5);
    for (let k = 0; k < 5; k++) { const stays = k < Math.round((1 - PP) * 5); circ2('pc' + k, 150 + 90 * k, 985, 26, stays ? WHT : 'none', WHT, 6, pic * prog(t, at('f05', .12) + k * .08, .3)); }
    lab('pcl', `Sam stays: ${Math.round((1 - PP) * 5)} of 5`, { x: 330, y: 915 }, pic);

    // scene D: the longest gap, the steepness of a face, the cone, Claim 1
    const pg = win(t, at('g01', .15), at('g02', .1), .4, .5) * SG, pi = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) pi.push([i, j]);
    pairL.forEach((l, n) => { const [i, j] = pi[n]; const isL = i === LG[0] && j === LG[1]; l.set([Pm(PTS5[i][0], PTS5[i][1]), Pm(PTS5[j][0], PTS5[j][1])], isL ? 0 : pg * prog(t, at('g01', .12) + n * .02, .4)); });
    longL.set([Pm(PTS5[LG[0]][0], PTS5[LG[0]][1]), Pm(PTS5[LG[1]][0], PTS5[LG[1]][1])], pg * prog(t, at('g01', .45), .4));
    lab('Dlab', 'D', gapMid(), win(t, at('g01', .45), at('g01', .82), .3, .3) * SG, { dx: 60, dy: -40, size: 72 });
    // g02: one face, one step
    const sg2 = win(t, at('g02', .12), at('g03', .15), .5, .5) * SG, w1 = Wd[1], wl = Math.hypot(w1[0], w1[1]), u1 = [w1[0] / wl, w1[1] / wl];
    arrowW.set([Pm(0, 0), Pm(w1[0], w1[1])], sg2 * prog(t, at('g02', .15), .5));
    const stp = prog(t, at('g02', .35), .6);
    stepFloor.set([Pm(0, 0, .0), Pm(u1[0] * stp, u1[1] * stp, 0)], sg2 * (stp > 0 ? 1 : 0));
    stepFace.set([Pm(0, 0, 0), Pm(u1[0] * stp, u1[1] * stp, wl * stp)], sg2 * prog(t, at('g02', .45), .5) * (stp > 0 ? 1 : 0));
    stepRise.set([Pm(u1[0] * stp, u1[1] * stp, 0), Pm(u1[0] * stp, u1[1] * stp, wl * stp)], sg2 * prog(t, at('g02', .45), .5) * (stp > 0 ? 1 : 0));
    lab('ar', 'ad arrow', Pm(w1[0] * .5, w1[1] * .5), sg2 * prog(t, at('g02', .2), .4), { dx: -170, dy: 75, color: BLU });
    lab('st1', 'one step', Pm(u1[0] * .5, u1[1] * .5), sg2 * prog(t, at('g02', .4), .4), { dx: 110, dy: 26 });
    lab('rise', 'rise', Pm(u1[0], u1[1], wl * .5), sg2 * prog(t, at('g02', .52), .4), { dx: 80, dy: 0 });
    // g03: the cone of slope D at the guess
    const gk = prog(t, at('g03', .05), 1.2), co2 = win(t, at('g03', .05), S('g08'), .5, .6) * SG;
    const rho = 1.0 * gk, apex = hGuess();
    if (co2 > 0 && rho > .01) {
      CONE.visible = true; CONE.material.opacity = .2 * co2; CONE.scale.set(rho, DD * rho, rho); CONE.position.copy(apex).add(V(0, DD * rho / 2, 0));
      gens.forEach((g, k) => { const a = 2 * Math.PI * k / 16; g.set([apex, apex.clone().add(V(rho * Math.cos(a), DD * rho, -rho * Math.sin(a)))], co2 * .9); });
      coneRing.forEach((c, k) => { const q = rho * (k + 1) / 4; c.set(cpts(MU[0], MU[1], q, H0 + DD * q), co2 * .9); });
    } else { CONE.visible = false; gens.forEach(g => g.set([], 0)); coneRing.forEach(c => c.set([], 0)); }
    // claim 1 and its proof: the new spot, the face best there slid back to the guess
    const sp = win(t, at('g03', .42), at('g06', .0), .4, .5) * SG;
    distSeg.set([GP(0), NSF], sp * prog(t, at('g03', .42), .5));
    spotDot.set(NSF, dsz, sp); spotBowl.set(NSP3, dsz, sp * dimA); spotCone.set(Pm(NS_[0], NS_[1], H0 + DD * .5), dsz, sp * win(t, at('g03', .5), at('g04', .0), .4, .4));
    dropB.set([NSF, NSP3], sp * prog(t, at('g03', .5), .5));
    dropC.set([NSP3, Pm(NS_[0], NS_[1], H0 + DD * .5)], sp * win(t, at('g03', .55), at('g04', .0), .4, .4));
    // g04, g05: three pictures of the proof
    const pf = win(t, at('g04', .35), at('g06', .0), .5, .5) * SG;
    planeDot.set(Pm(MU[0], MU[1], PZ), dsz * .9, pf);
    slideV.set([Pm(MU[0], MU[1], PZ), hGuess()], pf * prog(t, at('g04', .6), .5));
    const pl = [...Array(21)].map((_, k) => { const a = k / 20; return Pm(lerp(MU[0], NS_[0], a), lerp(MU[1], NS_[1], a), hv(lerp(MU[0], NS_[0], a), lerp(MU[1], NS_[1], a))); });
    bowlPath.set(pl, pf * prog(t, at('g05', .05), .5));
    facePath.set([Pm(MU[0], MU[1], PZ), Pm(NS_[0], NS_[1], HN)], pf * prog(t, at('g05', .12), .5));
    lab('w', 'w', Pm(WJ[0], WJ[1]), pf * prog(t, at('g04', .3), .4), { dy: -50, size: 72 });
    // g06, g07: rings of reach, then lifted onto the cone
    const rl = win(t, S('g06') + 1.0, S('g08') + .2, .4, .5) * SG;
    ringF.forEach((r, s) => { const a = prog(t, at('g06', .28 + .08 * s), .5); r.set(cpts(MU[0], MU[1], DT.rings[s] * a), rl * (a > .01 ? 1 : 0) * (1 - .6 * prog(t, S('g07') + .5, .5))); });
    ringL.forEach((r, s) => { const a = prog(t, at('g07', .1 + .12 * s), .6), q = DT.rings[s]; r.set(cpts(MU[0], MU[1], q, H0 + DD * q * a), rl * a * (a > .01 ? 1 : 0)); });
  } else {
    axes.forEach(a => a.set([], 0)); adDot.forEach(d => d.set(V(0, 0, 0), 0, 0)); orgDot.set(V(0, 0, 0), 0, 0);
    FACES.forEach((p, i) => { if (faceM[i]) setM(faceM[i], 0); faceL[i].set([], 0); }); sheetM.forEach(m => m && setM(m, 0));
    [guessDot, bowlDot, avgDot, spotDot, spotBowl, spotCone, planeDot, ...twoDot, ...twoLift, ...cloud, ...cloudL].forEach(d => d.set(V(0, 0, 0), 0, 0));
    [ballRing, regionRing, hDrop, chord, gainSeg, longL, stepFloor, stepFace, stepRise, arrowW, distSeg, dropB, dropC, slideV, bowlPath, facePath, ...twoDrop, ...pairL, ...gens, ...coneRing, ...ringF, ...ringL].forEach(l => l.set([], 0));
    CONE.visible = false;
  }

  meter(t); bars(t); title(t);
  formula('top', TOP, t, 960, 128);
  const fd = prog(t, FADE0, 1.5);
  if (fd > 0) { const e = el('fade', 'fadeb'); e.style.opacity = fd; OV.appendChild(e); }
  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  for (const [k, e] of spool) if (!sused.has(k)) e.style.display = 'none';
  R.render(scene, cam);
}

window.seek = t => draw(t);
window.ready = true;
draw(0);
