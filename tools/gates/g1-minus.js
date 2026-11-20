/* G1 for Minus numbers. Every sum the bank can make is checked against an answer worked out a different way
   (the sum is read back from its own text and worked by the computer), and the two cheats are checked to give
   that same answer every time. Planted faults at the end must all be caught.
   Run: node tools/gates/g1-minus.js */
const Mn = require('../../js/minus.js');
const Q = require('../../js/questions.js');
const M = '−';
const words = s => String(s).trim().split(/\s+/).filter(Boolean).length;
const clone = o => JSON.parse(JSON.stringify(o));
const word = neg => neg ? 'minus' : 'plus';

function join(toks) {
  let s = '';
  toks.forEach(t => { s += t.k === 'num' ? t.v : t.role === 'op' ? ` ${t.v} ` : t.v; });
  return s;
}

function check(q) {
  const out = [], bad = m => out.push(m);
  const m = /^(−?)(\d) ([+−]) (−?)(\d)$/.exec(q.text);
  if (!m) { bad('sum not in the set form: ' + q.text); return out; }
  const a = +m[2], b = +m[5], neg1 = m[1] === M, own = m[4] === M, op = m[3];
  const truth = Function('return ' + q.text.replace(/−/g, '-'))();
  if (a === b) bad('the two numbers are equal');
  if (a < 1 || b < 1) bad('a number below 1');
  if (truth === 0) bad('the answer is zero');
  if (q.answer !== truth) bad(`answer ${q.answer} but the sum makes ${truth}`);

  // The cheats themselves, worked here from the text alone.
  const neg2 = (op === M) !== own, same = neg1 === neg2, big = Math.max(a, b), small = Math.min(a, b), bigNeg = a > b ? neg1 : neg2;
  const size = same ? a + b : big - small, cheat = (bigNeg ? -1 : 1) * size;
  if (cheat !== truth) bad(`the cheats give ${cheat}, the sum makes ${truth}`);
  if (q.same !== same || q.big !== big || q.small !== small || q.bigNeg !== bigNeg) bad('same/bigger facts are wrong');
  if (!q.terms || q.terms.length !== 2 || q.terms[0].n !== a || q.terms[1].n !== b || q.terms[0].neg !== neg1 || q.terms[1].neg !== neg2) bad('terms are wrong');

  // Cheat 1: signs that touch.
  const makes = own ? (op === M ? '+' : M) : null;
  if (!!q.touch !== own) bad('touch flag is wrong');
  if (own && q.touch && q.touch.makes !== makes) bad(`touching signs said to make ${q.touch.makes}, they make ${makes}`);
  const wantTidy = own ? (makes === '+' ? 'plus' : 'minus') : 'none';
  if (q.tidyAnswer !== wantTidy) bad(`tidy answer ${q.tidyAnswer}, should be ${wantTidy}`);
  const t = /^(−?)(\d) ([+−]) (\d)$/.exec(q.tidy);
  if (!t) bad('tidy sum still has two signs together: ' + q.tidy);
  else {
    if (Function('return ' + q.tidy.replace(/−/g, '-'))() !== truth) bad(`tidy sum ${q.tidy} does not make ${truth}`);
    if (+t[2] !== a || +t[4] !== b || (t[1] === M) !== neg1) bad('tidy sum changed a number');
  }
  if (join(q.toks) !== q.text) bad('tokens do not spell the sum: ' + join(q.toks));
  if (join(q.tidyToks) !== q.tidy) bad('tidy tokens do not spell the tidy sum: ' + join(q.tidyToks));
  if (q.toks.filter(x => x.pair).length !== (own ? 2 : 0)) bad('the touching pair is not marked');
  if (q.between !== (!own && neg1 ? a : null)) bad('"between" number is wrong');

  // The working: three beats, every sum true.
  if (!q.beats || q.beats.length !== 3) { bad('working is not three steps'); return out; }
  q.beats.forEach(x => { if (words(x.say) > 10) bad('working line over 10 words: ' + x.say); });
  if (q.beats[0].sum !== q.tidy) bad('step 1 does not show the tidy sum');
  const want0 = own ? (op === M ? /^Two minus signs touch\. Same signs make a plus\.$/ : /^A plus touches a minus\. Different signs make a minus\.$/) : /^No signs touch\. Nothing changes\.$/;
  if (!want0.test(q.beats[0].say)) bad('step 1 says the wrong thing: ' + q.beats[0].say);
  const s = /^(\d+) ([+−]) (\d+) = (\d+)$/.exec(q.beats[1].sum);
  if (!s) bad('step 2 sum is not a plain sum: ' + q.beats[1].sum);
  else {
    const x = +s[1], y = +s[3], r = +s[4];
    if ((s[2] === '+') !== same) bad('step 2 uses the wrong sign for same/different');
    if ((s[2] === '+' ? x + y : x - y) !== r) bad('step 2 sum is false: ' + q.beats[1].sum);
    if (s[2] === M && (x !== big || y !== small)) bad('step 2 does not take the smaller from the bigger');
    if (s[2] === '+' && (x !== a || y !== b)) bad('step 2 does not add her two numbers');
    if (r !== Math.abs(truth)) bad('step 2 does not reach the size of the answer');
  }
  const want1 = same ? new RegExp(`^Both numbers are ${word(neg1)}\\. Same signs: add\\.$`) : new RegExp(`^${neg1 ? 'One minus, one plus' : 'One plus, one minus'}\\. Different signs: take away\\.$`);
  if (!want1.test(q.beats[1].say)) bad('step 2 says the wrong thing: ' + q.beats[1].say);
  if (q.beats[2].sum !== `${q.text} = ${Mn.num(truth)}`) bad('step 3 does not end on the answer: ' + q.beats[2].sum);
  if (q.beats[2].say !== `Bigger wins the sign. The ${big} is ${word(bigNeg)}.`) bad('step 3 says the wrong thing: ' + q.beats[2].say);

  // Stuck? Show me: the same three lines, the last sum left open, the answer never printed.
  if (!q.help || q.help.length !== 3) bad('help is not three steps');
  else {
    q.help.forEach((h, i) => {
      if (h.say !== q.beats[i].say) bad('help line differs from the working line: ' + h.say);
      if (words(h.say) > 10) bad('help step over 10 words: ' + h.say);
      (h.sums || []).concat(h.say).forEach(x => { if (/= −?\d/.test(x)) bad('help gives a finished sum: ' + x); });
    });
    const h0 = q.help[0].sums || [], h1 = q.help[1].sums || [], h2 = q.help[2].sums || [];
    if (own ? (h0.length !== 1 || h0[0] !== q.text + ' → ' + q.tidy) : h0.length !== 0) bad('help step 1 shows the wrong sum');   // the signs that touch, then what they become
    const wantOpen = same ? `${a} + ${b} = ?` : `${big} ${M} ${small} = ?`;
    if (h1.length !== 1 || h1[0] !== wantOpen) bad(`help step 2 should show "${wantOpen}", it shows "${h1.join(' | ')}"`);
    if (h2.length) bad('help step 3 should have no sum');
  }
  if (!q.helpTidy || q.helpTidy.length !== 2) bad('lesson 1 help is not two steps');
  else {
    q.helpTidy.forEach(h => { if (words(h.say) > 10) bad('help step over 10 words: ' + h.say); });
    const mark = own ? 'pair' : neg1 ? 'apart' : 'one';
    if (q.helpTidy[0].mark !== mark) bad(`lesson 1 help points at "${q.helpTidy[0].mark}", should be "${mark}"`);
    if (mark === 'apart' && q.helpTidy[0].say.indexOf(`The ${a} sits between`) < 0) bad('lesson 1 help names the wrong number between the signs');
  }

  // Slips: each one a real wrong answer, each with a reason.
  const seen = {};
  (q.slips || []).forEach(sl => {
    if (sl.value === truth) bad(`slip "${sl.tag}" is the right answer`);
    if (seen[sl.value]) bad('two slips with the same value ' + sl.value);
    seen[sl.value] = 1;
    if (!sl.say || words(sl.say) > 14) bad('slip reason missing or over 14 words: ' + sl.say);
    if (!/^(notTidied|twoMinus|sign|tookAway|added)$/.test(sl.tag)) bad('unknown slip ' + sl.tag);
  });
  const tagAt = v => { const sl = (q.slips || []).find(x => x.value === v); return sl ? sl.tag : ''; };
  const v1 = neg1 ? -a : a, v2 = truth - v1;
  if (own && tagAt(v1 - v2) !== 'notTidied') bad('no "left the touching signs" slip at ' + (v1 - v2));
  if (!own && tagAt(v1 - v2) === 'notTidied') bad('"left the touching signs" slip on a sum with no touching signs');
  if (neg1 && op === M && !own && tagAt(a + b) !== 'twoMinus') bad('no "two minus signs make a plus" slip at ' + (a + b));
  if (!/^(sign|twoMinus)$/.test(tagAt(-truth))) bad('no "wrong sign" slip at ' + (-truth));
  if (same) [a - b, b - a].forEach(v => { if (!/^(tookAway|notTidied)$/.test(tagAt(v))) bad('no "took away" slip at ' + v); });
  else [a + b, -(a + b)].forEach(v => { if (v !== truth && !/^(added|notTidied)$/.test(tagAt(v))) bad('no "added" slip at ' + v); });
  (q.slips || []).forEach(sl => {
    if (sl.tag === 'sign' && sl.say.indexOf(`the ${big} is ${word(bigNeg)}`) < 0) bad('wrong-sign reason names the wrong number: ' + sl.say);
    if (sl.tag === 'twoMinus' && sl.say.indexOf(`The ${a} sits between`) < 0) bad('two-minus reason names the wrong number: ' + sl.say);
    if (sl.tag === 'notTidied' && sl.say.indexOf(q.tidy) < 0) bad('touching-signs reason does not show the tidy sum: ' + sl.say);
  });

  // The judge.
  const j = Mn.judge(q, truth);
  if (!j.right) bad('the right answer is marked wrong');
  [truth + 1, truth - 1, -truth, truth + 7].forEach(v => { if (v !== truth && Mn.judge(q, v).right) bad(`wrong answer ${v} is marked right`); });
  (q.slips || []).forEach(sl => { const r = Mn.judge(q, sl.value); if (r.right || r.slip !== sl.tag || r.say !== sl.say) bad('judge does not name slip ' + sl.tag); });
  ['plus', 'minus', 'none'].forEach(v => {
    const r = Mn.judgeTidy(q, v);
    if (r.right !== (v === wantTidy)) bad(`lesson 1 answer "${v}" judged ${r.right ? 'right' : 'wrong'}`);
    if (!r.right && (!r.slip || !r.say || words(r.say) > 14)) bad('lesson 1 wrong answer has no reason, or one over 14 words');
    if (!r.right && wantTidy === 'none' && neg1 && r.say.indexOf(`The ${a} sits between`) < 0) bad('lesson 1 reason names the wrong number');
  });
  if (!q.desc || !/\d/.test(q.desc)) bad('no spoken description');
  return out;
}

