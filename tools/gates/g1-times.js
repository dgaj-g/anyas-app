/* G1 for Times and divide: every sum, step, word and slip. Run: node tools/gates/g1-times.js
   The gate never trusts the builder's own numbers. It reads each sum from its printed text, works the answer out again
   (for a box sum it tries every whole number), re-derives every tap answer from the signs it can see, proves every line
   on screen true, and checks that the words said about a sum are true of that sum. Then it builds every question on
   Anya's two class sheets, and last it plants faults that must all be caught. */
const T = require('../../js/times.js');
const Mn = require('../../js/minus.js');
const Q = require('../../js/questions.js');
const M = '−', X = '×', D = '÷', BOX = '□';
const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
const clone = o => JSON.parse(JSON.stringify(o));
const sg = v => v < 0 ? -1 : 1;
const numS = v => (v < 0 ? M : '') + Math.abs(v);
const signedS = v => (v < 0 ? M : '+') + Math.abs(v);
const int = s => parseInt(String(s).replace(M, '-').replace('+', ''), 10);
const SAID = new Set();

/* ---------- reading a printed sum ---------- */
const FN = new Map();
function compile(text) {
  if (FN.has(text)) return FN.get(text);
  const s = String(text).replace(/\(([^()]*)\)²/g, '(($1)*($1))').replace(/(\d+)²/g, '($1*$1)')
    .replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/[□?]/g, '(x)');
  let fn = null;
  if (/^[-+*/() \dx]+$/.test(s) && /[\dx]/.test(s)) { try { fn = Function('x', '"use strict"; return (' + s + ');'); } catch (e) { fn = null; } }
  FN.set(text, fn);
  return fn;
}
function value(text, x) { const fn = compile(text); if (!fn) return NaN; try { return fn(x); } catch (e) { return NaN; } }
// Is a printed line true? A box or a ? takes the value given. A line can be "a = b" or "a → b".
function holds(line, fill) {
  const parts = String(line).split(/=|→/);
  if (parts.length < 2) return false;
  const v = parts.map(p => value(p, fill));
  return v.every(n => Number.isFinite(n) && Math.abs(n - v[0]) < 1e-9);
}
const SOL = new Map();
function solve(line) {
  if (SOL.has(line)) return SOL.get(line);
  const out = [];
  for (let v = -999; v <= 999; v++) if (holds(line, v)) out.push(v);
  SOL.set(line, out);
  return out;
}
function respell(toks) {
  return toks.map(t => {
    if (t.k === 'num') { const s = (t.v < 0 ? M : t.plus && t.v > 0 ? '+' : '') + Math.abs(t.v); return t.br ? '(' + s + ')' : s; }
    if (t.k === 'op') return ' ' + t.v + ' ';
    return { eq: ' = ', box: BOX, sq: '²', lb: '(', rb: ')' }[t.k] || '<?>';
  }).join('');
}
const covered = text => String(text).replace(/[−()]/g, '').replace(/\+(\d)/g, '$1');   // the sum with its signs and brackets covered

/* What sort of sum is this, and what are its numbers? Read from the text alone.
   K, C, boxIdx: for a times or divide box, the known number, the number the two must make, and where the box sits. */
function facts(q) {
  const t = q.text, one = '\\(?([−+]?\\d+)\\)?';
  let m;
  const boxed = f => { const s = solve(t); f.truth = s.length === 1 ? s[0] : NaN; return f; };
  if ((m = new RegExp('^' + one + ' ([×÷]) ' + one + '$').exec(t))) {
    const a = int(m[1]), b = int(m[3]);
    if (a === 0 || b === 0) return { fam: 'zero', a: a || b, truth: value(t) };
    return { fam: m[2] === X ? 'times' : 'divide', a, b, op: m[2], pair: [a, b], pairSame: sg(a) === sg(b), truth: value(t) };
  }
  if ((m = /^(−?\d+) × (−?\d+) × (−?\d+)$/.exec(t))) {
    const v = [1, 2, 3].map(i => int(m[i]));
    return { fam: 'three', v, k: v.filter(x => x < 0).length, mag: v.map(Math.abs), truth: value(t) };
  }
  if ((m = /^\((−\d+)\)²$/.exec(t))) { const n = -int(m[1]); return { fam: 'square', n, pair: [-n, -n], pairSame: true, truth: value(t) }; }
  if ((m = /^(□|−?\d+) ([×÷]) (□|−?\d+) = (−?\d+)$/.exec(t)) && (m[1] === BOX) !== (m[3] === BOX)) {
    const first = m[1] === BOX;
    return boxed({ fam: 'box', K: int(first ? m[3] : m[1]), C: int(m[4]), boxIdx: first ? 0 : 1, op: m[2] });
  }
  if ((m = /^□ \+ \((−\d+)\) = (−?\d+)$/.exec(t))) return boxed({ fam: 'boxAdd', m: int(m[1]), c: int(m[2]) });
  if ((m = /^□ \+ (\d+) = (−?\d+)$/.exec(t))) return boxed({ fam: 'boxAdd', m: int(m[1]), c: int(m[2]) });
  if ((m = /^□ − (\d+) = (−?\d+)$/.exec(t))) return boxed({ fam: 'boxAdd', m: -int(m[1]), c: int(m[2]) });
  if ((m = /^(−?\d+) \+ □ = (−?\d+)$/.exec(t))) return boxed({ fam: 'boxAdd', m: int(m[1]), c: int(m[2]) });
  if ((m = /^\((−?\d+) × (−?\d+)\) ([×÷]) □ = (−?\d+)$/.exec(t))) {
    const a = int(m[1]), b = int(m[2]);
    return boxed({ fam: 'boxBr', pair: [a, b], pairSame: sg(a) === sg(b), K: a * b, C: int(m[4]), boxIdx: 1, op: m[3] });
  }
  if ((m = /^(−?\d+) \+ (\d+) × □ = (−?\d+)$/.exec(t))) {
    const a = int(m[1]);
    return boxed({ fam: 'box2', m: a, K: int(m[2]), C: int(m[3]) - a, c: int(m[3]), boxIdx: 1, op: X });
  }
  if ((m = /^(−?\d+) ([+−]) (−?\d+)$/.exec(t))) return { fam: 'add', a: int(m[1]), b: int(m[3]), truth: value(t) };
  return null;
}

