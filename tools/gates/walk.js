#!/usr/bin/env node
/* Gates G2 (fit) and G3 (walk): a robot pupil goes through the real screens at real sizes.
   First start the test server:   node tools/mock-server.js 8787
   Then:   NODE_PATH=$(npm root -g) node tools/gates/walk.js <out-dir> [390x844 375x667 820x1180 1180x820]
   It fails on: a console error, words spilling out of a button, a work screen that scrolls, a tap target under 44px,
   a job line over 14 words, a help step over 10 words, a wrong answer marked right, a score that did not reach the sheet. */
const puppeteer = require('puppeteer'), fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787', API = BASE + '/api';
const OUT = path.resolve(process.argv[2] || 'walk-out');
const SIZES = (process.argv.length > 3 ? process.argv.slice(3) : ['390x844', '375x667', '820x1180', '1180x820']).map(s => s.split('x').map(Number));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [], notes = [];
const S = { page: null, tag: '', dir: '', n: 0, quiet: false, prose: 0 };
const must = (ok, msg) => { if (!ok) fails.push(`[${S.tag}] ${msg}`); return ok; };
const server = async (p, method) => (await fetch(BASE + p, { method: method || 'GET' })).json();

function fitCheck(o) {            // runs inside the page
  const out = [], vw = Math.min(innerWidth, screen.width), vh = innerHeight, de = document.documentElement, root = o.root || '#app';
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const words = t => (t.trim().match(/\S+/g) || []).length;
  const all = sel => [...document.querySelectorAll(sel.split(',').map(s => root + ' ' + s.trim()).join(','))].filter(vis);
  const wide = Math.max(de.scrollWidth, document.body.scrollWidth, ...[...document.querySelectorAll('#app *')].map(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.right : 0; }));
  if (wide > vw + 2) out.push('the page scrolls sideways by ' + Math.round(wide - vw) + 'px');
  if (o.noScroll && de.scrollHeight > vh + 1) out.push('the page is ' + (de.scrollHeight - vh) + 'px taller than the screen');
  all('button, a, .job, .sub, .verdict, h1, .lead, .score, .savenote').forEach(el => {
    const r = el.getBoundingClientRect(), name = (el.id ? '#' + el.id : '.' + String(el.className).split(' ').join('.')) + ' "' + el.textContent.trim().slice(0, 26) + '"';
    if (el.scrollWidth > el.clientWidth + 1) out.push('words spill sideways: ' + name);
    // a number button in the sum holds one line of big digits: judge it by where its pieces really sit, because the browser counts the font's empty space as overflow
    const down = el.classList.contains('tapnum') ? [...el.children].some(k => { const q = k.getBoundingClientRect(); return q.height > 0 && (q.bottom > r.bottom + 1 || q.top < r.top - 1); }) : el.scrollHeight > el.clientHeight + 1;
    if (el.clientHeight > 0 && down) out.push('words spill down: ' + name);
    if (r.left < -1 || r.right > vw + 1) out.push('off the side of the screen: ' + name);
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && (r.height < 43.5 || r.width < 43.5)) out.push(`small tap target (${Math.round(r.width)}x${Math.round(r.height)}): ` + name);
  });
  all('.subject span:last-child').forEach(el => { if (el.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight) * 1.5) out.push('subject name breaks onto two lines: ' + el.textContent); });
  const pic = all('.pic')[0];
  if (pic && o.noScroll) { const r = pic.getBoundingClientRect(); if (r.height < 148) out.push('the picture is only ' + Math.round(r.height) + 'px tall'); }
  all('.pic .dg-label').forEach(el => { const m = el.getScreenCTM(), px = parseFloat(getComputedStyle(el).fontSize) * (m ? Math.hypot(m.a, m.b) : 1);
    if (px < 11.5) out.push('a number on the picture is only ' + px.toFixed(1) + 'px tall: ' + el.textContent); });
  const job = all('.job')[0]; if (job && words(job.textContent) > 14) out.push('job line over 14 words: ' + job.textContent);
  const steps = all('.help li'); if (steps.length > 3) out.push('more than 3 help steps');
  steps.forEach(li => { const say = li.querySelector('.say') || li; if (words(say.textContent) > 10) out.push('help step over 10 words: ' + say.textContent); });
  all('.help .sum').forEach(el => { const r = el.getBoundingClientRect(), box = el.closest('.help').getBoundingClientRect();
    if (el.scrollWidth > el.clientWidth + 1 || r.right > box.right - 3 || r.height > parseFloat(getComputedStyle(el).fontSize) * 2.6) out.push('a help sum does not fit on one line: ' + el.textContent); });
  if (all('.help').some(h => /object Object|undefined|NaN/.test(h.textContent))) out.push('the help shows broken words');
  let prose = 0; all('.job, .sub, .lead, .hello, .soon h1, .soon p, .keycard h1, .verdict').forEach(el => { prose += words(el.textContent); });
  if (!o.long && prose > 25) out.push('over 25 words of reading on one screen: ' + prose);
  return { out, prose };
}

async function stop(name, o) {     // a place where we look: fit check + picture
  o = o || {}; await sleep(o.wait || 260);
  const r = await S.page.evaluate(fitCheck, { noScroll: !!o.noScroll, long: !!o.long, root: o.root });
  r.out.forEach(m => fails.push(`[${S.tag}] ${name}: ${m}`)); S.prose = Math.max(S.prose, o.long ? 0 : r.prose);
  await S.page.screenshot({ path: path.join(S.dir, String(++S.n).padStart(2, '0') + '-' + name + '.png') });
}
async function section(name, fn) {
  try { await fn(); } catch (e) {
    fails.push(`[${S.tag}] ${name}: STOPPED: ${String(e && e.message || e).split('\n')[0]}`);
    try { await S.page.screenshot({ path: path.join(S.dir, 'FAIL-' + name + '.png') }); } catch (x) {}
  }
}
const tap = async sel => { const el = await S.page.waitForSelector(sel, { visible: true, timeout: 5000 }); await el.click(); };
const txt = sel => S.page.$eval(sel, e => e.textContent.trim()).catch(() => '');
const go = async hash => {   // the same screen twice in a row: step out to the lesson list first, so it really opens again
  if ((await S.page.evaluate(() => location.hash)) === hash) { await S.page.evaluate(() => { location.hash = '#/maths/angles'; }); await sleep(200); }
  await S.page.evaluate(h => { location.hash = h; }, hash); await sleep(200);
};
const hash = () => S.page.evaluate(() => location.hash);
const type = async n => { for (const d of String(n)) await tap(`.key[data-k="${d}"]`); };
const other = x => (x + 10 > 359 ? x - 10 : x + 10);

async function open(browser, w, h, url) {
  const ctx = await (browser.createBrowserContext || browser.createIncognitoBrowserContext).call(browser);
  const page = await ctx.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, hasTouch: true, isMobile: true });
  page.on('pageerror', e => fails.push(`[${S.tag}] script error: ${String(e.message || e).split('\n')[0]}`));
  page.on('console', m => { if (m.type() === 'error' && !(S.quiet && /503|Failed to load/.test(m.text()))) fails.push(`[${S.tag}] console error: ${m.text().slice(0, 160)}`); });
  page.on('response', r => { if (r.status() >= 400 && !(S.quiet && r.status() === 503)) fails.push(`[${S.tag}] ${r.status()} for ${r.url().replace(BASE, '')}`); });
  S.page = page; await page.goto(url, { waitUntil: 'load' }); return page;
}
const appUrl = extra => `${BASE}/?fast=1&seed=${S.seed}&api=${encodeURIComponent(API)}${extra || ''}`;

