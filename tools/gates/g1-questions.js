#!/usr/bin/env node
/* G1: the question gate. Every kind of question, 400 seeds each, is checked against rules
   taken from the design (SPEC §6). Then faults are planted on purpose: every planted fault
   must be caught, or the gate itself fails.   Run: node tools/gates/g1-questions.js */
const path = require('path');
const Q = require(path.join(__dirname, '..', '..', 'js', 'questions.js'));
const D = require(path.join(__dirname, '..', '..', 'js', 'diagram.js'));
const SEEDS = 400, near = (a, b) => Math.abs(a - b) < 0.01;
const words = s => s.trim().split(/\s+/).length;

function rectHitsSeg(l, s, shrink) {
  const x0 = l.x - l.w / 2 + shrink, x1 = l.x + l.w / 2 - shrink, y0 = l.y - l.h / 2 + shrink, y1 = l.y + l.h / 2 - shrink;
  let t0 = 0, t1 = 1; const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
  for (const [p, q] of [[-dx, s.a[0] - x0], [dx, x1 - s.a[0]], [-dy, s.a[1] - y0], [dy, y1 - s.a[1]]]) {
    if (p === 0) { if (q < 0) return false; } else { const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  }
  return true;
}

function check(q) {
  const f = [], par = q.topic === 'par', s = q.spec;
  if (!Number.isInteger(q.answer) || q.answer < 10 || q.answer > 340) f.push('answer not a sensible whole number: ' + q.answer);
  if (!par && [90, 180, 360].includes(q.answer)) f.push('answer is a give-away number');
  let L;
  try { L = D.layout(s); } catch (e) { return f.concat('layout threw: ' + e.message); }
  // the picture is drawn to the stated sizes
  if (s.type === 'fan') {
    const sum = s.arcs.reduce((t, a) => t + a.value, 0);
    if (sum !== (s.line ? 180 : 360)) f.push('fan angles add to ' + sum);
    if (sum !== q.total) f.push('total does not match the picture');
    s.arcs.forEach((a, i) => {
      if (!near(L.arcs[i].sweep, a.value)) f.push(`drawn ${L.arcs[i].sweep} for stated ${a.value}`);
      if (a.key === 'x' && a.value !== q.answer) f.push('x arc is not the answer');
      if (a.key !== 'x' && !a.square && a.label !== a.value + '°') f.push('label does not match its angle');
      if (a.square && a.value !== 90) f.push('square on a non-right angle');
      if (!a.square && a.value < 25) f.push('angle too thin to label: ' + a.value);
    });
    if (!s.arcs.some(a => a.key === 'x')) f.push('no x in the picture');
  } else if (s.type === 'tri') {
    if (s.angles.reduce((t, a) => t + a, 0) !== 180) f.push('triangle angles do not add to 180');
    if (Math.min(...s.angles) < 25) f.push('triangle corner too thin');
    const P = D.triPoints(s); let hasX = false;
    s.angles.forEach((a, i) => {
      if (!near(D.corner(P, i).sweep, a)) f.push(`corner drawn ${D.corner(P, i).sweep} for stated ${a}`);
      const c = (s.corners || [])[i]; if (!c) return;
      if (c.key === 'x') { hasX = true; if (a !== q.answer) f.push('x corner is not the answer'); }
      else if (c.square) { if (a !== 90) f.push('square on a non-right angle'); }
      else if (c.label !== a + '°') f.push('corner label does not match its angle');
    });
    if (s.ext) { hasX = true; const e = L.arcs[L.arcs.length - 1]; if (!near(e.sweep, 180 - s.angles[s.ext.at])) f.push('outside angle drawn wrong'); if (!near(e.sweep, q.answer)) f.push('outside angle is not the answer'); }
    if (!hasX) f.push('no x in the picture');
    if ((s.equal || []).length && s.angles[0] !== s.angles[1]) f.push('equal-side marks on unequal angles');
  } else {
    const d = D.n360(s.b - s.a);
    if (!(d >= 40 && d <= 140) || (d > 78 && d < 102)) f.push('crossing angle unclear: ' + d);
    s.arcs.forEach((a, i) => {
      if (!near(L.arcs[i].sweep, a.value)) f.push(`drawn ${L.arcs[i].sweep} for stated ${a.value}`);
      if (a.key === 'x' && a.value !== q.answer) f.push('x arc is not the answer');
      if (a.key !== 'x' && a.label !== a.value + '°') f.push('label does not match its angle');
    });
    if (s.arcs.length !== 2 || (s.arcs[0].cross === s.arcs[1].cross && s.arcs[0].q === s.arcs[1].q)) f.push('x sits on the given angle');
  }
  // the given numbers never hold the answer (parallel lines excepted: there the twin IS the lesson)
  if (!par) L.labels.forEach(l => { if (l.text === q.answer + '°') f.push('the picture shows the answer'); });
  // labels are readable
  L.labels.forEach((l, i) => {
    L.labels.forEach((m, j) => { if (j > i && Math.abs(l.x - m.x) < (l.w + m.w) / 2 + 1 && Math.abs(l.y - m.y) < (l.h + m.h) / 2 + 1) f.push(`labels ${l.text} and ${m.text} overlap`); });
    L.segs.forEach(sg => { if (rectHitsSeg(l, sg, 2.5)) f.push(`label ${l.text} sits on a line`); });
  });
  if (L.vb[2] > 420 || L.vb[3] > 330 || L.vb[2] / L.vb[3] > 2.6) f.push('picture too big or too wide: ' + L.vb.slice(2).map(Math.round));
  // the working is true and ends at the answer
  q.steps.forEach(line => {
    const m = line.match(/^(\d+) ([+−÷]) (\d+) = (\d+)/);
    if (m) { const a = +m[1], b = +m[3], v = m[2] === '+' ? a + b : m[2] === '−' ? a - b : a / b; if (v !== +m[4]) f.push('false working: ' + line); }
  });
  const last = (q.steps[q.steps.length - 1].match(/= (\d+)°$/) || [])[1];
  if (+last !== q.answer) f.push('working does not end at the answer');
  // slips
  const seen = new Set();
  q.slips.forEach(sl => {
    if (sl.value === q.answer) f.push('a slip equals the answer');
    if (!Number.isInteger(sl.value) || sl.value <= 0) f.push('slip is not a whole number');
    if (seen.has(sl.value)) f.push('same slip twice'); seen.add(sl.value);
    if (!sl.tag || !sl.say || words(sl.say) > 14) f.push('slip without a short reason');
  });
  if (!q.slips.length) f.push('no slips');
  // help: 1 to 3 steps, 10 words at most, never the answer
  if (q.help.length < 1 || q.help.length > 3) f.push('help has ' + q.help.length + ' steps');
  q.help.forEach(h => { if (words(h) > 10) f.push('help step over 10 words: ' + h); if (!par && new RegExp('(^|\\D)' + q.answer + '(\\D|$)').test(h)) f.push('help gives the answer'); });
  // the ring closes exactly with the answer
  if (q.ring) { const t = q.ring.pieces.reduce((a, b) => a + b, 0) + q.ring.n * q.answer; if (t !== q.ring.total) f.push('ring does not close: ' + t); }
  else if (!par) f.push('no ring');
  // first step of "Try it": exactly one right option
  if (q.choice.options.filter(o => o.right).length !== 1) f.push('choice has no single right option');
  if (Q.judge(q, q.answer).right !== true || Q.judge(q, q.answer + 1).right !== false) f.push('judge is wrong');
  return f;
}

let bad = 0;
for (const kind of Q.KINDS) {
  const faults = {}, answers = new Set(); let n = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q; try { q = Q.make(kind, seed); } catch (e) { faults['make threw: ' + e.message] = (faults['make threw: ' + e.message] || 0) + 1; n++; continue; }
    answers.add(q.answer);
    const f = check(q); if (f.length) n++;
    f.forEach(x => { const k = x.replace(/\d+(\.\d+)?/g, 'N'); faults[k] = (faults[k] || 0) + 1; });
  }
  const a = [...answers];
  console.log(`${n ? 'FAIL' : 'ok  '} ${kind.padEnd(8)} ${SEEDS - n}/${SEEDS}  answers ${Math.min(...a)}–${Math.max(...a)} (${a.length} different)`);
  Object.entries(faults).slice(0, 6).forEach(([k, c]) => console.log(`       ${c} × ${k}`));
  if (n) bad++;
  if (a.length < 12) { console.log('       too few different answers'); bad++; }
}
// every sitting builds, with the right count and no repeated question
for (const L of Q.LESSONS) for (const mode of ['try', 'quiz']) for (let seed = 1; seed <= 50; seed++) {
  const qs = Q.set(L.id, mode, seed), want = mode === 'try' ? L.tryKinds.length : L.quiz.length;
  const keys = new Set(qs.map(q => q.kind + q.answer));
  if (qs.length !== want || keys.size !== qs.length) { console.log(`FAIL set ${L.id} ${mode} seed ${seed}`); bad++; break; }
}