/* ---------- are the words true of this sum? ---------- */
function sayFaults(s, q, f) {
  const out = [], has = x => s.indexOf(x) >= 0, bad = msg => out.push(msg + ': "' + s + '"');
  const boxy = f.K !== undefined, add = f.fam === 'add';
  let m;
  const sameSaid = has('Same signs make a plus'), diffSaid = has('Different signs make a minus');
  if (sameSaid !== diffSaid && !add) {
    if (f.pairSame === undefined) bad('a sign rule that does not belong to this sum');
    else if (sameSaid !== f.pairSame) bad('the wrong sign rule for these signs');
  }
  if ((m = /The signs are (the same|different)/.exec(s)) && !add) {
    const same = boxy ? f.C > 0 : f.pairSame;
    if (same === undefined || (m[1] === 'the same') !== same) bad('says the signs are ' + m[1]);
  }
  if (has('The answer is minus, so the signs are different') && !(boxy && f.C < 0)) bad('says the answer is minus');
  if (has('The answer is plus, so the signs are the same') && !(boxy && f.C > 0)) bad('says the answer is plus');
  if (boxy && (m = /The (\d+) is (minus|plus)\./.exec(s)) && (int(m[1]) !== Math.abs(f.K) || (m[2] === 'minus') !== (f.K < 0))) bad('names the known number wrongly');
  if ((m = /The box (?:is|must be) (minus|plus)\./.exec(s)) && (!boxy || (m[1] === 'minus') !== (f.truth < 0))) bad('gives the box the wrong sign');
  if (has('Times the numbers') && ['times', 'three', 'square', 'boxBr'].indexOf(f.fam) < 0) bad('says times in a sum that is not times');
  if (has('Divide the numbers') && f.fam !== 'divide') bad('says divide in a sum that is not divide');
  if (has('Put the minus on the number') && !(f.truth < 0)) bad('puts a minus on a plus answer');
  if (has('A plus answer needs no sign') && !(f.truth > 0)) bad('calls a minus answer plus');
  if (has('A plus answer needs no sign') && boxy) bad('says "a plus answer" in a box sum, where the answer is the number after the equals');
  if (has('The box is plus, so it needs no sign') && !(boxy && f.truth > 0)) bad('calls the box plus when it is not');
  if (has('The answer is minus.') && !(f.truth < 0)) bad('says the answer is minus');
  if (has('The answer is plus.') && !(f.truth > 0)) bad('says the answer is plus');
  if (f.fam === 'three') {
    const k = f.k, odd = k % 2 === 1;
    if ((/^One minus sign/.test(s) || has('There is one.') || has('It has no partner')) && k !== 1) bad('counts one minus sign');
    if ((has('Two minus signs') || has('They make a pair') || has('A pair of minus signs makes a plus')) && k !== 2) bad('counts two minus signs');
    if ((has('Three minus signs') || /[Oo]ne pair,? (and )?one left over/.test(s)) && k !== 3) bad('counts three minus signs');
    if (has('Pair up the minus signs') && k < 2) bad('pairs up a single minus sign');
    if ((has('No minus is left over') || has('No minus sign is left over')) && odd) bad('says no minus is left over');
    if (has('One is left over') && !odd) bad('says one is left over');
    if (has('One left over makes a minus') && !has('Is one left over?') && !odd) bad('says one is left over');
  } else if (/left over|Pair up|pair makes/.test(s)) bad('talks about pairs in a sum that is not three numbers');
  if ((m = /The (−?\d+) (?:must change|changes) side/.exec(s)) && int(m[1]) !== f.m) bad('moves the wrong number');
  if ((m = /Move the (−?\d+)\./.exec(s)) && int(m[1]) !== f.m) bad('moves the wrong number');
  if ((m = /The (−?\d+) becomes ([+−]\d+)\./.exec(s)) && (int(m[1]) !== f.m || int(m[2]) !== -f.m || (m[2][0] === '+') !== (-f.m > 0))) bad('the number does not change sign as said');
  if (has('Change side, change sign') && f.m === undefined) bad('changes side in a sum where nothing moves');
  if ((m = /The box is (−?\d+)\./.exec(s)) && int(m[1]) !== f.truth) bad('names the wrong number for the box');
  if ((m = /The brackets make (−?\d+)\./.exec(s)) && !(f.fam === 'boxBr' && int(m[1]) === f.K)) bad('the brackets do not make that');
  if ((m = /Check (\d+) ([×÷]) (\d+) again/.exec(s)) && !(f.pair && f.op === m[2] && int(m[1]) === Math.abs(f.pair[0]) && int(m[3]) === Math.abs(f.pair[1]))) bad('asks her to check a different sum');
  const opWord = f.op === X ? 'times' : 'divided by';
  if ((m = /hat (times|divided by) (\d+) makes (\d+)\?/.exec(s)) && !(boxy && f.boxIdx === 0 && m[1] === opWord && int(m[2]) === Math.abs(f.K) && int(m[3]) === Math.abs(f.C))) bad('asks a question that is not this sum');
  if ((m = /(\d+) (times|divided by) what makes (\d+)\?/.exec(s)) && !(boxy && f.boxIdx === 1 && m[2] === opWord && int(m[1]) === Math.abs(f.K) && int(m[3]) === Math.abs(f.C))) bad('asks a question that is not this sum');
  if (f.fam === 'boxAdd') {
    const same = sg(f.c) === sg(-f.m);
    if ((m = /Both numbers are (plus|minus)/.exec(s)) && !(same && (m[1] === 'minus') === (f.c < 0))) bad('the two numbers are not both ' + m[1]);
    if (has('Different signs: take away') && same) bad('says different signs');
    if (has('Same signs: add') && !same) bad('says same signs');
  }
  if (has('Anything times 0 is 0') && f.fam !== 'zero') bad('the zero cheat in a sum with no 0');
  if ((m = /The little 2 means (−\d+) × (−\d+), not/.exec(s)) && !(f.fam === 'square' && int(m[1]) === -f.n && int(m[2]) === -f.n)) bad('the little 2 is explained with the wrong number');
  if (has('The little 2 means') && f.fam !== 'square') bad('the little 2 in a sum with none');
  if (has('Do the brackets first') && f.fam !== 'boxBr') bad('brackets first in a sum with no brackets to work out');
  if (has('No × or ÷?') && !add) bad('says there is no × or ÷');
  if (has('Brackets hold a number and its sign') && !/\([−+]?\d+\)/.test(q.text)) bad('talks about brackets that are not there');
  if (has('Both numbers are minus.') && f.fam !== 'boxAdd' && !add && !(f.pair && f.pair[0] < 0 && f.pair[1] < 0)) bad('the two numbers are not both minus');
  if (has('A number with no sign is a plus number') && !(f.pair && (f.pair[0] > 0 || f.pair[1] > 0) && !/\+\d/.test(q.text))) bad('no number here is without its sign');
  if (has('One number is minus. One is plus.') && f.pairSame !== false) bad('the signs are not one of each');
  return out;
}

/* ---------- the sign picture ---------- */
function rowFaults(r, q, f) {
  const out = [], bad = msg => out.push('sign picture: ' + msg);
  if (!r || !Array.isArray(r.signs) || !r.signs.length) return ['sign picture with no signs'];
  Object.keys(r).forEach(k => { if (['signs', 'made', 'pairs'].indexOf(k) < 0) bad('unknown key ' + k); });
  if (r.signs.some(s => s !== 1 && s !== -1 && s !== 0)) return ['sign picture: a sign that is not plus, minus or the box'];
  const zeros = r.signs.filter(s => s === 0).length, prod = r.signs.reduce((p, s) => p * s, 1), has = 'made' in r;
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (has && r.made !== 1 && r.made !== -1) bad('the sign it makes is not plus or minus');
  if (!zeros && has && prod !== r.made) bad('the signs shown do not make the sign shown');
  if (f.fam === 'three') { if (!r.pairs || !same(r.signs, Array(f.k).fill(-1))) bad('not the minus signs of this sum'); }
  else if (r.pairs) bad('pairs in a sum that is not three numbers');
  else if (f.K !== undefined) {
    const inner = r.signs.length === 2 && zeros <= 1 && r.signs[1 - f.boxIdx] === sg(f.K) && (r.signs[f.boxIdx] === 0 || r.signs[f.boxIdx] === sg(f.truth)) && (!has || r.made === sg(f.C));
    const brackets = f.fam === 'boxBr' && same(r.signs, f.pair.map(sg)) && (!has || r.made === sg(f.K));
    if (!inner && !brackets) bad('not the signs of this sum');
  } else if (f.pair) { if (!same(r.signs, f.pair.map(sg))) bad('not the signs of this sum'); }
  else bad('a sign picture in a sum that has none');
  return out;
}

/* ---------- "Stuck? Show me" steps (for one tap, or for the whole sum) ---------- */
function shown(steps, q, f) {
  const out = [], open = [], closed = [];
  if (!Array.isArray(steps) || !steps.length) return { out: ['no help steps'], open, closed };
  if (steps.length > 3) out.push('help of more than three steps');
  steps.forEach((h, i) => {
    if (!h || typeof h.say !== 'string' || !h.say) return out.push('a help step with no words');
    SAID.add(h.say);
    Object.keys(h).forEach(k => { if (['say', 'show', 'sums', 'srow', 'mark'].indexOf(k) < 0) out.push('unknown help key ' + k); });
    if (words(h.say) > 10) out.push('help step over 10 words: ' + h.say);
    sayFaults(h.say, q, f).forEach(x => out.push(x));
    if (h.show !== undefined && !(f.pair && h.show === signedS(f.pair[0]) + ' and ' + signedS(f.pair[1]))) out.push('help shows numbers that are not this sum: ' + h.show);
    if (h.srow) rowFaults(h.srow, q, f).forEach(x => out.push(x));
    (h.sums || []).forEach((s, j) => {
      if (s === q.full) return out.push('help prints the finished sum: ' + s);
      if (/\?/.test(s)) { const sol = solve(s); if (sol.length !== 1) out.push('a "?" sum with no single answer: ' + s); else open.push({ sum: s, sol: sol[0], step: i, last: j === h.sums.length - 1 }); return; }
      closed.push(s);
      if (/=|→/.test(s)) { if (!holds(s, f.truth)) out.push('a help sum that is not true: ' + s); }
      else if (!Number.isFinite(value(s))) out.push('a help sum that cannot be read: ' + s);
    });
  });
  return { out, open, closed };
}
function hpFaults(hp, q, f, s) {
  const r = shown(hp, q, f), out = r.out.map(x => 'help for "' + s.job + '": ' + x);
  const bad = msg => out.push('help for "' + s.job + '": ' + msg);
  if (r.open.length > 1) bad('more than one "?" sum');
  if (s.type === 'pick' && s.look === 'sign' && (hp || []).some(h => h.srow && 'made' in h.srow && h.srow.signs.indexOf(0) < 0)) bad('shows the sign she is asked for');
  if (s.type === 'pick' && s.look === 'team' && (hp || []).some(h => h.srow)) bad('shows the signs side by side with the answer drawn');
  if (s.type === 'pad' && r.open.length && Math.abs(r.open[0].sol) !== Math.abs(s.answer)) bad('its "?" sum does not lead to this answer');
  return out;
}