async function seeIt(id) {
  await go(`#/maths/angles/${id}/see`); await S.page.waitForFunction(() => window.__see && window.__see.type !== 'done', { timeout: 5000 });
  const seen = {};
  for (let guard = 0; ; guard++) {
    if (guard > 12) { must(false, `See it ${id}: never finished`); return; }
    const t = await S.page.evaluate(() => window.__see.type); if (t === 'done') break;
    const label = await txt('#count span');
    if (t === 'drag') {
      if (!seen.drag) { seen.drag = 1; await stop(`see${id}-drag`, { noScroll: true });
        await tap('#stuck'); await stop(`see${id}-stuck`, { noScroll: true, wait: 1250 });
        must(await S.page.$eval('#help', e => !e.hidden && e.querySelectorAll('li').length > 0), `See it ${id}: the help did not open`); }
      const [k, g] = await S.page.evaluate(() => [window.__see.knob(), window.__see.target()]);
      await S.page.mouse.move(k[0], k[1]); await S.page.mouse.down();
      await S.page.mouse.move((k[0] + g[0]) / 2, (k[1] + g[1]) / 2, { steps: 5 }); await S.page.mouse.move(g[0], g[1], { steps: 5 }); await sleep(70); await S.page.mouse.up();
    } else if (t === 'sort') {
      const a = await S.page.evaluate(() => window.__see.answer);
      if (!seen.sort) { seen.sort = 1; await tap(`.opt[data-v="${a === '180' ? '360' : '180'}"]`); await stop(`see${id}-sort-wrong`, { noScroll: true });
        must(/Look again/.test(await txt('#say')), `See it ${id}: a wrong sort gave no message`); }
      await tap(`.opt[data-v="${a}"]`);
    } else {
      const i = await S.page.evaluate(() => ({ a: window.__see.answer.map(k => window.__see.at(k)), w: window.__see.wrong.map(k => window.__see.at(k)) }));
      let rest = i.a;
      if (!seen.twins) { seen.twins = 1; await stop(`see${id}-twins`, { noScroll: true });
        await S.page.mouse.click(i.w[0][0], i.w[0][1]); await S.page.mouse.click(i.a[0][0], i.a[0][1]); await tap('#check'); await stop(`see${id}-twins-wrong`, { noScroll: true, wait: 120 });
        must(/match(es)? x/.test(await txt('#say')), `See it ${id}: wrong twins gave no message`); await sleep(1000); rest = (await S.page.evaluate(() => window.__see.answer.map(k => window.__see.at(k)))).slice(1); }
      for (const p of rest) { await S.page.mouse.click(p[0], p[1]); await sleep(40); }
      await tap('#check');
    }
    await S.page.waitForFunction(l => { const s = document.querySelector('#count span'); return window.__see.type === 'done' || (s && s.textContent !== l); }, { timeout: 5000 }, label);
  }
  await stop(`see${id}-end`, { noScroll: true });
  must(await S.page.$('#strip .stage.done'), `See it ${id}: the stage strip shows no tick`);
  await tap('#ctl a.go'); await sleep(200); must(/\/try$/.test(await hash()), `See it ${id}: the end button did not open Try it`);
}

async function tryIt(id, look) {
  await go(`#/maths/angles/${id}/try`); await S.page.waitForSelector('.opt', { visible: true, timeout: 5000 });
  for (let i = 0; i < 3; i++) {
    await S.page.waitForSelector('.opt', { visible: true, timeout: 5000 });
    const a = await S.page.evaluate(() => window.__answer), opts = await S.page.$$eval('.opt', els => els.map(e => e.textContent.trim()));
    must(opts.indexOf(a) >= 0, `Try it ${id}: no button for the right choice "${a}"`);
    if (look && i === 0) { await stop(`try${id}-pick`, { noScroll: true });
      await (await S.page.$$('.opt'))[opts.findIndex(o => o !== a)].click(); await tap('#stuck'); await stop(`try${id}-pick-wrong-help`, { noScroll: true });
      must(/Not that one/.test(await txt('#say')), `Try it ${id}: a wrong choice gave no message`); }
    await (await S.page.$$('.opt'))[opts.indexOf(a)].click(); await S.page.waitForSelector('.pad', { visible: true, timeout: 5000 });
    const x = await S.page.evaluate(() => window.__answer);
    if (look && i === 0) { await stop(`try${id}-find`, { noScroll: true });
      await type(other(x)); await tap('#check'); await type(other(x)); await tap('#check'); await stop(`try${id}-find-wrong-help`, { noScroll: true });
      must(await S.page.$eval('#help', e => !e.hidden), `Try it ${id}: help did not open after two wrong answers`); }
    if (look && i === 1) { for (let k = 0; k < 3; k++) { await type(other(x)); await tap('#check'); }
      await S.page.waitForSelector('#next', { visible: true, timeout: 5000 }); await stop(`try${id}-shown-after-3`, { noScroll: true, wait: 900 });
      must(/^Not this time/.test(await txt('.verdict')), `Try it ${id}: three wrong answers did not show the answer`); await tap('#next'); await sleep(150); continue; }
    await type(x); await tap('#check'); await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
    must(/^Yes!/.test(await txt('.verdict')), `Try it ${id}: the right answer ${x} was not marked right`);
    if (look && i === 0) await stop(`try${id}-right`, { noScroll: true, wait: 900 });
    await tap('#next'); await sleep(150);
  }
  must(/\/quiz$/.test(await hash()), `Try it ${id}: did not go on to the quiz`);
}

async function quiz(id, mode, look, offline) {
  const before = (await server('/__attempts')).length;
  await go(`#/maths/angles/${id}/quiz`); if (!/\/quiz$/.test(await hash())) await go(`#/maths/angles/${id}/quiz`);
  await S.page.waitForSelector('.pad', { visible: true, timeout: 5000 });
  const n = +(await txt('#count span')).split(' of ')[1];
  for (let i = 0; i < n; i++) {
    const x = await S.page.evaluate(() => window.__answer);
    if (look && i === 0) { await stop(`quiz${id}-question`, { noScroll: true }); await tap('#stuck'); await stop(`quiz${id}-help`, { noScroll: true }); }
    await type(mode === 'right' ? x : other(x)); await tap('#check'); await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
    must((mode === 'right' ? /^Yes!/ : /^Not this time/).test(await txt('.verdict')), `Quiz ${id} q${i + 1}: answer ${mode === 'right' ? x : other(x)} was marked the wrong way`);
    if (look && i < 2) await stop(`quiz${id}-q${i + 1}-${mode}`, { noScroll: true, wait: 900 });
    await tap('#next'); await sleep(120);
  }
  await S.page.waitForSelector('.score', { visible: true, timeout: 5000 });
  await S.page.waitForFunction(() => { const e = document.querySelector('#save'); return e && !/Saving/.test(e.textContent); }, { timeout: 15000 });
  const want = mode === 'right' ? n : 0, note = await txt('#save');
  must((await txt('.score')) === `${want} out of ${n}`, `Quiz ${id}: score line says "${await txt('.score')}", wanted ${want} out of ${n}`);
  await stop(`quiz${id}-result-${mode}${offline ? '-offline' : ''}`, { long: true, wait: 700 });
  const list = await server('/__attempts');
  if (offline) { must(/kept on this/.test(note), `Quiz ${id} offline: note says "${note}"`); must(list.length === before, 'offline: a score reached the sheet while it was down'); return; }
  must(note === 'Score saved.', `Quiz ${id}: note says "${note}"`);
  const a = list[list.length - 1];
  must(list.length === before + 1 && a && a.lesson === String(id) && a.score === want && a.total === n && a.detail.length === n, `Quiz ${id}: the sheet did not get the attempt (${JSON.stringify(a || {}).slice(0, 120)})`);
  if (a && look) must(a.detail[0].helped === true && a.detail[1].helped === false, `Quiz ${id}: "helped" was not recorded`);
  if (a && mode === 'wrong') must(a.detail.every(d => d.right === false && d.slip), `Quiz ${id}: wrong answers have no slip tag`);
}

