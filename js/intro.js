/* The opening: a spark writes "Anya's App", then an arc of light sweeps over it. window.Intro
   Strokes come from js/wordmark-data.js. Tap anywhere to skip. */
window.Intro = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const LAYERS = [['#ff6fb5', .2, 46, 10], ['#ff9ccb', .38, 22, 5.5], ['#ffd98a', 1, 11, 2.8], ['#ffffff', .96, 4, 1.15]]; // colour, opacity, width in font units, least width in px
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  function play(done) {
    const host = document.getElementById('intro'), WM = window.WORDMARK;
    let over = false;
    function end() {
      if (over) return; over = true; FX.pen(null);
      host.classList.add('out'); document.body.classList.remove('booting');
      if (done) done(); setTimeout(() => host.remove(), 1000);
    }
    if (!WM || window.CONFIG.fast) { host.style.transition = 'none'; end(); return; }

    const svg = el('svg', { viewBox: `0 0 ${WM.w} ${WM.h}`, 'aria-hidden': 'true' });
    const words = [0, 1].map(() => { const g = el('g', {}); LAYERS.forEach(() => g.appendChild(el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))); svg.appendChild(g); return g; });
    const strokes = WM.strokes.map(s => ({ w: s.w || 0, paths: LAYERS.map((_, i) => words[s.w || 0].children[i].appendChild(el('path', { d: s.d }))) }));
    host.appendChild(svg);

    // a phone held upright gets the two words stacked, so the writing is big
    let VW = WM.w, VH = WM.h;
    if (window.innerWidth < 700 && window.innerHeight > window.innerWidth) {
      const b0 = words[0].getBBox(), b1 = words[1].getBBox(), PAD = 100, GAP = 40;
      VW = Math.max(b0.width, b1.width) + PAD * 2; VH = b0.height + b1.height + GAP + PAD * 2;
      words[0].setAttribute('transform', `translate(${(VW - b0.width) / 2 - b0.x} ${PAD - b0.y})`);
      words[1].setAttribute('transform', `translate(${(VW - b1.width) / 2 - b1.x} ${PAD + b0.height + GAP - b1.y})`);
      svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    }
    const px = (svg.getBoundingClientRect().width || 300) / VW;   // screen px per font unit
    const widths = LAYERS.map(l => Math.max(l[2], l[3] / px));
    words.forEach(g => LAYERS.forEach((l, i) => { const c = g.children[i]; c.setAttribute('stroke', l[0]); c.setAttribute('stroke-opacity', l[1]); c.setAttribute('stroke-width', widths[i]); }));

    // the arc of light
    // it rises beside the first letter, passes over the top of the writing and comes down past the last letter; it never crosses a letter
    const bb = svg.getBBox(), X0 = bb.x, Y0 = bb.y, W = bb.width, H = bb.height, X1 = X0 + W;
    const arcD = VW / VH > 2.4 ? `M${X0 - W * .05} ${Y0 + H * .62}C${X0 + W * .04} ${Y0 - H * .8} ${X0 + W * .96} ${Y0 - H * .8} ${X1 + W * .05} ${Y0 + H * .4}`
      : `M${X0 - W * .07} ${Y0 + H * .3}C${X0} ${Y0 - H * .45} ${X1} ${Y0 - H * .45} ${X1 + W * .07} ${Y0 + H * .16}`;
    const arcG = el('g', { fill: 'none', 'stroke-linecap': 'round' });
    const arcs = [['#ff9ccb', .3, 2.4], ['#ffe3ad', .9, 1], ['#ffffff', 1, .42]].map(a => arcG.appendChild(el('path', { d: arcD, stroke: a[0], 'stroke-opacity': a[1], 'stroke-width': widths[2] * a[2] })));
    svg.insertBefore(arcG, svg.firstChild);

    const prep = (paths) => { const len = paths[0].getTotalLength(); paths.forEach(p => { p.setAttribute('stroke-dasharray', `${len + 2} ${len + 2}`); p.setAttribute('stroke-dashoffset', len + 2); p.style.visibility = 'hidden'; }); return len; };
    strokes.forEach(st => { st.len = prep(st.paths); });
    const arc = { paths: arcs, len: prep(arcs) };

    if (FX.reduce) { strokes.concat(arc).forEach(st => st.paths.forEach(p => { p.style.visibility = 'visible'; p.setAttribute('stroke-dashoffset', 0); })); setTimeout(end, 1500); host.addEventListener('pointerdown', end); return; }

    const total = strokes.reduce((a, s) => a + s.len, 0), WRITE = 3000;
    let t = 550;
    strokes.forEach((st, i) => { st.t0 = t; st.dur = Math.max(120, WRITE * st.len / total); t += st.dur + (strokes[i + 1] && strokes[i + 1].w !== st.w ? 280 : 45); });
    arc.t0 = t + 120; arc.dur = 950;
    const tShine = arc.t0 + arc.dur, tEnd = tShine + 1250;
    const tip = (path, at) => { const p = path.getPointAtLength(at), m = path.getScreenCTM(); return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f }; };
    const penR = Math.max(3.5, Math.min(7, widths[2] * px * 1.4));

    const start = performance.now(); let shone = false;
    function step(st, T, sparks) {
      const k = Math.min(1, (T - st.t0) / st.dur); if (k <= 0 || st.fin) return false;
      if (!st.on) { st.on = true; st.paths.forEach(p => { p.style.visibility = 'visible'; }); }
      const e = ease(k), off = (st.len + 2) * (1 - e);
      st.paths.forEach(p => p.setAttribute('stroke-dashoffset', off));
      const h = tip(st.paths[0], st.len * e); FX.pen(h.x, h.y, penR); FX.trail(h.x, h.y, sparks);
      if (k >= 1) st.fin = true;
      return true;
    }
    function frame(now) {
      if (over) return;
      const T = now - start; let live = false;
      strokes.forEach(st => { if (step(st, T, 1)) live = true; });
      if (step(arc, T, 3)) live = true;
      if (!live) FX.pen(null);
      if (T >= tShine && !shone) {
        shone = true; svg.classList.add('shine'); FX.chime('win');
        const h = tip(arc.paths[0], arc.len); FX.burst(h.x, h.y, 46, { power: 6 });
        arcG.style.transition = 'opacity 1.1s ease'; arcG.style.opacity = .5;
      }
      if (shone && T < tEnd - 250 && Math.random() < .5) { const st = strokes[(Math.random() * strokes.length) | 0], h = tip(st.paths[0], Math.random() * st.len); FX.burst(h.x, h.y, 2, { power: 1.2, g: .01, r: 3 + Math.random() * 4 }); }
      if (T >= tEnd) { end(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    host.addEventListener('pointerdown', end);
  }
  return { play };
})();