function checkSet(qs, L, mode) {
  const out = [], bad = m => out.push(m), want = { m1: { see: 5, try: 5, quiz: 6 }, m2: { see: 4, try: 4, quiz: 6 }, m3: { try: 4, quiz: 6 }, mmix: { quiz: 8 } }[L.id][mode];
  if (qs.length !== want) bad(`${qs.length} sums, should be ${want}`);
  const seen = {};
  qs.forEach((q, i) => { if (seen[q.text]) bad('the same sum twice: ' + q.text); seen[q.text] = 1; if (q.n !== i + 1) bad('numbering is wrong'); });
  const touch = qs.filter(q => q.touch).length, fam = k => k.replace(/-(up|down)$/, '');
  if (L.id === 'm1' && (touch < 3 || touch === qs.length)) bad(`lesson 1 needs touching signs and at least one trap (has ${touch} of ${qs.length})`);
  if (L.id === 'm2' && touch) bad('lesson 2 has a sum with touching signs');
  if (L.id === 'm2' && mode !== 'see' && qs.some(q => q.kind === 'plain-minus')) bad('lesson 2 has a sum with no minus answer or sign work');
  if (L.id === 'm3' && mode === 'try' && touch !== qs.length) bad('lesson 3 Try it has a sum with no touching signs');
  if (L.id === 'm3' && mode === 'quiz' && touch < 5) bad('lesson 3 quiz has fewer than 5 sums with touching signs');
  if (L.id === 'mmix') {
    const fams = {}; qs.forEach(q => { fams[fam(q.kind)] = 1; });
    ['neg-minus', 'neg-plus', 'pos-minus', 'pos-plus-neg', 'pos-minus-neg', 'neg-plus-neg', 'neg-minus-neg'].forEach(f => { if (!fams[f]) bad('mixed quiz is missing a ' + f + ' sum'); });
  }
  if (L.mode === 'sum' && qs.some(q => q.kind === 'plain-minus')) bad('a plain sum (7 − 3) in a typed quiz');
  return out;
}

