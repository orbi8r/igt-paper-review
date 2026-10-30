// Part 1: the model, the uncertainty and the stopping question. Every frame is a pure function of time:
// window.seek(t) draws time t, so capture is deterministic. Narration timing comes from timing.json.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const J = async f => (await fetch(f)).json();
const [ST, TM] = await Promise.all([J('story.json'), J('timing.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
window.TOTAL = TM._total;

const YEL = '#FFE600', BLU = '#3DA5FF', WHT = '#ffffff';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = a => V(a[0], a[1], -a[2]);                    // math coords to three: far goes into the screen
const vl = (a, b, k) => a.clone().lerp(b, k);
// opacity window: fade in over fi after a, fade out over fo after b
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));

// ---------- renderer, camera, lights
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(devicePixelRatio); R.setSize(1920, 1080); document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
cam.setViewOffset(1920, 1080, 0, 50, 1920, 1080);   // stage centre sits 50 px above the frame centre, clear of the chat bubble
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xffffff, 0.9); scene.add(sun);

// ---------- fat lines and dots
class FL {
  constructor(color, w, dashed = false, ds = .035, gs = .025) {
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
let RIGHT = V(1, 0, 0), UP = V(0, 1, 0);
const circ = (c, r, u = RIGHT, w = UP, n = 120, a0 = 0, a1 = 2 * Math.PI) => {
  const o = []; for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); o.push(c.clone().addScaledVector(u, r * Math.cos(a)).addScaledVector(w, r * Math.sin(a))); } return o;
};
const perp = d => { const a = Math.abs(d.y) < .9 ? V(0, 1, 0) : V(1, 0, 0); const u = a.clone().cross(d).normalize(); return [u, d.clone().cross(u).normalize()]; };

// ---------- DOM overlay with a per frame pool
const OV = document.getElementById('ov'); const pool = new Map(); let used = new Set();
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
  e.style.color = o.color || WHT; e.style.fontSize = (o.size || 44) + 'px';
}
const ctx2 = document.createElement('canvas').getContext('2d');
const textW = (s, px) => { ctx2.font = `700 ${px}px "Noto Sans"`; return ctx2.measureText(s.replace(/<[^>]+>/g, '')).width; };

// ---------- story data
const ADS = ST.ads.map(M), N = ADS.length, MUS = ST.mus.map(M), TRUE = M(ST.true), RR = ST.r;
const shat = TRUE.clone().normalize();
const proj = ADS.map(a => a.dot(shat)), COT = 0, YOGA = ST.picks[0];
// spa: relaxing like Sam, luxury unlike Sam, near like Sam. raft: the most adventurous ad.
let SPA = 0, best = -9;
ST.ads.forEach((a, i) => { const s = Math.min(-a[0], a[1], -a[2]); if (s > best) { best = s; SPA = i; } });
const RAFT = ST.raft, PUSH = 40;
const lastTurn = i => (ST.alive[3][i] ? 3 : ST.alive[2][i] ? 2 : ST.alive[1][i] ? 1 : 0);

// ---------- timeline anchors
const RW = [[S('a21'), S('a21') + 1.7, S('a18')], [S('a30'), S('a30') + 1.7, S('a27')]];
const tau = t => { for (const [a, b, to] of RW) if (t >= a && t < b) return lerp(a, to, ease((t - a) / (b - a))); return t; };
const B2 = at('a23', .05), B3 = at('a25', .12), B4 = at('a26', .06);
const T2 = at('a24', .74), T3 = at('a25', .66), T4 = at('a26', .3);
const DROP = [T2, T3, T4, null];
const R30 = S('a30') + 1.9;

function ball(t) {
  let m = MUS[0].clone(), r = RR[0];
  [[B2, 1.8, 1], [B3, 1.2, 2], [B4, 1.2, 3]].forEach(([b, d, k]) => { const q = prog(t, b, d); m.lerp(MUS[k], q); r = lerp(r, RR[k], q); });
  return { m, r };
}
function stepVal(t, vals, times, d = .6) { let v = vals[0]; times.forEach((tt, k) => { v = lerp(v, vals[k + 1], prog(t, tt, d)); }); return v; }

