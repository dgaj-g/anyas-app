/* Minus numbers: the sums and the two cheats. Runs in the browser (window.Minus) and in Node (the G1 gate).
   Cheat 1, signs that touch: two signs side by side become ONE sign. Same signs make a plus. Different signs make a minus.
   Cheat 2, same or different: look at the sign of each number. Same signs: add. Different signs: take away.
   Bigger wins the sign.
   make(kind, seed) -> { topic, kind, seed, text, toks, touch, tidy, tidyToks, tidyAnswer, terms, same, big, small, bigNeg, between,
                         answer, beats, help, helpTidy, slips, desc }
   judge(q, given) -> { right, slip, say }      given is a whole number, it may be below zero
   judgeTidy(q, given) -> { right, slip, say }  given is 'plus', 'minus' or 'none'
   Checked by tools/gates/g1-minus.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Minus = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const M = '−';
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
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const num = v => v < 0 ? M + (-v) : String(v);
  const word = neg => neg ? 'minus' : 'plus';

  /* s1: the sign of the first number. op: the sign between. s2: a sign of its own on the second number (it touches op).
     need: which number must be the bigger one. "up" = the answer is above zero, "down" = below zero. */
  const A_BIG = (a, b) => a > b, B_BIG = (a, b) => b > a;
  const FORMS = {
    'neg-minus':          { s1: -1, op: M,   s2: 1 },                  // −4 − 5
    'neg-plus-up':        { s1: -1, op: '+', s2: 1,  need: B_BIG },    // −3 + 7
    'neg-plus-down':      { s1: -1, op: '+', s2: 1,  need: A_BIG },    // −8 + 2
    'pos-minus':          { s1: 1,  op: M,   s2: 1,  need: B_BIG },    // 4 − 6
    'plain-minus':        { s1: 1,  op: M,   s2: 1,  need: A_BIG },    // 7 − 3   (only as a "no signs touch" case)
    'pos-plus-neg-up':    { s1: 1,  op: '+', s2: -1, need: A_BIG },    // 8 + −3
    'pos-plus-neg-down':  { s1: 1,  op: '+', s2: -1, need: B_BIG },    // 4 + −6
    'pos-minus-neg':      { s1: 1,  op: M,   s2: -1 },                 // 3 − −5
    'neg-plus-neg':       { s1: -1, op: '+', s2: -1 },                 // −3 + −5
    'neg-minus-neg-up':   { s1: -1, op: M,   s2: -1, need: B_BIG },    // −5 − −7
    'neg-minus-neg-down': { s1: -1, op: M,   s2: -1, need: A_BIG },    // −7 − −2
  };

  /* The same few words every time: on the cheats card, in the help, in the working and in the reason for a slip. */
  const SAY = {
    none: 'No signs touch. Nothing changes.',
    mm: 'Two minus signs touch. Same signs make a plus.',
    pm: 'A plus touches a minus. Different signs make a minus.',
    same: w => `Both numbers are ${w}. Same signs: add.`,
    diff: firstNeg => `${firstNeg ? 'One minus, one plus' : 'One plus, one minus'}. Different signs: take away.`,
    big: (n, w) => `Bigger wins the sign. The ${n} is ${w}.`,
    cover: 'Cover the signs to see which is bigger.',                    // what "bigger" means: 9 beats 7 whatever signs they wear
    coverAsk: (a, b) => `Cover the signs. Which is bigger: ${a} or ${b}?`,
  };

  function build(kind, a, b) {
    const F = FORMS[kind], neg1 = F.s1 < 0, own = F.s2 < 0;
    const v1 = F.s1 * a, v2 = (F.op === '+' ? 1 : -1) * F.s2 * b, answer = v1 + v2, neg2 = v2 < 0;
    const text = `${neg1 ? M : ''}${a} ${F.op} ${own ? M : ''}${b}`;
    const tidy = `${neg1 ? M : ''}${a} ${neg2 ? M : '+'} ${b}`;
    const touch = own ? { signs: [F.op, M], makes: neg2 ? M : '+' } : null;
    const toks = [];
    if (neg1) toks.push({ k: 'sign', v: M, role: 'lead' });
    toks.push({ k: 'num', v: a, role: 'a' }, { k: 'sign', v: F.op, role: 'op', pair: own });
    if (own) toks.push({ k: 'sign', v: M, role: 'own', pair: true });
    toks.push({ k: 'num', v: b, role: 'b' });
    const tidyToks = [];
    if (neg1) tidyToks.push({ k: 'sign', v: M, role: 'lead' });
    tidyToks.push({ k: 'num', v: a, role: 'a' }, { k: 'sign', v: neg2 ? M : '+', role: 'op', made: own }, { k: 'num', v: b, role: 'b' });
    const same = neg1 === neg2, big = Math.max(a, b), small = Math.min(a, b), bigNeg = a > b ? neg1 : neg2;

    const beats = [
      { say: touch ? (touch.makes === '+' ? SAY.mm : SAY.pm) : SAY.none, sum: tidy },
      { say: same ? SAY.same(word(neg1)) : SAY.diff(neg1), sum: same ? `${a} + ${b} = ${a + b}` : `${big} ${M} ${small} = ${big - small}` },
      { say: SAY.big(big, word(bigNeg)), sum: `${text} = ${num(answer)}` },
    ];
    // Stuck? Show me: the same three steps, every sum set out with her numbers, the last sum left for her.
    const help = [
      { say: beats[0].say, sums: touch ? [`${text} → ${tidy}`] : [] },      // the two signs that touch stay on screen beside what they become
      { say: beats[1].say, sums: [beats[1].sum.replace(/= \d+$/, '= ?')] },
      { say: beats[2].say, sums: [] },
    ];
    // Lesson 1 only asks what the touching signs make. Its help points at the signs; the last step is still hers.
    const between = !touch && neg1 ? a : null;
    const helpTidy = touch
      ? [{ say: 'These two signs sit side by side. They touch.', mark: 'pair' }, { say: 'Same signs make a plus. Different signs make a minus.' }]
      : between ? [{ say: `The ${a} sits between these two signs.`, mark: 'apart' }, { say: 'Signs only change when they touch.' }]
        : [{ say: 'There is only one sign here.', mark: 'one' }, { say: 'Signs only change when two of them touch.' }];

    const list = [];
    if (touch) list.push([v1 - v2, 'notTidied', (touch.makes === '+' ? 'Two minus signs touch. Same signs make a plus' : 'A plus touches a minus. Different signs make a minus') + `: ${tidy}.`]);
    if (kind === 'neg-minus') list.push([a + b, 'twoMinus', `Those minus signs do not touch. The ${a} sits between them.`]);
    list.push([-answer, 'sign', `Right number, wrong sign. Bigger wins the sign: the ${big} is ${word(bigNeg)}.`]);
    if (same) [a - b, b - a].forEach(v => list.push([v, 'tookAway', SAY.same(word(neg1))]));
    else [a + b, -(a + b)].forEach(v => list.push([v, 'added', SAY.diff(neg1)]));
    const slips = [], seen = {};
    list.forEach(([value, tag, say]) => { if (value === answer || seen[value]) return; seen[value] = 1; slips.push({ value, tag, say }); });

    const desc = `${neg1 ? 'minus ' : ''}${a} ${F.op === '+' ? 'plus' : 'take away'} ${own ? 'minus ' : ''}${b}`;
    return { topic: 'minus', kind, text, toks, touch, tidy, tidyToks, tidyAnswer: touch ? (touch.makes === '+' ? 'plus' : 'minus') : 'none',
      terms: [{ neg: neg1, n: a }, { neg: neg2, n: b }], same, big, small, bigNeg, between, answer, beats, help, helpTidy, slips, desc };
  }

  function make(kind, seed) {
    const F = FORMS[kind]; if (!F) throw new Error('no kind ' + kind);
    const r = rng(seed * 7919 + kind.length * 104729 + kind.charCodeAt(0) * 31 + kind.charCodeAt(kind.length - 1) * 17 + kind.charCodeAt(4));
    let a, b;
    for (let t = 0; t < 500; t++) { a = int(r, 1, 9); b = int(r, 1, 9); if (a !== b && (!F.need || F.need(a, b))) break; }
    const q = build(kind, a, b); q.seed = seed;
    return q;
  }

  function judge(q, given) {
    if (given === q.answer) return { right: true, slip: '', say: '' };
    const s = q.slips.find(s => s.value === given);
    if (s) return { right: false, slip: s.tag, say: s.say };
    if (Math.abs(given - q.answer) === 1) return { right: false, slip: 'near', say: 'So close. Check your adding and taking away.' };
    return { right: false, slip: '', say: 'Not this time. Here is the working.' };
  }
  function judgeTidy(q, given) {
    const want = q.tidyAnswer;
    if (given === want) return { right: true, slip: '', say: '' };
    if (want === 'none') return q.between
      ? { right: false, slip: 'notTouching', say: `Those signs do not touch. The ${q.between} sits between them.` }
      : { right: false, slip: 'oneSign', say: 'There is only one sign here. Nothing touches it.' };
    if (given === 'none') return { right: false, slip: 'missedTouch', say: 'Look again. Two signs sit side by side.' };
    return want === 'plus' ? { right: false, slip: 'twins', say: 'Both signs are minus. Same signs make a plus.' }
      : { right: false, slip: 'oddPair', say: 'One plus, one minus. Different signs make a minus.' };
  }

  /* Lesson ids start with m so the score sheet keeps them apart from the angle lessons. `sum` is the line under the title. */
  const LESSONS = [
    { id: 'm1', num: '1', mode: 'tidy', title: 'Signs that touch', sum: 'Two signs side by side become one', stages: ['see', 'try', 'quiz'], warm: [[0], [1]],
      see: ['neg-minus-neg-up', 'pos-plus-neg-down', 'neg-minus', 'pos-minus-neg', 'neg-plus-neg'],
      try: [['neg-minus-neg-up', 'neg-minus-neg-down'], ['pos-plus-neg-up', 'pos-plus-neg-down'], ['neg-minus'], ['neg-plus-neg', 'pos-minus-neg'], ['pos-minus', 'neg-plus-up']],
      quiz: [['neg-minus-neg-up', 'neg-minus-neg-down'], ['pos-plus-neg-up', 'pos-plus-neg-down'], ['neg-minus'], ['pos-minus-neg'], ['neg-plus-neg'], ['neg-plus-down', 'pos-minus', 'plain-minus']] },
    { id: 'm2', num: '2', mode: 'sum', title: 'Same or different?', sum: 'Add or take away, then pick the sign', stages: ['see', 'try', 'quiz'], warm: [[2, 3], [4, 5]],
      see: ['neg-minus', 'pos-minus', 'neg-plus-up', 'neg-plus-down'],
      try: [['neg-minus'], ['pos-minus'], ['neg-plus-up'], ['neg-plus-down']],
      quiz: [['neg-minus'], ['pos-minus'], ['neg-plus-up'], ['neg-plus-down'], ['neg-minus'], ['pos-minus', 'neg-plus-up', 'neg-plus-down']] },
    { id: 'm3', num: '3', mode: 'sum', title: 'Both cheats', sum: 'Tidy the signs, then work it out', stages: ['try', 'quiz'], warm: [[0, 1], [2, 3, 4, 5]],
      try: [['neg-minus-neg-up'], ['pos-plus-neg-down'], ['neg-plus-neg'], ['pos-minus-neg']],
      quiz: [['pos-plus-neg-down'], ['neg-minus-neg-up'], ['pos-minus-neg'], ['neg-plus-neg'], ['neg-minus-neg-down', 'pos-plus-neg-up'], ['neg-minus']] },
    { id: 'mmix', num: '★', mode: 'sum', title: 'Mixed quiz', sum: 'Every kind of sum', stages: ['quiz'], warm: [[0, 1], [2, 3, 4, 5]],
      quiz: [['neg-minus'], ['neg-plus-up', 'neg-plus-down'], ['pos-minus'], ['pos-plus-neg-down', 'pos-plus-neg-up'], ['pos-minus-neg'], ['neg-plus-neg'],
        ['neg-minus-neg-up', 'neg-minus-neg-down'], ['neg-minus', 'neg-plus-down', 'pos-plus-neg-down']] },
  ];
  const lesson = id => LESSONS.find(l => l.id === String(id));

  // The sums for one sitting. mode: 'see', 'try' or 'quiz'. No sum comes up twice.
  function set(lessonId, mode, seed) {
    const L = lesson(lessonId), r = rng(seed * 2654435761 + 29);
    let kinds = mode === 'see' ? L.see.slice() : (mode === 'try' ? L.try : L.quiz).map(o => pick(r, o));
    if (mode === 'quiz') kinds = L.id === 'mmix' ? shuffle(r, kinds) : [kinds[0]].concat(shuffle(r, kinds.slice(1)));
    const out = [], used = {};
    kinds.forEach((k, i) => {
      let q;
      for (let t = 0; t < 80; t++) { q = make(k, int(r, 1, 1e9)); if (!used[q.text]) break; }
      used[q.text] = 1; q.n = i + 1; out.push(q);
    });
    return out;
  }

  /* Two quick taps before every quiz: she says the cheat before she uses it. Not scored. */
  const WARM = [
    { ask: 'Two minus signs touch. What do they make?', right: 'A plus', wrong: 'A minus', why: 'Same signs make a plus.' },
    { ask: 'A plus touches a minus. What do they make?', right: 'A minus', wrong: 'A plus', why: 'Different signs make a minus.' },
    { ask: 'Both numbers have the same sign. What do you do?', right: 'Add', wrong: 'Take away', why: 'Same signs: add.' },
    { ask: 'The two numbers have different signs. What do you do?', right: 'Take away', wrong: 'Add', why: 'Different signs: take away.' },
    { ask: 'Cover the signs. Whose sign does the answer get?', right: 'The bigger number’s', wrong: 'The first number’s', why: 'Bigger wins the sign.' },
    { ask: 'How do you see which number is bigger?', right: 'Cover the signs', wrong: 'Pick the first number', why: SAY.cover },
  ];
  function warm(lessonId, seed) {
    const L = lesson(lessonId), r = rng(seed * 40503 + 7);
    return L.warm.map(opts => { const w = WARM[pick(r, opts)];
      return { ask: w.ask, why: w.why, options: shuffle(r, [{ label: w.right, right: true }, { label: w.wrong, right: false }]) }; });
  }
  function stars(score, total) { const p = score / total; return p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0; }

  return { make, build, judge, judgeTidy, set, warm, stars, lesson, LESSONS, WARM, SAY, KINDS: Object.keys(FORMS), num, M, rng };
});
