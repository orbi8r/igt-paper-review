// Part 3: counting the mistakes (Lemma 1 with A.1, Lemma 2 with A.2, Algorithm 1). Canvas 2D plus a DOM overlay.
// The page is a pure function of time: window.seek(t). Numbers come from part3_data.json (check/check_part3.py).
const J = async f => (await fetch(f)).json();
const [TM, DT] = await Promise.all([J('timing3.json'), J('part3_data.json')]);
await document.fonts.load('700 52px "Noto Sans"');
const S = id => TM[id][0], D = id => TM[id][1], E = id => TM[id][0] + TM[id][1];
const at = (id, f) => S(id) + f * D(id);
window.TOTAL = TM._total;

const YEL = '#FFE600', BLU = '#3DA5FF', WHT = '#ffffff', GRY = '#d0d0d0', MID = '#9a9a9a';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = (t, a, d) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const win = (t, a, b = 1e9, fi = .35, fo = .35) => Math.min(clamp((t - a) / fi), 1 - clamp((t - b) / fo));
const trk = (t, v0, keys) => { let v = v0; for (const [tt, vv, d] of keys) v = lerp(v, vv, prog(t, tt, d || .8)); return v; };
const f2 = v => v.toFixed(2), f4 = v => v.toFixed(4);

const cv = document.getElementById('cv'), g = cv.getContext('2d');
const OV = document.getElementById('ov'); const pool = new Map(); let used = new Set();
function el(key, cls) { let e = pool.get(key); if (!e) { e = document.createElement('div'); e.className = cls; OV.appendChild(e); pool.set(key, e); e._h = null; } used.add(key); e.style.display = ''; return e; }
function html(e, h) { if (e._h !== h) { e.innerHTML = h; e._h = h; } }
// text label at (x, y), 56 px by default; align c (centered), l (x is the left edge), r (x is the right edge)
function lab(key, h, x, y, op, o = {}) {
  if (op <= .004) return; const e = el(key, 'lab'); html(e, h);
  e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = op; e.style.color = o.color || WHT; e.style.fontSize = (o.size || 56) + 'px';
  e.style.transform = o.al === 'l' ? 'translate(0,-50%)' : o.al === 'r' ? 'translate(-100%,-50%)' : 'translate(-50%,-50%)';
}
const ctx2 = document.createElement('canvas').getContext('2d');
const textW = (s, px) => { ctx2.font = `700 ${px}px "Noto Sans"`; return ctx2.measureText(s.replace(/<[^>]+>/g, '')).width; };
const sub = s => `<sub>${s}</sub>`, sup = s => `<span style="font-size:.6em;vertical-align:.55em">${s}</span>`;

