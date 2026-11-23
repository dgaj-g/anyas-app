/* Times and divide with minus numbers: the sums, the steps and the cheats. Runs in the browser (window.Times) and in Node (the gate).
   Signs first, then the numbers:  Same signs make a plus. Different signs make a minus.  Cover the signs. Times the numbers.
   Three numbers:  Pair up the minus signs. A pair makes a plus. One left over makes a minus.
   A missing number in a times or divide sum:  The answer is minus, so the signs are different. Cover the signs. Find the number.
   A missing number in an add sum:  Change side, change sign.
   Every question carries its own steps as data, so the gate can read every word and every sum and the player only draws them:
     q = { topic, fam, kind, text, toks, answer, full, fullToks, desc, job, see, fin, try, beats, help, slips }
     a step is  { type: 'pick' | 'tap' | 'pad', job, ..., hp (Stuck? Show me for this step), then (what the picture does next) }
     a "then" is { say, srow: { signs, made, pairs }, line (new tokens), hop, dsum, cover, mark, full }
   judge(q, given) -> { right, slip, say }
   Checked by tools/gates/g1-times.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./minus.js'));
  else root.Times = factory(root.Minus);
})(typeof self !== 'undefined' ? self : this, function (Minus) {
  const M = '−', X = '×', D = '÷', BOX = '□';
  const rng = Minus.rng, num = Minus.num;
  const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const word = neg => neg ? 'minus' : 'plus';
  const sg = v => v < 0 ? -1 : 1;
  const signed = v => (v < 0 ? M : '+') + Math.abs(v);          // a number wearing its sign: +5 or −5
  const low = s => /^[A-Z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

  /* The same few words every time: on the cheats card, in the help, in the working and in the reason for a slip. */
  const SAY = {
    same: 'Same signs make a plus.',
    diff: 'Different signs make a minus.',
    rule: 'Same signs make a plus. Different signs make a minus.',
    coverT: 'Cover the signs. Times the numbers.',
    coverD: 'Cover the signs. Divide the numbers.',
    noSign: 'A number with no sign is a plus number.',
    brackets: 'Brackets hold a number and its sign.',
    bothMinus: 'Both numbers are minus.',
    zero: 'Anything times 0 is 0.',
    pair: 'Pair up the minus signs. A pair makes a plus.',
    left: 'One left over makes a minus.',
    noLeft: 'No minus sign is left over. The answer is plus.',
    little: 'The little 2 means times by itself.',
    boxDiff: 'The answer is minus, so the signs are different.',
    boxSame: 'The answer is plus, so the signs are the same.',
    find: 'Cover the signs. Find the number.',
    change: 'Change side, change sign.',
    first: 'Do the brackets first.',
    tell: 'No × or ÷? Add or take away.',
    putMinus: 'Put the minus on the number.',
    noNeed: 'A plus answer needs no sign.',
    boxNoNeed: 'The box is plus, so it needs no sign.',   // in a box sum "the answer" is the number after the equals
  };
  const tail = s => s < 0 ? SAY.putMinus : SAY.noNeed;

  /* The sum as a row of pieces. num: a number (br = it sits in brackets, plus = show its + sign). op: × ÷ + −. */
  const N = (v, o) => Object.assign({ k: 'num', v }, o);
  const O = (v, o) => Object.assign({ k: 'op', v }, o);
  const E = () => ({ k: 'eq' }), B = () => ({ k: 'box' });
  function spell(toks) {
    return toks.map(t => t.k === 'num' ? (t.br ? '(' + (t.plus && t.v > 0 ? '+' : '') + num(t.v) + ')' : num(t.v))
      : t.k === 'op' ? ' ' + t.v + ' ' : t.k === 'eq' ? ' = ' : t.k === 'box' ? BOX : t.k === 'sq' ? '²' : t.k === 'lb' ? '(' : ')').join('');
  }
  const OPWORD = { '×': 'times', '÷': 'divided by', '+': 'plus', '−': 'take away' };
  function speak(toks) {
    return toks.map(t => t.k === 'num' ? (t.v < 0 ? 'minus ' : t.plus && t.v > 0 ? 'plus ' : '') + Math.abs(t.v) + (t.br ? ' in brackets' : '')
      : t.k === 'op' ? OPWORD[t.v] : t.k === 'eq' ? 'equals' : t.k === 'box' ? 'box' : t.k === 'sq' ? 'squared' : t.k === 'lb' ? 'open bracket' : 'close bracket').join(' ');
  }

  function base(fam, toks, answer) {
    const boxed = toks.some(t => t.k === 'box');
    const fullToks = boxed ? toks.map(t => t.k === 'box' ? N(answer, { fill: true }) : t) : toks.concat([E(), N(answer, { fill: true })]);
    return { topic: 'times', fam, kind: fam, toks, text: spell(toks), answer, fullToks, full: spell(fullToks), desc: speak(toks),
      job: boxed ? 'Find the number in the box.' : 'Work out the answer.' };
  }
  function slipList(answer, list) {
    const out = [], seen = {};
    list.forEach(([value, tag, say]) => { if (value === answer || seen[value] || !Number.isInteger(value)) return; seen[value] = 1; out.push({ value, tag, say }); });
    return out;
  }

  /* The steps she taps through. Same and Different, Plus and Minus keep their places; word options are shuffled by the player. */
  const TEAM_JOB = 'Are the two signs the same or different?', SIGN_JOB = 'Which sign does the answer get?', BOX_JOB = 'Which sign does the box get?';
  const pickTeam = (same, wrong, hp, then, job) => ({ type: 'pick', look: 'team', job: job || TEAM_JOB, opts: [{ v: 'same', label: 'Same' }, { v: 'diff', label: 'Different' }],
    answer: same ? 'same' : 'diff', wrong: { [same ? 'diff' : 'same']: wrong }, hp, then });
  const pickSign = (job, s, wrong, hp, then) => ({ type: 'pick', look: 'sign', job, opts: [{ v: 'plus', label: 'Plus' }, { v: 'minus', label: 'Minus' }],
    answer: s < 0 ? 'minus' : 'plus', wrong: { [s < 0 ? 'plus' : 'minus']: wrong }, hp, then });
  const pad = job => ({ type: 'pad', final: true, job });
  const padJob = (answer, boxed) => boxed ? (answer < 0 ? 'Now type the number in the box. Start with the minus.' : 'Now type the number in the box.')
    : answer < 0 ? 'Now type the whole answer. Start with the minus.' : 'Now type the answer.';
  // A number hops over the equals: the pick that says what it becomes.
  const CHANGE_HP = [{ say: SAY.change }, { say: 'A minus number becomes plus. A plus number becomes minus.' }];
  const becomes = (m, then) => ({ type: 'pick', look: 'chips', job: `The ${num(m)} changes side. What does it become?`,
    opts: [{ v: 'plus', label: '+' + Math.abs(m) }, { v: 'minus', label: M + Math.abs(m) }], answer: m < 0 ? 'plus' : 'minus',
    wrong: { [m < 0 ? 'minus' : 'plus']: 'Look again. ' + SAY.change }, hp: CHANGE_HP, then });

  /* Two numbers: −4 × 3, (−2) × (+6), 6 × 8, −12 ÷ 3. */
  function two(op, a, b, br) {
    const times = op === X, answer = times ? a * b : a / b, A = Math.abs(a), Bm = Math.abs(b), n = Math.abs(answer);
    const same = sg(a) === sg(b), made = same ? 1 : -1, signs = [sg(a), sg(b)];
    const o = br ? { br: true, plus: true } : {};
    const q = base(times ? 'times' : 'divide', [N(a, o), O(op), N(b, o)], answer);
    const rule = same ? SAY.same : SAY.diff, cover = times ? SAY.coverT : SAY.coverD, nums = `${A} ${op} ${Bm}`;
    const name = { say: br ? SAY.brackets : a < 0 && b < 0 ? SAY.bothMinus : SAY.noSign, show: `${signed(a)} and ${signed(b)}` };
    const teamWrong = 'Look again. ' + (same && a < 0 ? SAY.bothMinus : br ? 'One number is minus. One is plus.' : SAY.noSign);
    const shown = { say: rule, srow: { signs, made } };
    q.see = [
      pickTeam(same, teamWrong, [name], { say: same ? 'The signs are the same.' : 'The signs are different.', srow: { signs } }),
      pickSign(SIGN_JOB, made, 'Look again. ' + rule, [name, { say: SAY.rule }], shown),
    ];
    q.fin = [{ say: cover, dsum: `${nums} = ${n}`, cover: true }, { say: tail(made), full: true }];
    q.try = [pickSign(SIGN_JOB, made, `Look again. The signs are ${same ? 'the same' : 'different'}. ${rule}`, [name, { say: SAY.rule }], shown), pad(padJob(answer))];
    q.beats = [{ say: rule, srow: { signs, made } }, { say: cover, sum: `${nums} = ${n}` }];
    q.help = [name, { say: rule, srow: { signs, made } }, { say: cover, sums: [`${nums} = ?`] }];
    const list = [[-answer, 'sign', `Right number, wrong sign. ${rule}`]];
    if (times) {
      [a + b, A + Bm, -(A + Bm)].forEach(v => list.push([v, 'added', 'That is adding. This is a times sum.']));
      [A * (Bm + 1), A * (Bm - 1), (A + 1) * Bm, (A - 1) * Bm].forEach(v => v && list.push([made * v, 'tables', `The sign is right. Check ${nums} again.`]));
    } else [n + 1, n - 1].forEach(v => v && list.push([made * v, 'tables', `The sign is right. Check ${nums} again.`]));
    q.slips = slipList(answer, list);
    return q;
  }

  /* −7 × 0 */
  function zero(a, first) {
    const q = base('zero', first ? [N(0), O(X), N(a)] : [N(a), O(X), N(0)], 0);
    q.see = [{ type: 'pick', look: 'words', job: `What is ${q.text}?`, opts: [{ v: 'zero', label: '0' }, { v: 'num', label: num(a) }], answer: 'zero',
      wrong: { num: 'Look again. ' + SAY.zero }, hp: [{ say: SAY.zero }], then: { say: SAY.zero, full: true } }];
    q.fin = [];
    q.try = [pad('Type the answer.')];
    q.beats = [{ say: SAY.zero, sum: q.full }];
    q.help = [{ say: SAY.zero, sums: [`${q.text} = ?`] }];
    q.slips = slipList(0, [[a, 'zero', SAY.zero], [-a, 'zero', SAY.zero]]);
    return q;
  }

  /* Three numbers: −4 × −3 × −5. Count the minus signs: every pair makes a plus. */
  function three(a, b, c) {
    const v = [a, b, c], mag = v.map(Math.abs), k = v.filter(x => x < 0).length, answer = a * b * c, made = k % 2 ? -1 : 1;
    const p = mag[0] * mag[1], n = p * mag[2], minus = Array(k).fill(-1);
    const q = base('three', [N(a), O(X), N(b), O(X), N(c)], answer);
    const count = k === 1 ? 'One minus sign. It has no partner.' : k === 2 ? 'Two minus signs. They make a pair.' : 'Three minus signs. One pair, one left over.';
    const after = k === 2 ? 'A pair makes a plus. No minus is left over.' : SAY.left;
    const counted = { say: k === 1 ? 'Count the minus signs. There is one.' : SAY.pair, srow: { signs: minus, pairs: true } };
    const hp = [counted, { say: 'Is one left over? One left over makes a minus.' }];
    const shown = { say: after, srow: { signs: minus, pairs: true, made } };
    q.see = [
      { type: 'tap', job: 'Tap every minus sign.', all: true, right: [0, 2, 4].filter(i => q.toks[i].v < 0), hp: [{ say: 'A minus sign sits in front of its number.' }],
        then: { say: count, srow: { signs: minus, pairs: true } } },
      pickSign(SIGN_JOB, made, 'Look again. ' + (k === 2 ? 'A pair of minus signs makes a plus.' : SAY.left), hp, shown),
    ];
    q.fin = [{ say: SAY.coverT, dsum: `${mag[0]} × ${mag[1]} = ${p}`, cover: true }, { say: 'Then times by the last number.', dsum: `${p} × ${mag[2]} = ${n}` }, { say: tail(made), full: true }];
    q.try = [pickSign(SIGN_JOB, made, `Look again. Count the minus signs. ${k === 2 ? 'They make a pair.' : 'One is left over.'}`, hp, shown), pad(padJob(answer))];
    q.beats = [
      { say: k === 1 ? 'One minus sign. One left over makes a minus.' : k === 2 ? 'Two minus signs. A pair makes a plus.' : 'Three minus signs. One left over makes a minus.', srow: { signs: minus, pairs: true, made } },
      { say: SAY.coverT, sum: `${mag[0]} × ${mag[1]} = ${p}` },
      { say: 'Then times by the last number.', sum: `${p} × ${mag[2]} = ${n}` },
    ];
    q.help = [counted, { say: k === 2 ? SAY.noLeft : SAY.left, srow: { signs: minus, pairs: true, made } }, { say: SAY.coverT, sums: [`${mag[0]} × ${mag[1]} = ${p}`, `${p} × ${mag[2]} = ?`] }];
    const list = [[-answer, 'oddMinus', k === 1 ? 'One minus sign is left over. The answer is minus.' : k === 2 ? 'Two minus signs make a pair. A pair makes a plus.' : 'Three minus signs: one pair, and one left over.']];
    [p, mag[1] * mag[2], mag[0] * mag[2]].forEach(w => [w, -w].forEach(s => list.push([s, 'twoOnly', 'That is two of the numbers. Times all three.'])));
    q.slips = slipList(answer, list);
    return q;
  }

  /* (−3)² */
  function square(n) {
    const q = base('square', [N(-n, { br: true }), { k: 'sq' }], n * n), mean = `${M}${n} × ${M}${n}`, signs = [-1, -1];
    const what = { type: 'pick', look: 'words', job: `What does ${q.text} mean?`, opts: [{ v: 'self', label: mean }, { v: 'two', label: `${M}${n} × 2` }], answer: 'self',
      wrong: { two: 'Look again. ' + SAY.little }, hp: [{ say: SAY.little, sums: ['5² = 5 × 5'] }], then: { say: SAY.little, dsum: mean } };
    q.see = [what, pickSign(SIGN_JOB, 1, 'Look again. Both numbers are minus. ' + SAY.same, [{ say: SAY.bothMinus, show: `${M}${n} and ${M}${n}` }, { say: SAY.rule }], { say: SAY.same, srow: { signs, made: 1 } })];
    q.fin = [{ say: SAY.coverT, dsum: `${n} × ${n} = ${n * n}`, cover: true }, { say: SAY.noNeed, full: true }];
    q.try = [what, pad('Now type the answer.')];
    q.beats = [{ say: SAY.little, sum: `${q.text} = ${mean}` }, { say: SAY.same, srow: { signs, made: 1 } }, { say: SAY.coverT, sum: `${n} × ${n} = ${n * n}` }];
    q.help = [{ say: SAY.little, sums: [`${q.text} = ${mean}`] }, { say: SAY.same, srow: { signs, made: 1 } }, { say: SAY.coverT, sums: [`${n} × ${n} = ?`] }];
    q.slips = slipList(n * n, [[-n * n, 'squareMinus', `${mean} has the same signs. ${SAY.same}`],
      [2 * n, 'doubled', `The little 2 means ${mean}, not ${M}${n} × 2.`], [-2 * n, 'doubled', `The little 2 means ${mean}, not ${M}${n} × 2.`]]);
    return q;
  }

  /* A missing number in a times or divide sum. ta: □ × b = c   tb: a × □ = c   da: □ ÷ b = c   db: a ÷ □ = c */
  function box(form, known, c) {
    const times = form[0] === 't', boxFirst = form[1] === 'a', op = times ? X : D;
    const x = times ? c / known : boxFirst ? known * c : known / c, K = Math.abs(known), Cm = Math.abs(c), n = Math.abs(x), diff = c < 0;
    const q = base('box', boxFirst ? [B(), O(op), N(known, { id: 'k' }), E(), N(c, { id: 'c' })] : [N(known, { id: 'k' }), O(op), B(), E(), N(c, { id: 'c' })], x);
    const open = boxFirst ? [0, sg(known)] : [sg(known), 0], filled = boxFirst ? [sg(x), sg(known)] : [sg(known), sg(x)], made = sg(c);
    const why = diff ? SAY.boxDiff : SAY.boxSame, tell = `The ${K} is ${word(known < 0)}. The box is ${word(x < 0)}.`;
    const cov = v => boxFirst ? `${v} ${op} ${K} = ${Cm}` : `${K} ${op} ${v} = ${Cm}`;
    const ask = times ? (boxFirst ? `What times ${K} makes ${Cm}?` : `${K} times what makes ${Cm}?`) : boxFirst ? `What divided by ${K} makes ${Cm}?` : `${K} divided by what makes ${Cm}?`;
    const hp = [{ say: why, srow: { signs: open, made } }, { say: `The ${K} is ${word(known < 0)}. So what is the box?` }];
    q.see = [
      pickTeam(!diff, 'Look again. ' + why, [{ say: 'Look at the number after the equals.' }, { say: 'A minus answer: different signs. A plus answer: the same.' }],
        { say: why, mark: ['c'], srow: { signs: open, made } }, `Look at the answer. ${boxFirst ? `The box and the ${num(known)}` : `The ${num(known)} and the box`}: same signs or different?`),
      pickSign(BOX_JOB, sg(x), `Look again. The ${K} is ${word(known < 0)}. The signs are ${diff ? 'different' : 'the same'}.`, hp, { say: tell, srow: { signs: filled, made } }),
    ];
    q.fin = [{ say: SAY.find, dsum: cov('?'), cover: true }, { say: ask, dsum: cov(n) }, { say: x < 0 ? SAY.putMinus : SAY.boxNoNeed, full: true }];
    q.try = [pickSign(BOX_JOB, sg(x), 'Look again. ' + why, hp, { say: tell, mark: ['c'], srow: { signs: filled, made } }), pad(padJob(x, true))];
    q.beats = [{ say: why, srow: { signs: open, made } }, { say: tell, srow: { signs: filled, made } }, { say: SAY.find, sum: cov(n) }];
    q.help = [{ say: why, srow: { signs: open, made } }, { say: `The ${K} is ${word(known < 0)}. The box must be ${word(x < 0)}.`, srow: { signs: filled, made } }, { say: SAY.find, sums: times ? [cov('?')] : [cov('?'), boxFirst ? `${Cm} ${X} ${K} = ?` : `${K} ${D} ${Cm} = ?`] }];   // "? ÷ 11 = 7" or "55 ÷ ? = 5" alone does not show her how: the sum beside it does
    const list = [[-x, 'boxSign', 'Right number, wrong sign.']];
    const fw = times || !boxFirst ? [K * Cm] : (Cm % K === 0 ? [Cm / K] : []).concat(K % Cm === 0 ? [K / Cm] : []);
    fw.forEach(w => [w, -w].forEach(s => list.push([s, 'notUndone', `Ask: ${low(ask)}`])));
    q.slips = slipList(x, list);
    q.why = why; q.filled = filled;
    return q;
  }

  /* A missing number in an add sum. g: □ + (−5) = 13   q: □ + 5 = −3   m: □ − 5 = −8   h: −3 + □ = 4
     m is the number beside the box with its sign (in form m the 5 after the take-away sign is −5). It changes side and changes sign. */
  function boxAdd(form, m, c) {
    const x = c - m, land = -m, Mm = Math.abs(m), rest = `${num(c)} ${land > 0 ? '+' : M} ${Mm}`, same = sg(c) === sg(land);
    const toks = form === 'h' ? [N(m, { id: 'm' }), O('+', { id: 'j' }), B(), E(), N(c, { id: 'c' })]
      : form === 'm' ? [B(), O(M, { id: 'm' }), N(Mm, { id: 'm' }), E(), N(c, { id: 'c' })]
        : [B(), O('+', { id: 'j' }), N(m, form === 'g' ? { br: true, id: 'm' } : { id: 'm' }), E(), N(c, { id: 'c' })];
    const q = base('boxAdd', toks, x);
    const after = [B(), E(), N(c, { id: 'c' }), O(land > 0 ? '+' : M, { id: 'm' }), N(Mm, { id: 'm' })];
    const restSay = same ? `Both numbers are ${word(c < 0)}. Same signs: add.` : 'Different signs: take away. Bigger wins the sign.';
    const hop = becomes(m, { say: SAY.change, line: after, hop: 'm' });
    q.see = [
      { type: 'tap', job: 'Get the box alone. Tap the number that changes side.', right: ['m'], other: ['c'], wrong: 'Look again. Move the number on the same side as the box.',
        hp: [{ say: 'The box must be alone.' }, { say: 'Move the number on the same side as the box.' }], then: { say: `The ${num(m)} must change side.`, mark: ['m'] } },
      hop,
    ];
    q.fin = [{ say: restSay, dsum: `${rest} = ${num(x)}` }, { say: `The box is ${num(x)}.`, full: true }];
    q.try = [hop, pad(`Now work out ${rest}.`)];
    q.beats = [{ say: SAY.change, sum: `${BOX} = ${rest}` }, { say: restSay, sum: `${rest} = ${num(x)}` }];
    q.help = [{ say: `The box must be alone. Move the ${num(m)}.`, sums: [q.text] }, { say: SAY.change, sums: [`${BOX} = ${rest}`] }, { say: 'Now it is a sum you know.', sums: [`${rest} = ?`] }];
    const list = [[c + m, 'notFlipped', `${SAY.change} The ${num(m)} becomes ${signed(land)}.`],
      [-x, 'sign', same ? `Right number, wrong sign. Both numbers are ${word(c < 0)}.` : 'Right number, wrong sign. Bigger wins the sign.']];
    const C = Math.abs(c);
    if (same) [C - Mm, Mm - C].forEach(w => list.push([w, 'tookAway', restSay]));
    else [C + Mm, -(C + Mm)].forEach(w => list.push([w, 'added', 'Different signs: take away.']));
    q.slips = slipList(x, list);
    q.rest = rest;
    return q;
  }

  /* Brackets first. d: (−6 × −5) ÷ □ = 3   t: (−2 × 3) × □ = 24 */
  function boxBr(form, a, b, c) {
    const p = a * b, inner = box(form === 'd' ? 'db' : 'tb', p, c), prod = two(X, a, b, false);
    const q = base('boxBr', [{ k: 'lb' }, N(a), O(X), N(b), { k: 'rb' }, O(form === 'd' ? D : X), B(), E(), N(c, { id: 'c' })], inner.answer);
    q.try = [{ type: 'pad', job: `Do the brackets first. What is ${prod.text}?`, answer: p, slips: [{ value: -p, say: 'Look again. ' + (p > 0 ? SAY.same : SAY.diff) }],
      other: 'Look again. Check your tables.', hp: prod.help, then: { say: `The brackets make ${num(p)}.`, line: inner.toks } }].concat(inner.try);
    q.beats = [{ say: SAY.first, sum: prod.full }, { say: inner.why, srow: { signs: inner.filled, made: sg(c) } }, inner.beats[2]];
    q.help = [{ say: SAY.first, sums: [prod.full] }, { say: inner.why, sums: [inner.text] }, inner.help[2]];
    q.slips = inner.slips;
    return q;
  }

  /* Two steps: −2 + 5 × □ = 8. The 5 × □ stays together; the −2 changes side. */
  function box2(a, b, c) {
    const r = c - a, inner = box('tb', b, r), land = -a, A = Math.abs(a), rest = `${num(c)} ${land > 0 ? '+' : M} ${A}`;
    const q = base('box2', [N(a, { id: 'm' }), O('+', { id: 'j' }), N(b, { id: 'k' }), O(X), B(), E(), N(c, { id: 'c' })], inner.answer);
    const moved = [N(b, { id: 'k' }), O(X), B(), E(), N(c, { id: 'c' }), O(land > 0 ? '+' : M, { id: 'm' }), N(A, { id: 'm' })];
    q.try = [becomes(a, [{ say: SAY.change, line: moved, hop: 'm' }, { say: `The right side makes ${num(r)}.`, dsum: `${rest} = ${num(r)}`, line: inner.toks }])].concat(inner.try);
    q.beats = [{ say: SAY.change, sum: spell(moved) }, { say: 'Now do the sum on the right.', sum: `${rest} = ${num(r)}` }, { say: inner.why, srow: { signs: inner.filled, made: sg(r) } }, inner.beats[2]];
    q.help = [{ say: `${num(b)} × ${BOX} stays together. Move the ${num(a)}.`, sums: [q.text] }, { say: SAY.change, sums: [spell(moved), inner.text] }, { say: 'Now find the box. Signs first.', sums: inner.help[2].sums }];
    q.slips = slipList(q.answer, inner.slips.map(s => [s.value, s.tag, s.say]).concat([[(c + a) / b, 'notFlipped', `${SAY.change} The ${num(a)} becomes ${signed(land)}.`]]));
    return q;
  }

  /* An add or take-away sum from Minus numbers, for the mixed quiz: she has to tell the two cheats apart. Its row keeps topic "minus". */
  function addSum(kind, a, b) {
    const m = Minus.build(kind, a, b), op = m.toks.find(t => t.role === 'op').v;
    const toks = [N(m.terms[0].neg ? -a : a), O(op), N(m.touch ? -b : b)];
    const q = base('add', toks, m.answer);
    q.topic = 'minus'; q.rowKind = kind; q.src = m; q.desc = m.desc;
    q.beats = [{ say: SAY.tell, sum: m.text }].concat(m.touch ? m.beats : m.beats.slice(1));
    q.help = m.touch ? m.help : [{ say: SAY.tell, sums: [m.text] }, m.help[1], m.help[2]];
    q.slips = slipList(m.answer, m.slips.map(s => [s.value, s.tag, s.say]).concat([[a * b, 'timesed', SAY.tell], [-a * b, 'timesed', SAY.tell]]));
    return q;
  }

  /* One random sum of a kind. The codes: x times, d divide (then b for brackets, then the two signs), x0, 3a 3b 3c (one, two, three minus signs),
     sq, bta btb bda bdb (times and divide boxes), ag aq am ah (add boxes), kd kt (brackets first), 2s (two steps), add:<a Minus numbers kind>. */
  const hash = s => s.split('').reduce((h, ch, i) => h + ch.charCodeAt(0) * (31 + i * 7), s.length * 104729);
  const TWO = /^([xd])(b?)([+-])([+-])$/;
  function build(kind, r) {
    const t = TWO.exec(kind), s = () => pick(r, [1, -1]);
    if (t) {
      const s1 = t[3] === '-' ? -1 : 1, s2 = t[4] === '-' ? -1 : 1, K = int(r, 2, 12);
      if (t[1] === 'x') return two(X, s1 * K, s2 * int(r, 2, 12), !!t[2]);
      return two(D, s1 * K * pick(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 2, 3, 4, 5, 6, 7, 8, 9]), s2 * K, !!t[2]);
    }
    if (kind === 'x0') return zero(pick(r, [-1, -1, 1]) * int(r, 2, 12), r() < 0.3);
    if (/^3[abc]$/.test(kind)) {
      const k = ' abc'.indexOf(kind[1]), neg = shuffle(r, [0, 1, 2]).slice(0, k);
      for (let i = 0; i < 400; i++) {
        const v = [int(r, 2, 10), int(r, 2, 10), int(r, 2, 10)], p = v[0] * v[1];
        if (p * v[2] <= 150 && (v[2] <= 2 || p <= 12 || p % 10 === 0)) return three(...v.map((n, j) => neg.includes(j) ? -n : n));
      }
    }
    if (kind === 'sq') return square(pick(r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 20, 3, 4, 5, 6, 7, 8, 9]));
    if (/^b[td][ab]$/.test(kind)) {
      const form = kind.slice(1), sx = s(), sk = sx > 0 ? -1 : s(), u = int(r, 2, 12), w = int(r, 2, 12);      // never plus and plus
      if (form[0] === 't') return box(form, sk * u, sk * u * sx * w);                // u × w = c, the box is w
      if (form === 'da') return box(form, sk * u, sx * sk * w);                      // box ÷ u = w, the box is u × w
      return box(form, sk * u * w, sk * sx * w);                                     // (u × w) ÷ box = w, the box is u
    }
    if (/^a[gqmh]$/.test(kind)) {
      for (let i = 0; i < 400; i++) {
        const f = kind[1], n = int(r, 2, 9), m = f === 'q' ? n : f === 'h' ? s() * n : -n;
        const c = m > 0 ? pick(r, [int(r, 1, n - 1), -int(r, 1, 12)]) : f === 'm' ? -int(r, 1, 12) : pick(r, [1, 1, -1]) * int(r, 1, 15);
        if (c !== m && Math.abs(c - m) <= 24) return boxAdd(f, m, c);
      }
    }
    if (kind === 'kd' || kind === 'kt') {
      for (let i = 0; i < 400; i++) {
        const sa = s(), sb = sa > 0 ? -1 : s(), a = sa * int(r, 2, 6), b = sb * int(r, 2, 6), P = Math.abs(a * b), n = int(r, 2, 12), sx = s();
        if (kind === 'kd' ? P % n === 0 && P / n >= 2 : n <= 6 && P * n <= 144) return boxBr(kind[1], a, b, kind === 'kd' ? a * b / (sx * n) : a * b * sx * n);
      }
    }
    if (kind === '2s') {
      for (let i = 0; i < 400; i++) {
        const a = s() * int(r, 1, 9), b = int(r, 2, 6), x = s() * int(r, 2, 9), c = a + b * x;
        if (c !== 0 && Math.abs(c) <= 60 && (a < 0 || x < 0)) return box2(a, b, c);
      }
    }
    throw new Error('no kind ' + kind);
  }
  function make(kind, seed) {
    let q;
    if (kind.slice(0, 4) === 'add:') { const m = Minus.make(kind.slice(4), seed); q = addSum(m.kind, m.terms[0].n, m.terms[1].n); }
    else q = build(kind, rng(seed * 7919 + hash(kind)));
    q.kind = kind; q.seed = seed;
    return q;
  }

  function judge(q, given) {
    if (given === q.answer) return { right: true, slip: '', say: '' };
    const s = q.slips.find(s => s.value === given);
    if (s) return { right: false, slip: s.tag, say: s.say };
    if (q.src) return Minus.judge(q.src, given);
    if (q.answer && given && (given < 0) === (q.answer < 0)) return { right: false, slip: 'near', say: 'The sign is right. Check the number.' };
    return { right: false, slip: '', say: 'Not this time. Here is the working.' };
  }

  /* Lesson ids start with t so the score sheet keeps them apart from the other topics. `sum` is the line under the title. */
  const ADDS = ['add:neg-plus-up', 'add:pos-minus', 'add:neg-minus-neg-up', 'add:pos-plus-neg-down', 'add:neg-plus-neg'];
  const LESSONS = [
    { id: 't1', num: '1', title: 'Times', sum: 'Signs first, then the numbers', stages: ['see', 'try', 'quiz'], warm: [[0, 1], [2, 5]],
      see: ['x-+', 'x+-', 'x--', 'xb-+', 'x0'],
      try: [['x+-', 'x-+'], ['x--'], ['xb--', 'xb+-', 'xb-+'], ['x-+', 'x+-'], ['x0', 'x++']],
      quiz: [['x-+'], ['x+-'], ['x--'], ['x--'], ['xb-+', 'xb+-'], ['xb--'], ['x0'], ['x++'], ['x-+', 'x+-'], ['x--', 'x+-']] },
    { id: 't2', num: '2', title: 'Divide', sum: 'The same cheat as times', stages: ['see', 'try', 'quiz'], warm: [[3], [4]],
      see: ['d-+', 'd--', 'd+-', 'd--'],
      try: [['d-+'], ['d+-'], ['d--'], ['d-+', 'd+-'], ['d--']],
      quiz: [['d-+'], ['d+-'], ['d--'], ['d-+'], ['d--'], ['d+-'], ['d-+', 'd+-'], ['d--']] },
    { id: 't3', num: '3', title: 'Three numbers and squares', sum: 'Pair up the minus signs', stages: ['see', 'try', 'quiz'], warm: [[6, 7], [8]],
      see: ['3b', '3c', '3a', 'sq'],
      try: [['3b'], ['3c'], ['3a'], ['sq'], ['sq']],
      quiz: [['3b'], ['3a'], ['3c'], ['3b', '3c'], ['sq'], ['sq'], ['sq'], ['3a', '3c']] },
    { id: 't4', num: '4', title: 'Find the missing number', sum: 'Work out what is in the box', stages: ['see', 'try', 'quiz'], warm: [[9], [10]],
      see: ['bta', 'btb', 'bda', 'bdb'],
      try: [['bta'], ['btb'], ['bda'], ['bdb'], ['bta', 'btb']],
      quiz: [['bta'], ['btb'], ['bda'], ['bdb'], ['bta', 'btb'], ['bda', 'bdb'], ['btb'], ['bta']] },
    { id: 't5', num: '5', title: 'More missing numbers', sum: 'Change side, change sign', stages: ['see', 'try', 'quiz'], warm: [[11], [12, 9, 10]],
      see: ['ag', 'ah', 'aq', 'am'],
      try: [['ag'], ['ah'], ['aq', 'am'], ['kd'], ['2s']],
      quiz: [['ag'], ['ah'], ['aq'], ['am'], ['kd'], ['kt', 'kd'], ['2s'], ['ah', 'ag']] },
    { id: 'tmix', num: '★', title: 'Mixed quiz', sum: 'Every kind of sum', stages: ['quiz'], warm: [[0, 1, 3, 4, 6], [13, 14]],
      quiz: [['x-+', 'x+-'], ['x--'], ['xb--', 'xb-+'], ['d-+', 'd+-'], ['d--'], ['3b', '3c'], ['sq'], ['bta', 'btb'], ['bda', 'bdb'], ['ag', 'ah', 'kd', '2s'], ['add:neg-minus'], ADDS] },
  ];
  const lesson = id => LESSONS.find(l => l.id === String(id));

  // The sums for one sitting. mode: 'see', 'try' or 'quiz'. No sum comes up twice.
  function set(lessonId, mode, seed) {
    const L = lesson(lessonId), r = rng(seed * 2654435761 + 31);
    let kinds = mode === 'see' ? L.see.slice() : (mode === 'try' ? L.try : L.quiz).map(o => pick(r, o));
    if (mode === 'quiz') kinds = L.id === 'tmix' ? shuffle(r, kinds) : [kinds[0]].concat(shuffle(r, kinds.slice(1)));
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
    { ask: 'Times: two minus numbers. What sign is the answer?', right: 'Plus', wrong: 'Minus', why: SAY.same },
    { ask: 'Times: one minus number, one plus number. What sign is the answer?', right: 'Minus', wrong: 'Plus', why: SAY.diff },
    { ask: 'What do you look at first in a times sum?', right: 'The signs', wrong: 'The numbers', why: 'Signs first, then the numbers.' },
    { ask: 'Divide: two minus numbers. What sign is the answer?', right: 'Plus', wrong: 'Minus', why: SAY.same },
    { ask: 'Divide: one plus number, one minus number. What sign is the answer?', right: 'Minus', wrong: 'Plus', why: SAY.diff },
    { ask: 'A number has no sign in front. What is it?', right: 'A plus number', wrong: 'A minus number', why: SAY.noSign },
    { ask: 'A times sum has three minus signs. What sign is the answer?', right: 'Minus', wrong: 'Plus', why: 'A pair makes a plus. One is left over.' },
    { ask: 'A times sum has two minus signs. What sign is the answer?', right: 'Plus', wrong: 'Minus', why: 'A pair of minus signs makes a plus.' },
    { ask: 'What does the little 2 in (−5)² mean?', right: '−5 × −5', wrong: '−5 × 2', why: SAY.little },
    { ask: '□ × −3 = −12. The box and the −3: same signs or different?', right: 'Different', wrong: 'The same', why: SAY.boxDiff },
    { ask: '□ × −3 = 12. The box and the −3: same signs or different?', right: 'The same', wrong: 'Different', why: SAY.boxSame },
    { ask: 'A number changes side. What happens to its sign?', right: 'It changes', wrong: 'It stays the same', why: SAY.change },
    { ask: 'Which part of a sum do you do first?', right: 'The brackets', wrong: 'The last part', why: SAY.first },
    { ask: '−4 − 5 has no × or ÷. What do you do?', right: 'Add or take away', wrong: 'Times the numbers', why: SAY.tell },
    { ask: '−3 − 6: do the two minus signs make a plus?', right: 'No', wrong: 'Yes', why: 'They do not touch. There is no × or ÷.' },
  ];
  function warm(lessonId, seed) {
    const L = lesson(lessonId), r = rng(seed * 40503 + 11);
    return L.warm.map(opts => { const w = WARM[pick(r, opts)];
      return { ask: w.ask, why: w.why, options: shuffle(r, [{ label: w.right, right: true }, { label: w.wrong, right: false }]) }; });
  }
  function stars(score, total) { const p = score / total; return p >= 1 ? 3 : p >= 0.8 ? 2 : p >= 0.6 ? 1 : 0; }

  const KINDS = [];
  LESSONS.forEach(l => [l.see || [], [].concat(...(l.try || [])), [].concat(...l.quiz)].forEach(a => a.forEach(k => { if (!KINDS.includes(k)) KINDS.push(k); })));

  return { make, judge, set, warm, stars, lesson, LESSONS, WARM, SAY, KINDS, spell, speak, num, signed, M, X, D, BOX,
    two, zero, three, square, box, boxAdd, boxBr, box2, addSum };
});