/* ---------- the steps she taps through ---------- */
const THEN_KEYS = ['say', 'srow', 'line', 'hop', 'dsum', 'cover', 'mark', 'full'];
function thenFaults(th, q, f, st, mode) {
  const out = [];
  if (!th || typeof th.say !== 'string' || !th.say) return ['a picture step with no words'];
  SAID.add(th.say);
  Object.keys(th).forEach(k => { if (THEN_KEYS.indexOf(k) < 0) out.push('unknown picture key ' + k); });
  if (words(th.say) > 10) out.push('picture line over 10 words: ' + th.say);
  sayFaults(th.say, q, f).forEach(x => out.push(x));
  if (th.srow) rowFaults(th.srow, q, f).forEach(x => out.push(x));
  if (th.line) {
    const line = respell(th.line), before = st.toks;
    if (!holds(line, f.truth)) out.push('a new line that is not true: ' + line);
    if (line === q.full) out.push('a new line that is the finished sum');
    if (th.hop && !(before.some(t => t.id === th.hop) && th.line.some(t => t.id === th.hop))) out.push('a hop for a piece that is not on both lines');
    st.toks = th.line;
  } else if (th.hop) out.push('a hop with no new line');
  if (th.dsum !== undefined) {
    const d = String(th.dsum);
    if (/\?/.test(d)) { const sol = solve(d); if (sol.length !== 1 || sol[0] !== Math.abs(f.truth)) out.push('a "?" sum that does not lead to the number: ' + d); }
    else if (/=/.test(d)) { if (!holds(d)) out.push('a sum on screen that is not true: ' + d); }
    else if (value(d) !== f.truth) out.push('a sum on screen that does not mean the same: ' + d);
    if (th.cover) {
      if (/−/.test(d)) out.push('a covered sum still shows a minus: ' + d);
      const base = covered(q.text), n = Math.abs(f.truth);
      const want = f.fam === 'three' ? `${f.mag[0]} × ${f.mag[1]} = ${f.mag[0] * f.mag[1]}` : f.fam === 'square' ? `${f.n} × ${f.n} = ${f.n * f.n}`
        : q.text.indexOf(BOX) >= 0 ? base.replace(BOX, '?') : `${base} = ${n}`;
      if (d !== want) out.push(`covered sum "${d}" is not this sum with its signs covered ("${want}")`);
    }
    if (mode === 'try' && covered(d) === covered(q.full)) out.push('Try it shows the worked sum before she answers: ' + d);
  } else if (th.cover) out.push('covers the signs but shows no covered sum');
  (th.mark || []).forEach(id => { if (!st.toks.some(t => t.id === id)) out.push('rings a piece that is not on the line: ' + id); });
  return out;
}
function jobFaults(s, q, f) {
  const out = [], j = s.job;
  let m;
  if ((m = /^Now work out (.+)\.$/.exec(j)) && value(m[1]) !== f.truth) out.push('asks for a sum that does not make the answer: ' + j);
  if ((m = /What is (.+)\?$/.exec(j)) && q.text.indexOf(m[1]) < 0) out.push('asks about a sum that is not on the screen: ' + j);
  if ((m = /What does (.+) mean\?$/.exec(j)) && m[1] !== q.text) out.push('asks what a different sum means: ' + j);
  if ((m = /^The (−?\d+) changes side/.exec(j)) && int(m[1]) !== f.m) out.push('names the wrong number to move: ' + j);
  if (s.type === 'pad' && s.final) {
    const padFam = ['times', 'divide', 'three', 'box', 'boxBr', 'box2'].indexOf(f.fam) >= 0;
    if (/Start with the minus/.test(j) && !(f.truth < 0)) out.push('tells her to start with a minus on a plus answer');
    if (padFam && f.truth < 0 && !/Start with the minus/.test(j)) out.push('a minus answer with no "Start with the minus"');
    if (/in the box/.test(j) !== (padFam && q.text.indexOf(BOX) >= 0)) out.push('the pad line and the box do not agree: ' + j);
  }
  return out;
}
function pickFaults(s, q, f) {
  const out = [], bad = msg => out.push(msg + ' (' + s.job + ')'), opts = s.opts || [], boxy = f.K !== undefined;
  if (opts.length < 2) return ['a choice with fewer than two options (' + s.job + ')'];
  if (new Set(opts.map(o => o.v)).size !== opts.length || new Set(opts.map(o => o.label)).size !== opts.length) bad('two options the same');
  if (!opts.some(o => o.v === s.answer)) bad('the right option is not offered');
  const wrong = s.wrong || {}, labels = opts.map(o => o.label).join('|');
  opts.forEach(o => {
    const w = wrong[o.v];
    if (o.v === s.answer) { if (w) bad('the right option has a "Look again." reason'); return; }
    if (typeof w !== 'string' || w.indexOf('Look again. ') !== 0) return bad('a wrong option with no "Look again." reason');
    if (words(w) > 14) bad('reason over 14 words: ' + w);
    sayFaults(w, q, f).forEach(x => out.push(x));
  });
  let want;
  if (s.look === 'team') {
    if (labels !== 'Same|Different') bad('Same and Different are not in their places');
    if (f.fam === 'box') {   // "same or different" must say WHICH two signs: the box and the number beside it, in the order they stand
      const mm = /The box and the (−?\d+):|The (−?\d+) and the box:/.exec(s.job);
      if (!mm || int(mm[1] || mm[2]) !== f.K || !!mm[1] !== (f.boxIdx === 0)) bad('does not say which two signs: the box and the ' + f.K);
    }
    want = boxy ? (/answer/.test(s.job) ? (f.C > 0 ? 'same' : 'diff') : undefined) : f.pairSame === undefined ? undefined : f.pairSame ? 'same' : 'diff';
  } else if (s.look === 'sign') {
    if (labels !== 'Plus|Minus') bad('Plus and Minus are not in their places');
    const v = /box/.test(s.job) === boxy ? f.truth : NaN;
    want = v < 0 ? 'minus' : v > 0 ? 'plus' : undefined;
  } else if (s.look === 'chips') {
    if (f.m !== undefined) { want = f.m < 0 ? 'plus' : 'minus'; if (labels !== '+' + Math.abs(f.m) + '|' + M + Math.abs(f.m)) bad('the two chips are not the number with each sign'); }
  } else if (s.look === 'words') {
    const r = opts.find(o => o.v === s.answer);
    if (r && value(r.label) === f.truth && !opts.some(o => o.v !== s.answer && value(o.label) === f.truth)) want = s.answer;
    else want = (opts.find(o => value(o.label) === f.truth) || {}).v;
  } else bad('an unknown sort of choice');
  if (want === undefined) bad('a question that does not fit this sum');
  else if (want !== s.answer) bad(`marks "${s.answer}" right, the sum says "${want}"`);
  return out;
}
function tapFaults(s, q, f, st) {
  const out = [];
  if (s.all) {
    const want = st.toks.map((t, i) => t.k === 'num' && t.v < 0 ? i : -1).filter(i => i >= 0);
    if (!want.length || JSON.stringify(s.right) !== JSON.stringify(want)) out.push('the minus signs to tap are not the minus signs in the sum');
    return out;
  }
  const eq = st.toks.findIndex(t => t.k === 'eq'), sides = id => st.toks.map((t, i) => t.id === id ? (i < eq ? 'L' : 'R') : '').filter(Boolean);
  if (!Array.isArray(s.right) || !s.right.length || !Array.isArray(s.other) || !s.other.length) out.push('a tap with nothing right or nothing wrong to tap');
  else {
    if (s.right.some(id => !sides(id).length || sides(id).some(x => x !== 'L'))) out.push('the piece to tap is not on the box side');
    if (s.other.some(id => !sides(id).length || sides(id).some(x => x !== 'R'))) out.push('the wrong piece to tap is not across the equals');
  }
  if (typeof s.wrong !== 'string' || s.wrong.indexOf('Look again. ') !== 0) out.push('a wrong tap with no "Look again." reason');
  else if (words(s.wrong) > 14) out.push('reason over 14 words: ' + s.wrong);
  return out;
}
function midPadFaults(s, q, f) {
  const out = [];
  if (f.fam !== 'boxBr') return ['a middle number pad in a sum with no brackets to work out'];
  if (s.answer !== f.K) out.push(`brackets answer ${s.answer}, the brackets make ${f.K}`);
  const sl = s.slips || [];
  if (!sl.some(x => x.value === -f.K)) out.push('the brackets pad has no reason ready for the wrong sign');
  sl.forEach(x => {
    if (!Number.isInteger(x.value) || x.value === s.answer) out.push('a brackets slip that is the right answer');
    if (typeof x.say !== 'string' || x.say.indexOf('Look again. ') !== 0) out.push('a brackets slip with no "Look again." reason');
    else { if (words(x.say) > 14) out.push('reason over 14 words: ' + x.say); sayFaults(x.say, q, f).forEach(y => out.push(y)); }
  });
  if (typeof s.other !== 'string' || s.other.indexOf('Look again. ') !== 0) out.push('the brackets pad has no "Look again." line for other numbers');
  return out;
}
function stepsFaults(q, f, steps, fin, mode) {
  const out = [], st = { toks: q.toks }, bad = msg => out.push(mode + ': ' + msg);
  if (!Array.isArray(steps) || !steps.length) return [mode + ': no steps'];
  let fulls = 0, lastThen = null;
  const run = list => list.forEach(th => { thenFaults(th, q, f, st, mode).forEach(bad); if (th && th.full) fulls++; lastThen = th; });
  steps.forEach((s, i) => {
    if (!s || ['pick', 'tap', 'pad'].indexOf(s.type) < 0) return bad('a step of an unknown type');
    if (typeof s.job !== 'string' || !s.job) bad('a step with no job line');
    else { if (words(s.job) > 14) bad('job line over 14 words: ' + s.job); jobFaults(s, q, f).forEach(bad); }
    if (s.type === 'pad' && s.final) {
      if (i !== steps.length - 1 || mode !== 'try') bad('the answer pad is not the last step of Try it');
      if (s.then || s.hp) bad('the answer pad carries its own help or picture');
      return;
    }
    if (s.type === 'pick') pickFaults(s, q, f).forEach(bad);
    if (s.type === 'tap') tapFaults(s, q, f, st).forEach(bad);
    if (s.type === 'pad') midPadFaults(s, q, f).forEach(bad);
    hpFaults(s.hp, q, f, s).forEach(bad);
    const thens = s.then ? [].concat(s.then) : [];
    if (!thens.length) bad('a step that shows nothing after the tap');
    run(thens);
  });
  if (mode === 'see') {
    if (steps.some(s => s.type === 'pad')) bad('a number pad in Show me');
    if (!Array.isArray(fin)) bad('no finish'); else run(fin);
    if (fulls !== 1 || !lastThen || !lastThen.full) bad('the finished sum is not shown once, at the end');
  } else {
    if (fulls) bad('shows the finished sum before she answers');
    const last = steps[steps.length - 1];
    if (!(last && last.type === 'pad' && last.final)) bad('does not end with the answer pad');
  }
  return out;
}

