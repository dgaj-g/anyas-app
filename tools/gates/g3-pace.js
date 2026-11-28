/* G3 pace. Plays the Times and divide and Minus numbers lessons at REAL speed (no fast mode) and fails if the screen rushes her.
   The walk runs in fast mode, so it can never see a rush: this gate is the only one that watches the clock.

   Rules, judged from a log the page keeps of every change she would see:
     READ  words the app puts up stay at least READ ms before the app changes them or the sum (unless she taps first)
     ONE   two things never arrive together: each tape, the small sum, the ring, a sign coming back and a hop are APART ms apart
     SEEN  a sign that gets covered is in view at least LEAD ms before its tape lands
   Control: the same lessons in fast mode MUST break all three rules. If they do not, the gate is blind and it fails.

   Run (the test server must be up on 8787):  NODE_PATH=$(npm root -g) node tools/gates/g3-pace.js [t1,m2,...]
   It never answers a quiz question, so nothing is saved. */
const puppeteer = require('puppeteer');
const BASE = process.env.BASE || 'http://localhost:8787', API = BASE + '/api';
const READ = 1700, APART = 350, LEAD = 400, BEAT = 120;
const only = (process.argv[2] || '').split(',').filter(Boolean);          // no list = every lesson and stage the app itself lists
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* In the page: write down the time of every change she would see, and of every tap. */
function recorder() {
  const log = []; window.__pace = log; let last = {};
  const T = () => Math.round(performance.now());
  const vis = el => !!el && !el.hidden && !el.classList.contains('hold');
  const snap = () => {
    const $ = s => document.querySelector(s), line = $('#line'), ds = $('#dsum'), sr = $('#srow'), say = $('#say'), job = $('#job');
    return {
      job: job ? job.textContent.trim() : '', say: say ? say.textContent.trim() : '',
      line: line ? line.textContent.replace(/\s+/g, '') : '',
      small: vis(ds) ? ds.textContent.trim() : '', row: vis(sr) ? (sr.textContent.replace(/\s+/g, '') || 'row') : '',
      cover: !!(line && line.classList.contains('cover')), tapes: line ? line.querySelectorAll('.tape').length : 0,
      ring: line ? line.querySelectorAll('.big').length : 0, back: line ? line.querySelectorAll('.win').length : 0,
      hop: !!$('.hopg'),
    };
  };
  const look = () => { const now = snap(), t = T(); for (const k in now) if (now[k] !== last[k]) log.push([t, k, now[k]]); last = now; };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true, characterData: true, attributeFilter: ['class', 'hidden'] });
  document.addEventListener('click', () => log.push([T(), 'tap', 1]), true);
  setInterval(look, 50);
}

/* Judge one stage's log. Gives back the faults, by rule, and how much it had to judge. */
function judge(log, name) {
  const out = { READ: [], ONE: [], SEEN: [], read: 0, arrivals: 0, covers: 0 };
  const short = s => String(s).length > 60 ? String(s).slice(0, 57) + '...' : String(s);
  let words = null, arr = null, coverAt = null; const was = {};
  for (const [t, k, v] of log) {
    if (k === 'tap') { words = null; arr = null; continue; }             // she set the pace herself
    if ((k === 'say' || k === 'job' || k === 'line') && words && t - words.t > BEAT) {
      out.read++;
      if (t - words.t < READ) out.READ.push(`${name}: "${short(words.text)}" stayed ${t - words.t} ms, then the ${k === 'line' ? 'sum' : 'words'} changed`);
      words = null;
    }
    if ((k === 'say' || k === 'job' || k === 'small') && v) words = { t, text: v };
    let what = null;
    if (k === 'tapes' && v > (was.tapes || 0)) what = 'a tape';
    if (k === 'small' && v) what = 'the small sum';
    if (k === 'ring' && v > (was.ring || 0)) what = 'the ring';
    if (k === 'back' && v > (was.back || 0)) what = 'the sign coming back';
    if (k === 'hop' && v) what = 'a number crossing';
    if (what) {
      out.arrivals++;
      if (arr && t - arr.t < APART) out.ONE.push(`${name}: ${what} came ${t - arr.t} ms after ${arr.what}`);
      arr = { t, what };
    }
    if (k === 'cover') coverAt = v ? t : null;
    if (k === 'tapes' && v === 1 && coverAt != null) { out.covers++; if (t - coverAt < LEAD) out.SEEN.push(`${name}: the tape landed ${t - coverAt} ms after the cover step began`); coverAt = null; }
    was[k] = v;
  }
  return out;
}

