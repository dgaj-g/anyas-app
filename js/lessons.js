/* "See it": she drags a gold dot and watches the angles change, then sorts or taps. window.Lessons */
window.Lessons = (function () {
  const D = window.Diagram, Q = window.Questions, CONFIG = window.CONFIG;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), snap = (v, s) => Math.round(v / s) * s;
  const rad = d => d * Math.PI / 180, sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d)), tan = d => Math.tan(rad(d));
  const ang = (up, across) => Math.atan2(up, across) * 180 / Math.PI;
  const f = n => (+n).toFixed(1);
  const reshake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const plus = (svg, extra) => svg.replace('</svg>', extra + '</svg>');
  const knobHtml = p => `<circle class="halo" cx="${f(p[0])}" cy="${f(p[1])}" r="18"/><circle class="handle" cx="${f(p[0])}" cy="${f(p[1])}" r="11"/>`;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const mix = (a, b, k) => { if (typeof a === 'number') return a + (b - a) * k; const o = {}; for (const key in a) o[key] = a[key] + (b[key] - a[key]) * k; return o; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const VB = [-152, -114, 304, 228];

  /* ---------- the four pictures she can drag ---------- */
  const line = () => ({ vb: [-142, -136, 284, 162], s: 100, tick: true,
    at: (x, y) => y > 0 ? (x > 0 ? 0 : 180) : ang(-y, x),
    tidy: v => clamp(snap(v, 5), 15, 165),
    draw(v) { return D.svg({ type: 'fan', line: true, rays: [0, 180, v], arcs: [{ from: 0, to: v, label: v + '°', cls: 'k0' }, { from: v, to: 180, label: (180 - v) + '°', cls: 'k1' }] },
      { vb: this.vb, alt: `A straight line. Pink angle ${v}°, purple angle ${180 - v}°.` }); },
    knob: v => D.add([0, 0], D.dir(v), 112),
    ring: v => ({ total: 180, parts: [{ v, cls: 'k0' }, { v: 180 - v, cls: 'k1' }] }) });

  const point = () => ({ vb: [-134, -134, 268, 268], s: 150, tick: true,
    at: (x, y) => D.n360(ang(-y, x)),
    tidy: v => v < 115 ? (v < 45 ? 335 : 115) : clamp(snap(v, 5), 115, 335),
    draw(v) { return D.svg({ type: 'fan', line: false, rays: [0, 90, v], arcs: [{ from: 0, to: 90, label: '', cls: 'sq', square: true }, { from: 90, to: v, label: (v - 90) + '°', cls: 'k0' }, { from: v, to: 360, label: (360 - v) + '°', cls: 'k1' }] },
      { vb: this.vb, alt: `Angles around a point. A right angle, pink ${v - 90}°, purple ${360 - v}°.` }); },
    knob: v => D.add([0, 0], D.dir(v), 112),
    ring: v => ({ total: 360, parts: [{ v: 90, cls: 'sq' }, { v: v - 90, cls: 'k0' }, { v: 360 - v, cls: 'k1' }] }) });

  function triSvg(P1, P2, T, a, b, c, o) {   // a at the left corner, b at the right corner, c at the top
    const w = (p, from, sweep, cls) => `<path class="dg-wedge dg-${cls}" d="${D.arcPath(p, 24, from, sweep, true)}"/><path class="dg-arc dg-${cls}" d="${D.arcPath(p, 24, from, sweep)}"/>`;
    const ln = (p, q) => `<line class="dg-line" x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}"/>`;
    const tx = (x, y, t, cls) => `<text class="dg-label dg-${cls}" x="${f(x)}" y="${f(y)}">${t}°</text>`;
    const tick = (p, q) => { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d = Math.hypot(q[0] - p[0], q[1] - p[1]), n = [-(q[1] - p[1]) / d * 7, (q[0] - p[0]) / d * 7];
      return `<line class="dg-tick" x1="${f(m[0] - n[0])}" y1="${f(m[1] - n[1])}" x2="${f(m[0] + n[0])}" y2="${f(m[1] + n[1])}"/>`; };
    const right = o.iso ? 'k0' : 'k1';
    return `<svg class="dg" viewBox="${o.vb.join(' ')}" role="img" aria-label="${o.alt}">` + w(P1, 0, a, 'k0') + w(P2, 180 - b, b, right) + w(T, 180 + a, c, 'k2') + ln(P1, P2) + ln(P2, T) + ln(T, P1)
      + (o.iso ? tick(P1, T) + tick(P2, T) : '') + tx(P1[0] - 18, P1[1] + 17, a, 'k0') + tx(P2[0] + 18, P2[1] + 17, b, right) + tx(T[0], T[1] - 31, c, 'k2') + '</svg>';
  }
  const tri = () => { const P1 = [-80, 70], P2 = [80, 70];
    const top = s => { const len = 160 * sin(s.B) / sin(180 - s.A - s.B); return [P1[0] + len * cos(s.A), P1[1] - len * sin(s.A)]; };
    return { vb: [-152, -172, 304, 278], s: { A: 56, B: 70 },
      at: (x, y) => { x = clamp(x, -120, 120); y = clamp(y, -125, -10); return { A: ang(70 - y, x + 80), B: ang(70 - y, 80 - x) }; },
      tidy: s => ({ A: Math.round(s.A), B: Math.round(s.B) }),
      draw(s) { const c = 180 - s.A - s.B; return triSvg(P1, P2, top(s), s.A, s.B, c, { vb: this.vb, alt: `A triangle. Pink ${s.A}°, purple ${s.B}°, green ${c}° at the top.` }); },
      knob: top, ring: s => ({ total: 180, parts: [{ v: s.A, cls: 'k0' }, { v: s.B, cls: 'k1' }, { v: 180 - s.A - s.B, cls: 'k2' }] }) }; };
  const iso = () => { const P1 = [-70, 70], P2 = [70, 70], top = a => [0, 70 - 70 * tan(a)];
    return { vb: [-152, -172, 304, 278], s: 62,
      at: (x, y) => ang(Math.max(1, 70 - y), 70), tidy: v => clamp(Math.round(v), 30, 68),
      draw(a) { return triSvg(P1, P2, top(a), a, a, 180 - 2 * a, { vb: this.vb, iso: true, alt: `A triangle with two equal sides. Pink ${a}° and ${a}°, green ${180 - 2 * a}° at the top.` }); },
      knob: top, ring: a => ({ total: 180, parts: [{ v: a, cls: 'k0' }, { v: a, cls: 'k0' }, { v: 180 - 2 * a, cls: 'k2' }] }) }; };

  const par = () => ({ vb: VB, s: 70, tick: true,
    at: (x, y) => { const a = D.n360(ang(-y, x)); return a > 180 ? a - 180 : a; },
    tidy: v => clamp(snap(v, 5), 35, 145),
    draw(v) { const arcs = []; for (let c = 0; c < 2; c++) for (let q = 0; q < 4; q++) { const val = q % 2 ? 180 - v : v; arcs.push({ cross: c, q, value: val, label: c === 0 && q < 2 ? val + '°' : '', cls: q % 2 ? 'k1' : 'k0' }); }
      return D.svg({ type: 'par', a: 0, b: v, nB: 1, arcs }, { vb: this.vb, alt: `Two parallel lines and a line across. Pink angles ${v}°, purple angles ${180 - v}°.` }); },
    knob: v => D.add([0, 0], D.dir(v), 48 / sin(v) + 60),
    ring: v => ({ total: 180, parts: [{ v, cls: 'k0' }, { v: 180 - v, cls: 'k1' }] }) });

  /* ---------- what she is asked to do, lesson by lesson ---------- */
  const dragTo = (ex, job, until, t) => Object.assign({ type: 'drag', ex, job, help: ['Put your finger on the gold dot.', `Slide it until ${until}.`] }, t);
  const sorts = () => { const seed = CONFIG.seed || 1 + Math.floor(Math.random() * 1e8);
    return shuffle(shuffle(['line2', 'line3', 'lineSq']).slice(0, 2).concat(shuffle(['pt1', 'pt2', 'ptSq']).slice(0, 2))).map((k, i) => ({ type: 'sort', q: Q.make(k, seed + i) })); };
  const PLANS = {
    1() { const ex = line(), t = (want, first) => dragTo(ex, (first ? 'Drag the gold dot. Make' : 'Now make') + ` the pink angle ${want}°.`, `the pink angle says ${want}°`,
        { off: v => Math.abs(v - want), fix: () => want, said: v => `Pink ${v}° + purple ${180 - v}° = 180°` });
      return { acts: [t(60, 1), t(135), t(25)], end: 'Angles on a straight line always make 180°.' }; },
    2() { const ex = point(), t = (want, first) => dragTo(ex, (first ? 'Drag the gold dot. Make' : 'Now make') + ` the pink angle ${want}°.`, `the pink angle says ${want}°`,
        { off: v => Math.abs(v - 90 - want), fix: () => want + 90, said: v => `90° + ${v - 90}° + ${360 - v}° = 360°. The little square means 90°.` });
      return { acts: [t(110, 1), t(200)].concat(sorts()), end: 'Angles around a point always make 360°.' }; },
    3() { const ex = tri(), ex2 = iso(), sum = s => `${s.A}° + ${s.B}° + ${180 - s.A - s.B}° = 180°`;
      return { acts: [
        dragTo(ex, 'Drag the gold dot. Make the pink angle 90°.', 'the pink angle says 90°', { off: s => Math.abs(s.A - 90), fix: s => ({ A: 90, B: clamp(s.B, 25, 50) }), said: sum }),
        dragTo(ex, 'Now make the green angle at the top 60°.', 'the green angle says 60°', { off: s => Math.abs(120 - s.A - s.B), fix: s => { const A = clamp(s.A, 35, 85); return { A, B: 120 - A }; }, said: sum }),
        dragTo(ex2, 'Two sides are equal. Make the green angle 80°.', 'the green angle says 80°', { off: a => Math.abs(100 - 2 * a), fix: () => 50, said: a => `${a}° + ${a}° + ${180 - 2 * a}° = 180°. The two pink angles match.` }),
      ], end: 'The angles in a triangle always make 180°.' }; },
    4() { const ex = par(), said = v => `Pink ${v}° + purple ${180 - v}° = 180°. Only two sizes.`;
      const twin = () => ({ type: 'twins', b: pick([55, 60, 65, 70, 110, 115, 120, 125]), c: pick([0, 1]), q: pick([0, 1, 2, 3]) });
      return { acts: [
        dragTo(ex, 'Drag the gold dot. Make the pink angles 50°.', 'the pink angles say 50°', { off: v => Math.abs(v - 50), fix: () => 50, said }),
        dragTo(ex, 'Now make the purple angles 60°.', 'the purple angles say 60°', { off: v => Math.abs(v - 120), fix: () => 120, said }),
        twin(), twin(),
      ], end: 'Parallel lines make only two sizes of angle.' }; },
  };

  function showHelp(ui, steps) {
    const h = ui.ctl.querySelector('#help'), s = ui.ctl.querySelector('#stuck');
    h.innerHTML = '<ol>' + steps.map(t => `<li>${t}</li>`).join('') + '</ol>'; h.hidden = false; if (s) s.hidden = true;
  }

  /* ---------- drag the gold dot ---------- */
  function runDrag(ui, act, api) {
    const ex = act.ex; let s = ex.s, won = false, dragging = false, raf = 0, demo = 0, lastTick = 0;
    ui.pic.className = 'pic drag'; ui.job.textContent = act.job;
    ui.ctl.innerHTML = `<div id="ring"></div><p class="sub" id="say" aria-live="polite"></p><div class="help" id="help" hidden></div>${ui.foot}`;
    const ring = ui.ctl.querySelector('#ring'), say = ui.ctl.querySelector('#say');
    const paint = () => { raf = 0; ui.pic.innerHTML = plus(ex.draw(s), knobHtml(ex.knob(s))); ring.innerHTML = Ring.html(Object.assign({ live: true }, ex.ring(s))); };
    const set = n => {
      if (same(n, s)) return; s = ex.s = n; if (!raf) raf = requestAnimationFrame(paint);
      if (ex.tick && performance.now() - lastTick > 70) { lastTick = performance.now(); FX.chime('tap'); }
    };
    const svg = () => ui.pic.querySelector('svg');
    const toScreen = p => { const m = svg().getScreenCTM(); return [p[0] * m.a + p[1] * m.c + m.e, p[0] * m.b + p[1] * m.d + m.f]; };
    const follow = e => { const m = svg().getScreenCTM().inverse(); set(ex.tidy(ex.at(e.clientX * m.a + e.clientY * m.c + m.e, e.clientX * m.b + e.clientY * m.d + m.f, s))); };
    const down = e => { if (won) return; cancelAnimationFrame(demo); dragging = true; try { ui.pic.setPointerCapture(e.pointerId); } catch (x) {} follow(e); e.preventDefault(); };
    const move = e => { if (dragging) { follow(e); e.preventDefault(); } };
    const up = () => {
      if (!dragging) return; dragging = false;
      const h = ui.ctl.querySelector('#help'), sb = ui.ctl.querySelector('#stuck'); if (h && !h.hidden) { h.hidden = true; if (sb) sb.hidden = false; }
      if (won || act.off(s) > 3) return;
      won = true; s = ex.s = ex.tidy(act.fix(s)); cancelAnimationFrame(raf); paint();
      const p = toScreen(ex.knob(s)); FX.chime('hit'); FX.burst(p[0], p[1], 28); say.textContent = act.said(s); ui.pic.classList.remove('drag'); api.win(1700);
    };
    const ev = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]];
    ev.forEach(x => ui.pic.addEventListener(x[0], x[1]));
    ui.ctl.querySelector('#stuck').onclick = () => {          // the words, then the dot slides most of the way to show her how
      showHelp(ui, act.help);
      const from = s, to = ex.tidy(act.fix(s)), t0 = performance.now();
      const go = now => { if (dragging || won) return; const k = Math.min(1, (now - t0) / 1000); set(ex.tidy(mix(from, to, k * k * (3 - 2 * k) * .7))); if (k < 1) demo = requestAnimationFrame(go); };
      demo = requestAnimationFrame(go);
    };
    paint();
    if (CONFIG.local) window.__see = { type: 'drag', knob: () => toScreen(ex.knob(s)), target: () => toScreen(ex.knob(ex.tidy(act.fix(s)))) };
    return () => { ev.forEach(x => ui.pic.removeEventListener(x[0], x[1])); cancelAnimationFrame(raf); cancelAnimationFrame(demo); };
  }

  /* ---------- 180 or 360? ---------- */
  function runSort(ui, act, api) {
    const q = act.q; let won = false;
    ui.pic.className = 'pic'; ui.pic.innerHTML = D.svg(q.spec, { alt: q.desc }); ui.job.textContent = 'Do these angles make 180° or 360°?';
    ui.ctl.innerHTML = `<p class="sub" id="say" aria-live="polite"></p><div class="help" id="help" hidden></div>
      <div class="duo"><button class="btn soft opt" type="button" data-v="180">180°</button><button class="btn soft opt" type="button" data-v="360">360°</button></div>${ui.foot}`;
    const say = ui.ctl.querySelector('#say');
    ui.ctl.querySelectorAll('.opt').forEach(b => { b.onclick = () => {
      if (won) return;
      if (+b.dataset.v !== q.total) { reshake(b); FX.chime('wrong'); say.className = 'sub bad'; say.textContent = 'Look again. Is it a straight line or all the way round?'; return; }
      won = true; say.className = 'sub'; say.textContent = q.total === 360 ? 'Yes. All the way round a point makes 360°.' : 'Yes. A straight line makes 180°.';
      FX.chime('right'); FX.at(b, 16); api.win(1300);
    }; });
    ui.ctl.querySelector('#stuck').onclick = () => { showHelp(ui, ['A straight line makes 180°.', 'All the way round a point makes 360°.']); ui.pic.classList.remove('hint'); void ui.pic.offsetWidth; ui.pic.classList.add('hint'); };
    if (CONFIG.local) window.__see = { type: 'sort', answer: String(q.total) };
    return () => {};
  }

  /* ---------- tap the angles that match x ---------- */
  function runTwins(ui, act, api) {
    const spec = { type: 'par', a: 0, b: act.b, nB: 1 }, pts = D.parCross(spec), key = (c, q) => 'c' + c + 'q' + q, xk = key(act.c, act.q), all = [];
    for (let c = 0; c < 2; c++) for (let q = 0; q < 4; q++) all.push({ c, q, k: key(c, q), twin: q % 2 === act.q % 2 });
    const twins = all.filter(o => o.twin && o.k !== xk).map(o => o.k);
    let picked = [], bad = [], solved = false;
    ui.pic.className = 'pic'; ui.job.textContent = 'Tap every angle the same size as x. Then press Check.';
    ui.ctl.innerHTML = `<p class="sub" id="say" aria-live="polite">&nbsp;</p><div class="help" id="help" hidden></div><button class="btn" id="check" type="button" disabled>Check</button>${ui.foot}`;
    const say = ui.ctl.querySelector('#say'), check = ui.ctl.querySelector('#check');
    const draw = () => {
      const arcs = all.map(o => ({ cross: o.c, q: o.q, label: o.k === xk ? 'x' : '', cls: solved ? (o.twin ? 'x' : 'k1') : o.k === xk || picked.includes(o.k) ? 'x' : bad.includes(o.k) ? 'bad' : 'ghost' }));
      let hits = '';
      if (!solved) all.forEach(o => { if (o.k === xk) return; const cn = D.parCorner(spec, o.q); hits += `<path class="tap" data-key="${o.k}" d="${D.arcPath(pts[o.c], 46, cn.from, cn.sweep, true)}"/>`; });
      ui.pic.innerHTML = plus(D.svg(Object.assign({ arcs }, spec), { vb: VB, alt: 'Two parallel lines and a line across. One angle is x.' }), hits);
      check.disabled = !picked.length;
    };
    const tap = e => {
      const t = e.target.closest ? e.target.closest('.tap') : null; if (!t || solved) return;
      const k = t.getAttribute('data-key'); picked = picked.includes(k) ? picked.filter(x => x !== k) : picked.concat(k); FX.chime('place'); draw();
    };
    ui.pic.addEventListener('click', tap);
    check.onclick = () => {
      const right = picked.filter(k => twins.includes(k)), wrong = picked.filter(k => !twins.includes(k));
      if (right.length === 3 && !wrong.length) {
        solved = true; draw(); check.hidden = true; say.className = 'sub'; say.textContent = 'Yes. Those 4 angles match. The other 4 match each other.';
        FX.chime('hit'); FX.at(ui.pic, 30); api.win(2200); return;
      }
      FX.chime('wrong'); reshake(ui.pic); bad = wrong; picked = right; draw(); say.className = 'sub bad';
      say.textContent = !wrong.length ? 'Good so far. Find all 3 angles that match x.' : right.length ? `${right.length} of your angles ${right.length === 1 ? 'matches' : 'match'} x. Find all 3.` : 'Those do not match x. Find the 3 angles that do.';
      api.later(() => { if (!solved) { bad = []; draw(); } }, 900);
    };
    ui.ctl.querySelector('#stuck').onclick = () => {           // the words, and one matching angle is picked for her
      showHelp(ui, ['Look at how wide x is.', 'Tap 3 more angles that wide.']);
      const k = twins.find(t => !picked.includes(t)); if (k) { picked = picked.concat(k); draw(); }
    };
    draw();
    if (CONFIG.local) window.__see = { type: 'twins', answer: twins, wrong: all.filter(o => !o.twin).map(o => o.k),
      at(k) { const o = all.find(z => z.k === k), cn = D.parCorner(spec, o.q), p = D.add(pts[o.c], D.dir(cn.from + cn.sweep / 2), 30), m = ui.pic.querySelector('svg').getScreenCTM();
        return [p[0] * m.a + p[1] * m.c + m.e, p[0] * m.b + p[1] * m.d + m.f]; } };
    return () => ui.pic.removeEventListener('click', tap);
  }

  /* ---------- one lesson's "See it" ---------- */
  function see(host, L, ctx) {
    const plan = (PLANS[L.id] || PLANS['1'])(), acts = plan.acts, n = acts.length, timers = [];
    let i = 0, alive = true, stop = null, inner = null;
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead"><p class="job" id="job"></p><div class="count" id="count"></div></div><div class="split"><div><div class="pic" id="pic"></div></div><div id="ctl"></div></div>`;
    const $ = id => host.querySelector('#' + id);
    const ui = { pic: $('pic'), ctl: $('ctl'), job: $('job'), count: $('count'),
      foot: `<div class="duo"><button class="btn soft small" id="stuck" type="button">Stuck? Show me</button><a class="btn soft small" href="${ctx.base}/try">Go to Try it</a></div>` };
    const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, CONFIG.fast ? Math.min(ms, 120) : ms));
    const head = done => { let d = ''; for (let k = 0; k < n; k++) d += `<i class="${k < done ? 'y' : k === i ? 'now' : ''}"></i>`; ui.count.innerHTML = `<span>${Math.min(i + 1, n)} of ${n}</span>${d}`; };
    const api = { later, win(ms) { head(i + 1); later(() => { i++; next(); }, ms); } };
    function next() {
      if (stop) stop(); stop = null;
      if (i >= n) return finish();
      head(i); const a = acts[i];
      stop = a.type === 'drag' ? runDrag(ui, a, api) : a.type === 'sort' ? runSort(ui, a, api) : runTwins(ui, a, api);
    }
    function finish() {
      ctx.done('see'); ui.job.textContent = plan.end; ui.pic.className = 'pic'; head(n);
      ui.ctl.innerHTML = `<div class="stack"><a class="btn go" href="${ctx.base}/try">Go to Try it</a><button class="btn soft" id="again" type="button">Do this again</button></div>`;
      FX.chime('win'); FX.at(ui.pic, 34);
      if (CONFIG.local) window.__see = { type: 'done' };
      ui.ctl.querySelector('#again').onclick = () => { if (alive) { stopAll(); inner = see(host, L, ctx); } };
    }
    function stopAll() { alive = false; timers.forEach(clearTimeout); if (stop) stop(); stop = null; }
    next();
    return () => { stopAll(); if (inner) inner(); };
  }
  return { see };
})();