// ---------- camera keys: [start, duration, pose]; pose = az, el (degrees), dist, target
const C3 = shat.clone();
const P0 = { az: 0, el: 0, dist: 5.4, tg: V(0, 0, 0) };
const KEYS = [
  [at('a05', .1), 1.3, { az: 0, el: 0, dist: 7.6, tg: V(0, 0, 0) }],
  [at('a06', .25), 3.0, { az: 40, el: 20, dist: 8.2, tg: V(0, 0, 0) }],
  [at('a07', .0), D('a07') + .6, { az: 52, el: 22, dist: 8.2, tg: V(0, 0, 0) }],
  [S('a08'), 2.2, { az: 46, el: 16, dist: 7.6, tg: C3.clone().multiplyScalar(.2) }],
  [at('a11', .05), 1.6, { az: 46, el: 16, dist: 8.8, tg: C3.clone().multiplyScalar(.2).add(V(0, .35, 0)) }],
  [S('a14'), 2.0, { az: 50, el: 20, dist: 7.6, tg: C3.clone().multiplyScalar(.25) }],
  [S('a22'), 2.5, { az: 58, el: 20, dist: 8.0, tg: C3.clone().multiplyScalar(.2) }],
  [B3 - .4, 2.0, { az: 62, el: 20, dist: 5.2, tg: C3.clone().multiplyScalar(.45) }],
  [B4 - .4, 2.0, { az: 64, el: 20, dist: 4.1, tg: C3.clone().multiplyScalar(.55) }],
  [S('a35'), 2.6, { az: 70, el: 24, dist: 2.1, tg: MUS[3].clone() }],
  [S('a37'), E('a39') - S('a37') + 1, { az: 92, el: 26, dist: 2.1, tg: MUS[3].clone() }],
];
let CD = 8;
function camAt(t) {
  let p = { ...P0, tg: P0.tg.clone() };
  for (const [s, d, q] of KEYS) { const k = prog(t, s, d); if (k <= 0) break; p = { az: lerp(p.az, q.az, k), el: lerp(p.el, q.el, k), dist: lerp(p.dist, q.dist, k), tg: vl(p.tg, q.tg, k) }; }
  CD = p.dist; const a = p.az * Math.PI / 180, e = p.el * Math.PI / 180;
  cam.position.copy(p.tg).add(V(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(p.dist));
  cam.up.set(0, 1, 0); cam.lookAt(p.tg); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  RIGHT = V(1, 0, 0).applyQuaternion(cam.quaternion); UP = V(0, 1, 0).applyQuaternion(cam.quaternion);
  sun.position.copy(cam.position).add(UP.clone().multiplyScalar(3));
}

// ---------- scene objects
const adDot = ADS.map(() => new Dot(BLU));
const adRing = ADS.map(() => new FL(WHT, 4));
const samDot = new Dot(YEL), guessDot = new Dot(WHT);
const samRing = new FL(YEL, 5, true, .02, .014);
const axes = [0, 1, 2].map(() => new FL('#d0d0d0', 3));
const arrow = new FL(WHT, 6), arrowExt = new FL(WHT, 3, true), arrowHead = new FL(WHT, 6);
const drop1 = new FL(WHT, 3, true, .025, .02), drop2 = new FL(YEL, 3, true, .025, .02), reach = new FL(WHT, 10), spaDrop = new FL(WHT, 3, true, .025, .02);
const segS = new FL(YEL, 12), segA = new FL(WHT, 5); segA.mat.depthTest = false; segA.obj.renderOrder = 2;
const wall = [0, 1, 2].map(() => new FL(WHT, 4));
const ballRing = new FL(WHT, 6), ballEq = new FL(WHT, 2.5, true, .05, .035), ghost = new FL(WHT, 3, true, .05, .04), radius = new FL(WHT, 4);
const rim = new FL(WHT, 6), gens = [...Array(8)].map(() => new FL(WHT, 2.5));
const pushRay = new FL(BLU, 3, true);
const smp = ST.sample.map(s => ({ p: M(s.p), ok: s.ok, d: new Dot(WHT, true), r: new FL(WHT, 3) }));
const region = new FL(WHT, 4, true, .012, .009), meanRing = new FL(WHT, 5);
const cloud = [...Array(48)].map(() => new Dot(WHT, true));

// next guess clouds: every shape has mean exactly at the guess and fits in the region
const RNG = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
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
  const mean = pts.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / 48);
  pts.forEach(p => p.sub(mean));
  const mx = Math.max(...pts.map(p => p.length())); pts.forEach(p => p.multiplyScalar(.95 / Math.max(mx, 1)));
  return pts;
}
const SHAPES = [shape(0), shape(1), shape(2)];
const RSTEP = RR[3] * (1 - ST.alpha);