/* "Add or take away?": mode 'right' = every tap right; 'wrong' = one wrong tap at the first step of every round. */
async function plan(mode, look) {
  const before = (await server('/__attempts')).length;
  await go('#/maths/angles/plan/quiz'); await S.page.waitForSelector('.opt', { visible: true, timeout: 5000 });
  const n = +(await txt('#count span')).split(' of ')[1]; must(n === 6, `Add or take away: ${n} rounds, wanted 6`);
  for (let i = 0; i < n; i++) {
    await S.page.waitForFunction(k => window.__plan && window.__plan.round === k && !window.__plan.done, { timeout: 5000 }, i);
    for (let guard = 0; ; guard++) {
      if (guard > 4) { must(false, `Add or take away round ${i + 1}: never finished`); return; }
      const st = await S.page.evaluate(() => window.__plan); if (st.done) break;
      const shot = look && [0, 2, 3, 4].includes(i);
      must((await S.page.$$('.opt')).length === (st.mode === 'working' ? 3 : 2), `Add or take away round ${i + 1}: wrong number of choices`);
      if (shot) await stop(`plan-r${i + 1}-s${st.step + 1}`, { noScroll: true, wait: 700 });
      if (look && mode === 'right' && i === 0 && st.step === 0) { await tap('#stuck'); await stop('plan-r1-help', { noScroll: true, wait: 1250 });
        must(await S.page.$eval('#help', e => !e.hidden && e.querySelectorAll('li').length > 0), 'Add or take away: the help did not open'); }
      if (mode === 'wrong' && st.step === 0) {
        const w = [0, 1, 2].find(k => k !== st.right);
        if (look && i === 3) await tap('#stuck');             // help open, then a wrong tap: the reason must still be seen
        const party = i === 0 && !(await S.page.evaluate(() => FX.reduce));   // party paper must not fall over a wrong choice
        if (party) { await S.page.evaluate(() => { FX.confetti(); }); await sleep(450); must((await S.page.evaluate(() => FX.paper())) > 0, 'the paper check saw no paper to begin with'); }
        await tap(`.opt[data-o="${w}"]`); await sleep(150);
        if (party) { await sleep(500); must((await S.page.evaluate(() => FX.paper())) === 0, 'party paper is still falling over a wrong choice'); }
        must(await S.page.$eval('#say', e => e.textContent.trim().length > 8 && e.getBoundingClientRect().height > 0), `Add or take away round ${i + 1}: a wrong tap showed no reason`);
        must(await S.page.$eval(`.opt[data-o="${w}"]`, b => b.disabled), `Add or take away round ${i + 1}: the wrong choice can be tapped again`);
        if (shot) await stop(`plan-r${i + 1}-wrong`, { noScroll: true, wait: 500 });
      }
      await tap(`.opt[data-o="${st.right}"]`);
      await S.page.waitForFunction((r, t) => window.__plan.done || window.__plan.round !== r || window.__plan.step !== t, { timeout: 5000 }, i, st.step);
    }
    await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
    const v = await txt('.verdict'), x = await S.page.evaluate(() => window.__q.answer);
    must(v.indexOf(`x = ${x}°`) >= 0 && (mode === 'right') === /^Yes!/.test(v), `Add or take away round ${i + 1}: the end line says "${v}"`);
    must(await S.page.$eval('#ctl .ring', e => /✓/.test(e.textContent)), `Add or take away round ${i + 1}: the ring did not close`);
    if (look && (i === 0 || i === 3)) await stop(`plan-r${i + 1}-done-${mode}`, { noScroll: true, wait: 1500 });
    await tap('#next'); await sleep(120);
  }
  await S.page.waitForSelector('.score', { visible: true, timeout: 5000 });
  await S.page.waitForFunction(() => { const e = document.querySelector('#save'); return e && !/Saving/.test(e.textContent); }, { timeout: 15000 });
  const want = mode === 'right' ? n : 0;
  must((await txt('.score')) === `${want} out of ${n}`, `Add or take away: score line says "${await txt('.score')}", wanted ${want} out of ${n}`);
  must((await txt('#save')) === 'Score saved.', `Add or take away: note says "${await txt('#save')}"`);
  must((await S.page.$$('.review li')).length === (mode === 'right' ? 0 : n), 'Add or take away: the score screen does not list the rounds to look at again');
  await stop(`plan-result-${mode}`, { long: true, wait: 700 });
  const list = await server('/__attempts'), a = list[list.length - 1];
  must(list.length === before + 1 && a && a.lesson === 'plan' && a.score === want && a.total === n && a.detail.length === n, `Add or take away: the sheet did not get the attempt (${JSON.stringify(a || {}).slice(0, 120)})`);
  if (!a || a.lesson !== 'plan') return;
  if (mode === 'right') must(a.detail.every(d => d.right === true && d.slip === '' && d.given === d.correct), 'Add or take away: a clean round was not saved as right');
  else must(a.detail.every(d => d.right === false && /^plan-/.test(d.slip) && d.given && d.given !== d.correct), 'Add or take away: a wrong choice was not saved with what she chose');
  if (look && mode === 'right') must(a.detail[0].helped === true && a.detail[1].helped === false, 'Add or take away: "helped" was not recorded');
}

/* Her own slip (take one away, then add the other) and an answer bigger than the whole each get their own words. */
async function slipWords() {
  await go('#/maths/angles/1/quiz'); if (!/\/quiz$/.test(await hash())) await go('#/maths/angles/1/quiz');
  await S.page.waitForSelector('.pad', { visible: true, timeout: 5000 });
  const n = +(await txt('#count span')).split(' of ')[1]; let mixed = 0, big = 0;
  for (let i = 0; i < n; i++) {
    const q = await S.page.evaluate(() => { const q = window.__q, J = v => window.Questions.judge(q, v).slip, out = { answer: q.answer };
      if (q.ring && q.ring.n === 1 && q.ring.pieces.length === 2) { const a = q.ring.pieces[0], b = q.ring.pieces[1]; [q.ring.total - a + b, q.ring.total - b + a].forEach(v => { if (J(v) === 'mixed') out.mixed = v; }); }
      if (q.total) { let v = q.total + 7; while (J(v) !== 'toobig' && v < 990) v++; if (v < 990) out.big = v; }
      return out; });
    let give = q.answer, want = null, name = '';
    if (q.mixed && !mixed) { give = q.mixed; want = /took one away, then added the other/; name = 'mixed'; mixed = 1; }
    else if (q.big && !big) { give = q.big; want = /must be smaller/; name = 'toobig'; big = 1; }
    await type(give); await tap('#check'); await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
    if (want) { must(want.test(await txt('#ctl .sub')), `Quiz 1: answer ${give} (${name}) got the words "${await txt('#ctl .sub')}"`); await stop('quiz1-slip-' + name, { noScroll: true, wait: 900 }); }
    await tap('#next'); await sleep(120);
  }
  must(mixed && big, 'Quiz 1: no question to try her slip on');
  await S.page.waitForSelector('.score', { visible: true, timeout: 5000 });
  await S.page.waitForFunction(() => { const e = document.querySelector('#save'); return e && !/Saving/.test(e.textContent); }, { timeout: 15000 });
  await stop('quiz1-result-slip', { long: true, wait: 700 });
  must(await S.page.$('.result a[href="#/maths/angles/plan/quiz"]'), 'the score screen has no way to the add-or-take-away practice');
  const list = await server('/__attempts'), a = list[list.length - 1];
  must(a && a.detail.some(d => d.slip === 'mixed') && a.detail.some(d => d.slip === 'toobig'), 'her slip was not saved with its own tag');
}

