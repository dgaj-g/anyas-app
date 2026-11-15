/* The angle questions. Every question is made from a seed, so a quiz can be rebuilt exactly
   (the walker in tools/drives does this) and no two quizzes are the same.
   make(kind, seed) -> { kind, topic, spec, answer, total, ring, choice, help, steps, slips, desc }
   judge(q, given)  -> { right, slip, say }
   Checked by tools/gates/g1-questions.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Questions = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const ang = (r, lo, hi) => r() < 0.5 ? 5 * int(r, Math.ceil(lo / 5), Math.floor(hi / 5)) : int(r, lo, hi);
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function until(gen, ok) { for (let i = 0; i < 500; i++) { const v = gen(); if (ok(v)) return v; } throw new Error('no fit'); }

  const SAY = {
    half: 'All the way round a point is 360°, not 180°.',
    fullLine: 'A straight line is 180°, not 360°.',
    fullTri: 'The angles in a triangle make 180°, not 360°.',
    square: 'The little square means 90°. Take that away too.',
    share: 'There are two x’s. Share what is left between them.',
    one: 'Take away both angles, not just one.',
    subtract: 'Add the two angles first. Then take the total from 180°.',
    sameLine: 'x is the rest of the line, not the same angle again.',
    shareIso: 'Two angles in this triangle are equal. Share what is left.',
    twinIso: 'The equal sides give two equal angles. Take that angle away twice.',
    sameIso: 'x is not a copy of that angle. Look at the equal sides.',
    inside: 'That is the angle inside. x is outside, on the straight line.',
    otherPar: 'x is the other size here. The two sizes make 180°.',
    twinPar: 'x is the same size as the angle you were given.',
  };
  function slips(answer, list) {
    const out = [], seen = {};
    list.forEach(([value, tag, say]) => {
      if (!Number.isInteger(value) || value <= 0 || value > 360 || value === answer || seen[value]) return;
      seen[value] = 1; out.push({ value, tag, say });
    });
    return out;
  }
  const CHOICE_TOTAL = t => ({ ask: 'What do these angles add up to?', options: [{ label: '180°', right: t === 180 }, { label: '360°', right: t === 360 }] });

  /* ---- pictures with rays from one point ---- */
  function fan(r, parts, line) {
    const start = line ? pick(r, [0, 0, 180]) : 5 * int(r, 0, 71);
    const rays = line ? [start, start + 180] : [], arcs = [];
    let d = start, k = 0;
    parts.forEach((p, i) => {
      if (!line || i > 0) rays.push(d);
      arcs.push({ from: d, to: d + p.v, value: p.v, label: p.sq ? '' : p.x ? 'x' : p.v + '°', cls: p.x ? 'x' : p.sq ? 'sq' : 'k' + (k++ % 3), square: !!p.sq, key: p.x ? 'x' : 'k' });
      d += p.v;
    });
    return { type: 'fan', rays, line: !!line, arcs };
  }
  const K = v => ({ v }), X = v => ({ v, x: true }), SQ = { v: 90, sq: true };

  const MAKE = {
    line2(r) {
      const a = until(() => ang(r, 25, 155), a => a !== 90);
      const x = 180 - a;
      return { topic: 'line', total: 180, answer: x, spec: fan(r, shuffle(r, [K(a), X(x)]), true), ring: { total: 180, pieces: [a], n: 1 },
        help: ['A straight line makes 180°.', `Take ${a} away from 180.`], steps: [`180 − ${a} = ${x}°`],
        slips: slips(x, [[360 - a, 'full', SAY.fullLine], [a, 'same', SAY.sameLine]]), desc: `Straight line: ${a}°, x` };
    },
    line3(r) {
      const [a, b] = until(() => [ang(r, 25, 110), ang(r, 25, 110)], ([a, b]) => a !== b && a !== 90 && b !== 90 && 180 - a - b >= 25 && 180 - a - b !== 90 && 180 - a - b !== a && 180 - a - b !== b);
      const x = 180 - a - b;
      return { topic: 'line', total: 180, answer: x, spec: fan(r, shuffle(r, [K(a), K(b), X(x)]), true), ring: { total: 180, pieces: [a, b], n: 1 },
        help: ['A straight line makes 180°.', `Add ${a} and ${b}.`, 'Take that total from 180.'], steps: [`${a} + ${b} = ${a + b}`, `180 − ${a + b} = ${x}°`],
        slips: slips(x, [[180 - a, 'one', SAY.one], [180 - b, 'one', SAY.one], [360 - a - b, 'full', SAY.fullLine]]), desc: `Straight line: ${a}°, ${b}°, x` };
    },
    lineSq(r) {
      const a = until(() => ang(r, 25, 65), a => a !== 45);
      const x = 90 - a;
      return { topic: 'line', total: 180, answer: x, spec: fan(r, pick(r, [[K(a), X(x), SQ], [SQ, K(a), X(x)], [X(x), K(a), SQ], [SQ, X(x), K(a)]]), true), ring: { total: 180, pieces: [90, a], n: 1 },
        help: ['A straight line makes 180°.', 'The little square is 90°.', `Take 90 and ${a} from 180.`], steps: [`90 + ${a} = ${90 + a}`, `180 − ${90 + a} = ${x}°`],
        slips: slips(x, [[180 - a, 'square', SAY.square], [270 - a, 'full', SAY.fullLine]]), desc: `Straight line: right angle, ${a}°, x` };
    },
    lineEq(r) {
      const a = until(() => 2 * int(r, 15, 65), a => a !== 60 && a !== 90);
      const x = (180 - a) / 2;
      return { topic: 'line', total: 180, answer: x, spec: fan(r, pick(r, [[X(x), K(a), X(x)], [K(a), X(x), X(x)], [X(x), X(x), K(a)]]), true), ring: { total: 180, pieces: [a], n: 2 },
        help: ['A straight line makes 180°.', `Take ${a} from 180.`, 'Share the rest between both x’s.'], steps: [`180 − ${a} = ${180 - a}`, `${180 - a} ÷ 2 = ${x}°`],
        slips: slips(x, [[180 - a, 'share', SAY.share], [(360 - a) / 2, 'full', SAY.fullLine], [360 - a, 'full', SAY.fullLine]]), desc: `Straight line: ${a}°, x, x` };
    },
    pt1(r) {
      const a = until(() => r() < 0.6 ? ang(r, 190, 330) : ang(r, 95, 170), a => a !== 270 && a !== 180);
      const x = 360 - a;
      return { topic: 'point', total: 360, answer: x, spec: fan(r, [K(a), X(x)], false), ring: { total: 360, pieces: [a], n: 1 },
        help: ['All the way round makes 360°.', `Take ${a} away from 360.`], steps: [`360 − ${a} = ${x}°`],
        slips: slips(x, [[180 - a, 'half', SAY.half], [a - 180, 'half', SAY.half]]), desc: `Around a point: ${a}°, x` };
    },
    pt2(r) {
      const [a, b] = until(() => [ang(r, 60, 200), ang(r, 40, 150)], ([a, b]) => { const x = 360 - a - b; return a !== b && x >= 30 && x !== 90 && x !== 180 && x !== a && x !== b && a !== 90 && b !== 90 && a !== 180; });
      const x = 360 - a - b;
      return { topic: 'point', total: 360, answer: x, spec: fan(r, shuffle(r, [K(a), K(b), X(x)]), false), ring: { total: 360, pieces: [a, b], n: 1 },
        help: ['All the way round makes 360°.', `Add ${a} and ${b}.`, 'Take that total from 360.'], steps: [`${a} + ${b} = ${a + b}`, `360 − ${a + b} = ${x}°`],
        slips: slips(x, [[180 - a - b, 'half', SAY.half], [180 - a, 'half', SAY.half], [180 - b, 'half', SAY.half], [360 - a, 'one', SAY.one], [360 - b, 'one', SAY.one]]), desc: `Around a point: ${a}°, ${b}°, x` };
    },
    ptSq(r) {
      const a = until(() => ang(r, 95, 240), a => 270 - a >= 30 && 270 - a !== 90 && a !== 180 && 270 - a !== a);
      const x = 270 - a;
      return { topic: 'point', total: 360, answer: x, spec: fan(r, pick(r, [[K(a), SQ, X(x)], [K(a), X(x), SQ], [SQ, K(a), X(x)]]), false), ring: { total: 360, pieces: [a, 90], n: 1 },
        help: ['All the way round makes 360°.', 'The little square is 90°.', `Take ${a} and 90 from 360.`], steps: [`${a} + 90 = ${a + 90}`, `360 − ${a + 90} = ${x}°`],
        slips: slips(x, [[180 - a, 'half', SAY.half], [360 - a, 'square', SAY.square], [a - 180, 'half', SAY.half], [90 - (a - 180), 'half', SAY.half]]), desc: `Around a point: ${a}°, right angle, x` };
    },
    ptEq(r) {
      const [a, b] = until(() => [ang(r, 60, 160), ang(r, 60, 160)], ([a, b]) => { const x = (360 - a - b) / 2; return a !== b && Number.isInteger(x) && x >= 30 && x !== 90 && x !== a && x !== b && a !== 90 && b !== 90; });
      const x = (360 - a - b) / 2;
      return { topic: 'point', total: 360, answer: x, spec: fan(r, pick(r, [[K(a), X(x), K(b), X(x)], [K(a), K(b), X(x), X(x)], [K(a), X(x), X(x), K(b)]]), false), ring: { total: 360, pieces: [a, b], n: 2 },
        help: ['All the way round makes 360°.', `Take ${a} and ${b} from 360.`, 'Share the rest between both x’s.'], steps: [`${a} + ${b} = ${a + b}`, `360 − ${a + b} = ${360 - a - b}`, `${360 - a - b} ÷ 2 = ${x}°`],
        slips: slips(x, [[360 - a - b, 'share', SAY.share], [180 - a, 'half', SAY.half], [180 - b, 'half', SAY.half], [(180 - a - b) / 2, 'half', SAY.half]]), desc: `Around a point: ${a}°, ${b}°, x, x` };
    },
    tri2(r) {
      const [a, b] = until(() => [ang(r, 30, 115), ang(r, 30, 115)], ([a, b]) => { const x = 180 - a - b; return a !== b && x >= 28 && x !== a && x !== b && ![a, b, x].includes(90); });
      const x = 180 - a - b, order = shuffle(r, [0, 1, 2]), angles = [], corners = [];
      [[a, 'k0'], [b, 'k1'], [x, 'x']].forEach(([v, c], i) => { angles[order[i]] = v; corners[order[i]] = { label: c === 'x' ? 'x' : v + '°', cls: c, key: c === 'x' ? 'x' : 'k' }; });
      return { topic: 'tri', total: 180, answer: x, spec: { type: 'tri', angles, corners, rot: pick(r, [0, 0, 180, 12, -12]), flip: r() < 0.5 }, ring: { total: 180, pieces: [a, b], n: 1 },
        help: ['A triangle’s angles make 180°.', `Add ${a} and ${b}.`, 'Take that total from 180.'], steps: [`${a} + ${b} = ${a + b}`, `180 − ${a + b} = ${x}°`],
        slips: slips(x, [[Math.abs(a - b), 'subtract', SAY.subtract], [360 - a - b, 'full', SAY.fullTri], [180 - a, 'one', SAY.one], [180 - b, 'one', SAY.one]]), desc: `Triangle: ${a}°, ${b}°, x` };
    },
    triSq(r) {
      const a = until(() => ang(r, 28, 62), a => a !== 45);
      const x = 90 - a, order = shuffle(r, [0, 1, 2]), angles = [], corners = [];
      [[90, 'sq'], [a, 'k0'], [x, 'x']].forEach(([v, c], i) => { angles[order[i]] = v; corners[order[i]] = c === 'sq' ? { square: true, cls: 'sq', key: 'k' } : { label: c === 'x' ? 'x' : v + '°', cls: c, key: c === 'x' ? 'x' : 'k' }; });
      return { topic: 'tri', total: 180, answer: x, spec: { type: 'tri', angles, corners, rot: pick(r, [0, 0, 180, 90]), flip: r() < 0.5 }, ring: { total: 180, pieces: [90, a], n: 1 },
        help: ['A triangle’s angles make 180°.', 'The little square is 90°.', `Take 90 and ${a} from 180.`], steps: [`90 + ${a} = ${90 + a}`, `180 − ${90 + a} = ${x}°`],
        slips: slips(x, [[180 - a, 'square', SAY.square], [270 - a, 'full', SAY.fullTri]]), desc: `Right-angled triangle: ${a}°, x` };
    },
    isoApex(r) {
      const a = until(() => 2 * int(r, 16, 60), a => a !== 60 && a !== 90);
      const x = (180 - a) / 2, at = int(r, 0, 1), corners = [null, null, { label: a + '°', cls: 'k0', key: 'k' }];
      corners[at] = { label: 'x', cls: 'x', key: 'x' };
      return { topic: 'tri', total: 180, answer: x, spec: { type: 'tri', angles: [x, x, a], corners, equal: [[0, 2], [1, 2]], rot: pick(r, [0, 0, 180]), flip: false }, ring: { total: 180, pieces: [a], n: 2 },
        help: ['Two of the angles are equal.', `Take ${a} from 180.`, 'Halve what is left.'], steps: [`180 − ${a} = ${180 - a}`, `${180 - a} ÷ 2 = ${x}°`],
        slips: slips(x, [[180 - a, 'share', SAY.shareIso], [a, 'same', SAY.sameIso], [180 - 2 * a, 'twin', SAY.sameIso]]), desc: `Isosceles triangle: ${a}° between the equal sides, x` };
    },
    isoBase(r) {
      const a = until(() => ang(r, 32, 76), a => a !== 60 && a !== 45);
      const x = 180 - 2 * a, at = int(r, 0, 1), corners = [null, null, { label: 'x', cls: 'x', key: 'x' }];
      corners[at] = { label: a + '°', cls: 'k0', key: 'k' };
      return { topic: 'tri', total: 180, answer: x, spec: { type: 'tri', angles: [a, a, x], corners, equal: [[0, 2], [1, 2]], rot: pick(r, [0, 0, 180]), flip: false }, ring: { total: 180, pieces: [a, a], n: 1 },
        help: ['Two of the angles are equal.', `The matching angle is ${a}° too.`, `Take ${a} and ${a} from 180.`], steps: [`${a} + ${a} = ${2 * a}`, `180 − ${2 * a} = ${x}°`],
        slips: slips(x, [[180 - a, 'twin', SAY.twinIso], [a, 'same', SAY.sameIso], [(180 - a) / 2, 'twin', SAY.twinIso]]), desc: `Isosceles triangle: one equal angle ${a}°, x between the equal sides` };
    },
    triExt(r) {
      const [a, c] = until(() => [ang(r, 30, 95), ang(r, 30, 95)], ([a, c]) => { const b = 180 - a - c; return a !== c && b >= 32 && b !== 90 && a + c !== 90 && b !== a && b !== c; });
      const b = 180 - a - c, x = a + c;
      return { topic: 'tri', total: 180, answer: x, spec: { type: 'tri', angles: [a, b, c], corners: [{ label: a + '°', cls: 'k0', key: 'k' }, null, { label: c + '°', cls: 'k1', key: 'k' }], ext: { at: 1, from: 0, label: 'x', cls: 'x', key: 'x' }, rot: pick(r, [0, 0, 180]), flip: r() < 0.5 },
        ring: { total: 180, pieces: [b], n: 1, note: 'the inside angle' },
        help: ['Find the inside angle beside x.', 'It makes a straight line with x.', 'Take the inside angle from 180.'], steps: [`${a} + ${c} = ${a + c}`, `180 − ${a + c} = ${b}`, `180 − ${b} = ${x}°`],
        slips: slips(x, [[b, 'inside', SAY.inside], [360 - a - c, 'full', SAY.fullTri], [Math.abs(a - c), 'subtract', SAY.subtract]]), desc: `Triangle: ${a}°, ${c}°, x outside` };
    },
    parOne(r) { return par(r, 1); },
    parTwo(r) { return par(r, 2); },
  };

  /* ---- parallel lines: only two sizes of angle ---- */
  function par(r, nB) {
    const a = pick(r, [0, 0, 8, -8]);
    const d = until(() => nB === 1 ? ang(r, 40, 140) : ang(r, 52, 128), d => d < 78 || d > 102);
    const size = q => q % 2 ? 180 - d : d;
    let ck, cx, qk = int(r, 0, 3), qx = int(r, 0, 3);
    if (nB === 1) { ck = int(r, 0, 1); cx = r() < 0.7 ? 1 - ck : ck; }
    else { const i = int(r, 0, 1), j = int(r, 0, 1); ck = i * 2 + j; cx = r() < 0.6 ? (1 - i) * 2 + (1 - j) : r() < 0.5 ? (1 - i) * 2 + j : i * 2 + (1 - j); }
    if (cx === ck && qx === qk) qx = (qk + 1 + int(r, 0, 2)) % 4;
    const k = size(qk), x = size(qx), same = x === k;
    const spec = { type: 'par', a, b: a + d, nB, arcs: [{ cross: ck, q: qk, value: k, label: k + '°', cls: 'k0', key: 'k' }, { cross: cx, q: qx, value: x, label: 'x', cls: 'x', key: 'x' }] };
    const reveal = { type: 'par', a, b: a + d, nB, arcs: [] };
    for (let c = 0; c < 2 * nB; c++) for (let q = 0; q < 4; q++) {
      const here = (c === ck && q === qk) || (c === cx && q === qx);
      reveal.arcs.push({ cross: c, q, value: size(q), label: here ? size(q) + '°' : '', cls: size(q) === k ? 'k0' : 'k1', key: c === cx && q === qx ? 'x' : 'k' });
    }
    const small = Math.min(k, 180 - k), kIs = k === small ? 'small' : 'big', xIs = x === small ? 'small' : 'big';
    return { topic: 'par', total: null, answer: x, spec, reveal, ring: same ? null : { total: 180, pieces: [k], n: 1 },
      choice: { ask: `${k}° is the ${kIs} size. Which size is x?`, options: [{ label: 'Small', right: xIs === 'small' }, { label: 'Big', right: xIs === 'big' }] },
      help: ['There are only two sizes of angle.', `Is x the same size as ${k}°?`, `If not, take ${k} from 180.`],
      steps: same ? [`x is the ${xIs} size, the same as ${k}°.`, `x = ${x}°`] : [`x is the ${xIs} size, so not ${k}°.`, `180 − ${k} = ${x}°`],
      slips: slips(x, [[180 - x, same ? 'twin' : 'other', same ? SAY.twinPar : SAY.otherPar], [360 - k, 'full', SAY.fullLine]]),
      desc: `${nB === 1 ? 'Parallel lines, one crossing line' : 'Two pairs of parallel lines'}: ${k}°, x` };
  }

  function make(kind, seed) {
    const q = MAKE[kind](rng(seed * 7919 + kind.length * 104729 + kind.charCodeAt(0) * 31 + kind.charCodeAt(kind.length - 1)));
    q.kind = kind; q.seed = seed;
    if (!q.choice) q.choice = CHOICE_TOTAL(q.total);
    return q;
  }
  function judge(q, given) {
    if (given === q.answer) return { right: true, slip: '', say: '' };
    const s = q.slips.find(s => s.value === given);
    if (s) return { right: false, slip: s.tag, say: s.say };
    const diff = Math.abs(given - q.answer);
    if (diff <= 10 || (diff % 10 === 0 && diff <= 100)) return { right: false, slip: 'near', say: 'So close. Check your adding and taking away.' };
    return { right: false, slip: '', say: 'Not this time. Here is the working.' };
  }

  const LESSONS = [
    { id: '1', topic: 'line', title: 'Angles on a straight line', sum: 'They always make 180°', tryKinds: ['line2', 'line3', 'lineEq'], quiz: [['line2'], ['line3'], ['lineSq'], ['lineEq'], ['line3', 'lineSq', 'lineEq']] },
    { id: '2', topic: 'point', title: 'Angles around a point', sum: 'They always make 360°', tryKinds: ['pt2', 'ptSq', 'ptEq'], quiz: [['pt1'], ['ptSq'], ['lineSq', 'line3'], ['ptEq'], ['pt2', 'ptSq']] },
    { id: '3', topic: 'tri', title: 'Angles in a triangle', sum: 'They always make 180°', tryKinds: ['tri2', 'isoApex', 'triExt'], quiz: [['tri2'], ['triSq'], ['isoApex'], ['isoBase'], ['triExt']] },
    { id: '4', topic: 'par', title: 'Angles and parallel lines', sum: 'Only two sizes of angle', tryKinds: ['parOne', 'parTwo', 'parTwo'], quiz: [['parOne'], ['parOne'], ['parTwo'], ['parTwo'], ['parTwo']] },
    { id: 'mixed', topic: 'mixed', title: 'Mixed quiz', sum: 'A bit of everything', tryKinds: [], quiz: [['lineSq'], ['lineEq'], ['line3'], ['ptSq'], ['ptEq'], ['pt2', 'pt1'], ['tri2'], ['isoApex', 'isoBase'], ['triExt', 'triSq'], ['parOne'], ['parTwo'], ['parTwo']] },
  ];
  const lesson = id => LESSONS.find(l => l.id === String(id));

  // The questions for one sitting. mode 'try' = the guided three, 'quiz' = the scored set.
  function set(lessonId, mode, seed) {
    const L = lesson(lessonId), r = rng(seed * 2654435761 + 17);
    let kinds = mode === 'try' ? L.tryKinds.slice() : L.quiz.map(opts => pick(r, opts));
    if (mode === 'quiz' && L.id === 'mixed') kinds = shuffle(r, kinds);
    else if (mode === 'quiz') kinds = [kinds[0]].concat(shuffle(r, kinds.slice(1)));
    const out = [], used = {};
    kinds.forEach((k, i) => {
      let q;
      for (let t = 0; t < 40; t++) { q = make(k, int(r, 1, 1e9)); if (!used[k + ':' + q.answer]) break; }
      used[k + ':' + q.answer] = 1; q.n = i + 1; out.push(q);
    });
    return out;
  }
  function stars(score, total) { const p = score / total; return p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0; }

  return { make, judge, set, stars, lesson, LESSONS, KINDS: Object.keys(MAKE), rng };
});