/* ---------- one whole question ---------- */
const TAGS = ['sign', 'added', 'tables', 'zero', 'oddMinus', 'twoOnly', 'squareMinus', 'doubled', 'boxSign', 'notUndone', 'notFlipped', 'tookAway', 'timesed', 'notTidied', 'twoMinus'];
function check(q) {
  const out = [], bad = msg => out.push(msg);
  if (!Array.isArray(q.toks) || respell(q.toks) !== q.text) bad('the pieces do not spell the sum: ' + (q.toks ? respell(q.toks) : 'none'));
  const f = facts(q);
  if (!f) return out.concat(['a sum the gate cannot read: ' + q.text]);
  if (f.fam !== q.fam) bad(`called a ${q.fam} sum, it reads as a ${f.fam} sum`);
  if (!Number.isInteger(f.truth)) return out.concat(['the sum has no single whole-number answer']);
  if (q.answer !== f.truth) bad(`answer ${q.answer}, the sum makes ${f.truth}`);
  if (Math.abs(f.truth) > 999) bad('answer of more than three digits');
  if (f.truth === 0 && f.fam !== 'zero') bad('the answer is 0');
  const boxed = q.text.indexOf(BOX) >= 0, add = f.fam === 'add';
  const wantFull = boxed ? q.text.replace(BOX, numS(f.truth)) : q.text + ' = ' + numS(f.truth);
  if (q.full !== wantFull) bad(`finished sum "${q.full}" should be "${wantFull}"`);
  if (!Array.isArray(q.fullToks) || respell(q.fullToks) !== q.full) bad('the finished pieces do not spell the finished sum');
  if (!holds(wantFull)) bad('the finished sum is not true');
  if (q.job !== (boxed ? 'Find the number in the box.' : 'Work out the answer.')) bad('job line does not fit the sum: ' + q.job);
  if (q.topic !== (add ? 'minus' : 'times')) bad('the score row would go under the wrong topic');
  // The sum in words (for a screen reader) names every number and every minus.
  const desc = String(q.desc || '');
  (q.text.match(/\d+/g) || []).forEach(n => { if (!new RegExp('(^|\\D)' + n + '(\\D|$)').test(desc)) bad('the spoken sum leaves out ' + n); });
  if (!add) {
    const negs = (q.toks || []).filter(t => t.k === 'num' && t.v < 0).length;
    if ((desc.match(/minus/g) || []).length !== negs) bad('the spoken sum has the wrong number of minus signs');
    [[BOX, 'box'], [X, 'times'], [D, 'divided by'], ['²', 'squared'], [' − ', 'take away']].forEach(([mark, word]) => { if ((q.text.indexOf(mark) >= 0) !== (desc.indexOf(word) >= 0)) bad('the spoken sum and the printed sum disagree about "' + word + '"'); });
  }
  if (q.see || q.fin) stepsFaults(q, f, q.see, q.fin, 'see').forEach(bad);
  if (q.try) stepsFaults(q, f, q.try, null, 'try').forEach(bad);

  // The working she sees after an answer.
  const beats = q.beats || [];
  if (!beats.length || beats.length > 4) bad('working of ' + beats.length + ' lines');
  beats.forEach(b => {
    if (typeof b.say !== 'string' || !b.say) return bad('a working line with no words');
    SAID.add(b.say);
    if (words(b.say) > 10) bad('working line over 10 words: ' + b.say);
    sayFaults(b.say, q, f).forEach(bad);
    if (b.sum === undefined && !b.srow) bad('a working line with nothing to look at: ' + b.say);
    if (b.srow) rowFaults(b.srow, q, f).forEach(bad);
    if (b.sum !== undefined) {
      if (/\?/.test(b.sum)) bad('a working sum with a ? in it: ' + b.sum);
      else if (/=|→/.test(b.sum)) { if (!holds(b.sum, f.truth)) bad('a working sum that is not true: ' + b.sum); }
      else if (value(b.sum) !== f.truth) bad('a working sum that does not make the answer: ' + b.sum);
    }
  });
  const sums = beats.map(b => b.sum), n = Math.abs(f.truth), needs = [];
  if (f.fam === 'times' || f.fam === 'divide') needs.push(`${covered(q.text)} = ${n}`);
  if (f.fam === 'three') needs.push(`${f.mag[0]} × ${f.mag[1]} = ${f.mag[0] * f.mag[1]}`, `${f.mag[0] * f.mag[1]} × ${f.mag[2]} = ${n}`);
  if (f.fam === 'square') needs.push(`${f.n} × ${f.n} = ${f.n * f.n}`);
  if (f.fam === 'box') needs.push(covered(q.text).replace(BOX, n));
  if (f.fam === 'zero' || add) needs.push(wantFull);
  needs.forEach(s => { if (sums.indexOf(s) < 0) bad('the working never shows ' + s); });
  if (f.fam === 'boxAdd' && !(sums.some(s => /^□ = /.test(s || '')) && sums.some(s => new RegExp(' = ' + numS(f.truth) + '$').test(s || '')))) bad('the working does not move the number and then finish the sum');
  if (['boxBr', 'box2'].indexOf(f.fam) >= 0 && !sums.some(s => s && !/□/.test(s) && covered(s).split(/\D+/).indexOf(String(n)) >= 0)) bad('the working never reaches the number for the box');

  // Stuck? Show me for the whole sum: every sum set out, the last one left for her.
  const h = shown(q.help, q, f);
  h.out.forEach(x => bad('help: ' + x));
  // "? ÷ 11 = 7" and "55 ÷ ? = 5" do not show her how to find the number, so a box in a divide sum sets "7 × 11 = ?" or "55 ÷ 5 = ?" beside it. Both must lead to the same number.
  const twoWays = (f.fam === 'box' || f.fam === 'boxBr') && f.op === '÷';
  const beside = f.boxIdx === 0 ? `${Math.abs(f.C)} × ${Math.abs(f.K)} = ?` : `${Math.abs(f.K)} ÷ ${Math.abs(f.C)} = ?`;
  if (twoWays && !(h.open.length === 2 && h.open[1].sum === beside && h.open[0].sol === h.open[1].sol && h.open[0].step === h.open[1].step)) bad('help for a box in a divide sum does not set the sum she can do beside it (' + beside + ')');
  const opens = twoWays && h.open.length === 2 ? [h.open[1]] : h.open;
  if (opens.length !== 1) bad('help has ' + opens.length + ' "?" sums (it needs exactly one)');
  else {
    const o = opens[0], lastStep = (q.help || []).length - 1;
    if (Math.abs(o.sol) !== n) bad('the help "?" sum does not lead to the answer: ' + o.sum);
    if (!o.last || o.step !== (add ? 1 : lastStep)) bad('the help "?" sum is not the last sum she meets');
    if (h.closed.indexOf(o.sum.replace('?', o.sol)) >= 0 || h.closed.indexOf(o.sum.replace('?', numS(o.sol))) >= 0) bad('help prints the sum it leaves for her');
  }
  if (!add) (q.help || []).forEach(x => { if (!(x.sums && x.sums.length) && !x.srow && !x.show) bad('a help step with nothing to look at: ' + x.say); });

  // Slips: each a real wrong answer with its own reason, and the ones that matter are there.
  const slips = q.slips || [], seen = {}, want = [];
  slips.forEach(s => {
    if (!Number.isInteger(s.value)) bad('a slip that is not a whole number');
    if (s.value === f.truth) bad('a slip equal to the right answer');
    if (seen[s.value]) bad('two slips with the same value ' + s.value); seen[s.value] = 1;
    if (TAGS.indexOf(s.tag) < 0) bad('unknown slip ' + s.tag);
    if (typeof s.say !== 'string' || !s.say) bad('a slip with no reason'); else { if (words(s.say) > 14) bad('slip reason over 14 words: ' + s.say); sayFaults(s.say, q, f).forEach(bad); }
    const j = T.judge(q, s.value);
    if (j.right || j.slip !== s.tag || j.say !== s.say) bad('the marker does not give slip ' + s.tag + ' its own reason');
  });
  if (f.fam === 'times' || f.fam === 'divide') want.push([-f.truth, 'sign']);
  if (f.fam === 'times') want.push([f.a + f.b, 'added']);
  if (f.fam === 'three') want.push([-f.truth, 'oddMinus'], [f.mag[0] * f.mag[1], 'twoOnly']);
  if (f.fam === 'square') want.push([-f.n * f.n, 'squareMinus'], [2 * f.n, 'doubled'], [-2 * f.n, 'doubled']);
  if (f.fam === 'zero') want.push([f.a, 'zero']);
  if (f.K !== undefined) want.push([-f.truth, 'boxSign']);
  if (f.fam === 'boxAdd') want.push([f.c + f.m, 'notFlipped'], [-f.truth, null]);
  if (f.fam === 'box2' && Number.isInteger((f.c + f.m) / f.K)) want.push([(f.c + f.m) / f.K, null]);
  if (add) {
    const src = q.src ? q.src.slips : null;
    if (!src) bad('an add sum without its Minus numbers sum'); else src.forEach(s => want.push([s.value, s.tag]));
    want.push([f.a * f.b, null], [-f.a * f.b, null]);
    if (q.src && (q.src.text !== q.text || q.src.answer !== f.truth)) bad('the add sum and its Minus numbers sum disagree');
  }
  const claimed = {};
  want.forEach(([v, tag]) => {
    if (v === f.truth || claimed[v]) return;
    claimed[v] = 1;
    const s = slips.find(x => x.value === v);
    if (!s) bad(`no slip ready for the wrong answer ${numS(v)}` + (tag ? ` (${tag})` : ''));
    else if (tag && s.tag !== tag) bad(`wrong answer ${numS(v)} is called ${s.tag}, it is ${tag}`);
  });
  if (!T.judge(q, f.truth).right) bad('the marker turns down the right answer');
  [f.truth + 1000, -f.truth - 1000].forEach(v => { if (T.judge(q, v).right) bad('the marker accepts a wrong answer'); });
  if (!add && f.truth !== 0) { const near = f.truth + sg(f.truth) * 371; if (!seen[near] && T.judge(q, near).slip !== 'near') bad('a wrong number with the right sign is not told "the sign is right"'); }
  // the screen after her answer shows the job line, the verdict and one reason: 25 words at most
  const load = say => words(q.job) + 3 + words(q.full) + words(say);
  slips.map(x => x.value).concat([f.truth + sg(f.truth || 1) * 371]).forEach(v => { const j = T.judge(q, v);
    if (!j.right && j.slip && load(j.say) > 25) bad(`over 25 words on the screen after the wrong answer ${numS(v)}: ${load(j.say)}`); });
  return out;
}