/* ---------- Minus numbers ---------- */
const CHEAT1 = 'Same signs make a plus. Different signs make a minus.', CHEAT2 = 'Same signs: add. Different signs: take away. Bigger wins the sign.';
const MINUS_N = { m1: 6, m2: 6, m3: 6, mmix: 8 };
const mstate = () => S.page.evaluate(() => ({ q: window.__q, a: window.__answer }));
const mgo = async h => { await S.page.evaluate(() => { location.hash = '#/maths/minus'; }); await sleep(180); await S.page.evaluate(x => { location.hash = x; }, h); await sleep(280); };
const mtype = async n => { if (n < 0) await tap('#neg'); for (const d of String(Math.abs(n))) await tap(`.key[data-k="${d}"]`); await tap('#check'); };
const mnum = v => (v < 0 ? '−' + Math.abs(v) : String(v));
/* What the screen must say once a typed answer is in. Used in the walk AND against a planted fault. */
async function minusMarked(q, a, given) {
  const v = await txt('.verdict'), out = [];
  if (!(given === a ? /^Yes!/ : /^Not this time/).test(v)) out.push(`minus ${q.lesson} "${q.text}": the answer ${given} was marked the wrong way ("${v}")`);
  if (v.indexOf('= ' + mnum(a)) < 0) out.push(`minus ${q.lesson} "${q.text}": the answer line does not show ${mnum(a)} ("${v}")`);
  return out;
}
/* Plays one stage of one lesson. mode 'wrong' answers every quiz question wrongly. */
async function minusStage(id, st, mode, look) {
  const before = (await server('/__attempts')).length, seen = {}, name = `minus-${id}-${st}`, bad = mode === 'wrong' && st === 'quiz'; let asked = 0, warm = 0, ended = false;
  await mgo(`#/maths/minus/${id}/${st}`);
  for (let k = 0; k < 90; k++) {
    if (await S.page.$('.score')) break;
    const { q, a } = await mstate();
    if (st === 'try' && q && q.lesson === id && q.stage === 'quiz') { ended = true; break; }   // "Start the quiz" ends Try it
    if (!must(q && q.lesson === id && q.stage === st, `${name}: this is not the screen for this lesson (${JSON.stringify(q || {}).slice(0, 90)})`)) return;
    if (q.mode === 'done') { ended = true; break; }
    const first = !seen[q.mode]; seen[q.mode] = 1;
    if (first && look) await stop(`${name}-${q.mode}`, { noScroll: true });
    if (first && await S.page.$('#stuck:not([hidden])')) {       // open the help once for each kind of step
      await tap('#stuck');
      if (q.mode === 'pad') await S.page.waitForSelector('#drows:not([hidden]) .drow', { timeout: 3000 }).catch(() => {});
      await sleep(280);
      const h = await S.page.evaluate(() => ({ steps: document.querySelectorAll('#help:not([hidden]) li').length, sums: [...document.querySelectorAll('#help:not([hidden]) .sum')].map(e => e.textContent.trim()),
        dots: !!document.querySelector('#drows:not([hidden]) .drow'), chips: document.querySelector('#line').classList.contains('chips'), marks: document.querySelectorAll('#line .mark').length }));
      must(h.steps >= 1, `${name} ${q.mode}: "Stuck? Show me" shows no steps`);
      if (q.mode === 'pad') {
        must(h.dots && h.chips, `${name}: the help did not change the picture to coloured numbers and dots`);
        must(h.sums.length && /= \?$/.test(h.sums[h.sums.length - 1]), `${name}: the help does not leave the last sum for her ("${h.sums[h.sums.length - 1]}")`);
        must(!h.sums.some(s => s.endsWith('= ' + mnum(a))), `${name}: the help gives the answer away`);
      } else must(h.marks > 0, `${name} ${q.mode}: the help did not mark the picture`);
      if (look) await stop(`${name}-${q.mode}-help`, { noScroll: true });
    }
    if (q.mode === 'see') {
      if (a === 'none') await tap('#none'); else for (const b of await S.page.$$('#line button[data-pair]')) await b.click();
      await S.page.waitForSelector('#next', { visible: true, timeout: 6000 });
      if (first && look) await stop(`${name}-see-after`, { noScroll: true }); await tap('#next');
    } else if (q.mode === 'pad') {
      const given = bad ? (a === 0 ? 1 : -a) : a;
      await mtype(given); await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
      (await minusMarked(q, a, given)).forEach(m => must(false, m));
      if (given !== a) must((await txt('#ctl .sub')).length > 8, `${name}: a wrong answer got no reason`);
      must((await S.page.$$('#ctl .work li')).length >= 1, `${name}: no working is shown after the answer`);
      if (look && asked < 1) await stop(`${name}-fb-${mode}`, { noScroll: true, wait: 600 });
      asked++; await tap('#next');
    } else {                                                     // warm, tidy, team, sign: she taps one button
      const opts = await S.page.$$eval('#ctl [data-v]', e => e.map(x => x.dataset.v)), other = opts.find(v => v !== String(a));
      if (q.mode !== 'warm' && st === 'try' && first) {          // a wrong tap in Try it gets its reason, and she goes again
        await tap(`#ctl [data-v="${other}"]`); await sleep(320);
        must((await S.page.evaluate(() => { const s = document.querySelector('#say'); return s && /bad/.test(s.className) ? s.textContent.trim() : ''; })).length > 8, `${name} ${q.mode}: a wrong tap got no reason`);
        if (look) await stop(`${name}-${q.mode}-wrong`, { noScroll: true });
      }
      const scored = st === 'quiz' && q.mode === 'tidy', pick = bad && scored ? other : String(a);
      await tap(`#ctl [data-v="${pick}"]`);
      if (q.mode === 'warm') { warm++; await S.page.waitForFunction((m, i) => { const x = window.__q; return !x || x.mode !== m || x.i !== i; }, { timeout: 6000 }, q.mode, q.i).catch(() => {}); }
      else await sleep(380);
      if (scored) {
        await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
        must((pick === String(a) ? /^Yes!/ : /^Not this time/).test(await txt('.verdict')), `${name} "${q.text}": the tap "${pick}" was marked the wrong way`);
        if (pick !== String(a)) must((await txt('#ctl .sub')).length > 8, `${name}: a wrong tap got no reason`);
        asked++;
      }
      if (await S.page.$('#next')) { if (look && first) await stop(`${name}-${q.mode}-after`, { noScroll: true }); await tap('#next'); }
    }
    await sleep(200);
  }
  if (st !== 'quiz') {
    must(ended, `${name}: the stage never reached its end screen`);
    if (st === 'try') { must(/\/quiz$/.test(await hash()), `${name}: "Start the quiz" did not open the quiz`); return; }
    await stop(`${name}-end`, { noScroll: true, wait: 500 });
    must(await S.page.$(`#app a[href$="/${id}/${st === 'see' ? 'try' : 'quiz'}"]`), `${name}: the end screen has no button to the next stage`);
    return;
  }
  await S.page.waitForSelector('.score', { visible: true, timeout: 5000 });
  await S.page.waitForFunction(() => { const e = document.querySelector('#save'); return e && !/Saving/.test(e.textContent); }, { timeout: 15000 });
  const n = MINUS_N[id], want = bad ? 0 : n;
  must(asked === n, `${name}: ${asked} questions were asked, wanted ${n}`); must(warm === 2, `${name}: ${warm} warm up taps, wanted 2`);
  must((await txt('.score')) === `${want} out of ${n}`, `${name}: score line says "${await txt('.score')}", wanted ${want} out of ${n}`);
  must((await txt('#save')) === 'Score saved.', `${name}: note says "${await txt('#save')}"`);
  must(await S.page.$('.result a[href="#/maths/minus"]'), `${name}: the score screen has no way back to the lessons`);
  await stop(`${name}-result-${mode}`, { long: true, wait: 700 });
  const list = await server('/__attempts'), a = list[list.length - 1];
  must(list.length === before + 1 && a && a.topic === 'minus' && a.lesson === id && a.score === want && a.total === n && a.detail.length === n && a.detail.every(d => d.topic === 'minus'),
    `${name}: the sheet did not get the attempt (${JSON.stringify(a || {}).slice(0, 140)})`);
  if (a && a.detail.length) must(a.detail[0].helped === true && a.detail.slice(1).every(d => d.helped === false), `${name}: "helped" was not recorded`);
  if (a && bad) {
    must(a.detail.every(d => d.right === false && d.slip), `${name}: wrong answers have no slip tag`);
    must((await S.page.$$('.review li')).length === n, `${name}: the "look at these again" list does not have ${n} sums`);
  }
}
async function minus(first) {
  const p = S.page;
  await section('minus-list', async () => {
    await p.evaluate(() => { location.hash = '#/s/maths'; }); await stop('minus-maths', { wait: 900 });
    must((await p.$$eval('a.card', e => e.map(x => x.getAttribute('href')).join(','))) === '#/maths/angles,#/maths/minus,#/maths/times', 'the Maths page does not list Angles, Minus numbers, then Times and divide');
    await tap('a.card[href="#/maths/minus"]'); await stop('minus-lessons', { wait: 1100 });
    must((await p.$$eval('a.card', e => e.length)) === 4, 'Minus numbers does not show four lessons');
    await tap('a.cheatlink'); await stop('minus-cheats', { wait: 700, long: true });
    const body = await p.evaluate(() => document.querySelector('#app').innerText.replace(/\s+/g, ' '));
    [CHEAT1, CHEAT2].forEach(c => must(body.indexOf(c) >= 0, `the cheats page does not say "${c}"`));
    must(await p.$('#app a[href="#/maths/minus"]'), 'the cheats page has no way back to the lessons');
  });
  for (const [id, stages] of [['m1', ['see', 'try', 'quiz']], ['m2', ['see', 'try', 'quiz']], ['m3', ['try', 'quiz']], ['mmix', ['quiz']]])
    for (const st of stages) await section(`minus-${id}-${st}`, () => minusStage(id, st, 'right', true));
  await section('minus-stars', async () => {
    for (const id of ['m1', 'm2', 'm3', 'mmix']) must((await p.evaluate(k => Store.stars(k), 'maths.minus.' + id)) === 3, `Minus ${id}: a clean quiz did not earn 3 stars`);
    await minusStage('m2', 'quiz', 'wrong', true); await minusStage('m1', 'quiz', 'wrong', first);
    for (const id of ['m1', 'm2']) must((await p.evaluate(k => Store.stars(k), 'maths.minus.' + id)) === 3, `Minus ${id}: stars were taken away by a worse quiz`);
    await p.evaluate(() => { location.hash = '#/maths/minus'; }); await stop('minus-lessons-after', { wait: 1100 });
  });
}

