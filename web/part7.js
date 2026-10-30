// Part 7: selling the slot. A pure function of time: window.seek(t) draws time t. 2D canvas plus the DOM overlay of Part 1.
const J = async f => (await fetch(f)).json();
const [TM, DATA] = await Promise.all([J('timing7.json'), J('part7_data.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
window.TOTAL = TM._total;
const YEL = '#FFE600', BLU = '#3DA5FF', WHT = '#ffffff', GRY = '#d0d0d0';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));
const c2 = document.getElementById('c2'), g = c2.getContext('2d');
const OV = document.getElementById('ov'); const pool = new Map(); let used = new Set();
function el(key, cls) {
  let e = pool.get(key); if (!e) { e = document.createElement('div'); e.className = cls; OV.appendChild(e); pool.set(key, e); e._h = null; }
  used.add(key); e.style.display = ''; return e;
}
function html(e, h) { if (e._h !== h) { e.innerHTML = h; e._h = h; } }
const ctx2 = document.createElement('canvas').getContext('2d');
const textW = (s, px) => { ctx2.font = `700 ${px}px "Noto Sans"`; return ctx2.measureText(s.replace(/<[^>]+>/g, '')).width; };
// ---------- 2D helpers
function lab(key, h, p, op, o = {}) {
  if (op <= .004) return; const e = el(key, 'lab'); html(e, h);
  e.style.left = (p[0] + (o.dx || 0)) + 'px'; e.style.top = (p[1] + (o.dy || 0)) + 'px'; e.style.opacity = op;
  e.style.color = o.color || WHT; e.style.fontSize = (o.size || 56) + 'px';
  e.style.transform = o.al === 'l' ? 'translate(0,-50%)' : o.al === 'r' ? 'translate(-100%,-50%)' : '';
}
function ln(pts, col, w, op = 1, dash = null) {
  if (op <= .004 || pts.length < 2) return; g.save(); g.globalAlpha = op; g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
  g.setLineDash(dash || []); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
}
function poly(pts, col, op, stroke = null, sw = 5) {
  if (op <= .004 || pts.length < 3) return; g.save(); g.globalAlpha = op; g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = sw; g.stroke(); } g.restore();
}
function rect(x, y, w, h, col, op, stroke = null, sw = 5) { if (op <= .004 || w <= 0 || h <= 0) return; poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col, col ? op : 0, stroke, sw); }
function ring(x, y, r, col, w, op = 1, fill = false) {
  if (op <= .004 || r <= .5) return; g.save(); g.globalAlpha = op; g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI);
  if (fill) { g.fillStyle = col; g.fill(); } else { g.strokeStyle = col; g.lineWidth = w; g.stroke(); } g.restore();
}
const disc = (x, y, r, col, op = 1) => ring(x, y, r, col, 0, op, true);
const fmt = (x, n = 2) => x.toFixed(n);
const CH = { x: 360, y: 340, w: 1200, h: 500 };
const mx = (v, b = CH, xm = 1) => b.x + v / xm * b.w;
const my = (v, b = CH, ym = .4) => b.y + b.h - v / ym * b.h;
function axes(b, op, xo = 1, yo = 1) {
  ln([[b.x, b.y + b.h], [b.x + b.w + 20, b.y + b.h]], GRY, 4, op * xo); ln([[b.x, b.y + 10], [b.x, b.y + b.h]], GRY, 4, op * yo);
}
// X(z): average fit of the beach cottage when pushed by bid z, linear between the check's grid points
const ZS = DATA.zs, XB = DATA.Xb, XP = DATA.Xphi;
const interp = (arr, z) => { const f = clamp(z, 0, 1) / (ZS[1] - ZS[0]); const i = Math.min(arr.length - 2, Math.floor(f)); return lerp(arr[i], arr[i + 1], f - i); };
const Xf = z => interp(XB, z);
const curvePts = (f, z0, z1, n, b, ym) => { const o = []; for (let k = 0; k <= n; k++) { const z = lerp(z0, z1, k / n); o.push([mx(z, b), my(f(z), b, ym)]); } return o; };
// utility of a bidder with value v who bids z (check formula): area up to z plus a strip of width v minus z at height X(z)
const AREA = z => { let s = 0; const n = 200; for (let k = 0; k < n; k++) { const a = z * k / n, c = z * (k + 1) / n; s += (Xf(a) + Xf(c)) / 2 * (c - a); } return s; };
const UTIL = (v, z) => AREA(z) + (v - z) * Xf(z);
// cross check of the page against the check script: utility for value 0.8 and the average payment identity
{ let m = -1, k0 = 0; ZS.forEach((z, k) => { const u = UTIL(.8, z); if (u > m) { m = u; k0 = k; } });
  window.__chk = { u80: Math.abs(m - DATA.u80_max) < 3e-3, u80z: ZS[k0] };
  let m5 = -1, z5 = 0; ZS.forEach(z => { const u = UTIL(.5, z); if (u > m5 + 1e-12) { m5 = u; z5 = z; } }); window.__chk.u50peak = z5; }
const msgX = (i, b) => b.x + i * (b.w / 7);
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
  const pk = new Map(prev.toks.map(x => [x.k, x])), caps = [];
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
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = px + 'px'; c.style.top = (py + size * .62) + 'px'; c.style.opacity = old && old.cap ? 1 : k; caps.push([c, px]); }
    if (x.box && t > x.box) { const q = prog(t, x.box, .5), w = lc[x.k].w + 24; const b = el(name + x.k + 'b', 'box'); b.style.left = (px - w / 2) + 'px'; b.style.top = (py - size * .62) + 'px'; b.style.width = w + 'px'; b.style.height = size * 1.24 + 'px'; b.style.opacity = q; }
  }
  // captions wider than their token push each other apart, the row stays centred where it was
  if (caps.length > 1) {
    const w = caps.map(([c]) => c.offsetWidth), p = caps.map(([, x]) => x);
    for (let i = 1; i < p.length; i++) p[i] = Math.max(p[i], p[i - 1] + (w[i - 1] + w[i]) / 2 + 28);
    const sh = (p.reduce((a, b) => a + b, 0) - caps.reduce((a, [, x]) => a + x, 0)) / p.length;
    caps.forEach(([c], i) => { c.style.left = (p[i] - sh) + 'px'; });
  }
  for (const x of prev.toks) if (!cur.toks.find(y => y.k === x.k)) {
    draw(x.k, x.h, cx + lp[x.k].x, cy, 1 - k, prev.size || size);
    if (x.cap) { const c = el(name + x.k + 'c', 'cap'); html(c, x.cap); c.style.left = (cx + lp[x.k].x) + 'px'; c.style.top = (cy + size * .62) + 'px'; c.style.opacity = 1 - k; }
  }
}
const sub = s => `<sub>${s}</sub>`;
const mu_t = 'μ' + sub('t'), r_t = 'r' + sub('t'), mu_t1 = 'μ' + sub('t+1'), r_t1 = 'r' + sub('t+1');
const T = (k, h, o = {}) => ({ k, h, ...o });
const NAMES = DATA.names, BIDS = DATA.bids, PHI = DATA.phi;