let bad = 0;
const fail = (where, list) => { if (!list.length) return; bad += list.length; console.log('FAULT ' + where + '\n  ' + list.slice(0, 6).join('\n  ')); };

console.log('Minus numbers: every kind of sum, 400 of each');
Mn.KINDS.forEach(kind => {
  const answers = {}, texts = {}; let faults = [];
  for (let seed = 1; seed <= 400; seed++) {
    const q = Mn.make(kind, seed);
    if (q.kind !== kind || q.seed !== seed || q.topic !== 'minus') faults.push('kind, seed or topic not set');
    const again = Mn.make(kind, seed); if (again.text !== q.text) faults.push('the same seed gives a different sum');
    faults = faults.concat(check(q).map(f => `${q.text}: ${f}`));
    answers[q.answer] = 1; texts[q.text] = 1;
  }
  const na = Object.keys(answers).length, nt = Object.keys(texts).length;
  if (na < 6) faults.push(`only ${na} different answers`);
  if (nt < 12) faults.push(`only ${nt} different sums`);
  const ex = Mn.make(kind, 3);
  console.log(`  ${kind.padEnd(20)} ${String(nt).padStart(3)} sums, ${String(na).padStart(2)} answers   e.g. ${ex.text} = ${Mn.num(ex.answer)}`);
  fail(kind, faults);
});