/* ---------- Times and divide ---------- */
const TIMES_N = { t1: 10, t2: 8, t3: 8, t4: 8, t5: 8, tmix: 12 };
const TIMES_SAY = ['Same signs make a plus. Different signs make a minus.', 'Cover the signs. Times the numbers.', 'Cover the signs. Divide the numbers.', 'Pair up the minus signs. A pair makes a plus.',
  'One left over makes a minus.', 'The answer is minus, so the signs are different.', 'The answer is plus, so the signs are the same.', 'Change side, change sign.', 'Do the brackets first.'];
const tfam = k => (/^add:/.test(k) ? 'add' : /^xb/.test(k) ? 'xb' : k === 'x0' ? 'x0' : /^x/.test(k) ? 'x' : /^d/.test(k) ? 'd' : /^3/.test(k) ? '3' : /^bt/.test(k) ? 'bt' : /^bd/.test(k) ? 'bd' : /^a[ghqm]$/.test(k) ? 'ba' : k);
/* The walker works every sum out for itself, from the words on the screen. */
const tcalc = t => { try { return Function('"use strict"; return (' + t.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '**2').replace(/\(\+/g, '(') + ');')(); } catch (e) { return NaN; } };
function tsolve(text) {
  if (text.indexOf('□') < 0) return tcalc(text);
  const side = text.split('='), hits = [];
  for (let b = -200; b <= 200; b++) { const f = x => tcalc(x.replace(/□/g, '(' + b + ')')); if (Math.abs(f(side[0]) - f(side[1])) < 1e-9) hits.push(b); }
  return hits.length === 1 ? hits[0] : NaN;
}
const tstate = () => S.page.evaluate(() => ({ q: window.__q, a: window.__answer, job: (document.querySelector('#job') || {}).textContent || '', next: !!document.querySelector('#next'), score: !!document.querySelector('.score') }));
const tsig = s => JSON.stringify([s.q, s.job, s.next, s.score]);
const tchange = (s, ms) => S.page.waitForFunction(old => { const j = document.querySelector('#job');
  return JSON.stringify([window.__q, (j || {}).textContent || '', !!document.querySelector('#next'), !!document.querySelector('.score')]) !== old; }, { timeout: ms || 8000 }, tsig(s)).catch(() => {});