// ---------- formulas: a list of states per channel, shared token keys slide, new ones fade or fly in
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
const sub = s => `<sub>${s}</sub>`;
const mu_t = 'μ' + sub('t'), r_t = 'r' + sub('t'), mu_t1 = 'μ' + sub('t+1'), r_t1 = 'r' + sub('t+1');
const T = (k, h, o = {}) => ({ k, h, ...o });
const fromScr = v => () => scr(v);
const TOP = [
  { t: at('a11', .3), toks: [T('fit', 'fit'), T('eq', '='), T('l', '⟨', { sp: .04 }), T('a', 'a', { from: fromScr(ADS[COT]) }), T('cm', ',', { sp: .02 }), T('mu', 'μ', { from: fromScr(TRUE) }), T('r', '⟩', { sp: .04 })] },
  { t: at('a12', .25), toks: [T('fit', 'h(μ)'), T('eq', '='), T('max', 'max'), T('l', '⟨', { sp: .04 }), T('a', 'a' + sub('i')), T('cm', ',', { sp: .02 }), T('mu', 'μ'), T('r', '⟩', { sp: .04 })] },
  { t: at('a13', .5), toks: [T('fit', 'h(μ)'), T('eq', '='), T('max', 'max'), T('l', '⟨', { sp: .04 }), T('v', 'v' + sub('i'), { sp: 0, from: fromScr(ADS[PUSH].clone().multiplyScalar(1.3)) }), T('a', 'a' + sub('i'), { sp: 0 }), T('cm', ',', { sp: .02 }), T('mu', 'μ'), T('r', '⟩', { sp: .04 })] },
  { t: S('a14') + .2, toks: [] },
  { t: at('a23', .35), toks: [T('r1', r_t1), T('eq', '='), T('al', 'α'), T('rt', r_t)] },
  { t: at('a23', .55), toks: [T('r1', r_t1), T('eq', '='), T('al', 'α'), T('rt', r_t), T('a2', 'α = 0.6', { sp: .9 })] },
  { t: at('a24', .1), toks: [] },
  { t: at('a29', .62), toks: [T('p', 'p = 0.2', { cap: 'chance Sam leaves' })] },
  { t: S('a30'), toks: [] },
  { t: at('a32', .6), toks: [T('when', 'when?')], size: 96 },
  { t: S('a33'), toks: [] },
  { t: at('a33', .7), toks: [T('h', `h(${mu_t})`, { cap: 'show now', from: fromScr(ADS[COT]) })] },
  { t: at('a34', .3), toks: [T('h', `h(${mu_t})`, { cap: 'show now' }), T('or', 'or', { sp: .5 }), T('p', '(1 − p)', { cap: 'stays' }), T('x', '×'), T('nx', 'V(next)', { cap: 'same choice again' })] },
  { t: at('a38', .2), toks: [T('V', `V(${mu_t}, ${r_t})`), T('eq', '='), T('max', 'max{', { sp: .05 }), T('h', `h(${mu_t})`, { cap: 'show now' }), T('or', ',', { sp: .1 }), T('p', '(1 − p)', { cap: 'stays' }), T('nx', `E${sub('t')}[V(${mu_t1}, ${r_t1})]`, { cap: 'keep talking', box: at('a39', .2), sp: .3 }), T('cl', '}', { sp: .1 })], size: 64 },
];
const BOT = [
  { t: at('a36', .55), toks: [T('E', `E${sub('t')}[${mu_t1}] = ${mu_t}`)] },
  { t: S('a38'), toks: [] },
];