// ---------- formulas (top band, centred at 960,128)
const supx = s => `<sup>${s}</sup>`;
const TOP = [
  { t: at('b05', .55), toks: [T('P', 'P'), T('eq', '='), T('bx', 'b X(b)', { cap: 'rectangle', from: () => ({ x: 960, y: 560 }) }), T('mi', '−', { sp: .25 }), T('int', `∫${sub('0')}${supx('b')} X(z) dz`, { cap: 'area', from: () => ({ x: 700, y: 760 }) })] },
  { t: at('b06', .45), toks: [T('P', 'u'), T('eq', '='), T('int', `∫${sub('0')}${supx('b')} X(z) dz`, { cap: 'area kept' }), T('pl', '+', { sp: .25 }), T('st', '(v − b) X(b)', { cap: 'strip' })] },
  { t: at('b09', .55), toks: [] },
  { t: at('c02', .62), toks: [T('P', 'φ(v)'), T('eq', '='), T('v', 'v', { cap: 'value' }), T('mi', '−', { sp: .8 }), T('r', '(1 − F) / f', { cap: 'profit given up' })] },
  { t: at('c03', .35), toks: [T('P', 'φ(v)'), T('eq', '='), T('v', 'v', { cap: 'value' }), T('mi', '−', { sp: .8 }), T('r', '(1 − v) / 1', { cap: 'uniform values' })] },
  { t: at('c03', .75), toks: [T('P', 'φ(v)'), T('eq', '='), T('res', '2v − 1')] },
  { t: at('c05', .1), toks: [T('P', 'E[P]'), T('eq', '='), T('r', `E[φ X]`, { cap: 'virtual value × fit' })] },
  { t: S('c06'), toks: [] },
  { t: S('d02') + .3, toks: [T('P', `v${sub('i')} a${sub('i')}`, { cap: 'pushed by its value' })] },
  { t: at('d03', .1), toks: [T('P', `φ${sub('i')} a${sub('i')}`, { cap: 'pushed by its virtual value' })] },
  { t: S('d05') + .3, toks: [T('R', 'revenue'), T('eq', '='), T('s', 'Σ'), T('ph', `φ${sub('i')}`, { cap: 'virtual value', sp: .8 }), T('xi', `X${sub('i')}`, { cap: 'fit', sp: .8 })] },
  { t: E('d05') + .1, toks: [] },
  { t: at('e06', .35), toks: [T('P', 'price'), T('eq', '='), T('b', fmt(BIDS[0], 1), { cap: 'bid', from: () => ({ x: 1440, y: 930 }) }), T('x', '×', { sp: .2 }), T('f', fmt(DATA.x_b), { cap: 'fit it got', from: () => ({ x: 700, y: 640 }) }), T('mi', '−', { sp: .2 }), T('a', fmt(DATA.integral_sum), { cap: 'area', from: () => ({ x: 1330, y: 800 }) })] },
  { t: at('e06', .8), toks: [T('P', 'price'), T('eq', '='), T('b', fmt(BIDS[0], 1), { cap: 'bid' }), T('x', '×', { sp: .2 }), T('f', fmt(DATA.x_b), { cap: 'fit it got' }), T('mi', '−', { sp: .2 }), T('a', fmt(DATA.integral_sum), { cap: 'area' }), T('r', `= ${fmt(DATA.path_pay)}`, { sp: .4 })] },
  { t: at('e07', .1), toks: [T('P', 'price'), T('eq', '='), T('S', 'Σ'), T('j', 'jump', { cap: 'fit gained' }), T('x', '×', { sp: .2 }), T('pu', 'push', { cap: 'where it happens' })] },
  { t: S('e08'), toks: [] },
  { t: at('f02', .4), toks: [T('P', 'pull'), T('eq', '='), T('v', 'v', { cap: 'push' }), T('f', '⟨a, μ⟩', { cap: 'fit' }), T('d', '÷', { sp: .25 }), T('D', 'D', { cap: 'market spread' })] },
  { t: at('f03', .5), toks: [T('P', 'bigger push'), T('eq', '⇒', { sp: .3 }), T('v', 'bigger pull')] },
  { t: S('f04'), toks: [] },
  { t: at('f05', .15), toks: [T('P', `S${sub('t')}`), T('eq', '='), T('g', `(1 − p)${supx('t−1')}`, { cap: 'Sam still there' }), T('x', '×', { sp: .2 }), T('pl', 'pull', { cap: 'of the cottage' })] },
  { t: at('f06', .3), toks: [T('P', "X(c′)"), T('eq', '≥', { sp: .3 }), T('r', 'X(c)', { cap: 'c′ > c, the bigger push' })] },
  { t: at('f07', .15), toks: [T('P', 'A(c)'), T('eq', '⊆', { sp: .3 }), T('r', "A(c′)", { cap: 'chats won at c, at c′' })] },
  { t: S('f08'), toks: [] },
  { t: at('g02', .35), toks: [T('c', 'C', { cap: 'learning constant' }), T('ar', '→', { sp: .5 }), T('s', '(1 − p)', { cap: 'Sam stays' })] },
  { t: S('g03'), toks: [] },
  { t: at('g03', .55), toks: [T('P', 'bound'), T('eq', '='), T('S', 'Σ'), T('d', 'drop', { cap: 'largest radius drop left' }), T('x', '×', { sp: .2 }), T('g', `(1 − p)${supx('t')}`, { cap: 'Sam still there' })] },
  { t: S('g04'), toks: [] },
];
const LF = [T('P', 'loss'), T('eq', '≤', { sp: .25 })];
const BIGF = [
  { t: at('f08', .1), toks: [...LF, T('D', `D̄${sub('φ')}`, { cap: 'virtual spread' })], size: 72 },
  { t: at('f08', .3), toks: [...LF, T('D', `D̄${sub('φ')}`, { cap: 'virtual spread' }), T('x1', '·', { sp: .15 }), T('C', 'C', { cap: 'learning' })], size: 72 },
  { t: at('f08', .45), toks: [...LF, T('D', `D̄${sub('φ')}`, { cap: 'virtual spread' }), T('x1', '·', { sp: .15 }), T('C', 'C', { cap: 'learning' }), T('x2', '·', { sp: .15 }), T('r1', `r${sub('1')}`, { cap: 'start radius' })], size: 72 },
  { t: at('f08', .62), toks: [...LF, T('D', `D̄${sub('φ')}`, { cap: 'virtual spread' }), T('x1', '·', { sp: .15 }), T('C', 'C', { cap: 'learning' }), T('x2', '·', { sp: .15 }), T('r1', `r${sub('1')}`, { cap: 'start radius' }), T('d', '÷', { sp: .25 }), T('den', '2(1 − (1 − p)α)', { cap: 'Sam leaves, learning' })], size: 72 },
  { t: S('f09'), toks: [] },
];