/* ---------- a set of sums for one sitting ---------- */
const SIZES = { t1: { see: 5, try: 5, quiz: 10 }, t2: { see: 4, try: 5, quiz: 8 }, t3: { see: 4, try: 5, quiz: 8 }, t4: { see: 4, try: 5, quiz: 8 }, t5: { see: 4, try: 5, quiz: 8 }, tmix: { quiz: 12 } };
const FAMS = { t1: ['times', 'zero'], t2: ['divide'], t3: ['three', 'square'], t4: ['box'], t5: ['boxAdd', 'boxBr', 'box2'] };
function matchable(kinds, slots) {
  if (kinds.length !== slots.length) return false;
  const used = slots.map(() => false);
  const go = i => i === kinds.length || slots.some((o, j) => { if (used[j] || o.indexOf(kinds[i]) < 0) return false; used[j] = true; if (go(i + 1)) return true; used[j] = false; return false; });
  return go(0);
}
function checkSet(qs, L, mode) {
  const out = [], bad = msg => out.push(msg), seen = {};
  const size = (SIZES[L.id] || {})[mode];
  if (qs.length !== size) bad(`${qs.length} sums, the design says ${size}`);
  const fams = qs.map(q => (facts(q) || {}).fam);
  qs.forEach((q, i) => {
    if (seen[q.text]) bad('the same sum twice: ' + q.text); seen[q.text] = 1;
    if (q.n !== i + 1) bad('sums not numbered in order');
    if (FAMS[L.id] && FAMS[L.id].indexOf(fams[i]) < 0) bad(`a ${fams[i]} sum in lesson ${L.id}: ${q.text}`);
    if (mode === 'see' && !(Array.isArray(q.see) && q.see.length && Array.isArray(q.fin))) bad('a Show me sum with no steps: ' + q.text);
    if (mode === 'try' && !(Array.isArray(q.try) && q.try.length)) bad('a Try it sum with no steps: ' + q.text);
    if (fams[i] === 'add' && Mn.KINDS.indexOf(q.rowKind) < 0) bad('an add sum without its Minus numbers kind');
  });
  const kinds = qs.map(q => q.kind);
  if (mode === 'see' && kinds.join() !== (L.see || []).join()) bad('Show me sums are not the planned kinds in order');
  if (mode === 'try' && !qs.every((q, i) => L.try[i] && L.try[i].indexOf(q.kind) >= 0)) bad('Try it sums are not the planned kinds in order');
  if (mode === 'quiz') {
    if (!matchable(kinds, L.quiz)) bad('quiz sums do not fit the plan');
    if (L.id !== 'tmix' && L.quiz[0].indexOf(kinds[0]) < 0) bad('the quiz does not open with its first kind');
    if (L.id === 'tmix') {
      [['times'], ['divide'], ['three', 'square'], ['box'], ['boxAdd', 'boxBr', 'box2']].forEach(g => { if (!fams.some(x => g.indexOf(x) >= 0)) bad('mixed quiz has no ' + g.join(' or ') + ' sum'); });
      if (fams.filter(x => x === 'add').length < 2) bad('mixed quiz has fewer than two add or take-away sums');
    }
    if (['t1', 't2', 't3', 'tmix'].indexOf(L.id) >= 0 && (qs.filter(q => q.answer > 0).length < 2 || qs.filter(q => q.answer < 0).length < 2)) bad('quiz answers are nearly all one sign');
  }
  return out;
}