// ---------- chat: one bubble, morphing between messages
const MSG = [
  { t: S('a01') + .2, u: 1e9, who: 'sam', s: "I'm so tired of work.", type: 1 },
  { t: at('a18', .62), u: S('a21'), who: 'bot', s: 'Here is an idea:', card: 'Hill yoga retreat · 5 nights · $380' },
  { t: at('a20', .42), u: S('a21'), who: 'sam', s: 'ugh. ads already?' },
  { t: at('a20', .82), u: S('a21'), who: 'gone', s: 'Sam left' },
  { t: S('a22'), u: 1e9, who: 'bot', s: 'That sounds heavy. What would help?' },
  { t: at('a22', .52), u: 1e9, who: 'sam', s: 'a few days, warm and quiet' },
  { t: S('a25'), u: 1e9, who: 'sam', s: 'my sister. no hiking please' },
  { t: S('a26'), u: 1e9, who: 'sam', s: 'the sea, we drive, under $100' },
  { t: S('a27'), u: S('a30'), who: 'bot', s: 'A quiet beach town nearby. Go midweek.' },
  { t: S('a28'), u: S('a30'), who: 'sam', s: 'perfect, thanks!' },
  { t: at('a28', .4), u: S('a30'), who: 'gone', s: 'Sam left' },
  { t: R30, u: 1e9, who: 'bot', s: 'A quiet beach town nearby. Go midweek.', card: 'Beach cottage · 2 nights · $90' },
  { t: at('a31', .3), u: 1e9, who: 'sam', s: 'huh. that fits.' },
  { t: S('a32') + .3, u: 1e9, who: 'none', s: '' },
];
const active = t => { let m = null; for (const x of MSG) if (x.t <= t && t < x.u) m = x; return m; };
function bubbleBox(m) {
  if (!m || m.who === 'none' || m.who === 'gone') return { w: 0, h: 0 };
  const tw = textW(m.s, 52), cw = m.card ? textW(m.card, 46) + 56 : 0;
  return { w: Math.max(tw, cw) + 80, h: m.card ? 190 : 100 };
}
function chat(t) {
  const m = active(t); if (!m) return;
  const p = active(m.t - 1e-3), k = prog(t, m.t, .45);
  const b0 = bubbleBox(p), b1 = bubbleBox(m);
  const w = lerp(b0.w, b1.w, k), h = lerp(b0.h, b1.h, k);
  const cy = lerp(540, 975, prog(t, S('a02') + .1, 1.0)) - (b1.h > 120 ? 45 : 0) * k - (b0.h > 120 ? 45 : 0) * (1 - k);
  const col = c => (c && c.who === 'sam') ? YEL : WHT;
  if (w > 4) {
    const b = el('bub', 'bub'); b.style.left = '960px'; b.style.top = cy + 'px'; b.style.width = w + 'px'; b.style.height = h + 'px';
    b.style.borderColor = k < .5 ? col(p) : col(m); b.style.opacity = 1;
    const tg = el('btag', 'btag'), who = k < .5 ? p : m;
    if (who && (who.who === 'sam' || who.who === 'bot')) { html(tg, who.who === 'sam' ? 'Sam' : 'bot'); tg.style.color = col(who); tg.style.left = (960 - w / 2 + 24) + 'px'; tg.style.top = (cy - h / 2 - 30) + 'px'; tg.style.opacity = Math.abs(k - .5) * 2; }
  }
  const line = (id, mm, op, dy) => {
    if (!mm || op <= .004 || !mm.s || mm.who === 'gone') return;
    const bh = bubbleBox(mm).h, ty = cy + dy - (bh > 120 ? 40 : 0);
    let s = mm.s; if (mm.type) s = s.slice(0, Math.floor(s.length * clamp((t - mm.t) / 1.3)));
    const e = el('bt' + id, 'btxt'); html(e, s.replace(/</g, '&lt;')); e.style.top = ty + 'px'; e.style.opacity = op;
    if (mm.type) { e.style.transform = 'translate(0,-50%)'; e.style.left = (960 - textW(mm.s, 52) / 2) + 'px'; } else { e.style.transform = ''; e.style.left = '960px'; }
    if (mm.card) { const c = el('bc' + id, 'card'); html(c, mm.card); c.style.left = '960px'; c.style.top = (ty + 82) + 'px'; c.style.opacity = op;
      const ck = win(t, at('a31', .02), at('a31', .22), .1, .3); if (ck > 0 && mm === active(t)) c.style.boxShadow = `0 0 0 ${8 * ck}px #fff`; else c.style.boxShadow = 'none'; }
  };
  line('o', p, 1 - clamp(k * 2.2), -14 * k);
  line('n', m, clamp((k - .35) / .65), 14 * (1 - k));
  if (m.who === 'gone') { const g = el('gone', 'lab'); html(g, 'Sam left'); g.style.left = '960px'; g.style.top = '975px'; g.style.opacity = k; g.style.color = YEL; g.style.fontSize = '48px'; }
}