// ---------- title and scene A: the sale (bid, then chat, then payment)
const ROWY = [420, 540, 660, 780], BX0 = 700, BSC = 800;
function sceneA(t) {
  const to = 1 - clamp((t - 1.3) / .6);
  lab('t1', 'Part 7', [960, 440 - 70 * prog(t, 1.3, .7)], to, { size: 128 });
  lab('t2', 'Selling the slot', [960, 600 - 70 * prog(t, 1.3, .7)], to, { size: 96 });
  const o = win(t, 1.4, S('b01') - .1, .5, .5); if (o <= 0) return;
  BIDS.forEach((v, i) => {
    const k = prog(t, S('a02') + .3 + i * .4, .6), y = ROWY[i], w = v * BSC * k, fk = prog(t, S('a03') + .1 + i * .1, .6);
    const op = o * (t < S('a02') ? 0 : 1);
    lab('an' + i, NAMES[i], [BX0 - 40, y], op * k, { al: 'r' });
    rect(BX0, y - 32, w, 64, BLU, .9 * fk, WHT, 6 * (op > 0 ? 1 : 0));
    rect(BX0, y - 32, w, 64, null, 0, null);
    ln([[BX0, y - 32], [BX0 + w, y - 32], [BX0 + w, y + 32], [BX0, y + 32], [BX0, y - 32]], WHT, 6, op * k * (1 - fk * .0));
  });
  lab('av', 'value v', [BX0 + BIDS[0] * BSC + 80, ROWY[0]], o * win(t, at('a02', .5), S('a03') + .3, .4, .4), { al: 'l' });
  lab('ab', 'bid b', [BX0 + BIDS[0] * BSC + 80, ROWY[0]], o * win(t, S('a03') + .5, 1e9, .4), { al: 'l' });
  // timeline: four bids, then eight chat messages, then the ad is shown and the winner pays
  const tl = o * prog(t, at('a03', .45), .6);
  if (tl > .01) ln([[300, 250], [300 + 1260 * tl, 250]], GRY, 4, 1);
  for (let i = 0; i < 4; i++) disc(330 + 56 * i, 250, 18, BLU, tl * prog(t, at('a03', .45) + i * .12, .4));
  lab('tlb', 'bids', [450, 185], tl);
  for (let i = 0; i < 8; i++) { const k = prog(t, at('a03', .62) + i * .06, .35); ring(760 + 100 * i, 250, 20, WHT, 5, o * k, false); }
  lab('tlc', 'chat', [1160, 185], tl * prog(t, at('a03', .62), .5));
  const sk = prog(t, at('a04', .12), .5);
  disc(860, 250, 20 + 8 * sk, BLU, o * sk);
  lab('tls', 'ad shown', [860, 322], o * sk * (1 - prog(t, at('a04', .5), .4)), { size: 56 });
  const pk = prog(t, at('a04', .3), .6);
  ln([[880, 250], [880 + 640 * pk, 250]], BLU, 6, o * pk * .0 + o * pk);
  lab('tlp', 'pays', [1600, 250], o * pk, { al: 'l' });
  lab('tlr', 'revenue', [1640, 330], o * prog(t, at('a04', .45), .5), { color: BLU });
  lab('ah', 'honest bids: b = v', [960, 920], o * win(t, at('a04', .6), 1e9, .5, .5));
}

// ---------- scene B: the payment is an area, and why it keeps bids honest
function sceneB(t) {
  const o = win(t, S('b01') - .1, S('c01') - .1, .5, .5); if (o <= 0) return;
  const ym = .4, Y = v => my(v, CH, ym), X = v => mx(v);
  const xo = prog(t, S('b01') + .2, .6), yo = prog(t, S('b02') + .3, .6);
  const uphase = prog(t, at('b09', .2), .6);
  axes(CH, o, xo, yo);
  lab('bx0', '0', [CH.x, 905], o * xo); lab('bx1', '1', [CH.x + CH.w, 905], o * xo); lab('bxn', 'bid b', [960, 975], o * xo);
  lab('byn', 'average fit X', [330, 300], o * yo * (1 - uphase), { al: 'l' });
  lab('byu', 'utility', [330, 300], o * uphase, { al: 'l' });
  const V = .5;
  // bid marker: b01 slides it down and back
  const bump = Math.sin(Math.PI * clamp((t - at('b01', .5)) / (D('b01') * .42)));
  const bm = .9 - .3 * bump;
  const m1 = win(t, S('b01') + .2, S('b06') - .2, .4, .4);
  disc(X(bm), Y(0), 18, BLU, o * m1);
  lab('bm', t < at('b01', .45) ? 'bid 0.9' : 'smaller bid?', [X(bm), Y(0) - 70], o * m1 * (1 - uphase));
  // the curve X(b)
  const cf = prog(t, S('b03') + .2, D('b03') * .7);
  const cop = o * (1 - uphase);
  if (cf > 0) ln(curvePts(Xf, 0, Math.max(.001, cf), Math.round(60 * cf) + 2, CH, ym), BLU, 9, cop);
  lab('rise', 'only rises', [X(.25), Y(.3)], o * win(t, at('b03', .55), S('b04'), .4, .4));
  // b04 to b05: rectangle, then the area under the curve
  const rb = .9 - .3 * (prog(t, at('b04', .66), .9) - prog(t, S('b05') + .2, .8));
  const rw = win(t, at('b04', .3), S('b06') - .3, .4, .4);
  if (rw > 0) {
    const xr = Xf(rb);
    rect(X(0), Y(xr), X(rb) - X(0), Y(0) - Y(xr), WHT, .12 * o * rw, WHT, 6);
    lab('rbx', 'bid × X', [X(rb / 2), Y(xr / 2)], o * rw * win(t, at('b04', .4), S('b05'), .4, .4));
    ln([[X(.9), Y(0)], [X(.9), Y(Xf(.9))], [CH.x, Y(Xf(.9))]], GRY, 3, o * rw * prog(t, at('b04', .1), .5), [10, 8]);
    lab('x37', fmt(DATA.Xb_at), [CH.x - 20, Y(Xf(.9))], o * rw * prog(t, at('b04', .1), .5), { al: 'r' });
  }
  const af = prog(t, S('b05') + .1, 1.6) * win(t, S('b05'), S('b06') - .3, .2, .4);
  if (af > 0 && rw > 0) {
    const zz = rb * af, pts = curvePts(Xf, 0, Math.max(zz, .001), 40, CH, ym);
    poly([[X(0), Y(0)], ...pts, [X(zz), Y(0)]], BLU, .5 * o * rw);
    const k2 = prog(t, at('b05', .45), .6) * o * rw, xr = Xf(rb);
    poly([[X(0), Y(xr)], [X(rb), Y(xr)], ...curvePts(Xf, rb, 0, 40, CH, ym)], WHT, .32 * k2);
    lab('ar1', 'area', [X(.78), Y(.17)], o * rw * prog(t, at('b05', .3), .5) * 1, { color: WHT });
    lab('pr1', 'price', [X(.22), Y(.3)], k2);
  }
  // b06 to b09: a bidder with value 0.5
  const iw = win(t, S('b06') - .1, at('b09', .3), .4, .4);
  if (iw > 0) {
    const v = V, bb = t < S('b08') ? .3 : .65, ks = prog(t, S('b06') + .2, .6) * iw;
    ln([[X(v), Y(0)], [X(v), Y(.4)]], GRY, 4, o * ks, [12, 10]); lab('vv', 'value v', [X(v), Y(.4) - 50], o * ks);
    disc(X(bb), Y(0), 18, BLU, o * ks); lab('bb', 'bid b', [X(bb), Y(0) - 60], o * ks * .0 + o * ks * (bb < v ? 1 : 1), { dx: bb < v ? -30 : 50 });
    const xb = Xf(bb);
    if (bb < v) {
      poly([[X(0), Y(0)], ...curvePts(Xf, 0, bb, 30, CH, ym), [X(bb), Y(0)]], BLU, .5 * o * ks);
      const sk = prog(t, at('b06', .55), .6) * o * ks;
      rect(X(bb), Y(xb), X(v) - X(bb), Y(0) - Y(xb), WHT, .3 * sk, WHT, 5);
      lab('strip', 'strip', [X((bb + v) / 2), Y(xb / 2)], sk, { size: 56 });
      const sl = win(t, S('b07'), S('b08'), .4, .3) * o;
      poly([[X(bb), Y(xb)], [X(v), Y(xb)], ...curvePts(Xf, v, bb, 30, CH, ym)], WHT, .95 * sl);
      lab('lost', 'lost', [X(.4), Y(Xf(.5)) - 80], sl);
    } else {
      poly([[X(0), Y(0)], ...curvePts(Xf, 0, v, 30, CH, ym), [X(v), Y(0)]], BLU, .5 * o * ks);
      ln([[X(v), Y(xb)], [X(bb), Y(xb)]], WHT, 5, o * ks);
      rect(X(v), Y(xb), X(bb) - X(v), Y(0) - Y(xb), WHT, .18 * o * ks, WHT, 5);
      const sl = win(t, at('b08', .35), E('b08') + 1, .4, .4) * o;
      poly([[X(v), Y(xb)], [X(bb), Y(xb)], ...curvePts(Xf, bb, v, 30, CH, ym)], WHT, .95 * sl);
      lab('over', 'overpaid', [X(.74), Y(xb) - 60], sl);
    }
  }
  // utility for every bid: peaks at the truth
  if (uphase > 0) {
    const ymu = .08, uf = prog(t, at('b09', .35), 1.4);
    const pts = []; for (let k = 0; k <= 60; k++) { const z = k / 60; if (z > uf + .0001) break; pts.push([X(z), my(UTIL(V, z), CH, ymu)]); }
    ln(pts, BLU, 9, o * uphase);
    const pk = prog(t, at('b09', .7), .5) * o;
    ln([[X(0), my(UTIL(V, V), CH, ymu)], [X(1), my(UTIL(V, V), CH, ymu)]], GRY, 3, pk * .8, [10, 8]);
    ln([[X(V), my(UTIL(V, V), CH, ymu)], [X(V), Y(0)]], GRY, 4, pk, [12, 10]);
    disc(X(V), my(UTIL(V, V), CH, ymu), 16, WHT, pk);
    lab('best', 'best bid = 0.5', [X(V) - 40, my(UTIL(V, V), CH, ymu) - 70], pk, { al: 'r' });
  }
}