// planted faults: each one must be caught
const clone = q => JSON.parse(JSON.stringify(q));
const controls = [
  ['answer one out', 'pt2', q => { q.answer += 1; }],
  ['picture drawn 10° out', 'line3', q => { q.spec.arcs[0].to += 10; q.spec.arcs[1].from += 10; }],
  ['a slip equal to the answer', 'ptSq', q => { q.slips[0].value = q.answer; }],
  ['working ends somewhere else', 'tri2', q => { q.steps[q.steps.length - 1] = q.steps[q.steps.length - 1].replace(/= \d+°$/, '= ' + (q.answer + 2) + '°'); }],
  ['false sum in the working', 'ptEq', q => { q.steps[0] = q.steps[0].replace(/= \d+/, '= 999'); }],
  ['two labels on top of each other', 'pt2', q => { q.spec.arcs[1].from = q.spec.arcs[0].from; q.spec.arcs[1].to = q.spec.arcs[0].to; }],
  ['help step of 11 words', 'line2', q => { q.help[0] = 'one two three four five six seven eight nine ten eleven'; }],
  ['help that gives the answer', 'lineEq', q => { q.help[1] = 'x is ' + q.answer + '.'; }],
  ['picture shows the answer', 'tri2', q => { const i = q.spec.corners.findIndex(c => c && c.key === 'x'); q.spec.corners[i].label = q.answer + '°'; q.spec.corners[i].key = 'k'; }],
  ['square on a 60° corner', 'triSq', q => { const i = q.spec.angles.indexOf(90); q.spec.angles[i] = 60; q.spec.angles[(i + 1) % 3] += 30; }],
  ['ring that does not close', 'isoApex', q => { q.ring.n = 1; }],
  ['x drawn on the given angle', 'parTwo', q => { q.spec.arcs[1].cross = q.spec.arcs[0].cross; q.spec.arcs[1].q = q.spec.arcs[0].q; }],
  ['two right options', 'parOne', q => { q.choice.options.forEach(o => { o.right = true; }); }],
];
for (const [name, kind, plant] of controls) {
  const q = clone(Q.make(kind, 7)); plant(q);
  const caught = check(q).length > 0;
  console.log(`${caught ? 'ok   caught' : 'FAIL MISSED'}  control: ${name}`);
  if (!caught) bad++;
}
console.log(bad ? `\nG1 FAILED (${bad})` : '\nG1 passed');
process.exit(bad ? 1 : 0);