// ---------- the frame
function draw(t0) {
  const t = tau(t0); used = new Set();
  camAt(t);
  const k1 = prog(t, at('a03', .3), 1.4), k2 = prog(t, at('a05', .35), 1.2), k3 = prog(t, at('a06', .3), 1.8);
  const place = (a, g) => { const l = V(a.x, 0, 0), p2 = V(a.x, a.y, 0); return vl(vl(vl(g, l, k1), p2, k2), a, k3); };
  const bl = ball(t);

  // axes and their end labels
  const AX = [[V(1, 0, 0), at('a03', .25), 'relaxing', 'adventurous'], [V(0, 1, 0), at('a05', .2), 'cheap', 'luxury'], [V(0, 0, -1), at('a06', .25), 'near', 'far']];
  const axOp = 1 - prog(t, S('a32'), 1.5);
  AX.forEach(([d, s, lo, hi], i) => {
    const g = prog(t, s, .9) * 1.2; axes[i].set([d.clone().multiplyScalar(-g), d.clone().multiplyScalar(g)], axOp * (g > 0 ? 1 : 0));
    const o = win(t, s + (i === 2 ? 2.2 : .3), at('a09', .3), .5, .8) * axOp; if (o <= 0) return;
    const c = scr(V(0, 0, 0));
    [[-1, lo], [1, hi]].forEach(([sg, txt]) => {
      const e = scr(d.clone().multiplyScalar(1.2 * sg)); let dx = e.x - c.x, dy = e.y - c.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const w = textW(txt, 40) / 2 + 16, push = Math.abs(dx) * w + Math.abs(dy) * 30 + 10;
      lab('ax' + i + sg, txt, { x: e.x + dx * push, y: e.y + dy * push }, o, { size: 40, color: '#d0d0d0' });
    });
  });

  // ads
  for (let i = 0; i < N; i++) {
    const g = V(((i % 10) - 4.5) * .2, (4.5 - Math.floor(i / 10)) * .2, 0);
    const app = prog(t, at('a02', .45) + i * .012, .35);
    let p = place(ADS[i], g);
    let sc = 1, dk = 0; const dt = DROP[lastTurn(i)]; if (dt) { dk = prog(t, dt + (i % 7) * .04, .45); sc = 1 - .4 * dk; }
    if (i === PUSH) p.multiplyScalar(1 + .35 * Math.sin(Math.PI * clamp((t - at('a13', .2)) / (D('a13') * .5))));
    const focus = (i === SPA || i === COT) ? 1 : 1 - .75 * win(t, at('a08', .1), at('a09', .55), .5, .6);
    adDot[i].set(p, .036 * CD / 8 * app * sc, focus * (1 - .8 * dk));
    // white rings: being touched by the wall, the best ad, the pick, ads left at the end, drop flashes
    let rop = 0, rr = .06;
    const ws = wallS(t); if (t > S('a10') && t < S('a11') + .5 && Math.abs(proj[i] - ws) < .03) rop = 1;
    if (i === COT) rop = Math.max(rop, win(t, at('a10', .78), S('a14'), .3, .4), win(t, R30, S('a32') + .4));
    if (i === YOGA) rop = Math.max(rop, win(t, at('a18', .5), S('a21'), .3, .2));
    if (ST.alive[3][i]) rop = Math.max(rop, win(t, at('a28', .62), S('a30'), .3, .2));
    if (dt) { const f = (t - dt - (i % 7) * .04) / .45; if (f > 0 && f < 1) { rop = Math.max(rop, 1 - f); rr = .03 + .05 * f; } }
    adRing[i].set(circ(p, rr * CD / 8, RIGHT, UP, 48), rop);
  }
  lab('l100', '100 ads', V(0, 1.15, 0), win(t, at('a02', .5), at('a03', .25), .4, .4), { size: 48 });
  const spaP = place(ADS[SPA], V(0, 0, 0)), raftP = place(ADS[RAFT], V(0, 0, 0));
  const a4 = win(t, at('a04', .3), at('a05', .05), .4, .3);
  lab('spa', 'spa day', spaP, a4, { dy: 56 }); lab('spa+', '+', spaP, win(t, at('a04', .5), at('a05', .05), .3, .3), { dy: 126, size: 80 });
  lab('raft', 'rafting', raftP, a4, { dy: 56 }); lab('raft-', '−', raftP, win(t, at('a04', .78), at('a05', .05), .3, .3), { dy: 126, size: 80 });

  // Sam
  const samP = place(TRUE, V(0, 0, 0));
  const hidden = prog(t, S('a14') + .1, .8) * (1 - prog(t, S('a20'), .6) * (t < S('a21') ? 1 : 0));
  samDot.set(samP, .05 * CD / 8 * prog(t, at('a04', .05), .5) * (1 - hidden), 1);
  samRing.set(circ(samP, .06 * CD / 8, RIGHT, UP, 60), hidden);
  lab('sam', 'Sam', samP, win(t, at('a04', .12), S('a14'), .4, .5), { dx: 70, dy: -40, color: YEL });
  lab('samq', 'Sam ?', samP, hidden * win(t, S('a14'), S('a22')), { dx: -100, color: YEL });
  lab('samun', 'unknown', samP, win(t, at('a16', .72), S('a18'), .3, .5), { dx: -100, dy: 46, color: YEL, size: 40 });
  lab('samhere', 'Sam', samP, win(t, S('a20') + .2, S('a21'), .3, .2), { dx: -90, color: YEL });

  // aspect by aspect (a08): on each axis, where Sam (yellow) and the spa (white) land; the tally on the left adds them up
  const asp = [at('a08', .2), at('a08', .4), at('a08', .58)], aspEnd = at('a09', .25);
  const sa = [TRUE.x, TRUE.y, -TRUE.z], pa = [ADS[SPA].x, ADS[SPA].y, -ADS[SPA].z];
  let cum = 0; const sc = 700, rows = [];
  for (let k = 0; k < 3; k++) { const v = sa[k] * pa[k]; rows.push([cum, cum + v]); cum += v; }
  const lo = Math.min(0, ...rows.flat()), hi = Math.max(0, ...rows.flat()), x0 = 420 - (lo + hi) / 2 * sc, Y0 = 350, DY = 74;
  lab('spa3', 'spa day', spaP, win(t, at('a08', .1), at('a09', .9), .4, .5), { dy: -50 });
  let liveAny = false;
  ['relaxing', 'cheap', 'near'].forEach((nm, k) => {
    const o = win(t, asp[k], aspEnd, .3, .4); if (o <= 0) return;
    const ax = AX[k][0], sp = ax.clone().multiplyScalar(ax.dot(samP)), pp = ax.clone().multiplyScalar(ax.dot(spaP));
    const live = win(t, asp[k], k < 2 ? asp[k + 1] : asp[2] + 1.6, .25, .3);
    if (live > 0) { liveAny = true; drop2.set([samP, sp], live); drop1.set([spaP, pp], live); segS.set([V(0, 0, 0), sp], live); segA.set([V(0, 0, 0), pp], live); }
    const [a, b] = rows[k], bar = el('wf' + k, 'fill');
    const wd = Math.abs(b - a) * sc * prog(t, asp[k] + .2, .5), y = Y0 + k * DY;
    bar.style.left = (b >= a ? x0 + a * sc : x0 + a * sc - wd) + 'px'; bar.style.top = y + 'px'; bar.style.width = wd + 'px'; bar.style.height = '44px'; bar.style.opacity = o;
    bar.style.background = b >= a ? WHT : 'transparent'; bar.style.border = b >= a ? 'none' : '6px solid #fff'; bar.style.boxSizing = 'border-box';
    const txt = nm + (b >= a ? '  +' : '  −');
    lab('wfl' + k, txt, { x: x0 + lo * sc - 28 - textW(txt, 44) / 2, y: y + 22 }, o, { size: 44 });
  });
  if (!liveAny) { drop1.set([], 0); drop2.set([], 0); segS.set([], 0); segA.set([], 0); }
  const tot = win(t, at('a08', .72), aspEnd, .25, .4);
  if (tot > 0) {
    const z = el('wf0line', 'fill'); z.style.left = (x0 - 2) + 'px'; z.style.top = (Y0 - 14) + 'px'; z.style.width = '4px'; z.style.height = (3 * DY + 6) + 'px'; z.style.opacity = tot * .8; z.style.background = '#d0d0d0';
    const f = el('wftk', 'fill'); f.style.left = (x0 + cum * sc - 4) + 'px'; f.style.top = (Y0 - 14) + 'px'; f.style.width = '8px'; f.style.height = (3 * DY + 20) + 'px'; f.style.opacity = tot; f.style.background = WHT;
    lab('wftot', 'fit', { x: x0 + cum * sc, y: Y0 + 3 * DY + 40 }, tot, { size: 52 });
  }

  // arrow to Sam, reach of the spa, the wall
  const arOp = win(t, at('a09', .2), S('a14'), .4, .5), arG = prog(t, at('a09', .2), .8);
  arrow.set([V(0, 0, 0), samP.clone().multiplyScalar(arG * .93)], arOp);
  const hb = samP.clone().multiplyScalar(.93), [hu] = perp(shat);
  const side = RIGHT.clone().sub(shat.clone().multiplyScalar(RIGHT.dot(shat))).normalize();
  arrowHead.set([hb.clone().addScaledVector(side, .035), samP, hb.clone().addScaledVector(side, -.035)], arOp * (arG > .9 ? 1 : 0));
  arrowExt.set([samP, shat.clone().multiplyScalar(1.2)], arOp * prog(t, at('a09', .45), .6));
  const ro = win(t, at('a09', .55), at('a10', .15), .4, .5), foot = shat.clone().multiplyScalar(proj[SPA]);
  spaDrop.set([spaP, foot], ro); reach.set([V(0, 0, 0), foot], ro);
  lab('fit', 'fit', vl(V(0, 0, 0), foot, .5), ro, { dy: 44 });
  const ws = wallS(t), wo = win(t, at('a10', .03), at('a11', .5), .3, .5);
  const [u, w] = perp(shat), c = shat.clone().multiplyScalar(ws), q = .5;
  const corner = (a, b) => c.clone().addScaledVector(u, a * q).addScaledVector(w, b * q);
  wall[0].set([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)], wo);
  wall[1].set([corner(-1, 0), corner(1, 0)], wo * .6); wall[2].set([corner(0, -1), corner(0, 1)], wo * .6);
  lab('best', 'best ad', ADS[COT], win(t, at('a10', .8), at('a11', .25), .3, .4), { dx: -120 });
  lab('besta', 'a', ADS[COT], win(t, at('a11', .2), S('a14'), .3, .4), { dy: -56, size: 56 });
  lab('h', 'h', vl(V(0, 0, 0), shat.clone().multiplyScalar(proj[COT]), .55), win(t, at('a12', .1), S('a14'), .3, .4), { dy: 48, size: 56 });
  reach.obj.visible = reach.obj.visible || false;
  if (t > at('a12', .1) && t < S('a14') + .4) reach.set([V(0, 0, 0), shat.clone().multiplyScalar(proj[COT])], win(t, at('a12', .1), S('a14'), .3, .4));
  pushRay.set([V(0, 0, 0), ADS[PUSH].clone().multiplyScalar(1.4)], win(t, at('a13', .15), at('a13', .9), .3, .4));
  lab('v', 'v', ADS[PUSH].clone().multiplyScalar(1.3), win(t, at('a13', .3), at('a13', .9), .3, .4), { dx: 40, size: 56 });

  // guess and ball
  const gop = win(t, at('a15', .25), 1e9, .4);
  guessDot.set(bl.m, .042 * CD / 8 * gop, 1);
  const br = bl.r * prog(t, at('a15', .5), 1.0);
  const bop = 1 - prog(t, S('a35') + 1.0, 1.2) * 0;
  ballRing.set(circ(bl.m, br, RIGHT, UP, 160), br > .01 ? bop : 0);
  ballEq.set(circ(bl.m, br, V(1, 0, 0), V(0, 0, 1), 160), br > .01 ? .9 * bop : 0);
  const gk = [B2, B3, B4].findLastIndex(b => t >= b), gh = gk < 0 ? 0 : 1 - clamp((t - [B2, B3, B4][gk] - .6) / 1.4);
  ghost.set(gk < 0 ? [] : circ(MUS[gk], RR[gk], RIGHT, UP, 160), gh);
  const rop = win(t, at('a15', .7), S('a22'), .4, .5);
  const DIAG = RIGHT.clone().add(UP).normalize();
  radius.set([bl.m, bl.m.clone().addScaledVector(DIAG, br)], rop);
  lab('rlab', t < at('a16', .3) ? 'r' : r_t, bl.m.clone().addScaledVector(DIAG, br * .5), rop, { dx: -34, dy: -34, size: 52 });
  const gl = win(t, at('a15', .3), S('a22'), .4, .5);
  lab('gl1', 'guess', bl.m, gl * (1 - prog(t, at('a16', .1), .5)), { dx: 100 });
  lab('gl2', mu_t, bl.m, gl * prog(t, at('a16', .1), .5), { dx: 80, size: 52 });
  lab('known', 'known', bl.m, win(t, at('a16', .45), S('a18'), .3, .5), { dx: 100, dy: 46, size: 40 });

  // light from the center through the ball
  const lop = win(t, at('a24', .3), S('a32') + .2, .5, .6);
  if (lop > 0 && bl.m.length() > bl.r + 1e-3) {
    const dd = bl.m.clone().normalize(), th = Math.asin(bl.r / bl.m.length()), [uu, ww] = perp(dd);
    const cc = dd.clone().multiplyScalar(Math.cos(th)), rr2 = Math.sin(th), gk = prog(t, at('a24', .3), 1.2);
    rim.set(circ(cc, rr2, uu, ww, 160), lop * (gk > .95 ? 1 : 0));
    gens.forEach((g, k) => { const a = 2 * Math.PI * k / 8; const e = cc.clone().addScaledVector(uu, rr2 * Math.cos(a)).addScaledVector(ww, rr2 * Math.sin(a)); g.set([V(0, 0, 0), e.multiplyScalar(gk)], lop * .8); });
  } else { rim.set([], 0); gens.forEach(g => g.set([], 0)); }

  // click chance definition: tastes in the ball, filled where the pick comes close to Sam's best
  smp.forEach((s, k) => {
    const o = win(t, at('a19', .3) + k * .02, S('a21'), .25, .2);
    if (s.ok) { s.d.set(s.p, .026, o); s.r.set([], 0); } else { s.d.set(s.p, 0, 0); s.r.set(circ(s.p, .022, RIGHT, UP, 24), o); }
  });
  const sideLab = (key, txt, pts, y, op, right) => {
    if (op <= 0) return; const xs = pts.map(p => scr(p).x), w = textW(txt, 44) / 2 + 36;
    lab(key, txt, { x: right ? Math.max(...xs) + w : Math.min(...xs) - w, y }, op);
  };
  const ballPts = br > .01 ? circ(bl.m, br, RIGHT, UP, 32) : [bl.m];
  sideLab('yoga', 'yoga retreat', [ADS[YOGA], ...ballPts], scr(ADS[YOGA]).y, win(t, at('a18', .55), S('a21'), .3, .2), true);
  const left10 = ADS.filter((_, i) => ST.alive[3][i]);
  sideLab('cot', 'beach cottage', [...left10, ...ballPts], scr(ADS[COT]).y, win(t, R30, S('a32') + .3, .3, .4), false);
  sideLab('never', 'never shown', [...left10, ...ballPts], scr(bl.m).y, win(t, at('a28', .7), S('a30'), .3, .2), false);

  // HUD: ads that could be best, and the click chance
  const hc = win(t, at('a17', .55), S('a32'), .5, .6);
  if (hc > 0) {
    const n = Math.round(stepVal(t, ST.counts, DROP.slice(0, 3), .7));
    const e = el('hudL', 'hud'); html(e, `<div class="k">could be best</div><div class="v">${n}</div>`); e.style.left = '330px'; e.style.top = '60px'; e.style.opacity = hc;
  }
  const mc = Math.max(win(t, at('a19', .62), S('a21'), .5, .2), win(t, S('a22'), S('a32'), .5, .6));
  if (mc > 0) {
    const pc = stepVal(t, ST.click.map(x => x * 100), DROP.slice(0, 3), .7);
    const e = el('hudR', 'hud'); html(e, `<div class="k">click chance</div><div class="v">${Math.round(pc)}%</div>`); e.style.left = '1590px'; e.style.top = '60px'; e.style.opacity = mc;
    const b = el('mbar', 'bar'); b.style.left = '1440px'; b.style.top = '210px'; b.style.width = '300px'; b.style.opacity = mc;
    const f = el('mfill', 'fill'); f.style.left = '1440px'; f.style.top = '210px'; f.style.width = (300 * pc / 100) + 'px'; f.style.opacity = mc;
  }

  // next guesses (a35 to a39)
  const reg = win(t, at('a35', .45), 1e9, .5);
  region.set(circ(bl.m, RSTEP, RIGHT, UP, 120), reg);
  lab('reg', `${r_t} − ${r_t1}`, bl.m.clone().addScaledVector(UP, RSTEP), win(t, at('a35', .6), S('a37'), .4, .5), { dy: -40, size: 44 });
  const sh = [at('a37', .25), at('a37', .55)];
  cloud.forEach((d, k) => {
    let v = SHAPES[0][k].clone(); sh.forEach((s, j) => v.lerp(SHAPES[j + 1][k], prog(t, s, .8)));
    d.set(bl.m.clone().addScaledVector(v, RSTEP), .0075, win(t, at('a36', .2) + k * .015, 1e9, .3));
  });
  meanRing.set(circ(bl.m, .012, RIGHT, UP, 40), win(t, at('a36', .55), 1e9, .4));
  lab('avg', 'average', bl.m, win(t, at('a36', .6), S('a38'), .4, .5), { dx: 0, dy: 140, size: 40 });

  formula('top', TOP, t, 960, 128);
  formula('bot', BOT, t, 960, 975);
  chat(t);
  const rw = RW.some(([a, b]) => t0 >= a && t0 < b);
  lab('rw', '◀◀  rewind', { x: 960, y: 128 }, rw ? 1 : 0, { size: 72 });

  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  R.render(scene, cam);
}
function wallS(t) { return proj[COT] * prog(t, at('a10', .05), D('a10') * .62); }

window.seek = t => draw(t);
window.ready = true;
draw(0);
