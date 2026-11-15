/* Angle pictures, drawn to scale from a small description ("spec").
   layout(spec) is pure (no page needed) so the question gate can measure it.
   render(spec, el, opts) draws it as SVG.
   Directions are in degrees, 0 = right, anticlockwise positive (as in a maths book). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Diagram = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const dir = d => [Math.cos(rad(d)), -Math.sin(rad(d))];
  const add = (p, v, k) => [p[0] + v[0] * (k == null ? 1 : k), p[1] + v[1] * (k == null ? 1 : k)];
  const n360 = d => ((d % 360) + 360) % 360;
  const dirOf = (a, b) => n360(deg(Math.atan2(-(b[1] - a[1]), b[0] - a[0])));
  const textW = t => 6 + String(t).replace('°', '').length * 8.6 + (String(t).includes('°') ? 5 : 0);
  const TH = 18;

  function blank() { return { segs: [], arcs: [], labels: [], ticks: [], chevs: [], dots: [] }; }

  // How far from the corner a label must sit so it fits between the two arms.
  function labelDist(r, sweep, text, max) {
    const half = Math.min(sweep, 180) / 2;
    const need = (Math.hypot(textW(text), TH) / 2 + 3) / Math.sin(rad(Math.max(half, 6)));
    return Math.min(Math.max(r + 16, need), max);
  }
  function label(L, c, from, sweep, r, a, max) {
    if (!a.label) return;
    const d = labelDist(r, sweep, a.label, max);
    const p = add(c, dir(from + sweep / 2), d);
    L.labels.push({ x: p[0], y: p[1], text: a.label, cls: a.cls || 'known', key: a.key, w: textW(a.label), h: TH });
  }

  /* fan: rays from one point. spec = {type:'fan', rays:[deg], line:bool, arcs:[{from,to,value,label,cls,square,key}]} */
  function layoutFan(s) {
    const L = blank(), C = [0, 0], R = 112;
    s.rays.forEach((d, i) => L.segs.push({ a: C, b: add(C, dir(d), s.line && i < 2 ? R + 16 : R), cls: s.line && i < 2 ? 'line' : 'ray' }));
    s.arcs.forEach((a, i) => {
      const sweep = n360(a.to - a.from) || 360;
      const r = a.square ? 16 : sweep > 180 ? 22 : 28 + (i % 2) * 7;
      L.arcs.push({ c: C, r, from: a.from, sweep, cls: a.cls || 'known', square: !!a.square, key: a.key });
      label(L, C, a.from, sweep, r, a, R - 16);
    });
    L.dots.push(C);
    return L;
  }

  /* tri: spec = {type:'tri', angles:[A,B,C], rot, flip, corners:[{label,cls,square,key}|null x3], equal:[[i,j],[i,k]], ext:{at,from,label,cls,key}} */
  function triPoints(s) {
    const [A, B, C] = s.angles;
    const b = Math.sin(rad(B)) / Math.sin(rad(C));
    let P = [[0, 0], [1, 0], [b * Math.cos(rad(A)), -b * Math.sin(rad(A))]];
    if (s.flip) P = P.map(p => [p[0], -p[1]]);
    const t = rad(s.rot || 0), ct = Math.cos(t), st = Math.sin(t);
    P = P.map(p => [p[0] * ct + p[1] * st, -p[0] * st + p[1] * ct]);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    let k = Math.min(250 / (Math.max(...xs) - Math.min(...xs)), 170 / (Math.max(...ys) - Math.min(...ys)));
    const side = i => Math.hypot(P[i][0] - P[(i + 1) % 3][0], P[i][1] - P[(i + 1) % 3][1]);
    k = Math.max(k, 118 / Math.min(side(0), side(1), side(2)));   // a thin triangle is drawn bigger so its labels have room
    return P.map(p => [p[0] * k, p[1] * k]);
  }
  function corner(P, i) { // the inside angle at corner i as {from, sweep}
    const d1 = dirOf(P[i], P[(i + 1) % 3]), d2 = dirOf(P[i], P[(i + 2) % 3]);
    const s = n360(d2 - d1);
    return s < 180 ? { from: d1, sweep: s } : { from: d2, sweep: 360 - s };
  }
  function layoutTri(s) {
    const L = blank(), P = triPoints(s);
    for (let i = 0; i < 3; i++) L.segs.push({ a: P[i], b: P[(i + 1) % 3], cls: 'line' });
    (s.corners || []).forEach((a, i) => {
      if (!a) return;
      const c = corner(P, i), r = a.square ? 15 : c.sweep < 40 ? 34 : 26;
      L.arcs.push({ c: P[i], r, from: c.from, sweep: c.sweep, cls: a.cls || 'known', square: !!a.square, key: a.key });
      label(L, P[i], c.from, c.sweep, r, a, 86);
    });
    (s.equal || []).forEach(([i, j]) => {
      const m = [(P[i][0] + P[j][0]) / 2, (P[i][1] + P[j][1]) / 2], n = dir(dirOf(P[i], P[j]) + 90);
      L.ticks.push({ a: add(m, n, 7), b: add(m, n, -7) });
    });
    if (s.ext) { // the side from -> at carries on past the corner; the outside angle sits beside the inside one
      const e = s.ext, v = P[e.at], u = P[e.from], w = P[3 - e.at - e.from];
      const de = dirOf(u, v), dw = dirOf(v, w), q = add(v, dir(de), 64);
      L.segs.push({ a: v, b: q, cls: 'line' });
      const sw = n360(dw - de), c = sw < 180 ? { from: de, sweep: sw } : { from: dw, sweep: 360 - sw };
      L.arcs.push({ c: v, r: 22, from: c.from, sweep: c.sweep, cls: e.cls || 'known', key: e.key });
      label(L, v, c.from, c.sweep, 22, e, 60);
    }
    return L;
  }

  /* par: two parallel lines (direction a) crossed by one or two lines (direction b).
     spec = {type:'par', a, b, nB:1|2, arcs:[{cross, q, value, label, cls, key}]}
     crossing index = i*nB + j ; corner q: 0 starts at direction a, 1 at b, 2 at a+180, 3 at b+180. */
  function parCross(s) {
    const nA = 2, nB = s.nB || 1, gapA = 96, gapB = 124, out = [];
    const na = dir(s.a + 90), nb = dir(s.b + 90), da = dir(s.a), db = dir(s.b);
    for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
      const pa = add([0, 0], na, (i - (nA - 1) / 2) * gapA), pb = add([0, 0], nb, (j - (nB - 1) / 2) * gapB);
      const det = da[0] * (-db[1]) - (-db[0]) * da[1];
      const t = ((pb[0] - pa[0]) * (-db[1]) - (-db[0]) * (pb[1] - pa[1])) / det;
      out.push(add(pa, da, t));
    }
    return out;
  }
  function parCorner(s, q) {
    const d = n360(s.b - s.a);
    return { from: [s.a, s.b, s.a + 180, s.b + 180][q], sweep: q % 2 ? 180 - d : d };
  }
  function layoutPar(s) {
    const L = blank(), X = parCross(s), nB = s.nB || 1, EXT = nB > 1 ? 46 : 60;
    const lineThrough = (pts, d, cls, chev) => {
      const v = dir(d), ts = pts.map(p => p[0] * v[0] + p[1] * v[1]);
      const base = add(pts[0], v, -ts[0]), lo = Math.min(...ts) - EXT, hi = Math.max(...ts) + EXT;
      L.segs.push({ a: add(base, v, lo), b: add(base, v, hi), cls });
      if (chev) L.chevs.push({ p: add(base, v, hi - 24), d, n: chev });
    };
    for (let i = 0; i < 2; i++) lineThrough(X.slice(i * nB, i * nB + nB), s.a, 'line', 1);
    for (let j = 0; j < nB; j++) lineThrough([X[j], X[nB + j]], s.b, 'line', nB > 1 ? 2 : 0);
    s.arcs.forEach(a => {
      const c = parCorner(s, a.q), r = c.sweep < 60 ? 27 : 21;
      L.arcs.push({ c: X[a.cross], r, from: c.from, sweep: c.sweep, cls: a.cls || 'known', key: a.key });
      label(L, X[a.cross], c.from, c.sweep, r, a, 58);
    });
    return L;
  }

  function layout(spec) {
    const L = spec.type === 'fan' ? layoutFan(spec) : spec.type === 'tri' ? layoutTri(spec) : layoutPar(spec);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    L.segs.forEach(s => { grow(s.a[0], s.a[1]); grow(s.b[0], s.b[1]); });
    L.arcs.forEach(a => { grow(a.c[0] - a.r, a.c[1] - a.r); grow(a.c[0] + a.r, a.c[1] + a.r); });
    L.labels.forEach(l => { grow(l.x - l.w / 2, l.y - l.h / 2); grow(l.x + l.w / 2, l.y + l.h / 2); });
    const pad = 12;
    L.vb = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
    return L;
  }

  const f = n => Math.round(n * 100) / 100;
  function arcPath(c, r, from, sweep, wedge) {
    if (sweep >= 359.99) return `M${f(c[0] + r)} ${f(c[1])}A${r} ${r} 0 1 0 ${f(c[0] - r)} ${f(c[1])}A${r} ${r} 0 1 0 ${f(c[0] + r)} ${f(c[1])}`;
    const p0 = add(c, dir(from), r), p1 = add(c, dir(from + sweep), r);
    const arc = `M${f(p0[0])} ${f(p0[1])}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${f(p1[0])} ${f(p1[1])}`;
    return wedge ? `M${f(c[0])} ${f(c[1])}L${f(p0[0])} ${f(p0[1])}${arc.slice(arc.indexOf('A'))}Z` : arc;
  }
  function squarePath(c, r, from) {
    const p0 = add(c, dir(from), r), p2 = add(c, dir(from + 90), r), p1 = add(p0, dir(from + 90), r);
    return `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}`;
  }
  function svg(spec, opts) {
    const L = layout(spec), o = opts || {}, out = [];
    L.arcs.forEach(a => {
      const k = a.key ? ` data-key="${a.key}"` : '';
      if (!a.square) out.push(`<path class="dg-wedge dg-${a.cls}"${k} d="${arcPath(a.c, a.r, a.from, a.sweep, true)}"/>`);
      out.push(`<path class="dg-arc dg-${a.cls}"${k} d="${a.square ? squarePath(a.c, a.r, a.from) : arcPath(a.c, a.r, a.from, a.sweep)}"/>`);
    });
    L.segs.forEach(s => out.push(`<line class="dg-${s.cls}" x1="${f(s.a[0])}" y1="${f(s.a[1])}" x2="${f(s.b[0])}" y2="${f(s.b[1])}"/>`));
    L.ticks.forEach(t => out.push(`<line class="dg-tick" x1="${f(t.a[0])}" y1="${f(t.a[1])}" x2="${f(t.b[0])}" y2="${f(t.b[1])}"/>`));
    L.chevs.forEach(c => {
      for (let i = 0; i < c.n; i++) {
        const tip = add(c.p, dir(c.d), -i * 9), l = add(tip, dir(c.d + 152), 11), r = add(tip, dir(c.d - 152), 11);
        out.push(`<path class="dg-chev" d="M${f(l[0])} ${f(l[1])}L${f(tip[0])} ${f(tip[1])}L${f(r[0])} ${f(r[1])}"/>`);
      }
    });
    L.dots.forEach(d => out.push(`<circle class="dg-dot" cx="${f(d[0])}" cy="${f(d[1])}" r="3.4"/>`));
    L.labels.forEach(l => {
      const k = l.key ? ` data-key="${l.key}"` : '';
      out.push(`<text class="dg-label dg-${l.cls}"${k} x="${f(l.x)}" y="${f(l.y)}">${l.text}</text>`);
    });
    return `<svg class="dg" viewBox="${(o.vb || L.vb).map(f).join(' ')}" role="img" aria-label="${o.alt || 'Angle picture'}">${out.join('')}</svg>`;
  }
  function render(spec, el, opts) { el.innerHTML = svg(spec, opts); return el.firstChild; }

  return { layout, svg, render, arcPath, triPoints, corner, parCross, parCorner, dir, add, n360, dirOf, rad, deg };
});