// ---------- scene C: virtual value
const VL = { x: 360, y: 340, w: 1200, h: 500 };
function sceneC(t) {
  const o = win(t, S('c01') - .1, S('d01') - .1, .5, .5); if (o <= 0) return;
  const lineY = 620, X = v => mx(v, VL);
  const chartK = prog(t, at('c03', .1), .8) * (1 - prog(t, S('c05') - .2, .5));
  const lineK = o * (1 - chartK) * (1 - prog(t, S('c05') - .2, .4));
  // value line with the four bidders
  ln([[VL.x, lineY], [VL.x + VL.w, lineY]], GRY, 4, lineK);
  lab('c0', '0', [VL.x, lineY + 60], lineK); lab('c1', '1', [VL.x + VL.w, lineY + 60], lineK); lab('cvn', 'value v', [960, lineY + 130], lineK);
  BIDS.forEach((v, i) => { disc(X(v), lineY, 20, BLU, lineK * prog(t, S('c01') + .3 + i * .2, .4)); lab('cq' + i, '?', [X(v), lineY - 70], lineK * win(t, S('c01') + .5 + i * .2, at('c02', .1), .3, .4)); });
  const uk = win(t, at('c02', .02), at('c03', .4), .4, .5) * lineK;
  for (let k = 0; k < 40; k++) disc(X((k + .5) / 40), lineY, 8, WHT, uk * .75);
  lab('cu', 'bidders spread evenly', [960, 330], uk);
  const hv = .55, hk = prog(t, at('c02', .3), .6) * uk;
  rect(X(hv), lineY - 90, X(1) - X(hv), 70, BLU, .35 * hk, null);
  lab('c1F', '1 − F', [X((hv + 1) / 2), lineY - 130], hk * prog(t, at('c02', .38), .4));
  rect(X(hv) - 7, lineY - 48, 14, 96, WHT, hk * prog(t, at('c02', .6), .4), null);
  lab('cf', 'f', [X(hv), lineY + 90], hk * prog(t, at('c02', .62), .4));
  // the chart of phi = 2v - 1
  if (chartK > 0) {
    const ym0 = -1, ym1 = 1, Y = v => VL.y + VL.h * (1 - (v - ym0) / (ym1 - ym0));
    ln([[VL.x, Y(0)], [VL.x + VL.w + 20, Y(0)]], GRY, 4, o * chartK);
    ln([[VL.x, VL.y + 10], [VL.x, VL.y + VL.h]], GRY, 4, o * chartK);
    lab('cp0', '0', [VL.x - 40, Y(0)], o * chartK); lab('cp1', '1', [VL.x + VL.w, Y(0) + 60], o * chartK); lab('cpn', 'value v', [960, VL.y + VL.h + 80], o * chartK);
    lab('cpy', 'virtual value φ', [330, 300], o * chartK, { al: 'l' });
    const lf = prog(t, at('c03', .45), 1.0);
    ln([[X(0), Y(-1)], [X(lf), Y(2 * lf - 1)]], BLU, 9, o * chartK);
    const zk = prog(t, S('c04'), .5) * o * chartK;
    disc(X(.5), Y(0), 16, WHT, zk); lab('chalf', 'one half', [X(.5) - 40, Y(0) - 70], zk * win(t, S('c04'), at('c04', .55), .3, .3));
    BIDS.forEach((v, i) => {
      const k = prog(t, at('c04', .3) + i * .12, .4) * o * chartK, neg = PHI[i] < 0;
      ln([[X(v), Y(0)], [X(v), Y(PHI[i])]], WHT, 3, k * .7, [10, 8]);
      disc(X(v), Y(PHI[i]), 18, BLU, k * (neg ? .45 : 1));
      if (neg) { ring(X(v), Y(PHI[i]), 28, WHT, 5, k); lab('cdrop', 'dropped', [X(v), Y(PHI[i]) + 70], k * win(t, at('c04', .55), S('c05') - .3, .4, .4)); }
    });
    lab('creg', 'only rises', [X(.8), Y(.1)], o * chartK * win(t, at('c04', .78), S('c05') - .3, .4, .4));
  }
  // c05: payment equals virtual value times X on average, c06: negative fit is not worth buying
  const bk = win(t, at('c05', .05), S('c06') + .1, .5, .5) * o;
  if (bk > 0) {
    const sc = 7600;
    rect(700, 420, DATA.EP * sc, 90, BLU, .9 * prog(t, at('c05', .12), .8) * bk, WHT, 6);
    rect(700, 600, DATA.EP * sc, 90, BLU, .9 * prog(t, at('c05', .3), .8) * bk, WHT, 6);
    lab('e1', 'average payment', [660, 465], bk * prog(t, at('c05', .1), .4), { al: 'r' });
    lab('e2', 'average φ X', [660, 645], bk * prog(t, at('c05', .28), .4), { al: 'r' });
    lab('e1v', fmt(DATA.EP, 4), [700 + DATA.EP * sc + 40, 465], bk * prog(t, at('c05', .5), .4), { al: 'l' });
    lab('e2v', fmt(DATA.EP, 4), [700 + DATA.EP * sc + 40, 645], bk * prog(t, at('c05', .65), .4), { al: 'l' });
  }
  const nk = win(t, at('c06', .02), E('c06') + 1, .5, .5) * o;
  if (nk > 0) {
    const [r0, r1] = DATA.toy, sc = 5600;
    rect(700, 420, r0 * sc, 90, BLU, .35 * prog(t, at('c06', .08), .8) * nk, WHT, 6);
    rect(700, 600, r1 * sc, 90, BLU, .9 * prog(t, at('c06', .3), .8) * nk, WHT, 6);
    lab('n1', 'paying for negative fit', [660, 465], nk * prog(t, at('c06', .06), .4), { al: 'r' });
    lab('n2', 'show nothing instead', [660, 645], nk * prog(t, at('c06', .28), .4), { al: 'r' });
    lab('n1v', fmt(r0, 3), [700 + r0 * sc + 40, 465], nk * prog(t, at('c06', .4), .4), { al: 'l' });
    lab('n2v', fmt(r1, 3), [700 + r1 * sc + 40, 645], nk * prog(t, at('c06', .6), .4), { al: 'l' });
  }
}

// ---------- shared: partial polyline (fraction k of its length)
function partial(pts, k) {
  if (k >= 1 || pts.length < 2) return pts; if (k <= 0) return [];
  const L = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d; }
  let need = tot * k; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (need >= L[i - 1]) { out.push(pts[i]); need -= L[i - 1]; }
    else { const f = need / L[i - 1]; out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; }
  }
  return out;
}
function bar(key, label, val, sc, x0, y, op, col = BLU, fmtN = 3) {
  rect(x0, y - 36, val * sc, 72, col, .9 * op, WHT, 6);
  lab(key + 'l', label, [x0 - 30, y], op, { al: 'r' }); lab(key + 'v', fmt(val, fmtN), [x0 + val * sc + 30, y], op, { al: 'l' });
}