// ---------- canvas primitives
function rect(x, y, w, h, fill, op = 1) { if (op <= .004 || h <= 0) return; g.globalAlpha = op; g.fillStyle = fill; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
function srect(x, y, w, h, color, lw, op = 1, dash = null) { if (op <= .004 || h <= 0) return; g.globalAlpha = op; g.strokeStyle = color; g.lineWidth = lw; g.setLineDash(dash || []); g.strokeRect(x, y, w, h); g.setLineDash([]); g.globalAlpha = 1; }
function ln(x1, y1, x2, y2, color, lw, op = 1, dash = null) { if (op <= .004) return; g.globalAlpha = op; g.strokeStyle = color; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
function disc(x, y, r, fill, op = 1) { if (op <= .004) return; g.globalAlpha = op; g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1; }
function ring(x, y, r, color, lw, op = 1, dash = null, fill = null) { if (op <= .004 || r <= 0) return; g.globalAlpha = op; g.setLineDash(dash || []); g.beginPath(); g.arc(x, y, r, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } g.strokeStyle = color; g.lineWidth = lw; g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
function arrow(x1, y1, x2, y2, color, lw, op = 1, hd = 22) {
  ln(x1, y1, x2, y2, color, lw, op); const a = Math.atan2(y2 - y1, x2 - x1); g.globalAlpha = op; g.fillStyle = color; g.beginPath();
  g.moveTo(x2, y2); g.lineTo(x2 - hd * Math.cos(a - .45), y2 - hd * Math.sin(a - .45)); g.lineTo(x2 - hd * Math.cos(a + .45), y2 - hd * Math.sin(a + .45)); g.fill(); g.globalAlpha = 1;
}
function dbl(x, ya, yb, color, lw, op) { if (Math.abs(yb - ya) < 4) return; const s = Math.sign(yb - ya); arrow(x, (ya + yb) / 2, x, ya, color, lw, op, 18); arrow(x, (ya + yb) / 2, x, yb, color, lw, op, 18); }

// ---------- formulas (token states: shared keys slide, new ones fade or fly in; captions under terms)
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
  const cur = states[j], prev = j > 0 ? states[j - 1] : { toks: [] }, size = cur.size || 72, k = prog(t, cur.t, .7);
  const lc = layout(cur.toks, size), lp = layout(prev.toks, prev.size || size);
  const pk = new Map(prev.toks.map(x => [x.k, x]));
  const draw = (id, h, x, y, op, sz) => { if (op <= .004) return; const e = el(name + id, 'tok'); html(e, h); e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.opacity = op; e.style.fontSize = sz + 'px'; e.style.color = WHT; };
  const cap = (id, h, x, y, op) => { if (op <= .004) return; const c = el(name + id + 'c', 'cap'); html(c, h); c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.opacity = op; };
  for (const x of cur.toks) {
    const tx = cx + lc[x.k].x, old = pk.get(x.k); let sx = tx, sy = cy, op = 1;
    if (old) sx = cx + lp[x.k].x; else if (x.from && k < 1) { sx = x.from[0]; sy = x.from[1]; op = clamp(k * 4); } else op = clamp((k - .75) / .25);
    const px = lerp(sx, tx, k), py = lerp(sy, cy, k);
    if (old && old.h !== x.h) { draw(x.k + 'o', old.h, px, py, 1 - k, size); draw(x.k, x.h, px, py, k, size); } else draw(x.k, x.h, px, py, op, size);
    if (x.cap) cap(x.k, x.cap, px, py + size * .62, old && old.cap ? 1 : k);
  }
  for (const x of prev.toks) if (!cur.toks.find(y => y.k === x.k)) {
    draw(x.k, x.h, cx + lp[x.k].x, cy, 1 - k, prev.size || size);
    if (x.cap) cap(x.k, x.cap, cx + lp[x.k].x, cy + size * .62, 1 - k);
  }
}
const T = (k, h, o = {}) => ({ k, h, ...o });

// ---------- data
const A = DT.A, B = DT.B, CS = DT.cases, ST = DT.stair, AL = DT.alg;
const ml = (a, b) => a + (b - a) / 2;

// ---------- value meter: columns h and C, the fence, the bar, a loss brace
const Y0 = 840, HX = 740, CXc = 1040, CW = 120, BX0 = 580, BX1 = 1340, LX = 1390, BRX = 1190;
let PPU = 880;
const yv = v => Y0 - PPU * v;
function meter(t, P) {
  const op = P.op; if (op <= .004) return;
  ln(530, Y0, 1400, Y0, GRY, 3, op);
  if (P.fence > .004) {
    const a = yv(P.U), b = yv(P.L), fo = P.fence * op;
    rect(BX0, a, BX1 - BX0, b - a, WHT, .14 * fo); ln(BX0, a, BX1, a, WHT, 4, fo); ln(BX0, b, BX1, b, WHT, 4, fo);
    lab('mU', P.fnum ? `ceiling U ${f2(P.U)}` : 'ceiling U', LX, a, fo, { al: 'l' }); lab('mL', P.fnum ? `floor L ${f2(P.L)}` : 'floor L', LX, b, fo, { al: 'l' });
  }
  if (P.gH > .004) {
    const hh = PPU * P.hv * P.gH; rect(HX - CW / 2, Y0 - hh, CW, hh, WHT, op);
    lab('mhv', `h ${f2(P.hv)}`, HX, Y0 - hh - 44, op * P.gH); lab('mht', 'show now', HX, Y0 + 56, op * P.gH);
  }
  if (P.gC > .004) {
    const ch = PPU * P.cv * P.gC; rect(CXc - CW / 2, Y0 - ch, CW, ch, WHT, .1 * op); srect(CXc - CW / 2, Y0 - ch, CW, ch, WHT, 6, op, [18, 12]);
    if (ch > 90) lab('mcq', '?', CXc, Y0 - ch / 2, op * P.gC, { size: 72 });
    lab('mcv', `C ${f2(P.cv)}`, CXc, Y0 - ch - 44, op * P.gC); lab('mct', 'waiting', CXc, Y0 + 56, op * P.gC);
  }
  if (P.best > .004) {
    const hi = P.hv > P.cv, x = hi ? HX : CXc, top = yv(Math.max(P.hv, P.cv));
    srect(x - CW / 2 - 12, top - 12, CW + 24, Y0 - top + 12, WHT, 8, P.best * op); lab('mbest', 'best', x, Y0 + 116, P.best * op);
  }
  if (P.bar != null && P.barOp > .004) {
    const y = yv(P.bar), bo = P.barOp * op; ln(BX0 - 20, y, BX1 + 10, y, WHT, 10, bo);
    lab('mbar', P.barNum ? `bar β ${f2(P.bar)}` : 'bar β', BX0 - 40, y, bo, { al: 'r' });
  }
  if (P.loss > .004) {
    const ya = yv(P.hv), yb = yv(P.cv), lo = P.loss * op;
    ln(HX + CW / 2, ya, BRX + 20, ya, GRY, 3, lo, [10, 8]); ln(CXc + CW / 2, yb, BRX + 20, yb, GRY, 3, lo, [10, 8]); dbl(BRX, ya, yb, WHT, 6, lo);
    const d = P.cv - P.hv; lab('mloss', `${d >= 0 ? 'C − h' : 'h − C'} = ${f2(Math.abs(d))}`, BRX + 40, (ya + yb) / 2, lo, { al: 'l' });
  }
  if (P.rows > .004) {
    const R = P.rowsData; lab('mrowt', 'worst loss, bar at', 1600, 370, P.rows * op); R.forEach((r, i) => lab('mrow' + i, r, 1600, 450 + i * 80, P.rows * op));
  }
}

function meterState(t) {
  const P = { op: 0, gH: 0, hv: .06, gC: 0, cv: .13, fence: 0, L: .15, U: .65, fnum: false, bar: null, barOp: 0, barNum: true, loss: 0, best: 0, rows: 0 };
  if (t < S('n09')) {
    const sB = at('n07', .3);
    P.op = win(t, S('n01') + .4, S('n09') - .2, .5, .5);
    P.hv = trk(t, A.h, [[sB, B.h, 1.2]]); P.cv = trk(t, A.C, [[sB, B.C, 1.2]]);
    P.gH = prog(t, at('n02', .45), 1); P.gC = prog(t, at('n03', .3), 1.2);
    const f1 = win(t, S('n01') + .6, S('n02') - .1, .6, .5);
    P.fence = f1; P.L = B.L; P.U = B.U;
    const sweep = .4 + .2 * Math.sin((t - S('n01')) * 1.7);
    const b2 = trk(t, A.beta, [[at('n05', .62), .03, .9], [sB, B.beta, 1.2]]);
    P.barOp = Math.max(f1, win(t, at('n05', .3), S('n09') - .3, .4, .4));
    P.bar = t < S('n02') ? sweep : b2; P.barNum = t >= S('n02');
    if (t < S('n02') + .4) { P.barNum = false; }
    P.best = win(t, at('n04', .35), at('n08', .3), .5, .5);
    P.loss = win(t, at('n06', .5), at('n08', .2), .5, .4);
  } else if (t >= S('n17') && t < S('n22')) {
    P.op = win(t, S('n17'), S('n22') - .1, .5, .5); P.gH = P.gC = 1; P.fnum = true;
    P.fence = prog(t, at('n17', .4), .8);
    P.hv = trk(t, B.h, [[at('n18', .15), .649, .9], [at('n18', .62), .15, .9], [at('n19', .12), .40, .9], [at('n20', .12), .399, .9]]);
    P.cv = trk(t, B.C, [[at('n18', .15), .15, .9], [at('n18', .62), .65, .9], [at('n20', .12), .15, .9]]);
    P.bar = trk(t, .65, [[at('n18', .62), .15, .9], [at('n19', .1), .40, .9]]); P.barOp = prog(t, at('n18', .1), .5);
    P.loss = win(t, at('n18', .3), at('n21', .2), .5, .4);
    P.rows = win(t, at('n21', .2), 1e9, .5, .5); P.rowsData = ['floor 0.50', 'middle 0.25', 'ceiling 0.50'];
    if (P.rows > .004) { P.fence = Math.min(P.fence, 1); }
  }
  return P;
}

// ---------- gap meter: best value, the rule's value, and the gap stacked on the rule column
function gapMeter(t) {
  const op = win(t, at('n09', .35), S('n13') - .1, .5, .5); if (op <= .004) return;
  const s1 = S('n10'), s2 = S('n11');
  const vb = trk(t, CS['1b'].Vstar, [[s2, CS['2b'].Vstar, 1.0]]);
  const vr = trk(t, CS['1b'].Vpi, [[s1, CS['2a'].Vpi, 1.0], [s2, CS['2b'].Vpi, 1.0]]);
  const fl = trk(t, CS['1b'].loss, [[s1, 0, .8], [s2, CS['2b'].loss, 1.0]]);
  const ou = trk(t, 0, [[s1, CS['2a'].carried, 1.0], [s2, CS['2b'].carried, 1.0]]);
  const gb = prog(t, at('n09', .4), .8), gs = prog(t, at('n09', .62), .7);
  ln(530, Y0, 1400, Y0, GRY, 3, op);
  const hb = PPU * vb * gb; rect(HX - CW / 2, Y0 - hb, CW, hb, WHT, op);
  const hr = PPU * vr * gb; rect(CXc - CW / 2, Y0 - hr, CW, hr, MID, op);
  const yTop = yv(vr), yF = yv(vr + fl), yO = yv(vr + fl + ou);
  rect(CXc - CW / 2, yF, CW, yTop - yF, WHT, op * gs);
  if (ou > .0005) { const hh = Math.max(4, yF - yO); srect(CXc - CW / 2, yF - hh, CW, hh, WHT, 6, op * gs, [14, 10]); }
  ln(HX + CW / 2, yv(vb), CXc + CW / 2 + 40, yv(vb), GRY, 3, op * gs, [10, 8]);
  lab('gb1', 'best', HX, Y0 + 56, op * gb); lab('gb2', f2(vb), HX, Y0 + 116, op * gb);
  lab('gr1', 'the rule', CXc, Y0 + 56, op * gb); lab('gr2', f2(vr), CXc, Y0 + 116, op * gb);
  const gx = HX - CW / 2 - 50; dbl(gx, yv(vb), yTop, WHT, 6, op * gs);
  lab('ggap', `gap Δ ${f4(vb - vr)}`, gx - 30, (yv(vb) + yTop) / 2, op * gs, { al: 'r' });
  if (fl > .0005) lab('gloss', `loss now ${f4(fl)}`, CXc + CW / 2 + 40, (yTop + yF) / 2 + (ou > .0005 ? 28 : 0), op * gs * clamp(fl * 40), { al: 'l' });
  if (ou > .0005) lab('gcar', `carried gap ${f4(ou)}`, CXc + CW / 2 + 40, yO - 52, op * gs * clamp(ou * 60), { al: 'l' });
}

// ---------- staircase of shrinking loss blocks (Lemma 1), and the same blocks under their allowances (Lemma 2)
const XS = [330, 700, 1070, 1440], SW = 150, SB = 800, PPS = 1800, STK = 1730;
const sy = v => SB - PPS * v;
function stairScene(t) {
  const op1 = win(t, S('n13'), S('n17') - .2, .5, .5), op2 = win(t, S('n22'), S('n24') - .2, .5, .5);
  const sl = ST.slices, rem = ST.rem, gap = ST.gap;
  if (op1 > .004) {
    const op = op1; ln(250, SB, 1850, SB, GRY, 3, op);
    const cut = [0, .45, .65, .8].map(f => prog(t, at('n13', f) + .1, .7));
    let stackTop = SB;
    for (let k = 0; k < 4; k++) {
      const c = cut[k]; if (c <= .004) continue;
      const fly = prog(t, at('n14', .25 + .12 * k), .9), h = Math.max(3, PPS * sl[k]);
      const stackY = stackTop - h; stackTop = stackY;
      const x = lerp(XS[k] - SW / 2, STK - SW / 2, fly), y = lerp(SB - h, stackY, fly);
      rect(x, y, SW, h, WHT, op * c); if (fly > 0) srect(XS[k] - SW / 2, SB - h, SW, h, WHT, 4, op * c * fly * .6, [10, 8]);
      if (rem[k] > 1e-4) { const oh = Math.max(3, PPS * rem[k]); srect(XS[k] - SW / 2, SB - h - oh, SW, oh, WHT, 6, op * c, [14, 10]); }
      lab('sl' + k, `ℓ ${f4(sl[k])}`, XS[k], SB + 56, op * c * (1 - fly * .0));
      const tot = k === 0 ? gap : rem[k - 1];
      lab('sa' + k, `Δ ${f4(tot)}`, XS[k], SB - PPS * tot - 56 - (k ? 20 : 0), op * c * (1 - fly));
      if (k < 3) { const nx = cut[k + 1]; if (nx > .004) arrow(XS[k] + SW / 2 + 14, SB - h - Math.max(3, PPS * rem[k]) / 2, XS[k + 1] - SW / 2 - 14, sy(rem[k]) - 6, GRY, 5, op * nx * (1 - fly * .8)); }
    }
    const fo = prog(t, at('n14', .55), .8);
    if (fo > .004) {
      ln(XS[0] + SW / 2 + 10, sy(gap), STK - SW / 2 - 10, sy(gap), GRY, 4, op * fo, [12, 10]);
      lab('ssum', `Σ ${f4(sl.slice(0, 4).reduce((a, b) => a + b, 0))}`, STK, sy(gap) - 56, op * fo);
    }
    const pn = win(t, at('n16', .3), S('n17') - .2, .5, .4);
    if (pn > .004) lab('spanel', `Δ ${f4(gap)}  =  ${sl.slice(0, 4).map(f4).join(' + ')} + …`, 960, 950, op * pn, { size: 56 });
  }
  if (op2 > .004) {
    const op = op2; ln(250, SB, 1850, SB, GRY, 3, op);
    for (let k = 0; k < 4; k++) {
      const c = prog(t, at('n22', .55 + .08 * k), .6), x = XS[k] - SW / 2, a = ST.allow[k], h = Math.max(3, PPS * sl[k]);
      rect(x, SB - h, SW, h, WHT, op); srect(x, sy(a), SW, PPS * a, WHT, 5, op * c, [14, 10]);
      lab('al' + k, `ℓ ${f4(sl[k])}`, XS[k], SB + 56, op); lab('ab' + k, `≤ ${f4(a)}`, XS[k], SB + 116, op * c, { color: GRY });
    }
    const p1 = win(t, at('n23', .3), 1e9, .5, .4), p2 = win(t, at('n23', .62), 1e9, .5, .4);
    lab('p0', 'midpoint bar', 1560, 390, op * p1); lab('p1', `gap ${ST.gap.toFixed(3)} ≤ ${ST.half.toFixed(3)}`, 1560, 460, op * p1);
    lab('p2', 'bar at ceiling', 1560, 580, op * p2); lab('p3', `gap ${ST.gap_ceiling.toFixed(3)} ≤ ${ST.full.toFixed(3)}`, 1560, 650, op * p2);
  }
}

// ---------- Algorithm 1 on a map for Sam
const PXc = 975, PYc = 560, PSC = 300, px = x => PXc + PSC * x, py = y => PYc - PSC * y;
const ADN = ['beach cottage', 'yoga retreat', 'spa day', 'rafting', 'city hotel', 'ski trip'];
const MK = [S('n25'), S('n26') + .1, S('n27') + .1];
function mixAlg(t) {
  const s = AL.steps, k1 = prog(t, MK[1], 1.4), k2 = prog(t, MK[2], 1.4), o = {};
  const L = (a, b, k) => lerp(a, b, k);
  for (const f of ['h', 'L', 'U', 'beta', 'r']) o[f] = L(L(s[0][f], s[1][f], k1), s[2][f], k2);
  o.mx = L(L(s[0].mu[0], s[1].mu[0], k1), s[2].mu[0], k2); o.my = L(L(s[0].mu[1], s[1].mu[1], k1), s[2].mu[1], k2);
  o.lo = L(L(0, .1, k1), .25, k2); o.hi = L(L(.7, .6, k1), .55, k2); o.k1 = k1; o.k2 = k2;
  return o;
}
const LIST = ['1  h from the guess', '2  floor L, ceiling U', '3  bar β = ½ (L + U)', '4  show if h ≥ β'];
const MSG = [
  { t: S('n25'), u: S('n26'), who: 'sam', s: "I'm so tired of work." },
  { t: S('n26'), u: S('n27'), who: 'sam', s: 'a few days, warm and quiet' },
  { t: S('n27'), u: at('n27', .62), who: 'sam', s: 'the sea, we drive, under $100' },
  { t: at('n27', .62), u: 1e9, who: 'bot', s: 'A quiet beach town nearby. Go midweek.', card: 'Beach cottage · 2 nights · $90' },
];
const active = t => { let m = null; for (const x of MSG) if (x.t <= t && t < x.u) m = x; return m; };
function bubbleBox(m) { if (!m) return { w: 0, h: 0 }; const tw = textW(m.s, 52), cw = m.card ? textW(m.card, 46) + 56 : 0; return { w: Math.max(tw, cw) + 80, h: m.card ? 190 : 100 }; }
function chat(t, op) {
  const m = active(t); if (!m) return; const p = active(m.t - 1e-3), k = prog(t, m.t, .45), b0 = bubbleBox(p), b1 = bubbleBox(m);
  const w = lerp(b0.w, b1.w, k), h = lerp(b0.h, b1.h, k), cy = 975 - (b1.h > 120 ? 45 : 0) * k - (b0.h > 120 ? 45 : 0) * (1 - k);
  const col = c => (c && c.who === 'sam') ? YEL : WHT;
  const b = el('bub', 'bub'); b.style.left = '960px'; b.style.top = cy + 'px'; b.style.width = w + 'px'; b.style.height = h + 'px'; b.style.borderColor = k < .5 ? col(p) : col(m); b.style.opacity = op * (p ? 1 : k);
  const who = k < .5 ? p : m, tg = el('btag', 'btag');
  if (who) { html(tg, who.who === 'sam' ? 'Sam' : 'bot'); tg.style.color = col(who); tg.style.left = (960 - w / 2 + 24) + 'px'; tg.style.top = (cy - h / 2 - 30) + 'px'; tg.style.opacity = op * (p ? Math.abs(k - .5) * 2 : k); }
  const line = (id, mm, o, dy) => {
    if (!mm || o <= .004) return; const bh = bubbleBox(mm).h, ty = cy + dy - (bh > 120 ? 40 : 0), e = el('bt' + id, 'btxt');
    html(e, mm.s.replace(/</g, '&lt;')); e.style.top = ty + 'px'; e.style.opacity = o * op; e.style.left = '960px';
    if (mm.card) { const c = el('bc' + id, 'card'); html(c, mm.card); c.style.left = '960px'; c.style.top = (ty + 82) + 'px'; c.style.opacity = o * op; }
  };
  line('o', p, 1 - clamp(k * 2.2), -14 * k); line('n', m, p ? clamp((k - .35) / .65) : k, 14 * (1 - k));
}
function algScene(t) {
  const op = win(t, S('n24'), 1e9, .5, .5);
  if (op <= .004) return;
  // the list slides from the centre to the left once the map appears
  const lx = lerp(560, 60, prog(t, S('n25'), 1.2));
  LIST.forEach((s, i) => lab('li' + i, s, lx, 330 + i * 100, op * prog(t, at('n24', .12 + .2 * i), .5), { al: 'l' }));
  const mo = win(t, S('n25') + .1, 1e9, .6, .5); if (mo <= .004) { chat(t, 1); return; }
  const m = mixAlg(t), mx = px(m.mx), my = py(m.my);
  ln(PXc - 330, PYc, PXc + 330, PYc, MID, 2, mo * .7); ln(PXc, PYc - 280, PXc, PYc + 280, MID, 2, mo * .7);
  disc(PXc, PYc, 9, WHT, mo);
  // ghosts of the earlier balls
  AL.steps.slice(0, 2).forEach((s, i) => { const gk = i === 0 ? m.k1 : m.k2; ring(px(s.mu[0]), py(s.mu[1]), s.r * PSC, GRY, 3, mo * .6 * gk, [10, 10]); });
  ring(mx, my, m.r * PSC, WHT, 6, mo, null, 'rgba(255,255,255,.08)');
  const best = AL.steps[m.k2 > .5 ? 2 : m.k1 > .5 ? 1 : 0].best;
  ADN.forEach(n => { const v = AL.ads[n], x = px(v[0]), y = py(v[1]), b = n === best; disc(x, y, b ? 20 : 15, BLU, mo); if (b) ring(x, y, 32, WHT, 5, mo); });
  const bc = AL.ads['beach cottage'], yg = AL.ads['yoga retreat'];
  lab('adc', 'beach cottage', px(bc[0]) - 20, py(bc[1]) + 124, mo, { color: BLU }); lab('ady', 'yoga retreat', px(yg[0]) + 20, py(yg[1]) - 56, mo, { color: BLU, al: 'l' });
  disc(px(AL.sam[0]), py(AL.sam[1]), 13, YEL, mo); lab('sam', 'Sam', px(AL.sam[0]) + 8, py(AL.sam[1]) + 48, mo, { color: YEL });
  disc(mx, my, 8, WHT, mo);
  // compact meter: h marker, the fence band, the bar
  const BX0c = 1500, BX1c = 1640, yc = v => 800 - 500 * (v - m.lo) / (m.hi - m.lo);
  rect(BX0c, yc(m.U), BX1c - BX0c, yc(m.L) - yc(m.U), WHT, .14 * mo); ln(BX0c, yc(m.U), BX1c, yc(m.U), WHT, 4, mo); ln(BX0c, yc(m.L), BX1c, yc(m.L), WHT, 4, mo);
  ln(BX0c - 20, yc(m.beta), BX1c + 20, yc(m.beta), WHT, 10, mo);
  const yh = yc(m.h); g.globalAlpha = mo; g.fillStyle = WHT; g.beginPath(); g.moveTo(BX0c - 40, yh - 20); g.lineTo(BX0c - 40, yh + 20); g.lineTo(BX0c - 4, yh); g.fill(); g.globalAlpha = 1;
  lab('ch', `h ${f2(m.h)}`, BX0c - 56, yh, mo, { al: 'r' });
  lab('cu', `U ${f2(m.U)}`, BX1c + 36, yc(m.U), mo, { al: 'l' }); lab('cb', `β ${f2(m.beta)}`, BX1c + 36, yc(m.beta), mo, { al: 'l' }); lab('cl', `L ${f2(m.L)}`, BX1c + 36, yc(m.L), mo, { al: 'l' });
  const mi = t < MK[1] ? 1 : t < MK[2] ? 2 : 3; lab('cm', `message ${mi}`, 1570, 250, mo);
  const stopNow = win(t, at('n27', .35), 1e9, .5, .5), keep = win(t, at('n25', .55), at('n27', .3), .5, .4);
  lab('st1', 'h below the bar: keep talking', 960, 128, keep, { size: 72 }); lab('st2', 'h clears the bar: show the ad', 960, 128, stopNow * (1 - win(t, at('n29', .1), 1e9, .5, .5)), { size: 72 });
  chat(t, op);
}

// ---------- top formulas
const STATES = [
  { t: at('n08', .45), toks: [T('l', 'ℓ' + sub('t')), T('eq', '='), T('a', 'C − h', { cap: 'too early' }), T('o1', 'or', { sp: .45 }), T('b', 'h − C', { cap: 'too late' }), T('o2', 'or', { sp: .45 }), T('z', '0', { cap: 'agree' })] },
  { t: S('n09') + .3, toks: [] },
  { t: at('n12', .4), toks: [T('D', 'Δ' + sub('t')), T('eq', '='), T('l', 'ℓ' + sub('t'), { from: [CXc, yv(.226)] }), T('pl', '+', { sp: .25 }), T('q', '(1 − p)', { cap: 'stays' }), T('i', '1{h &lt; β}', { cap: 'talking' }), T('e', 'E' + sub('t') + '[Δ' + sub('t+1') + ']', { cap: 'gap next', from: [CXc, yv(.289)] })] },
  { t: at('n15', .12), toks: [T('D', 'Δ' + sub('t')), T('eq', '='), T('E', 'E' + sub('t'), { sp: .05 }), T('sg', 'Σ' + sub('s ≥ t'), { sp: .05 }), T('q', '(1 − p)' + sup('s−t'), { cap: 'stayed' }), T('i', '1{s ≤ τ}', { cap: 'talking' }), T('l', 'ℓ' + sub('s'), { cap: 'loss' })] },
  { t: S('n17') + .1, toks: [] },
  { t: at('n22', .3), toks: [T('D', 'Δ' + sub('t')), T('eq', '≤', { sp: .25 }), T('E', 'E' + sub('t'), { sp: .05 }), T('sg', 'Σ' + sub('s ≥ t'), { sp: .05 }), T('q', '(1 − p)' + sup('s−t')), T('h', '½(U' + sub('s') + ' − L' + sub('s') + ')', { cap: 'half the fence' })] },
  { t: S('n24') + .1, toks: [] },
  { t: at('n29', .3), toks: [T('q', 'how far from the best?')], size: 96 },
];

// ---------- the frame
function draw(t) {
  used = new Set(); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
  // title morphs up and out into the first scene
  const tk = prog(t, 1.5, .9), to = win(t, 0, 2.4, .4, .9);
  lab('t1', 'Part 3', 960, 470 - 110 * tk, to, { size: 110 }); lab('t2', 'Counting the mistakes', 960, 600 - 110 * tk, to, { size: 96 });
  const P = meterState(t); meter(t, P);
  gapMeter(t); stairScene(t); algScene(t);
  formula('F', STATES, t, 960, 128);
  if (t < S('n05') + 1 && t >= at('n05', .25)) { /* status is drawn below */ }
  const ks = win(t, at('n05', .3), at('n05', .62), .4, .3), ss = win(t, at('n05', .62), S('n06') - .1, .4, .4);
  lab('sk', 'h below the bar: keep talking', 960, 150, ks, { size: 56 }); lab('ss', 'h reaches the bar: show the ad', 960, 150, ss, { size: 56 });
  for (const [k, e] of pool) if (!used.has(k)) e.style.display = 'none';
  const fade = 1 - clamp((t - E('n29') - .2) / 1.3); OV.style.opacity = fade; cv.style.opacity = fade;
}
window.seek = t => draw(t);
window.ready = true;