/* ---------- Anya's two class sheets (23 Nov): every question, as printed, with its answer worked by hand ---------- */
const two = (a, op, b, br) => () => T.two(op, a, b, br), three = (a, b, c) => () => T.three(a, b, c), sq = n => () => T.square(n);
const SHEET = [
  // Practice D, question 1
  ['x+-', two(2, X, -3), '2 × −3', -6], ['x-+', two(-4, X, 3), '−4 × 3', -12], ['x-+', two(-5, X, 5), '−5 × 5', -25], ['x--', two(-7, X, -2), '−7 × −2', 14],
  ['x--', two(-6, X, -3), '−6 × −3', 18], ['x+-', two(8, X, -4), '8 × −4', -32], ['x-+', two(-9, X, 3), '−9 × 3', -27], ['x--', two(-5, X, -8), '−5 × −8', 40],
  ['x-+', two(-9, X, 7), '−9 × 7', -63], ['x+-', two(10, X, -8), '10 × −8', -80], ['x+-', two(7, X, -4), '7 × −4', -28], ['x++', two(6, X, 8), '6 × 8', 48],
  ['x-+', two(-11, X, 3), '−11 × 3', -33], ['x+-', two(4, X, -15), '4 × −15', -60], ['x--', two(-12, X, -12), '−12 × −12', 144], ['x-+', two(-5, X, 7), '−5 × 7', -35],
  ['x+-', two(9, X, -8), '9 × −8', -72], ['x--', two(-7, X, -8), '−7 × −8', 56], ['x+-', two(12, X, -6), '12 × −6', -72], ['x+-', two(4, X, -13), '4 × −13', -52],
  ['xb-+', two(-2, X, 6, true), '(−2) × (+6)', -12], ['xb--', two(-4, X, -7, true), '(−4) × (−7)', 28], ['xb--', two(-3, X, -7, true), '(−3) × (−7)', 21], ['x0', () => T.zero(-7), '−7 × 0', 0],
  // question 2
  ['3a', three(2, 3, -2), '2 × 3 × −2', -12], ['3a', three(-3, 2, 5), '−3 × 2 × 5', -30], ['3b', three(-5, -6, 2), '−5 × −6 × 2', 60], ['3b', three(10, -3, -4), '10 × −3 × −4', 120],
  ['3b', three(-9, 2, -2), '−9 × 2 × −2', 36], ['3c', three(-4, -3, -5), '−4 × −3 × −5', -60], ['3c', three(-8, -8, -2), '−8 × −8 × −2', -128], ['3b', three(5, -4, -7), '5 × −4 × −7', 140],
  // question 3
  ['sq', sq(3), '(−3)²', 9], ['sq', sq(6), '(−6)²', 36], ['sq', sq(2), '(−2)²', 4], ['sq', sq(1), '(−1)²', 1], ['sq', sq(10), '(−10)²', 100], ['sq', sq(8), '(−8)²', 64], ['sq', sq(12), '(−12)²', 144], ['sq', sq(20), '(−20)²', 400],
  // question 4
  ['d-+', two(-10, D, 2), '−10 ÷ 2', -5], ['d-+', two(-12, D, 3), '−12 ÷ 3', -4], ['d-+', two(-24, D, 4), '−24 ÷ 4', -6], ['d-+', two(-42, D, 6), '−42 ÷ 6', -7],
  ['d+-', two(9, D, -3), '9 ÷ −3', -3], ['d+-', two(21, D, -7), '21 ÷ −7', -3], ['d-+', two(-44, D, 11), '−44 ÷ 11', -4], ['d-+', two(-72, D, 9), '−72 ÷ 9', -8],
  ['d--', two(-10, D, -5), '−10 ÷ −5', 2], ['d--', two(-28, D, -4), '−28 ÷ −4', 7], ['d--', two(-30, D, -3), '−30 ÷ −3', 10], ['d--', two(-48, D, -8), '−48 ÷ −8', 6],
  ['d-+', two(-6, D, 6), '−6 ÷ 6', -1], ['d+-', two(24, D, -3), '24 ÷ −3', -8], ['d--', two(-12, D, -12), '−12 ÷ −12', 1], ['d-+', two(-132, D, 11), '−132 ÷ 11', -12],
  ['d+-', two(72, D, -8), '72 ÷ −8', -9], ['d--', two(-108, D, -9), '−108 ÷ −9', 12], ['d+-', two(36, D, -9), '36 ÷ −9', -4], ['d+-', two(100, D, -4), '100 ÷ −4', -25],
  // Practice E, G to T
  ['ag', () => T.boxAdd('g', -5, 13), '□ + (−5) = 13', 18], ['ah', () => T.boxAdd('h', -3, 4), '−3 + □ = 4', 7],
  ['x+-', two(6, X, -2), '6 × −2', -12], ['x--', two(-7, X, -4), '−7 × −4', 28], ['d+-', two(10, D, -5), '10 ÷ −5', -2], ['d-+', two(-27, D, 9), '−27 ÷ 9', -3], ['d--', two(-36, D, -4), '−36 ÷ −4', 9],
  ['bta', () => T.box('ta', -4, -44), '□ × −4 = −44', 11], ['btb', () => T.box('tb', -9, 18), '−9 × □ = 18', -2], ['bda', () => T.box('da', -8, -6), '□ ÷ −8 = −6', 48], ['bdb', () => T.box('db', -6, 3), '−6 ÷ □ = 3', -2],
  ['3b', three(2, -5, -4), '2 × −5 × −4', 40], ['kd', () => T.boxBr('d', -6, -5, 3), '(−6 × −5) ÷ □ = 3', 10], ['2s', () => T.box2(-2, 5, 8), '−2 + 5 × □ = 8', 2],
];
const shape = (text, kind) => { const s = text.replace(/\d+/g, 'n'); return /^[xd]b?[+-][+-]$|^sq$/.test(kind) ? s : /^3/.test(kind) ? s.replace(/−/g, '') + (s.match(/−/g) || []).length : s.replace(/−/g, ''); };
function sheetFaults(list, kinds) {
  const out = [];
  list.forEach(([kind, mk, text, answer]) => {
    let q;
    try { q = mk(); } catch (e) { return out.push(text + ': cannot be built (' + e.message + ')'); }
    if (q.text !== text) out.push(`sheet sum "${text}" comes out as "${q.text}"`);
    if (q.answer !== answer) out.push(`${text}: answer ${q.answer}, the sheet answer is ${answer}`);
    if (kinds.indexOf(kind) < 0) out.push(`${text}: its kind (${kind}) is in no lesson`);
    else if (shape(T.make(kind, 1).text, kind) !== shape(text, kind)) out.push(`${text}: kind ${kind} is a different sort of sum`);
    check(q).forEach(x => out.push(text + ': ' + x));
  });
  return out;
}