// ---------- scene D: push by virtual value (a projected 3D view of the ads)
const ADS = DATA.ads, C3 = { x: 960, y: 530, k: 330 };
const PX = (p, az) => {
  const c = Math.cos(az), s = Math.sin(az), x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c, y = p[1];
  const ce = Math.cos(.4), se = Math.sin(.4), y2 = y * ce - z * se, z2 = y * se + z * ce, f = 1 / (1 - .1 * z2);
  return [C3.x + C3.k * x * f, C3.y - C3.k * y2 * f];
};
const RINGS3 = [0, 1, 2].map(ax => { const o = []; for (let k = 0; k <= 48; k++) { const a = 2 * Math.PI * k / 48, c = Math.cos(a), s = Math.sin(a); o.push(ax === 0 ? [c, s, 0] : ax === 1 ? [0, c, s] : [c, 0, s]); } return o; });
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function dstate(t) {
  const grow = i => prog(t, S('d02') + .1 + i * .18, .8);
  const k = prog(t, at('d03', .12), 3.4);
  const ads = BIDS.map((v, i) => {
    const val = lerp(v, PHI[i], k) * grow(i), vis = PHI[i] < 0 ? 1 - clamp((k - .62) / .25) : 1;
    return { i, val, vis, g: grow(i), p: ADS[i].map(c => c * val) };
  });
  const set = [{ p: [0, 0, 0], o: -1 }, ...ads.filter(a => a.g > .99 && a.vis > .5).map(a => ({ p: a.p, o: a.i }))];
  let best = 0, pa = set[0], pb = set[0];
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) { const d = dist3(set[i].p, set[j].p); if (d > best) { best = d; pa = set[i]; pb = set[j]; } }
  return { ads, k, best, pa, pb };
}
window.__chk = window.__chk || {};
{ // D of the pushed market against the check script: by value at k=0, by virtual value after the drop
  const pts = (f) => [[0, 0, 0], ...BIDS.map((v, i) => ADS[i].map(c => c * f(i))).filter((p, i) => f(i) !== null)];
  const dm = a => { let m = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) m = Math.max(m, dist3(a[i], a[j])); return m; };
  window.__chk.Dbids = dm(pts(i => BIDS[i])); window.__chk.Dphi = dm([[0, 0, 0], ...BIDS.map((v, i) => ADS[i].map(c => c * Math.max(PHI[i], 0)))]);
  window.__chk.Dok = Math.abs(window.__chk.Dbids - DATA.D_bids) < 1e-3 && Math.abs(window.__chk.Dphi - DATA.D_phi) < 1e-3;
}
function sceneD(t) {
  // d01: the three steps of Lemma 4
  const sk = win(t, S('d01') + .1, S('d02') - .2, .4, .4);
  if (sk > 0) {
    [['1', 'drop negative virtual value'], ['2', 'push by virtual value'], ['3', 'run the same chat rule']].forEach(([n, s], i) => {
      const k = sk * prog(t, at('d01', .12 + i * .27), .5), y = 400 + i * 140;
      disc(560, y, 36, BLU, k); lab('ds' + i + 'n', n, [560, y], k, { color: '#000' }); lab('ds' + i, s, [630, y], k, { al: 'l' });
    });
  }
  // d02 to d04: the market in 3D
  const o = win(t, S('d02') - .1, S('d05') + .1, .4, .5);
  if (o > 0) {
    const az = -.6 + .07 * Math.max(0, t - S('d02')), st = dstate(t), P = p => PX(p, az);
    RINGS3.forEach(r => ln(r.map(P), GRY, 3, .22 * o));
    const O = P([0, 0, 0]);
    disc(O[0], O[1], 14, WHT, o); const LB = [{ key: 'dno', s: 'no ad', x: O[0], y: O[1] + 64, al: '', op: o * win(t, S('d02') + .6, S('d03') + .5, .4, .4) }];
    st.ads.forEach(a => {
      const q = P(a.p), op = o * a.vis * clamp(a.g * 2);
      if (op <= .004) return;
      const neg = a.val < 0;
      ln([O, q], BLU, 4, op * .6);
      if (st.k > .02) { const g0 = P(ADS[a.i].map(c => c * BIDS[a.i])); ring(g0[0], g0[1], 16, GRY, 4, op * .35 * (neg ? 0 : 1)); }
      disc(q[0], q[1], 20, BLU, op * (neg ? .5 : 1));
      if (neg) ring(q[0], q[1], 30, WHT, 5, op);
      const dx = q[0] - 960, dy = q[1] - 530, dl = Math.hypot(dx, dy) || 1;
      LB.push({ key: 'dn' + a.i, s: neg && st.k > .3 ? 'dropped' : NAMES[a.i], x: q[0] + dx / dl * 36, y: q[1] + dy / dl * 36 + (dy / dl > .5 ? 30 : 0), al: dx > 0 ? 'l' : 'r', op: op * win(t, S('d02') + .5 + a.i * .15, 1e9, .4, .4) });
    });
    // keep labels apart: a later label that would overlap an earlier one moves down
    const span = L => { const w = textW(L.s, 56); return L.al === 'l' ? [L.x, L.x + w] : L.al === 'r' ? [L.x - w, L.x] : [L.x - w / 2, L.x + w / 2]; };
    LB.sort((a, b) => a.y - b.y).forEach((L, i) => { for (let j = 0; j < i; j++) { const A = span(LB[j]), B = span(L); if (Math.abs(L.y - LB[j].y) < 64 && A[0] < B[1] && B[0] < A[1]) L.y = LB[j].y + 64; } lab(L.key, L.s, [L.x, L.y], L.op, { al: L.al }); });
    if (st.pa !== st.pb) {
      const A = P(st.pa.p), B = P(st.pb.p);
      const gk = o * prog(t, at('d02', .42), .5);
      ln([A, B], WHT, 8, gk); ring(A[0], A[1], 28, WHT, 5, gk); ring(B[0], B[1], 28, WHT, 5, gk);
      lab('dgap', 'widest gap ' + fmt(st.best), [960, 930], gk);
    }
    lab('dwas', 'was ' + fmt(DATA.D_bids), [960, 995], o * win(t, at('d04', .1), S('d05'), .4, .3), { color: GRY });
  }
  // d05: the curves X, pushed by value and by virtual value
  const c = win(t, S('d05') - .05, S('e01') - .1, .45, .35);
  if (c > 0) {
    const ym = .4, xo = prog(t, S('d05') + .1, .5), Y = v => my(v, CH, ym), X = v => mx(v);
    axes(CH, c, xo, xo);
    lab('dx0', '0', [CH.x, 905], c * xo); lab('dx1', '1', [CH.x + CH.w, 905], c * xo); lab('dxn', 'bid', [960, 975], c * xo);
    lab('dyn', 'fit X of the cottage', [330, 300], c * xo, { al: 'l' });
    const k1 = prog(t, at('d05', .1), 1.3), k2 = prog(t, at('d05', .3), 1.6);
    if (k1 > 0) ln(curvePts(Xf, 0, Math.max(.001, k1), Math.round(60 * k1) + 2, CH, ym), WHT, 7, c * .85);
    const Xp = z => interp(XP, z);
    if (k2 > 0) ln(curvePts(Xp, 0, Math.max(.001, k2), Math.round(60 * k2) + 2, CH, ym), BLU, 10, c);
    lab('dl1', 'pushed by value', [X(.03), Y(.34)], c * prog(t, at('d05', .2), .5), { al: 'l' });
    lab('dl2', 'pushed by virtual value', [X(1), Y(.4) - 55], c * prog(t, at('d05', .45), .5), { al: 'r', color: BLU });
    lab('dfl', 'flat until one half', [X(.25), Y(0) - 60], c * prog(t, at('d05', .55), .5), { color: BLU });
    ln([[X(.5), Y(0) + 4], [X(.5), Y(.14)]], GRY, 4, c * prog(t, at('d05', .55), .5), [12, 10]);
  }
}