console.log('Sets for each lesson, 300 sittings of each');
Mn.LESSONS.forEach(L => {
  ['see', 'try', 'quiz'].forEach(mode => {
    const has = mode === 'see' ? !!L.see : mode === 'try' ? !!L.try : !!L.quiz;
    if (L.stages.includes(mode) !== has) fail(`${L.id} ${mode}`, ['stage list and sum list disagree']);
    if (!has) return;
    let faults = [];
    for (let seed = 1; seed <= 300; seed++) faults = faults.concat(checkSet(Mn.set(L.id, mode, seed), L, mode));
    fail(`${L.id} ${mode}`, faults);
  });
  let faults = [];
  for (let seed = 1; seed <= 100; seed++) {
    const w = Mn.warm(L.id, seed);
    if (w.length !== 2) faults.push('warm-up is not two questions');
    w.forEach(x => {
      if (x.options.length !== 2 || x.options.filter(o => o.right).length !== 1) faults.push('warm-up needs two choices, one right');
      if (words(x.ask) > 12) faults.push('warm-up question over 12 words: ' + x.ask);
      if (words(x.why) > 10) faults.push('warm-up reason over 10 words: ' + x.why);
      x.options.forEach(o => { if (words(o.label) > 6) faults.push('warm-up choice over 6 words: ' + o.label); });
    });
    if (w[0].ask === w[1].ask) faults.push('warm-up asks the same thing twice');
  }
  fail(`${L.id} warm-up`, faults);
  console.log(`  ${L.id.padEnd(5)} ${L.title.padEnd(20)} ${L.stages.join(', ')}`);
});
[[5, 5, 3], [4, 5, 2], [3, 5, 1], [2, 5, 0], [6, 6, 3], [5, 6, 2], [4, 6, 1], [3, 6, 0], [8, 8, 3], [7, 8, 2], [5, 8, 1], [4, 8, 0]].forEach(([s, t, want]) => {
  if (Mn.stars(s, t) !== want || Q.stars(s, t) !== want) fail('stars', [`${s} of ${t} should be ${want} stars`]);
});

// The warm-up taps say the cheats in their own fixed words and nothing else, and every cheat sentence is asked for somewhere.
const CHEAT_WORDS = ['Same signs make a plus.', 'Different signs make a minus.', 'Same signs: add.', 'Different signs: take away.', 'Bigger wins the sign.', 'Cover the signs to see which is bigger.'];
const WANT_CHOICE = { 'Same signs make a plus.': 'A plus', 'Different signs make a minus.': 'A minus', 'Same signs: add.': 'Add', 'Different signs: take away.': 'Take away', 'Cover the signs to see which is bigger.': 'Cover the signs' };
function warmWords(list, lessons) {
  const f = [];
  list.forEach((w, i) => {
    if (CHEAT_WORDS.indexOf(w.why) < 0) f.push('warm-up reason is not in the cheat words: ' + w.why);
    if (WANT_CHOICE[w.why] && w.right !== WANT_CHOICE[w.why]) f.push('warm-up right choice does not use the cheat words: ' + w.right);
    if (w.right === w.wrong) f.push('warm-up choices are the same: ' + w.right);
    if (!lessons.some(L => L.warm.some(g => g.indexOf(i) >= 0))) f.push('warm-up never asked: ' + w.ask);
  });
  CHEAT_WORDS.forEach(c => { if (!list.some(w => w.why === c)) f.push('no warm-up asks for: ' + c); });
  return f;
}
fail('warm-up words', warmWords(Mn.WARM, Mn.LESSONS));
if (Mn.SAY.cover !== CHEAT_WORDS[5] || Mn.SAY.coverAsk(9, 7) !== 'Cover the signs. Which is bigger: 9 or 7?') fail('cover words', ['the "cover the signs" line has changed']);