const tgo = async h => { await S.page.evaluate(() => { location.hash = '#/maths/times'; }); await sleep(180); await S.page.evaluate(x => { location.hash = x; }, h); await sleep(280); };
const tbad = () => S.page.evaluate(() => { const s = document.querySelector('#say'); return s && /bad/.test(s.className) ? s.textContent.trim() : ''; });
const thelp = () => S.page.evaluate(() => { const h = document.querySelector('#help'); return { open: !!h && !h.hidden, steps: h ? h.querySelectorAll('li').length : 0, sums: h ? [...h.querySelectorAll('.sum')].map(e => e.textContent.trim()) : [] }; });
const tflat = t => String(t || '').replace(/□/g, '').replace(/\s+/g, ' ').trim();
/* What the screen must say once a typed answer is in. Used in the walk AND against a planted fault. */
async function timesMarked(q, a, given) {
  const v = await txt('.verdict'), out = [], head = given === a ? 'Yes! ' : 'Not this time. ';
  if (v.indexOf(head.trim()) !== 0) out.push(`times ${q.lesson} "${q.text}": the answer ${given} was marked the wrong way ("${v}")`);
  if (tflat(v) !== tflat(head + q.full)) out.push(`times ${q.lesson} "${q.text}": the answer line is "${v}", wanted "${head}${q.full}"`);
  if (String(q.full || '').indexOf(mnum(a)) < 0) out.push(`times ${q.lesson} "${q.text}": the whole sum "${q.full}" does not show ${mnum(a)}`);
  return out;
}
/* Plays one stage of one lesson. mode 'wrong' answers every quiz question wrongly. */
async function timesStage(id, st, mode, look) {
  const before = (await server('/__attempts')).length, seen = {}, name = `times-${id}-${st}`, bad = mode === 'wrong' && st === 'quiz', helpedAt = {}; let asked = 0, warm = 0, ended = false, shown3 = false;
  await tgo(`#/maths/times/${id}/${st}`);
  for (let k = 0; k < 300; k++) {
    if (await S.page.$('.score')) break;
    const s = await tstate(), q = s.q, a = s.a;
    if (st === 'try' && q && q.lesson === id && q.stage === 'quiz') { ended = true; break; }   // "Start the quiz" ends Try it
    if (!must(q && q.topic === 'times' && q.lesson === id && q.stage === st, `${name}: this is not the screen for this lesson (${JSON.stringify(q || {}).slice(0, 90)})`)) return;
    if (q.mode === 'done') { ended = true; break; }
    const fam = tfam(q.kind || ''), key = fam + '|' + q.mode + '|' + s.job, first = !seen[key], tag = `${name}-${fam}-${q.mode}`; seen[key] = 1;
    const pic = async (end, o) => { if (look && first) await stop(tag + (end ? '-' + end : '') + '-' + Object.keys(seen).length, Object.assign({ noScroll: true }, o)); };
    const help = async () => {                                   // open "Stuck? Show me" and check it shows something
      if (!(await S.page.$('#stuck:not([hidden])'))) return;
      if (!(await thelp()).open) await tap('#stuck');
      await sleep(260); const h = await thelp();
      must(h.open && h.steps >= 1, `${name} ${fam} ${q.mode}: "Stuck? Show me" shows no steps`);
      if (q.mode === 'pad') must(h.sums.some(x => /\?/.test(x)), `${name} ${fam}: the help does not leave a sum for her (${h.sums.join(' ; ')})`);
      if (q.mode === 'pad' && h.sums.length) { const last = h.sums[h.sums.length - 1];   // "36 ÷ ? = 6" keeps the answer back even when the answer is also 6
        must(/\?/.test(last) || !last.endsWith('= ' + mnum(a)), `${name} ${fam}: the help gives the answer away`); }
      await pic('help');
    };
    if (q.mode === 'watch') { await tchange(s, 25000); continue; }
    if (q.mode === 'next' && st === 'see') {                      // See it: the whole sum, then on
      await S.page.waitForSelector('#next', { visible: true, timeout: 6000 }); await pic('whole', { wait: 500 });
      must(tflat(await txt('.verdict')) === tflat(q.full), `${name} "${q.text}": the whole sum shown is "${await txt('.verdict')}", wanted "${q.full}"`);
      await tap('#next'); await tchange(s); continue;
    }
    if (q.mode === 'next') { await tap('#next'); await tchange(s); continue; }
    if (q.text && q.mode !== 'warm') must(tsolve(q.text) === (q.mode === 'pad' ? a : tsolve(q.text)) && !Number.isNaN(tsolve(q.text)), `${name} "${q.text}": the app's answer is ${a}, the walker makes it ${tsolve(q.text)}`);
    if (q.mode === 'pick' || q.mode === 'warm') {
      const opts = await S.page.$$eval('#ctl [data-v]', e => e.map(x => x.dataset.v)), other = opts.find(v => v !== String(a));
      if (!must(opts.indexOf(String(a)) >= 0, `${name} ${fam}: no button for the right choice "${a}" (${opts.join(',')})`)) return;
      await pic('');
      if (q.mode === 'pick' && st === 'try' && first) {          // a wrong tap in Try it gets its reason, and she goes again
        await tap(`#ctl [data-v="${other}"]`); await sleep(320);
        must((await tbad()).length > 8, `${name} ${fam} pick: a wrong tap got no reason`); await pic('wrong');
      }
      if (q.mode === 'pick' && first) await help();
      await tap(`#ctl [data-v="${a}"]`);
      if (q.mode === 'warm') { warm++; await sleep(200); await pic('after', { wait: 300 }); }
      await tchange(s, 9000);
    } else if (q.mode === 'tap-all' || q.mode === 'tap-one') {
      const all = q.mode === 'tap-all', attr = all ? 'data-i' : 'data-t', want = (all ? a : [a]).map(String);
      const have = await S.page.$$eval('#line button.tapnum', (e, at) => e.map(x => x.getAttribute(at)), attr);
      if (!must(want.every(w => have.indexOf(w) >= 0), `${name} ${fam}: the sum has no number to tap for ${want.join(',')} (${have.join(',')})`)) return;
      await pic('');
      const wrong = have.find(v => want.indexOf(v) < 0);
      if (first && wrong != null) { await tap(`#line button.tapnum[${attr}="${wrong}"]`); await sleep(320); must((await tbad()).length > 8, `${name} ${fam} tap: a wrong tap got no reason`); await pic('wrong'); }
      if (first) await help();
      for (const w of want) { await tap(`#line button.tapnum[${attr}="${w}"]`); await sleep(90); }
      await tchange(s, 9000);
    } else if (q.mode === 'mid') {                                // the brackets: she types what they make
      await pic('');
      if (first) { await mtype(a + 1); await sleep(320); must((await tbad()).length > 8, `${name} ${fam} brackets: a wrong answer got no reason`); await help(); }
      await mtype(a); await tchange(s, 9000);
    } else if (q.mode === 'pad') {
      must(tsolve(q.text) === a, `${name} "${q.text}": the app's answer is ${a}, the walker makes it ${tsolve(q.text)}`);
      const wrongOne = a === 0 ? 1 : -a;
      await pic('');
      if (st === 'try' && first) {                               // two wrong answers: each gets its reason, then the help opens by itself
        await mtype(wrongOne); await sleep(300); must((await tbad()).length > 8, `${name} ${fam}: a wrong answer got no reason`);
        await mtype(wrongOne); await sleep(300); must((await thelp()).open, `${name} ${fam}: help did not open after two wrong answers`); await help();
      } else if (st === 'try' && !shown3) {                      // three wrong answers: she is shown the answer
        shown3 = true; for (let j = 0; j < 3; j++) { await mtype(wrongOne); await sleep(260); }
        await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
        (await timesMarked(q, a, wrongOne)).forEach(m => must(false, m));
        if (look) await stop(`${tag}-shown-after-3`, { noScroll: true, wait: 600 });
        asked++; await tap('#next'); await tchange(await tstate().then(x => Object.assign(x, { next: true }))); await sleep(120); continue;   // wait as the right-answer path does: the last Try it sum leaves by a fade
      } else if (st === 'quiz' && first) { await help(); helpedAt[q.i] = 1; }
      const given = bad ? wrongOne : a;
      await mtype(given); await S.page.waitForSelector('#next', { visible: true, timeout: 5000 });
      (await timesMarked(q, a, given)).forEach(m => must(false, m));
      if (given !== a) must((await txt('#ctl .sub')).length > 8, `${name} "${q.text}": a wrong answer got no reason`);
      must((await S.page.$$('#ctl .work li')).length >= 1, `${name}: no working is shown after the answer`);
      if (look && first) await stop(`${tag}-fb-${mode}-${Object.keys(seen).length}`, { noScroll: true, wait: 600 });
      asked++; await tap('#next'); await tchange(await tstate().then(x => Object.assign(x, { next: true })));
    } else { must(false, `${name}: the walker does not know the step "${q.mode}"`); return; }
    await sleep(120);
  }
  if (st !== 'quiz') {
    must(ended, `${name}: the stage never reached its end screen`);
    if (st === 'try') { must(/\/quiz$/.test(await hash()), `${name}: "Start the quiz" did not open the quiz`); return; }
    await stop(`${name}-end`, { noScroll: true, wait: 500 });
    must(await S.page.$(`#app a[href$="/${id}/try"]`), `${name}: the end screen has no button to Try it`);
    return;
  }
  await S.page.waitForSelector('.score', { visible: true, timeout: 5000 });
  await S.page.waitForFunction(() => { const e = document.querySelector('#save'); return e && !/Saving/.test(e.textContent); }, { timeout: 15000 });
  const n = TIMES_N[id], want = bad ? 0 : n;
  must(asked === n, `${name}: ${asked} questions were asked, wanted ${n}`); must(warm === 2, `${name}: ${warm} warm up taps, wanted 2`);
  must((await txt('.score')) === `${want} out of ${n}`, `${name}: score line says "${await txt('.score')}", wanted ${want} out of ${n}`);
  must((await txt('#save')) === 'Score saved.', `${name}: note says "${await txt('#save')}"`);
  must(await S.page.$('.result a[href="#/maths/times"]'), `${name}: the score screen has no way back to the lessons`);
  await stop(`${name}-result-${mode}`, { long: true, wait: 700 });
  const list = await server('/__attempts'), at = list[list.length - 1];
  must(list.length === before + 1 && at && at.topic === 'times' && at.lesson === id && at.score === want && at.total === n && at.detail.length === n
    && at.detail.every(d => d.topic === 'times' || (id === 'tmix' && d.topic === 'minus')), `${name}: the sheet did not get the attempt (${JSON.stringify(at || {}).slice(0, 140)})`);
  if (at && at.detail.length === n) must(at.detail.every((d, i) => d.helped === !!helpedAt[i]), `${name}: "helped" was not recorded for the right questions`);
  if (at && bad) {
    must(at.detail.every(d => d.right === false && d.slip), `${name}: wrong answers have no slip tag`);
    must((await S.page.$$('.review li')).length === n, `${name}: the "look at these again" list does not have ${n} sums`);
  }
}
async function times(first) {
  const p = S.page;
  await section('times-list', async () => {
    await p.evaluate(() => { location.hash = '#/s/maths'; }); await stop('times-maths', { wait: 900 });
    await tap('a.card[href="#/maths/times"]'); await stop('times-lessons', { wait: 1100 });
    must((await p.$$eval('a.card', e => e.length)) === 6, 'Times and divide does not show six lessons');
    await tap('a.cheatlink'); await stop('times-cheats', { wait: 700, long: true });
    await p.screenshot({ path: path.join(S.dir, 'times-cheats-whole.png'), fullPage: true });
    const body = await p.evaluate(() => document.querySelector('#app').innerText.replace(/\s+/g, ' '));
    TIMES_SAY.forEach(c => must(body.indexOf(c) >= 0, `the times cheats page does not say "${c}"`));
    must(await p.$('#app a[href="#/maths/times"]'), 'the times cheats page has no way back to the lessons');
  });
  const all = ['t1', 't2', 't3', 't4', 't5'];
  for (const id of all) for (const st of ['see', 'try', 'quiz']) await section(`times-${id}-${st}`, () => timesStage(id, st, 'right', true));
  await section('times-tmix-quiz', () => timesStage('tmix', 'quiz', 'right', true));
  await section('times-stars', async () => {
    for (const id of all.concat('tmix')) must((await p.evaluate(k => Store.stars(k), 'maths.times.' + id)) === 3, `Times ${id}: a clean quiz did not earn 3 stars`);
    await timesStage('t4', 'quiz', 'wrong', true); await timesStage('tmix', 'quiz', 'wrong', first);
    for (const id of ['t4', 'tmix']) must((await p.evaluate(k => Store.stars(k), 'maths.times.' + id)) === 3, `Times ${id}: stars were taken away by a worse quiz`);
    await p.evaluate(() => { location.hash = '#/maths/times'; }); await stop('times-lessons-after', { wait: 1100 });
  });
}