// ---------- scene E: replaying the chat gives a staircase
const ST = DATA.steps, CE = { x: 360, y: 500, w: 1200, h: 360 }, YE = .6, TOPZ = BIDS[0];
const ex = z => CE.x + z * CE.w, ey = v => CE.y + CE.h - v / YE * CE.h;
const stepAt = z => ST.find(s => z >= s.z0 && z < s.z1) || ST[ST.length - 1];
function stairPts(zmin) {
  const pts = [];
  for (let j = ST.length - 1; j >= 0; j--) { const s = ST[j]; if (s.z1 <= zmin) break; pts.push([ex(s.z1), ey(s.x)]); pts.push([ex(Math.max(s.z0, zmin)), ey(s.x)]); }
  return pts;
}
function zmE(t) {
  if (t < at('e03', .2)) return TOPZ;
  if (t < E('e03')) return lerp(TOPZ, .575, prog(t, at('e03', .2), D('e03') * .8));
  if (t < at('e04', .35)) return lerp(.575, .549, prog(t, E('e03'), D('e04') * .35));
  return lerp(.549, 0, prog(t, at('e04', .35), D('e04') * .6));
}
const emx = i => CE.x + i * CE.w / 7, EY = 320;
function sceneE(t) {
  const o = win(t, S('e01') - .1, S('f01') - .1, .4, .4); if (o <= 0) return;
  const c8 = 1 - prog(t, S('e08') - .1, .5), oc = o * c8, ax = prog(t, S('e01') + .1, .5);
  axes(CE, oc, ax, ax);
  lab('ex0', '0', [CE.x, 915], oc * ax); lab('ex1', '1', [CE.x + CE.w, 915], oc * ax);
  lab('eyn', 'fit gained', [380, 455], oc * ax, { al: 'l' });
  // e01: the whole curve is out of reach, there is one chat
  const gk = oc * prog(t, at('e01', .3), .6) * (1 - prog(t, at('e02', .3), .4));
  if (gk > 0) { ln(curvePts(Xf, 0, 1, 60, CE, YE), GRY, 6, gk, [14, 12]); lab('eq', 'the whole curve X?', [ex(.34), ey(.3)], gk); }
  const pk = oc * prog(t, at('e01', .6), .4) * (1 - prog(t, at('e03', .3), .4));
  disc(ex(TOPZ), ey(ST[6].x), 20, BLU, pk); lab('e1c', 'one chat', [ex(TOPZ) - 40, ey(ST[6].x)], pk, { al: 'r' });
  // e02 to e04: the replay timeline and the sliding push
  const tl = oc * win(t, S('e02') + .05, E('e04') + .6, .4, .5);
  const zm = zmE(t), sA = stepAt(Math.min(zm, TOPZ - .001)), stop = Math.min(sA.tau, 8) - 1, shown = sA.x > 0;
  const mk = tl * prog(t, at('e02', .72), .4);
  if (tl > 0) {
    for (let i = 0; i < 8; i++) {
      const k = tl * prog(t, S('e02') + .1 + i * .06, .4), gone = i >= 6, isStop = mk > 0 && i === stop;
      ring(emx(i), EY, 40, WHT, 6, k * (gone ? .4 : 1), false);
      if (isStop) disc(emx(i), EY, 36, BLU, mk * (shown ? 1 : .35));
      lab('em' + i, String(i + 1), [emx(i), EY], k * (gone ? .5 : 1), { color: isStop && shown ? '#000' : WHT });
    }
    const sx = (emx(5) + emx(6)) / 2, sk = tl * prog(t, at('e02', .62), .4);
    ln([[sx, EY - 60], [sx, EY + 60]], YEL, 6, sk);
    lab('esl', 'Sam leaves', [sx, EY - 100], sk, { color: YEL });
    lab('erp', 'same chat, replayed', [960, EY - 100], tl * win(t, S('e02') + .1, at('e02', .5), .4, .3));
    lab('efl', shown ? 'fit ' + fmt(sA.x) : 'no fit', [emx(stop), EY + 76], mk);
    lab('ebz', 'bid ' + fmt(Math.max(zm, 0)), [ex(Math.max(zm, 0)), 975], mk);
    disc(ex(Math.max(zm, 0)), CE.y + CE.h, 18, BLU, mk);
  }
  // the staircase, revealed from the right as the push slides down
  const sk2 = oc * (t >= at('e03', .15) ? 1 : 0);
  const sp = stairPts(Math.max(zm, 0));
  if (sk2 > 0 && sp.length > 1) ln(sp, BLU, 10, sk2);
  // e05: five slabs, a short sum
  const sl = oc * win(t, at('e05', .1), S('e06') + .2, .4, .4);
  if (sl > 0) ST.forEach((s, j) => { if (s.x > 0) rect(ex(s.z0), ey(s.x), ex(s.z1) - ex(s.z0), ey(0) - ey(s.x), BLU, (.4 + .25 * (j % 2)) * sl * prog(t, at('e05', .1 + .1 * (6 - j)), .4), null); });
  lab('e5a', '5 steps', [ex(.28), ey(.32)], sl * prog(t, at('e05', .25), .4));
  // e06: the rectangle, the area under the staircase, and what is left is the price
  const rk = oc * win(t, at('e06', .1), S('e07') - .1, .4, .4);
  if (rk > 0) {
    const top = ey(ST[6].x), pts = [[ex(0), top], ...stairPts(0)];
    poly(pts, WHT, .34 * rk * prog(t, at('e06', .5), .6), null);
    ln([[ex(0), top], [ex(TOPZ), top], [ex(TOPZ), ey(0)]], WHT, 6, rk);
    lab('epr', 'price', [ex(.28), ey(.44)], rk * prog(t, at('e06', .55), .5));
    lab('eab', 'area', [ex(.82), ey(.17)], rk * prog(t, at('e06', .3), .5));
    lab('ev9', fmt(TOPZ, 1), [ex(TOPZ), 915], rk * prog(t, at('e06', .1), .4));
    lab('evf', fmt(ST[6].x), [CE.x - 20, top], rk * prog(t, at('e06', .2), .4), { al: 'r' });
  }
  // e07: the same region in horizontal slices, one per step
  const ik = oc * win(t, S('e07') - .1, S('e08') - .1, .4, .4);
  if (ik > 0) {
    const nz = ST.filter(s => s.x > 0);
    nz.forEach((s, j) => {
      const prev = j === 0 ? 0 : nz[j - 1].x, k = prog(t, at('e07', .1 + j * .12), .5);
      rect(ex(0), ey(s.x), ex(s.z0) - ex(0), ey(prev) - ey(s.x), WHT, (j % 2 ? .45 : .7) * ik * k, BLU, 3);
    });
    rect(ex(0), ey(ST[6].x), ex(TOPZ) - ex(0), ey(0) - ey(ST[6].x), null, 0, WHT, 6);
    lab('ejp', 'jump × push', [ex(.28), ey(.15)], ik * prog(t, at('e07', .2), .4), { color: '#000' });
  }
  // e08: the average over all chats
  const bk = o * win(t, S('e08') + .1, S('f01') - .2, .4, .4);
  if (bk > 0) {
    const sc = 2800;
    bar('ea', 'average charge', DATA.Pphi_at, sc, 760, 430, bk * prog(t, at('e08', .12), .5), BLU, 2);
    bar('eb', 'earlier formula', DATA.Pphi_at, sc, 760, 580, bk * prog(t, at('e08', .3), .5), BLU, 2);
    lab('enz', 'never below zero', [960, 760], bk * prog(t, at('e08', .6), .5));
  }
}