// Planted faults: each one must be caught.
console.log('Planted faults');
const controls = [
  ['answer one out', 'neg-minus', q => { q.answer += 1; }],
  ['touching signs make the wrong sign', 'neg-minus-neg-up', q => { q.touch.makes = M; q.tidyAnswer = 'minus'; }],
  ['tidy sum that changes the answer', 'pos-plus-neg-down', q => { q.tidy = q.tidy.replace(M, '+'); q.beats[0].sum = q.tidy; q.help[0].sums = [q.text + ' → ' + q.tidy]; }],
  ['slip equal to the right answer', 'neg-plus-up', q => { q.slips.push({ value: q.answer, tag: 'sign', say: 'Right number, wrong sign.' }); }],
  ['no slip for two minus signs that do not touch', 'neg-minus', q => { q.slips = q.slips.filter(s => s.tag !== 'twoMinus'); }],
  ['help that gives the answer', 'pos-minus', q => { q.help[1].sums = [q.beats[1].sum]; }],
  ['help sum with the wrong numbers', 'neg-plus-down', q => { q.help[1].sums = [`${q.small} − ${q.big} = ?`]; }],
  ['working sum that is false', 'neg-minus', q => { q.beats[1].sum = q.beats[1].sum.replace(/= \d+$/, '= 1'); }],
  ['working line of 11 words', 'pos-minus-neg', q => { q.beats[2].say = 'Bigger wins the sign so the answer here is a plus.'; q.help[2].say = q.beats[2].say; }],
  ['adds when the signs are different', 'pos-minus', q => { q.beats[1].sum = `${q.terms[0].n} + ${q.terms[1].n} = ${q.terms[0].n + q.terms[1].n}`; }],
  ['wrong number wins the sign', 'neg-plus-up', q => { q.beats[2].say = `Bigger wins the sign. The ${q.small} is minus.`; q.help[2].say = q.beats[2].say; }],
  ['slip reason of 15 words', 'neg-plus-neg', q => { q.slips[0].say = 'A plus touches a minus here and so different signs will always make a minus.'; }],
];
let caught = 0;
controls.forEach(([name, kind, plant]) => {
  const q = clone(Mn.make(kind, 7)); plant(q);
  const f = check(q);
  if (f.length) caught++; else { bad++; console.log('  NOT CAUGHT: ' + name); }
});
const zero = check(Mn.build('pos-plus-neg-down', 5, 5));
if (zero.length) caught++; else { bad++; console.log('  NOT CAUGHT: equal numbers, answer zero'); }
const twice = Mn.set('m2', 'quiz', 5); twice[3] = clone(twice[1]);
if (checkSet(twice, Mn.lesson('m2'), 'quiz').length) caught++; else { bad++; console.log('  NOT CAUGHT: the same sum twice in a quiz'); }
const trap = Mn.set('m1', 'quiz', 5).map(q => q.touch ? q : Mn.make('neg-plus-neg', q.seed));
if (checkSet(trap.map((q, i) => { q.n = i + 1; return q; }), Mn.lesson('m1'), 'quiz').length) caught++; else { bad++; console.log('  NOT CAUGHT: lesson 1 quiz with no trap'); }
const reworded = clone(Mn.WARM); reworded[3].right = 'Take the smaller from the bigger';
if (warmWords(reworded, Mn.LESSONS).length) caught++; else { bad++; console.log('  NOT CAUGHT: warm-up choice not in the cheat words'); }
const unasked = clone(Mn.LESSONS).map(L => { L.warm = L.warm.map(g => g.filter(i => i !== 5)); return L; });
if (warmWords(Mn.WARM, unasked).length) caught++; else { bad++; console.log('  NOT CAUGHT: a warm-up that is never asked'); }
console.log(`  controls caught: ${caught} of ${controls.length + 5}`);

console.log(bad ? `\nG1 MINUS FAILED (${bad})` : '\nG1 minus passed');
process.exit(bad ? 1 : 0);