/* ---------- the cheats in their fixed words, and the warm-up taps ---------- */
const CHEATS = {
  same: 'Same signs make a plus.', diff: 'Different signs make a minus.', rule: 'Same signs make a plus. Different signs make a minus.',
  coverT: 'Cover the signs. Times the numbers.', coverD: 'Cover the signs. Divide the numbers.', noSign: 'A number with no sign is a plus number.',
  brackets: 'Brackets hold a number and its sign.', zero: 'Anything times 0 is 0.', pair: 'Pair up the minus signs. A pair makes a plus.',
  left: 'One left over makes a minus.', noLeft: 'No minus sign is left over. The answer is plus.', little: 'The little 2 means times by itself.',
  boxDiff: 'The answer is minus, so the signs are different.', boxSame: 'The answer is plus, so the signs are the same.', find: 'Cover the signs. Find the number.',
  change: 'Change side, change sign.', first: 'Do the brackets first.', tell: 'No × or ÷? Add or take away.', putMinus: 'Put the minus on the number.', noNeed: 'A plus answer needs no sign.', boxNoNeed: 'The box is plus, so it needs no sign.',
};
function cheatFaults(SAY, said) {
  const out = [];
  Object.keys(CHEATS).forEach(k => {
    if (SAY[k] !== CHEATS[k]) out.push(`cheat "${k}" has changed its words: ${SAY[k]}`);
    if (words(CHEATS[k]) > 10) out.push('cheat over 10 words: ' + CHEATS[k]);
    if (said && ![...said].some(s => s.indexOf(CHEATS[k]) >= 0)) out.push('cheat never used on a sum: ' + CHEATS[k]);
  });
  if (Mn.SAY.mm.indexOf(CHEATS.same) < 0 || Mn.SAY.pm.indexOf(CHEATS.diff) < 0) out.push('Minus numbers no longer says the sign cheat in the same words');
  return out;
}
const WARM_KEY = [
  ['Times: two minus numbers. What sign is the answer?', 'Plus'], ['Times: one minus number, one plus number. What sign is the answer?', 'Minus'],
  ['What do you look at first in a times sum?', 'The signs'], ['Divide: two minus numbers. What sign is the answer?', 'Plus'],
  ['Divide: one plus number, one minus number. What sign is the answer?', 'Minus'], ['A number has no sign in front. What is it?', 'A plus number'],
  ['A times sum has three minus signs. What sign is the answer?', 'Minus'], ['A times sum has two minus signs. What sign is the answer?', 'Plus'],
  ['What does the little 2 in (−5)² mean?', '−5 × −5'], ['□ × −3 = −12. The box and the −3: same signs or different?', 'Different'],
  ['□ × −3 = 12. The box and the −3: same signs or different?', 'The same'], ['A number changes side. What happens to its sign?', 'It changes'],
  ['Which part of a sum do you do first?', 'The brackets'], ['−4 − 5 has no × or ÷. What do you do?', 'Add or take away'], ['−3 − 6: do the two minus signs make a plus?', 'No'],
];
function warmFaults(list, lessons) {
  const out = [];
  if (list.length !== WARM_KEY.length) out.push(`${list.length} warm-ups, the answer key has ${WARM_KEY.length}`);
  list.forEach((w, i) => {
    const key = WARM_KEY.find(k => k[0] === w.ask);
    if (!key) out.push('warm-up not in the answer key: ' + w.ask); else if (key[1] !== w.right) out.push(`warm-up "${w.ask}" marks "${w.right}" right, the key says "${key[1]}"`);
    if (w.right === w.wrong) out.push('warm-up choices are the same: ' + w.right);
    if (words(w.ask) > 14) out.push('warm-up question over 14 words: ' + w.ask);
    if (words(w.why) > 10) out.push('warm-up reason over 10 words: ' + w.why);
    [w.right, w.wrong].forEach(o => { if (words(o) > 6) out.push('warm-up choice over 6 words: ' + o); });
    if (!lessons.some(L => L.warm.some(g => g.indexOf(i) >= 0))) out.push('warm-up never asked: ' + w.ask);
  });
  return out;
}

/* ---------- run ---------- */
let bad = 0;
const fail = (where, list) => { if (!list.length) return; bad += list.length; console.log('FAULT ' + where + '\n  ' + list.slice(0, 6).map(s => String(s).slice(0, 230)).join('\n  ')); };

console.log('Times and divide: every kind of sum, 300 of each');
T.KINDS.forEach(kind => {
  const answers = {}, texts = {};
  let faults = [];
  for (let seed = 1; seed <= 300; seed++) {
    const q = T.make(kind, seed);
    if (q.kind !== kind || q.seed !== seed) faults.push('kind or seed not set');
    if (T.make(kind, seed).text !== q.text) faults.push('the same seed gives a different sum');
    faults = faults.concat(check(q).map(x => `${q.text}: ${x}`));
    answers[q.answer] = 1; texts[q.text] = 1;
  }
  const na = Object.keys(answers).length, nt = Object.keys(texts).length;
  if (nt < 12) faults.push(`only ${nt} different sums`);
  if (na < 6 && kind !== 'x0') faults.push(`only ${na} different answers`);
  const ex = T.make(kind, 3);
  console.log(`  ${kind.padEnd(22)} ${String(nt).padStart(3)} sums, ${String(na).padStart(3)} answers   e.g. ${ex.full}`);
  fail(kind, faults);
});

console.log('Sets for each lesson, 200 sittings of each');
const famOf = kind => (facts(T.make(kind, 1)) || {}).fam;
T.LESSONS.forEach(L => {
  ['see', 'try', 'quiz'].forEach(mode => {
    const has = !!L[mode];
    if (L.stages.includes(mode) !== has || has !== !!(SIZES[L.id] || {})[mode]) fail(`${L.id} ${mode}`, ['stage list, sum list and design disagree']);
    if (!has) return;
    let faults = [];
    for (let seed = 1; seed <= 200; seed++) faults = faults.concat(checkSet(T.set(L.id, mode, seed), L, mode));
    fail(`${L.id} ${mode}`, faults);
  });
  if (L.id !== 'tmix') {
    const taught = {}; [].concat(...L.try).forEach(k => { taught[famOf(k)] = 1; });
    fail(`${L.id} plan`, [].concat(...L.quiz).filter(k => !taught[famOf(k)]).map(k => `quiz kind ${k} is never practised in Try it`));
  }
  let faults = [];
  for (let seed = 1; seed <= 100; seed++) {
    const w = T.warm(L.id, seed);
    if (w.length !== 2) faults.push('warm-up is not two questions');
    w.forEach(x => { if (x.options.length !== 2 || x.options.filter(o => o.right).length !== 1) faults.push('warm-up needs two choices, one right'); });
    if (w.length === 2 && w[0].ask === w[1].ask) faults.push('warm-up asks the same thing twice');
  }
  fail(`${L.id} warm-up`, faults);
  console.log(`  ${L.id.padEnd(5)} ${L.title.padEnd(28)} ${L.stages.join(', ')}`);
});
[[5, 5, 3], [4, 5, 2], [3, 5, 1], [2, 5, 0], [10, 10, 3], [8, 10, 2], [6, 10, 1], [5, 10, 0], [12, 12, 3], [10, 12, 2], [8, 12, 1], [7, 12, 0]].forEach(([s, t, want]) => {
  if (T.stars(s, t) !== want || Mn.stars(s, t) !== want || Q.stars(s, t) !== want) fail('stars', [`${s} of ${t} should be ${want} stars`]);
});

console.log('The class sheets: ' + SHEET.length + ' questions');
fail('class sheets', sheetFaults(SHEET, T.KINDS));
fail('cheat words', cheatFaults(T.SAY, SAID));
fail('warm-up words', warmFaults(T.WARM, T.LESSONS));