// ---------- scene F: Theorem 2, pulls against the bar, supermartingale, nesting, the bound
const CF = { x: 360, y: 340, w: 1100, h: 500 }, YF = .5, BAR = DATA.bar, SMP = DATA.sm_paths, SMM = DATA.sm_mean;
const fx = i => CF.x + i * CF.w / 7, fy = v => CF.y + CF.h - v / YF * CF.h;
const PULL = z => DATA.pulls.find(q => Math.abs(q.z - z) < 1e-6).own;
const ser = vals => vals.map((v, i) => [fx(i), fy(v)]);
const crossAt = vals => vals.findIndex((v, i) => v >= BAR[i]);
function sceneF(t) {
  const o = win(t, S('f01') - .1, S('g01') - .1, .4, .4); if (o <= 0) return;
  // f01: X must rise with the bid
  const a = o * win(t, S('f01') - .1, S('f02') - .1, .4, .4);
  if (a > 0) {
    const ym = .4, X = v => mx(v), Y = v => my(v, CH, ym), xo = prog(t, S('f01') + .05, .5);
    axes(CH, a, xo, xo);
    lab('fx0', '0', [CH.x, 905], a * xo); lab('fx1', '1', [CH.x + CH.w, 905], a * xo); lab('fxn', 'bid', [960, 975], a * xo);
    lab('fyn', 'fit X', [330, 300], a * xo, { al: 'l' });
    const k = prog(t, at('f01', .25), 3.2);
    ln(curvePts(Xf, 0, Math.max(.001, k), Math.round(60 * k) + 2, CH, ym), BLU, 10, a);
    const zz = .12 + .78 * k, px = X(zz), py = Y(Xf(zz));
    ln([[px, Y(0)], [px, py]], GRY, 4, a * .7, [10, 8]); disc(px, Y(0), 16, BLU, a); disc(px, py, 16, WHT, a);
    lab('frs', 'bigger bid, more fit?', [X(.34), Y(.3)], a * prog(t, at('f01', .55), .5));
  }
  // f02 to f04: pull against the bar, message by message
  const b = o * win(t, S('f02') - .1, S('f05') - .1, .4, .4);
  if (b > 0) {
    const xo = prog(t, S('f02') + .05, .5), pw = b;
    axes(CF, pw, xo, xo);
    for (let i = 0; i < 8; i++) lab('ft' + i, String(i + 1), [fx(i), 905], pw * xo);
    lab('ftn', 'message', [CF.x + CF.w / 2, 975], pw * xo);
    lab('fpy', 'pull', [330, 300], pw * xo, { al: 'l' });
    const kb = prog(t, at('f02', .12), 1.6);
    ln(partial(ser(BAR), kb), WHT, 8, pw, [20, 14]);
    lab('fbar', 'bar', [fx(0) + 90, fy(BAR[0]) - 30], pw * prog(t, at('f02', .12), .5));
    const p6 = PULL(.6), p9 = PULL(.9), kp = prog(t, at('f02', .45), 2.2), kq = prog(t, at('f03', .08), 2.0);
    ln(partial(ser(p6), kp), BLU, 9, pw * (t > at('f03', .3) ? .55 : 1));
    lab('fp6', 'push 0.6', [fx(7) + 40, fy(p6[7])], pw * prog(t, at('f02', .75), .5), { al: 'l', color: BLU });
    const c6 = crossAt(p6), c9 = crossAt(p9);
    const m6 = pw * prog(t, at('f02', .88), .4);
    ring(fx(c6), fy(p6[c6]), 30, WHT, 6, m6);
    ln([[fx(c6), fy(p6[c6]) + 30], [fx(c6), CF.y + CF.h]], GRY, 4, m6 * .8, [10, 8]);
    ln(partial(ser(p9), kq), BLU, 12, pw);
    lab('fp9', 'push 0.9', [fx(7) + 40, fy(p9[7])], pw * prog(t, at('f03', .3), .5), { al: 'l', color: BLU });
    const m9 = pw * prog(t, at('f03', .62), .4);
    ring(fx(c9), fy(p9[c9]), 30, WHT, 6, m9);
    ln([[fx(c9), fy(p9[c9]) + 30], [fx(c9), CF.y + CF.h]], GRY, 4, m9 * .8, [10, 8]);
    lab('fst6', 'stop', [fx(c6), 975 + 0], 0);
    lab('fq', 'earlier is more fit?', [960, 128], pw * win(t, at('f04', .3), S('f05') - .15, .4, .3));
  }
  // f05 and f06: the discounted pull is a supermartingale
  const m = o * win(t, S('f05') - .1, S('f07') - .1, .45, .4);
  if (m > 0) {
    const xo = prog(t, S('f05') + .05, .5);
    axes(CF, m, xo, xo);
    for (let i = 0; i < 8; i++) lab('mt' + i, String(i + 1), [fx(i), 905], m * xo);
    lab('mtn', 'message', [CF.x + CF.w / 2, 975], m * xo);
    lab('myn', 'discounted pull', [330, 300], m * xo, { al: 'l' });
    SMP.forEach((p, k) => ln(partial(ser(p), prog(t, at('f05', .1) + (k % 6) * .06, 1.6)), WHT, 3, m * .2));
    ln(partial(ser(SMM), prog(t, at('f05', .35), 2.4)), BLU, 12, m);
    lab('mone', 'one chat', [fx(1) + 60, fy(SMP[3][1]) - 60], m * prog(t, at('f05', .3), .5), { color: GRY });
    lab('mav', 'average', [fx(5), fy(SMM[5]) - 70], m * prog(t, at('f05', .55), .5), { color: BLU });
    const e1 = 1, e2 = 3, k6 = m * prog(t, at('f06', .25), .5);
    [e1, e2].forEach((e, j) => {
      ln([[fx(e), fy(SMM[e]) + 24], [fx(e), CF.y + CF.h]], GRY, 4, k6 * prog(t, at('f06', .25 + j * .2), .4) * .8, [10, 8]);
      disc(fx(e), fy(SMM[e]), 20, WHT, k6 * prog(t, at('f06', .25 + j * .2), .4));
    });
    lab('mst1', 'stop early', [fx(e1) - 20, fy(SMM[e1]) - 70], k6 * prog(t, at('f06', .3), .4), { al: 'r' });
    lab('mst2', 'stop late', [fx(e2) + 40, fy(SMM[e2]) - 70], k6 * prog(t, at('f06', .5), .4), { al: 'l' });
  }
  // f07: nested sets
  const n = o * win(t, S('f07') - .1, S('f08') - .1, .45, .4);
  if (n > 0) {
    const cx = 960, cy = 600, k1 = prog(t, at('f07', .1), .6), k2 = prog(t, at('f07', .3), .6);
    ring(cx, cy, 300, WHT, 8, n * k1); ring(cx, cy, 190, BLU, 8, n * k2); ring(cx, cy, 190, BLU, 0, n * k2 * .3, true);
    lab('nbg', 'big push', [cx, cy - 245], n * prog(t, at('f07', .2), .5));
    lab('nsm', 'small push', [cx, cy], n * prog(t, at('f07', .4), .5));
    lab('nwn', 'chats where the cottage wins', [cx, 940], n * prog(t, at('f07', .55), .5));
  }
  // f09: the bound against the worst loss over 300 markets
  const q = o * win(t, S('f09') - .05, S('g01') - .2, .4, .4);
  if (q > 0) {
    const sc = 3600, T2 = DATA.thm2;
    lab('f9t', 'over 300 random markets', [960, 330], q * prog(t, S('f09') + .1, .5));
    bar('f9a', 'worst loss', T2.max_loss, sc, 700, 480, q * prog(t, at('f09', .25), .5), BLU, 2);
    bar('f9b', 'average bound', T2.mean_bound, sc, 700, 640, q * prog(t, at('f09', .55), .5), WHT, 2);
  }
}

