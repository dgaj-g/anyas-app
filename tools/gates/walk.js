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
    if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1) out.push('words spill down: ' + name);
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
  steps.forEach(li => { if (words(li.textContent) > 10) out.push('help step over 10 words: ' + li.textContent); });
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
const go = async hash => { await S.page.evaluate(h => { location.hash = h; }, hash); await sleep(200); };
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
    notes.push(`[${S.tag}] admin text starts: ` + (await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 260))));
    await p.close();
  });
}

async function walk(browser, w, h, first) {
  S.tag = `${w}x${h}`; S.dir = path.join(OUT, S.tag); S.n = 0; S.prose = 0; S.seed = 20 + w; fs.mkdirSync(S.dir, { recursive: true });
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
    ['help step over 10 words', () => { const h = document.querySelector('#help'); h.hidden = false; h.innerHTML = '<ol><li>Add the two angles you can see and then take that away from 180.</li></ol>'; }],
  ];
  let caught = 0;
  for (const [want, fn] of plant) {
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.pad', { visible: true, timeout: 8000 }); await p.evaluate(fn);
    const r = await p.evaluate(fitCheck, { noScroll: true });
    if (r.out.some(m => m.indexOf(want) >= 0)) caught++; else fails.push(`CONTROL NOT CAUGHT: ${want}`);
  }
  await p.close(); notes.push(`controls caught: ${caught} of ${plant.length}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); await server('/__reset', 'POST');
  const browser = await puppeteer.launch({ headless: 'shell' });
  try {
    await controls(browser);
    for (let i = 0; i < SIZES.length; i++) await walk(browser, SIZES[i][0], SIZES[i][1], i === 0);
  } finally { await browser.close(); }
  const uniq = [...new Set(fails)], text = [`WALK ${uniq.length ? 'FAILED' : 'PASSED'}: ${uniq.length} faults`, ...uniq, '', ...notes].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.txt'), text + '\n'); console.log(text.split('\n').slice(0, 110).join('\n'));
  process.exit(uniq.length ? 1 : 0);
})().catch(e => { console.error('walker crashed:', e); process.exit(2); });