/* Planted faults: each one must be caught. */
console.log('Planted faults');
const swap = (s, a, reason) => { s.answer = a; s.wrong = { [s.opts.find(o => o.v !== a).v]: reason }; };
const controls = [
  ['answer one out', () => T.two(X, -4, 3), q => { q.answer += 1; }],
  ['Show me marks the wrong sign right', () => T.two(X, -4, -3), q => swap(q.see[1], 'minus', 'Look again. Same signs make a plus.')],
  ['same or different marked wrong', () => T.two(X, 5, -6), q => swap(q.see[0], 'same', 'Look again. A number with no sign is a plus number.')],
  ['sign picture that makes the wrong sign', () => T.two(D, -28, 4), q => { q.beats[0].srow.made = 1; }],
  ['sign picture with another sum\'s signs', () => T.two(X, -4, 3), q => { q.help[1].srow = { signs: [-1, -1], made: 1 }; }],
  ['covered sum that is false', () => T.two(D, -28, -4), q => { q.fin[0].dsum = '28 ÷ 4 = 8'; }],
  ['covered sum still wearing its minus', () => T.two(X, -4, 3), q => { q.fin[0].dsum = '−4 × 3 = −12'; }],
  ['help that prints the answer', () => T.two(X, -4, 3), q => { q.help[2].sums = ['4 × 3 = 12']; }],
  ['help step of 12 words', () => T.two(X, -4, 3), q => { q.help[1].say = 'Different signs make a minus so the answer here is a minus.'; }],
  ['slip equal to the right answer', () => T.two(X, -4, 3), q => { q.slips.push({ value: q.answer, tag: 'sign', say: 'Right number, wrong sign.' }); }],
  ['no slip for the wrong sign', () => T.two(X, -4, 3), q => { q.slips = q.slips.filter(s => s.tag !== 'sign'); }],
  ['wrong option with no "Look again."', () => T.two(X, -4, 3), q => { q.try[0].wrong = { plus: 'Different signs make a minus.' }; }],
  ['"Put the minus" on a plus answer', () => T.two(X, -4, -3), q => { q.fin[1].say = 'Put the minus on the number.'; }],
  ['says "same signs" when they are different', () => T.two(X, -4, 3), q => { q.beats[0].say = 'Same signs make a plus.'; }],
  ['job line of 16 words', () => T.two(X, -4, 3), q => { q.try[0].job = 'Look at the two signs in this sum and say which sign the answer will get.'; }],
  ['Try it with no answer pad', () => T.two(X, -4, 3), q => { q.try.pop(); }],
  ['Try it shows the finished sum first', () => T.two(X, -4, 3), q => { q.try[0].then.full = true; }],
  ['sign help that gives the sign away', () => T.two(X, -4, 3), q => { q.try[0].hp.push({ say: 'Different signs make a minus.', srow: { signs: [-1, 1], made: -1 } }); }],
  ['spoken sum missing a number', () => T.two(X, -4, 3), q => { q.desc = 'minus 4 times'; }],
  ['wrong-answer reason that makes the screen over 25 words', () => T.two(X, -4, 3), q => { q.slips.find(x => x.tag === 'sign').say = 'Right number, wrong sign. Different signs make a minus. Different signs make a minus. Different signs make a minus.'; }],
  ['pieces that spell a different sum', () => T.two(X, -4, 3), q => { q.toks[2].v = 4; }],
  ['a misspelt picture key', () => T.two(X, -4, 3), q => { q.fin[0].dsumm = q.fin[0].dsum; delete q.fin[0].dsum; }],
  ['times 0 with the other number marked right', () => T.zero(-7), q => swap(q.see[0], 'num', 'Look again. Anything times 0 is 0.')],
  ['three numbers: a minus sign left off the tap list', () => T.three(-4, -3, -5), q => { q.see[0].right = [0, 2]; }],
  ['three numbers: one minus sign too few in the picture', () => T.three(-4, -3, -5), q => { q.beats[0].srow = { signs: [-1, -1], pairs: true, made: 1 }; }],
  ['three numbers: second sum false', () => T.three(-4, -3, -5), q => { q.fin[1].dsum = '12 × 5 = 50'; }],
  ['three numbers: says a pair when one is left over', () => T.three(-4, -3, -5), q => { q.help[1].say = 'No minus sign is left over. The answer is plus.'; }],
  ['square: the wrong meaning marked right', () => T.square(3), q => swap(q.see[0], 'two', 'Look again. The little 2 means times by itself.')],
  ['square: no slip for the minus answer', () => T.square(3), q => { q.slips = q.slips.filter(s => s.tag !== 'squareMinus'); }],
  ['box: wrong sign marked for the box', () => T.box('ta', -4, -44), q => swap(q.see[1], 'minus', 'Look again. The 4 is minus. The signs are different.')],
  ['box: "same or different" does not say which two signs', () => T.box('ta', -4, -44), q => { q.see[0].job = 'Look at the answer. Same or different signs?'; }],
  ['box: names the wrong number beside the box', () => T.box('ta', -4, -44), q => { q.see[0].job = 'Look at the answer. The box and the −44: same signs or different?'; }],
  ['box divided by a number: help leaves out the times sum', () => T.box('da', -11, 7), q => { q.help[2].sums = ['? ÷ 11 = 7']; }],
  ['number divided by a box: help leaves out the sum she can do', () => T.box('db', -55, -5), q => { q.help[2].sums = ['55 ÷ ? = 5']; }],
  ['number divided by a box: the sum beside it is the wrong one', () => T.box('db', -55, -5), q => { q.help[2].sums = ['55 ÷ ? = 5', '5 × 55 = ?']; }],
  ['box: "a plus answer" said where the answer is minus', () => T.box('ta', -5, -10), q => { q.fin[2].say = 'A plus answer needs no sign.'; }],
  ['box: called plus when the box is minus', () => T.box('ta', -5, 10), q => { q.fin[2].say = 'The box is plus, so it needs no sign.'; }],
  ['box: covered sum with the wrong number', () => T.box('ta', -4, -44), q => { q.fin[1].dsum = '12 × 4 = 44'; }],
  ['box: answer that does not fit the sum', () => T.box('db', -6, 3), q => { q.answer = 2; }],
  ['box: says the answer is plus when it is minus', () => T.box('ta', -4, -44), q => { q.beats[0].say = 'The answer is plus, so the signs are the same.'; }],
  ['add box: the number keeps its sign when it moves', () => T.boxAdd('g', -5, 13), q => { q.see[1].then.line[3].v = M; }],
  ['add box: "becomes" marked wrong', () => T.boxAdd('g', -5, 13), q => swap(q.try[0], 'minus', 'Look again. Change side, change sign.')],
  ['add box: pad asks for the wrong sum', () => T.boxAdd('h', -3, 4), q => { q.try[1].job = 'Now work out 4 − 3.'; }],
  ['add box: no slip for the number that did not change sign', () => T.boxAdd('g', -5, 13), q => { q.slips = q.slips.filter(s => s.tag !== 'notFlipped'); }],
  ['brackets: wrong answer for the brackets', () => T.boxBr('d', -6, -5, 3), q => { q.try[0].answer = -30; q.try[0].slips = [{ value: 30, say: 'Look again. Same signs make a plus.' }]; }],
  ['two steps: help prints the finished line', () => T.box2(-2, 5, 8), q => { q.help[2].sums = [q.full]; }],
  ['two steps: line after the move is false', () => T.box2(-2, 5, 8), q => { q.try[0].then[0].line[5].v = M; }],
  ['mixed quiz add sum that says it is a times sum', () => T.make('add:neg-minus', 3), q => { q.beats[1].say = 'Cover the signs. Times the numbers.'; }],
];
let caught = 0, extra = 0;
controls.forEach(([name, mk, plant]) => {
  const clean = mk();
  if (check(clean).length) { bad++; return console.log('  CONTROL NOT CLEAN BEFORE PLANTING: ' + name + '  ' + check(clean)[0]); }
  const q = clone(clean); plant(q);
  if (check(q).length) caught++; else { bad++; console.log('  NOT CAUGHT: ' + name); }
});
const also = (name, faults) => { extra++; if (faults.length) caught++; else { bad++; console.log('  NOT CAUGHT: ' + name); } };
const twice = T.set('t2', 'quiz', 5); twice[3] = clone(twice[1]); twice[3].n = 4;
also('the same sum twice in a quiz', checkSet(twice, T.lesson('t2'), 'quiz'));
const stray = T.set('t2', 'quiz', 5); stray[2] = T.make('x-+', 9); stray[2].n = 3;
also('a times sum in the divide lesson', checkSet(stray, T.lesson('t2'), 'quiz'));
const noAdd = T.set('tmix', 'quiz', 5).map((q, i) => { const r = q.fam === 'add' ? T.make('x--', 50 + i) : q; r.n = i + 1; return r; });
also('a mixed quiz with no add or take-away sum', checkSet(noAdd, T.lesson('tmix'), 'quiz'));
also('a quiz one sum short', checkSet(T.set('t1', 'quiz', 5).slice(0, 9), T.lesson('t1'), 'quiz'));
const flipped = clone(T.WARM); [flipped[9].right, flipped[9].wrong] = [flipped[9].wrong, flipped[9].right];
also('a warm-up with the wrong choice marked right', warmFaults(flipped, T.LESSONS));
const unasked = clone(T.LESSONS).map(L => { L.warm = L.warm.map(g => g.filter(i => i !== 12)); return L; });
also('a warm-up that is never asked', warmFaults(T.WARM, unasked));
const respelt = SHEET.map(r => r.slice()); respelt[20][2] = '(−2) × 6';
also('a sheet question spelt differently from the sheet', sheetFaults(respelt, T.KINDS));
const wrongKey = SHEET.map(r => r.slice()); wrongKey[14][3] = -144;
also('a sheet answer that disagrees with the app', sheetFaults(wrongKey, T.KINDS));
also('a sheet question whose kind is in no lesson', sheetFaults(SHEET.slice(70, 71), T.KINDS.filter(k => k !== 'bdb')));
also('a cheat whose words have changed', cheatFaults(Object.assign({}, T.SAY, { change: 'Swap sides and swap the sign.' }), null));
console.log(`  controls caught: ${caught} of ${controls.length + extra}`);

console.log(bad ? `\nG1 TIMES FAILED (${bad})` : '\nG1 times passed');
process.exit(bad ? 1 : 0);