async function run(fast, pickLessons, pickStages) {
  const b = await puppeteer.launch({ headless: 'shell' }), p = await b.newPage(), results = [];
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const errors = []; p.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  await p.evaluateOnNewDocument(recorder);
  await p.goto(`${BASE}/?seed=3${fast ? '&fast=1' : ''}&api=${encodeURIComponent(API)}#k=test-anya`);
  await p.waitForSelector('.subjects', { timeout: 60000 }); await sleep(900);
  const state = () => p.evaluate(() => ({ q: window.__q, a: window.__answer, job: (document.querySelector('#job') || {}).textContent || '', next: !!document.querySelector('#next'), score: !!document.querySelector('.score') }));
  const sig = s => JSON.stringify([s.q, s.a, s.job, s.next, s.score]);
  const change = (s, ms) => p.waitForFunction(old => { const j = document.querySelector('#job');
    return JSON.stringify([window.__q, window.__answer, (j || {}).textContent || '', !!document.querySelector('#next'), !!document.querySelector('.score')]) !== old; }, { timeout: ms || 30000, polling: 60 }, sig(s)).catch(() => {});
  const tap = async sel => { const el = await p.waitForSelector(sel, { visible: true, timeout: 20000 }); await el.click(); };
  const type = async n => { if (n < 0) await tap('#neg'); for (const d of String(Math.abs(n))) await tap(`.key[data-k="${d}"]`); await tap('#check'); };
  const drain = () => p.evaluate(() => window.__pace.splice(0));
  // the lessons and their stages come from the app, so a new lesson is covered the day it is added
  const plan = (await p.evaluate(() => [].concat(window.Times.LESSONS.map(l => [l.id, l.stages]), window.Minus.LESSONS.map(l => [l.id, l.stages]))))
    .filter(x => !pickLessons.length || pickLessons.indexOf(x[0]) >= 0).map(x => [x[0], x[1].filter(st => !pickStages || pickStages.indexOf(st) >= 0)]);

  for (const [id, stages] of plan) for (const st of stages) {
    const topic = id[0] === 't' ? 'times' : 'minus', name = `${topic === 'times' ? 'Times and divide' : 'Minus numbers'} ${id} ${st}`;
    await p.evaluate(x => { location.hash = '#/maths/' + x; }, topic); await sleep(fast ? 250 : 700);
    await p.evaluate(x => { location.hash = x; }, `#/maths/${topic}/${id}/${st}`); await sleep(fast ? 350 : 1200);
    await drain();
    let helped = false, stuckOn = '', steps = 0;
    for (let k = 0; k < 260; k++) {
      const s = await state(), q = s.q, a = s.a;
      if (s.score || !q || q.lesson !== id || q.stage !== st || q.mode === 'done') break;
      if (s.next) { await tap('#next'); await change(s); await sleep(120); continue; }   // any screen that waits for "Next"
      steps++;
      if (q.mode === 'watch' || q.mode === 'next') { await change(s, 60000); continue; }
      if (q.mode === 'pad' && st === 'quiz') break;                       // never answer a quiz question
      if (q.mode === 'tidy' && st === 'quiz') break;
      if (q.mode === 'pad' || q.mode === 'mid') { await type(a); await change(s); }
      else if (q.mode === 'tap-all' || q.mode === 'tap-one') {
        const attr = q.mode === 'tap-all' ? 'data-i' : 'data-t';
        for (const w of [].concat(a)) { await tap(`#line button.tapnum[${attr}="${w}"]`); await sleep(90); }
        await change(s);
      } else if (q.mode === 'see') {
        if (a === 'none') await tap('#none'); else for (const el of await p.$$('#line button[data-pair]')) await el.click();
        await change(s);
      } else {                                                          // pick, warm, team, sign, tidy: she taps one button
        if (q.mode === 'sign' && !helped && await p.$('#stuck')) { helped = true; await tap('#stuck'); await sleep(fast ? 900 : 7000); }   // the help that covers the signs
        const btn = await p.waitForSelector(`#ctl [data-v="${a}"]:not(.yes):not(:disabled)`, { visible: true, timeout: 8000 }).catch(() => null);
        if (!btn) { const key = sig(s); if (stuckOn === key) { errors.push(`${name}: no button for "${a}"`); break; } stuckOn = key; await sleep(400); continue; }
        await btn.click(); await change(s);
      }
      await sleep(fast ? 60 : 150);
    }
    const r = judge(await drain(), name); r.name = name; r.steps = steps; results.push(r);
    if (!fast) console.log(`  ${name}: ${steps} steps, ${r.read} reads timed, ${r.arrivals} arrivals, ${r.covers} covers, ${r.READ.length + r.ONE.length + r.SEEN.length} faults`);
  }
  await b.close();
  return { results, errors, lessons: plan.map(x => x[0]) };
}

(async () => {
  let bad = 0; const say = m => { console.log('FAULT ' + m); bad++; };
  // Control: fast mode is a rushed screen. The gate must catch it under every rule.
  const c = await run(true, ['t1', 'm2'], ['see']);
  const hit = k => c.results.reduce((n, r) => n + r[k].length, 0);
  console.log(`control (fast mode must fail): READ ${hit('READ')}, ONE ${hit('ONE')}, SEEN ${hit('SEEN')}`);
  for (const k of ['READ', 'ONE', 'SEEN']) if (!hit(k)) say(`control: the gate did not catch a rushed screen under the rule ${k}`);
  // The real run.
  const t0 = Date.now(), r = await run(false, only, null), LESSONS = r.lessons;
  r.errors.forEach(e => say('page: ' + e));
  let read = 0, covers = 0;
  for (const x of r.results) { read += x.read; covers += x.covers; for (const k of ['READ', 'ONE', 'SEEN']) x[k].forEach(m => say(`${k} ${m}`)); if (!x.steps) say(`${x.name}: the gate could not play this stage`); }
  if (!only.length && read < 3 * r.results.length) say(`too little judged: ${read} reads over ${r.results.length} stages`);
  if (LESSONS.indexOf('t1') >= 0 && LESSONS.indexOf('m2') >= 0 && covers < 2) say(`the covered-sign steps were not seen (${covers})`);
  console.log(`${r.results.length} stages at real speed in ${Math.round((Date.now() - t0) / 1000)} s: ${read} reads timed, ${covers} covers`);
  console.log(bad ? `G3 pace: ${bad} FAULTS` : 'G3 pace passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