// ---------- scene G: Section 6 and the appendix extensions
const GC = [960, 470];
const CG = { x: 360, y: 340, w: 1200, h: 460 };
const gx = i => CG.x + i * CG.w / 7, gy = v => CG.y + CG.h - v / .55 * CG.h;
const gx2 = i => CG.x + i * CG.w / 8, gy2 = v => CG.y + CG.h - v * CG.h;
function sceneG(t) {
  const o = win(t, S('g01') - .1, S('h01') - .1, .4, .4); if (o <= 0) return;
  // g01 and g02: nested versus wandering balls
  const a = o * win(t, S('g01') - .1, S('g03') - .1, .4, .4);
  if (a > 0) {
    const R = [220, 132, 79], SH = [[0, 0], [120, -70], [200, -150]], w = prog(t, at('g02', .12), 2.5);
    R.forEach((r, i) => {
      const k = prog(t, S('g01') + .1 + i * .25, .5), cx = GC[0] + SH[i][0] * w, cy = GC[1] + SH[i][1] * w;
      ring(cx, cy, r, WHT, 6, a * k * (i ? .85 : 1)); disc(cx, cy, 12, BLU, a * k);
    });
    lab('gl1', 'nested balls, fair guess', [960, 790], a * prog(t, at('g01', .3), .5) * (1 - prog(t, at('g02', .1), .4)));
    lab('gl2', 'the guess wanders out', [960, 790], a * prog(t, at('g02', .3), .5) * (1 - prog(t, at('g03', .0) - .3, .3)));
    const bk = a * prog(t, at('g02', .55), .5);
    if (bk > 0) {
      lab('gb0', 'cost per unit of spread and radius', [960, 770], 0);
    }
  }
  const b = o * win(t, at('g02', .5), S('g03') - .1, .4, .4);
  if (b > 0) {
    const sc = 1000;
    bar('gba', 'nested', DATA.fac, sc, 760, 880, b * prog(t, at('g02', .6), .5), BLU, 2);
    bar('gbb', 'wandering', DATA.fac_weak, sc, 760, 960, b * prog(t, at('g02', .78), .5), WHT, 2);
  }
  // g03: any shrinking pattern
  const c = o * win(t, S('g03') - .1, S('g04') - .1, .4, .4);
  if (c > 0) {
    const xo = prog(t, S('g03') + .1, .5), RB = DATA.b3.radii, path = [[gx(0), gy(RB[0])]];
    for (let i = 1; i < 8; i++) { path.push([gx(i), gy(RB[i - 1])]); path.push([gx(i), gy(RB[i])]); }
    axes(CG, c, xo, xo);
    for (let i = 0; i < 8; i++) lab('gt' + i, String(i + 1), [gx(i), 860], c * xo);
    lab('gtn', 'round', [960, 940], c * xo);
    lab('gyn', 'radius', [330, 300], c * xo, { al: 'l' });
    const kk = prog(t, at('g03', .12), 3.0);
    ln(partial(path, kk), WHT, 8, c);
    const dk = c * prog(t, at('g03', .35), .5);
    for (let i = 1; i < 8; i++) if (RB[i] < RB[i - 1]) ln([[gx(i), gy(RB[i - 1])], [gx(i), gy(RB[i])]], BLU, 12, dk);
    lab('gp1', 'pause', [gx(1.5), gy(RB[0]) - 60], c * prog(t, at('g03', .45), .5));
    lab('gp2', 'pause', [gx(4), gy(RB[3]) - 60], c * prog(t, at('g03', .5), .5));
    const st = DATA.rad.slice(0, 8).map((r, i) => [gx(i), gy(r)]);
    ln(st, GRY, 6, c * prog(t, at('g03', .72), .5), [16, 12]);
    lab('gst', 'steady shrinking', [gx(5.8), gy(.34)], c * prog(t, at('g03', .78), .5), { color: GRY });
  }
  // g04: the chance of leaving climbs
  const d = o * win(t, S('g04') - .1, at('g04', .86), .4, .4);
  if (d > 0) {
    const xo = prog(t, S('g04') + .1, .5), SV = DATA.b4.surv, pts = SV.map((v, i) => [gx2(i), gy2(v)]);
    axes(CG, d, xo, xo);
    for (let i = 0; i < 9; i++) lab('hg' + i, String(i), [gx2(i), 860], d * xo);
    lab('hgn', 'message', [960, 940], d * xo);
    lab('hyn', 'chance Sam is still there', [330, 300], d * xo, { al: 'l' });
    ln(partial(pts, prog(t, at('g04', .15), 3.0)), BLU, 10, d);
    lab('hpl', 'leave chance climbs from 0.1 to 0.45', [960, 1010], d * prog(t, at('g04', .2), .5), { color: BLU });
  }
  const e = o * win(t, at('g04', .8), S('h01') - .2, .4, .4);
  if (e > 0) {
    const sc = 2000;
    bar('g4a', 'loss', DATA.b4.loss, sc, 600, 480, e * prog(t, at('g04', .86), .5), BLU, 2);
    bar('g4b', 'bound', DATA.b4.bound, sc, 600, 640, e * prog(t, at('g04', .92), .5), WHT, 2);
  }
}

// ---------- scene H: what a platform gets, what is next, close
function rows(prefix, items, t, a, b, y0 = 360, dy = 130) {
  const w = win(t, a, b, .45, .4); if (w <= 0) return;
  items.forEach((s, i) => {
    const k = w * prog(t, a + .2 + i * Math.max(.6, (b - a - .6) / (items.length + 1) * .8), .5);
    disc(560, y0 + i * dy, 14, BLU, k); lab(prefix + i, s, [610, y0 + i * dy], k, { al: 'l' });
  });
}
function sceneH(t) {
  const o = win(t, S('h01') - .1, 1e9, .4, .3); if (o <= 0) return;
  lab('hq', 'So what does a platform get?', [960, 540], o * win(t, S('h01') - .1, S('h02') - .1, .4, .4), { size: 96 });
  rows('r1', ['advertisers bid', 'push ads by virtual value', 'chat until pull clears the bar', 'charge the area under the curve'], t, S('h02') + .1, S('h03') - .1);
  rows('r2', ['every step is computable', 'honest bids are best', 'revenue near the best possible'], t, S('h03') + .1, S('h04') - .1, 400, 150);
  rows('r3', ['advertiser budgets', 'real conversations', 'ads that change how Sam talks', 'bolder near a length or latency limit'], t, S('h04') + .1, S('h05') - .1);
  const w = win(t, S('h05') - .05, 1e9, .45, .3);
  ['a rule to run', 'bids to trust', 'a guarantee to state'].forEach((s, i) => lab('hz' + i, s, [960, 380 + i * 170], w * prog(t, at('h05', .2 + i * .22), .5), { size: 96 }));
}

// ---------- the frame
function draw(t) {
  used = new Set(); g.clearRect(0, 0, 1920, 1080);
  formula('top', TOP, t, 960, 128); formula('big', BIGF, t, 960, 480);
  sceneA(t); sceneB(t); sceneC(t); sceneD(t); sceneE(t); sceneF(t); sceneG(t); sceneH(t);
  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  const f = 1 - clamp((t - E('h05')) / 1.5); c2.style.opacity = f; OV.style.opacity = f;
}
window.seek = t => draw(t);
window.ready = true;
