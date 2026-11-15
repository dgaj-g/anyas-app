/* The fill-the-ring picture: a half ring holds 180°, a whole ring holds 360°.
   Coloured pieces pour in; a gap or an overspill shows a wrong total at a glance. window.Ring */
window.Ring = (function () {
  const R = 70, SW = 22, CX = 100;
  function geo(total) {
    const half = total === 180, cy = half ? 96 : 100;
    const pt = (a, r) => { const t = (half ? 180 - a : 90 - a) * Math.PI / 180; return [CX + r * Math.cos(t), cy - r * Math.sin(t)]; };
    const arc = (a0, a1, r) => {
      if (a1 - a0 >= 359.99) a1 = a0 + 359.9;
      const p = pt(a0, r), q = pt(a1, r), f = n => n.toFixed(1);
      return `M${f(p[0])} ${f(p[1])}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(q[0])} ${f(q[1])}`;
    };
    return { half, cy, arc };
  }
  /* o = { total: 180|360, parts: [{ v, cls }], live: true|false } */
  function html(o) {
    const total = o.total, g = geo(total), parts = o.parts.filter(p => p.v > 0), sum = parts.reduce((a, p) => a + p.v, 0);
    let s = `<svg viewBox="0 0 200 ${g.half ? 112 : 200}" aria-hidden="true"><path class="trk" stroke-width="${SW}" d="${g.arc(0, total, R)}"/>`;
    let at = 0, i = 0;
    for (const p of parts) {
      const to = Math.min(total, at + p.v);
      if (to > at) s += `<path class="seg dg-${p.cls}${o.live ? '' : ' anim'}" style="--i:${i}" pathLength="1" stroke-width="${SW}" d="${g.arc(at, to, R)}"/>`;
      at = to; i++;
    }
    let note, tone = '';
    if (sum === total) { note = `${total}° ✓`; tone = ' good'; }
    else if (sum < total) { s += `<path class="gap" stroke-width="${SW - 6}" d="${g.arc(sum, total, R)}"/>`; note = `${total - sum}° gap`; tone = ' bad'; }
    else { const over = Math.min(total, sum - total); s += `<path class="over${o.live ? '' : ' anim'}" style="--i:${i}" pathLength="1" stroke-width="7" d="${g.arc(total - over, total, R + SW / 2 + 7)}"/>`; note = `${sum - total}° too much`; tone = ' bad'; }
    s += `<text class="note${tone}" x="${CX}" y="${g.half ? g.cy - 12 : g.cy}">${note}</text></svg>`;
    const words = parts.map(p => `<b class="dg-${p.cls}">${p.v}</b>`).join(' + ') + ` = ${sum}°`;
    return `<div class="ring${g.half ? '' : ' full'}">${s}<p class="ringsum">${words}</p></div>`;
  }
  /* The ring for one question, with her answer poured in (given), or the right answer. */
  function forQuestion(q, given) {
    if (!q.ring) return '';
    const parts = q.ring.pieces.map((v, i) => ({ v, cls: 'k' + Math.min(i, 2) }));
    for (let i = 0; i < q.ring.n; i++) parts.push({ v: given, cls: 'x' });
    return html({ total: q.ring.total, parts });
  }
  return { html, forQuestion };
})();