async function keys(browser, w, h) {
  await section('key-screen', async () => {
    const p = await open(browser, w, h, appUrl()); await p.waitForSelector('.keycard', { visible: true, timeout: 8000 }); await stop('key', {});
    await p.type('#k', 'not-the-key'); await tap('#go'); await p.waitForFunction(() => document.querySelector('#err').textContent, { timeout: 8000 }); await stop('key-wrong', {});
    must(/did not work/.test(await txt('#err')), 'key screen: a wrong key gave no message');
    await p.click('#k', { clickCount: 3 }); await p.type('#k', 'TEST anya'); await tap('#go'); await p.waitForSelector('.subjects', { visible: true, timeout: 8000 });
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.subjects', { visible: true, timeout: 8000 }); must(!(await p.$('.keycard')), 'the key was asked for a second time');
    await p.close();
  });
  await section('key-link', async () => {
    const p = await open(browser, w, h, appUrl('#k=test-anya')); await p.waitForSelector('.subjects', { visible: true, timeout: 8000 });
    must((await hash()) === '' && !/test-anya/.test(p.url()), 'the key stayed in the address bar'); await p.close();
  });
}
async function dad(browser, w, h, name) {
  await section('dad-' + name, async () => {
    const p = await open(browser, w, h, appUrl('#k=test-dad')); await p.waitForFunction(() => /\/admin\//.test(location.pathname), { timeout: 8000 });
    await sleep(1500); await stop('admin-' + name, { root: 'body', long: true });
    const body = await p.evaluate(() => document.body.textContent);
    ['Took one angle away, then added the other', 'Chose to take one angle from the other', 'Add or take away?',
      'Minus numbers: Signs that touch', 'Minus numbers: Mixed quiz', 'Angles: Mixed quiz', 'Right number, wrong sign'].forEach(t => must(body.indexOf(t) >= 0, `Dad's page does not say "${t}"`));
    await p.evaluate(() => { const b = [...document.querySelectorAll('.row-btn')].find(x => /Minus numbers: Same or different/.test(x.textContent) && /0 \/ 6/.test(x.textContent)); if (b) b.click(); }); await sleep(300);
    const shown = await p.evaluate(() => { const d = document.querySelector('.quiz div:not([hidden]) .qs'); return d ? d.innerText.replace(/\s+/g, ' ') : ''; });
    must(/−\d/.test(shown) && /Right number, wrong sign/.test(shown) && !/the angles/.test(shown), `Dad's page: the wrong minus quiz does not show its sums and slips (${shown.slice(0, 160)})`);
    await stop('admin-minus-open-' + name, { root: 'body', long: true });
    notes.push(`[${S.tag}] admin text starts: ` + (await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 260))));
    await p.close();
  });
}

async function walk(browser, w, h, first) {
  S.tag = `${w}x${h}`; S.dir = path.join(OUT, S.tag); S.n = 0; S.prose = 0; S.seed = 20 + w; fs.mkdirSync(S.dir, { recursive: true });
  if (process.env.ONLY === 'times') {
    const t = await open(browser, w, h, appUrl('#k=test-anya')); await t.waitForSelector('.subjects', { visible: true, timeout: 8000 }); await sleep(700);
    await times(first); await t.close(); notes.push(`[${S.tag}] ${S.n} screens looked at; most reading on one work screen: ${S.prose} words`); return;
  }
  if (first) await keys(browser, w, h);
  const p = await open(browser, w, h, appUrl('#k=test-anya'));
  await section('home', async () => {
    await p.waitForSelector('.subjects', { visible: true, timeout: 8000 }); await stop('home', { wait: 1600, long: true });
    must((await txt('.hello')).replace(/\s+/g, ' ') === 'Hi Anya,what would you like help with today?' || /Hi Anya,\s*what would you like help with today\?/.test(await txt('.hello')), 'home greeting is wrong: ' + await txt('.hello'));
    must((await p.$$eval('.subject span:last-child', e => e.map(x => x.textContent.trim()).join(','))) === 'Maths,English,Science,Geography,History,French,HE,RE,Irish,Spanish', 'home subjects are wrong');
    await tap('.subject[href="#/s/french"]'); await stop('subject-soon', { wait: 700 }); await tap('.soon a.btn'); await sleep(500);
    await tap('.subject[href="#/s/maths"]'); await stop('maths', { wait: 900 }); await tap('a.card'); await stop('lessons', { wait: 1100 });
  });
  for (const id of [1, 2, 3, 4]) {
    await section('see' + id, () => seeIt(id));
    await section('try' + id, () => tryIt(id, id === 1 || id === 4));
    await section('quiz' + id, () => quiz(id, 'right', id === 1 || id === 3));
  }
  await section('plan', async () => {
    await go('#/maths/angles'); await stop('lessons-plan-next', { wait: 1100 });
    const fresh = !(await p.evaluate(() => Store.best('maths.angles.plan')));   // later sizes pull her earlier score from the server
    must(!first || fresh, 'the first walk did not start with Add or take away? still to do');
    if (fresh) must(await p.$('a.card[href="#/maths/angles/plan/quiz"] .here'), 'with lessons 1 to 4 done, "Start here" is not on Add or take away?');
    await plan('right', true);
    must((await p.evaluate(() => Store.stars('maths.angles.plan'))) === 3, 'Add or take away: six clean rounds did not earn 3 stars');
  });
  await section('plan-wrong', async () => {
    await plan('wrong', true);
    must((await p.evaluate(() => Store.stars('maths.angles.plan'))) === 3, 'Add or take away: stars were taken away by a worse go');
  });
  await section('her-slip', slipWords);
  await section('once-earned', async () => {
    await quiz(1, 'wrong', true);
    must(await p.$('.result a[href$="/1/try"]'), 'a 0-star result has no way back to Try it');
    must((await p.evaluate(() => Store.stars('maths.angles.1'))) === 3, 'stars were taken away by a worse quiz');
    await go('#/maths/angles'); await stop('lessons-after', { wait: 1100 });
  });
  if (first) {
    await section('offline', async () => {
      S.quiet = true; await server('/__down?on=1', 'POST'); await quiz('mixed', 'right', true, true);
      const before = (await server('/__attempts')).length; await server('/__down?on=0', 'POST');
      await p.evaluate(() => Store.flush()); await sleep(300); S.quiet = false;
      must((await server('/__attempts')).length === before + 1 && (await p.evaluate(() => Store.waiting())) === 0, 'the kept score did not send itself once the internet came back');
    });
    await server('/__down?on=0', 'POST'); S.quiet = false;
    await section('new-device', async () => {
      const q = await open(browser, w, h, appUrl('#k=test-anya')); await q.waitForSelector('.subjects', { visible: true, timeout: 8000 }); await sleep(900);
      must((await q.evaluate(() => Store.stars('maths.angles.1'))) === 3, 'a new device did not get her stars from the sheet'); await q.close(); S.page = p;
    });
  } else await section('mixed', () => quiz('mixed', 'right', true));
  S.page = p; await minus(first); await times(first);
  await p.close();
  if (first || w > 1000) await dad(browser, w, h, S.tag);
  notes.push(`[${S.tag}] ${S.n} screens looked at; most reading on one work screen: ${S.prose} words`);
}

async function controls(browser) {   // the checker must catch planted faults, or the gate itself is broken
  S.tag = 'controls'; const p = await open(browser, 390, 844, `${BASE}/?fast=1#/maths/angles/1/quiz`); await p.waitForSelector('.pad', { visible: true, timeout: 8000 });
  const plant = [
    ['words spill sideways', () => { const b = document.querySelector('#stuck'); b.style.cssText = 'width:70px;white-space:nowrap;overflow:hidden'; }],
    ['small tap target', () => { document.querySelector('#del').style.cssText = 'width:20px;height:20px;min-width:0;min-height:0;padding:0'; }],
    ['job line over 14 words', () => { document.querySelector('#job').textContent = 'Find the size of the angle marked x in this picture and then type it in below now.'; }],
    ['taller than the screen', () => { const d = document.createElement('div'); d.style.height = '1500px'; document.querySelector('#app').appendChild(d); }],
    ['scrolls sideways', () => { const d = document.createElement('div'); d.style.cssText = 'width:900px;height:4px'; document.querySelector('#app').appendChild(d); }],
    ['number on the picture is only', () => { document.querySelectorAll('.pic .dg-label').forEach(t => { t.style.fontSize = '5px'; }); }],
    ['help step over 10 words', () => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li><span class="say">Add the two angles you can see and then take that away from 180.</span><b class="sum">65 + 40 = 105</b></li></ol>'; }],
    ['a help sum does not fit on one line', () => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li><span class="say">Add the two angles.</span><b class="sum">65 + 40 + 65 + 40 + 65 + 40 + 65 + 40 + 65 + 40 + 65 + 40 = 630</b></li></ol>'; }],
    ['the help shows broken words', () => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li>[object Object]</li></ol>'; }],
  ];
  let caught = 0;
  for (const [want, fn] of plant) {
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.pad', { visible: true, timeout: 8000 }); await p.evaluate(fn);
    const r = await p.evaluate(fitCheck, { noScroll: true });
    if (r.out.some(m => m.indexOf(want) >= 0)) caught++; else fails.push(`CONTROL NOT CAUGHT: ${want}`);
  }
  // Minus numbers: a long help step on a minus screen, and a wrong answer that the app marks right
  const total = plant.length + 5;
  await p.goto(`${BASE}/?fast=1&seed=7#/maths/minus/m2/try`, { waitUntil: 'load' }); await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#ctl [data-v]', { visible: true, timeout: 8000 });
  await p.evaluate(() => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li><span class="say">Look at both of the numbers and decide if their signs are the same or not.</span></li></ol>'; });
  if ((await p.evaluate(fitCheck, { noScroll: true })).out.some(m => m.indexOf('help step over 10 words') >= 0)) caught++; else fails.push('CONTROL NOT CAUGHT: a long help step on a minus screen');
  await p.goto(`${BASE}/?fast=1&seed=7#/maths/minus`, { waitUntil: 'load' }); await p.evaluate(() => { Minus.judge = () => ({ right: true }); });
  await p.evaluate(() => { location.hash = '#/maths/minus/m2/quiz'; }); await sleep(300);
  let hit = false;
  for (let k = 0; k < 12 && !hit; k++) {
    const { q, a } = await mstate(); if (!q) break;
    if (q.mode === 'warm') { await tap(`#ctl [data-v="${a}"]`); await p.waitForFunction((m, i) => { const x = window.__q; return !x || x.mode !== m || x.i !== i; }, { timeout: 6000 }, q.mode, q.i).catch(() => {}); continue; }
    if (q.mode === 'pad') { await mtype(-a); await p.waitForSelector('#next', { visible: true, timeout: 5000 }); hit = (await minusMarked(q, a, -a)).some(m => /marked the wrong way/.test(m)); break; }
    break;
  }
  if (hit) caught++; else fails.push('CONTROL NOT CAUGHT: a wrong minus answer marked right');
  // Times and divide: a long help step, and a wrong answer that the app marks right
  await p.goto(`${BASE}/?fast=1&seed=7#/maths/times`, { waitUntil: 'load' }); await p.evaluate(() => { location.hash = '#/maths/times/t1/try'; }); await p.waitForSelector('#ctl [data-v]', { visible: true, timeout: 8000 });
  await p.evaluate(() => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li><span class="say">Look at both of the numbers and decide if their signs are the same or not.</span></li></ol>'; });
  if ((await p.evaluate(fitCheck, { noScroll: true })).out.some(m => m.indexOf('help step over 10 words') >= 0)) caught++; else fails.push('CONTROL NOT CAUGHT: a long help step on a times screen');
  await p.evaluate(() => { location.hash = '#/maths/times/t3/see'; }); await p.waitForSelector('#line button.tapnum', { visible: true, timeout: 8000 });
  await p.evaluate(() => { const b = document.querySelector('#line button.tapnum'); b.style.cssText = 'height:30px;min-height:0'; });
  if ((await p.evaluate(fitCheck, { noScroll: true })).out.some(m => m.indexOf('words spill down') >= 0 && m.indexOf('tapnum') >= 0)) caught++; else fails.push('CONTROL NOT CAUGHT: a number button too short for its digits');
  await p.evaluate(() => { location.hash = '#/maths/times'; }); await sleep(200); await p.evaluate(() => { Times.judge = () => ({ right: true, slip: '', say: '' }); });
  await p.evaluate(() => { location.hash = '#/maths/times/t1/quiz'; }); await sleep(300);
  let thit = false;
  for (let k = 0; k < 12 && !thit; k++) {
    const st = await tstate(), q = st.q, a = st.a; if (!q) break;
    if (q.mode === 'warm') { await tap(`#ctl [data-v="${a}"]`); await tchange(st, 6000); continue; }
    if (q.mode === 'pad') { const g = a === 0 ? 1 : -a; await mtype(g); await p.waitForSelector('#next', { visible: true, timeout: 5000 }); thit = (await timesMarked(q, a, g)).some(m => /marked the wrong way/.test(m)); break; }
    break;
  }
  if (thit) caught++; else fails.push('CONTROL NOT CAUGHT: a wrong times answer marked right');
  await p.close(); notes.push(`controls caught: ${caught} of ${total}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); await server('/__reset', 'POST');
  const browser = await puppeteer.launch({ headless: 'shell' });
  try {
    if (!process.env.ONLY) await controls(browser);
    for (let i = 0; i < SIZES.length; i++) await walk(browser, SIZES[i][0], SIZES[i][1], i === 0);
  } finally { await browser.close(); }
  const uniq = [...new Set(fails)], text = [`WALK ${uniq.length ? 'FAILED' : 'PASSED'}: ${uniq.length} faults`, ...uniq, '', ...notes].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.txt'), text + '\n'); console.log(text.split('\n').slice(0, 110).join('\n'));
  process.exit(uniq.length ? 1 : 0);
})().catch(e => { console.error('walker crashed:', e); process.exit(2); });
