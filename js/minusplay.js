/* Minus numbers: the screens. See it, Try it, Quiz, the two taps before a quiz, and the cheats card.
   The sums, the cheat words and the judging live in minus.js. The result screen and the run rules come from Player.kit.
   A sum is drawn from pieces so the signs can be tapped, lit, moved and joined; every sign is a drawn bar, not a letter. */
(function () {
  'use strict';
  const M = window.Minus, CONFIG = window.CONFIG, FX = window.FX, kit = window.Player.kit;
  const { esc, newSeed, reshake, dots, helpHtml } = kit, MN = M.M, BACK = '#/maths/minus';
  const CHEAT1 = 'Same signs make a plus. Different signs make a minus.';
  const CHEAT2 = 'Same signs: add. Different signs: take away. Bigger wins the sign.';
  const word = neg => neg ? 'minus' : 'plus';

  /* ---------- the pieces of a sum ---------- */
  const sign = (v, role, o) => {
    o = o || {};
    const cls = `tok sign ${v === '+' ? 'plus' : 'minus'}${o.made ? ' made' : ''}${o.pop ? ' pop' : ''}${o.ghost ? ' ghost' : ''}${o.mini ? ' mini' : ''}`;
    const at = `${role ? ` data-role="${role}"` : ''}${o.pair ? ' data-pair="1"' : ''}`;
    return o.tap ? `<button class="${cls}" type="button"${at} aria-label="${v === '+' ? 'plus' : 'minus'} sign"></button>` : `<span class="${cls}"${at} aria-hidden="true"></span>`;
  };
  const numTok = (n, role) => `<span class="tok num"${role ? ` data-role="${role}"` : ''}>${n}</span>`;
  const chip = v => `<span class="grp ${word(v < 0)}">${sign(v < 0 ? MN : '+')}${numTok(Math.abs(v))}</span>`;

  /* o.tidy: after the touching signs have become one. o.tap: the signs are buttons. o.eq: the answer is on the end. */
  function lineHtml(q, o) {
    o = o || {};
    const toks = o.tidy ? q.tidyToks : q.toks, get = r => toks.find(t => t.role === r), op = get('op'), own = get('own'), A = q.terms[0], B = q.terms[1];
    let h = `<span class="grp ga ${word(A.neg)}">${get('lead') ? sign(MN, 'lead', { tap: o.tap }) : sign('+', 'lead', { ghost: true })}${numTok(A.n, 'a')}</span>`
      + `<span class="grp gb${own ? '' : ' ' + word(B.neg)}">${sign(op.v, 'op', { tap: o.tap, pair: op.pair, made: op.made, pop: op.made && o.pop })}${own ? sign(MN, 'own', { tap: o.tap, pair: true }) : ''}${numTok(B.n, 'b')}</span>`;
    if (o.eq) h += `<span class="tok eq" aria-hidden="true">=</span><span class="grp gans ${word(q.answer < 0)}">${q.answer < 0 ? sign(MN) : ''}${numTok(Math.abs(q.answer))}</span>`;
    return h;
  }
  const cardHtml = (q, o) => `<div class="sumcard" id="pic"${o && o.tap ? '' : ` role="img" aria-label="${esc(q.desc)}"`}><div class="sumline" id="line">${lineHtml(q, o)}</div>
    <div class="dotrows" id="drows" aria-hidden="true" hidden></div><p class="dotsum" id="dsum" hidden></p></div>`;

  function frame(host, q, job, label, dotHtml, o) {
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead long"><p class="job" id="job">${job}</p><div class="count" id="count"><span>${label}</span>${dotHtml}</div></div>
      <div class="split msplit"><div>${cardHtml(q, o)}</div><div id="ctl"></div></div>`;
    window.scrollTo(0, 0);
    const $ = s => host.querySelector(s);
    return { ctl: $('#ctl'), pic: $('#pic'), line: $('#line'), job: $('#job'), count: $('#count'), drows: $('#drows'), dsum: $('#dsum') };
  }

  /* One sitting. Every timer and every tap checks that this sitting is still the one on the screen. */
  function runner() {
    const me = kit.begin(), timers = [];
    return { me, live: () => kit.live(me),
      later(fn, ms) { timers.push(setTimeout(() => { if (kit.live(me)) fn(); }, CONFIG.fast ? Math.min(ms, 120) : ms)); },
      stop() { timers.forEach(clearTimeout); kit.stopAll(); } };
  }
  const hook = (L, stage, mode, q, i, n) => { if (CONFIG.local) window.__q = { topic: 'minus', lesson: L.id, stage, mode, kind: q && q.kind, text: q && q.text, i, n }; };
  const want = v => { if (CONFIG.local) window.__answer = v; };

  /* ---------- what the picture can do ---------- */
  const chips = ui => ui.line.classList.add('chips');        // each number wears its sign: minus is rose, plus is gold
  function showDots(ui, q) {
    if (!ui.drows.hidden) return;
    ui.drows.innerHTML = q.terms.map(t => `<div class="drow ${word(t.neg)}">${sign(t.neg ? MN : '+', '', { mini: true })}${'<i></i>'.repeat(t.n)}</div>`).join('');
    ui.drows.hidden = false;
  }
  /* Same signs: every dot counts. Different signs: they cancel in pairs and the left-over dots are the answer. */
  function settleDots(ui, q) {
    showDots(ui, q);
    ui.drows.classList.add(q.same ? 'same' : 'diff');
    if (!q.same) ui.drows.querySelectorAll('.drow').forEach(r => r.querySelectorAll('i').forEach((d, k) => { d.style.setProperty('--k', k); d.classList.add(k < q.small ? 'gone' : 'left'); }));
    ui.dsum.textContent = q.beats[1].sum; ui.dsum.hidden = false;
  }
  /* The two signs that touch become one: two minus bars cross to make a plus; a minus knocks the upright out of a plus. */
  function merge(R, ui, q, then) {
    const own = ui.line.querySelector('[data-role="own"]'), op = ui.line.querySelector('[data-role="op"]');
    if (!own) { if (then) then(); return; }
    const paint = () => { ui.line.innerHTML = lineHtml(q, { tidy: true, pop: true }); if (then) then(); };
    if (FX.reduce || CONFIG.fast) return paint();
    const dx = op.getBoundingClientRect().left - own.getBoundingClientRect().left + (op.offsetWidth - own.offsetWidth) / 2;
    own.classList.add('fly'); own.style.transform = `translateX(${dx}px)${q.touch.makes === '+' ? ' rotate(90deg)' : ''}`;
    if (q.touch.makes !== '+') op.classList.add('losing');
    FX.chime('place'); R.later(paint, 640);
  }
  function mark(ui, what) {
    const sel = what === 'pair' ? '[data-pair]' : what === 'apart' ? '[data-role="lead"]:not(.ghost), [data-role="a"], [data-role="op"]' : what === 'one' ? '[data-role="op"]'
      : what === 'both' ? '.ga, .gb' : what === 'ga' || what === 'gb' ? '.' + what : '';
    if (!sel) return;
    ui.line.querySelectorAll(sel).forEach(el => { el.classList.remove('mark'); void el.offsetWidth; el.classList.add('mark'); });
  }
  /* Tape lands on ONE sign at a time, on top of the sign, so she can watch each sign being covered.
     Gives back how long that takes (ms): nothing else should move until then. */
  const TAPE = { lead: 600, each: 850, land: 750 };
  function tape(R, line) {
    const gs = Array.from(line.querySelectorAll('.grp')).filter(g => g.querySelector(':scope > .tok.sign'));
    gs.forEach((g, i) => R.later(() => {
      const s = g.querySelector(':scope > .tok.sign');
      if (!s || !g.isConnected || !line.classList.contains('cover') || s.querySelector('.tape')) return;
      s.insertAdjacentHTML('beforeend', '<i class="tape" aria-hidden="true"></i>'); FX.chime('place');
    }, TAPE.lead + i * TAPE.each));
    return gs.length ? TAPE.lead + (gs.length - 1) * TAPE.each + TAPE.land : 0;
  }
  /* "Cover the signs": tape covers each sign in turn, THEN only the bigger number is ringed (any older ring is cleared first) and the ring stays.
     With `back` (ms after the ring) its own sign then comes back: bigger wins the sign. Gives back how long it all takes (ms). */
  function cover(R, ui, q, back) {
    const which = q.terms[0].n > q.terms[1].n ? 'ga' : 'gb', g = ui.line.querySelector('.' + which);
    ui.line.querySelectorAll('.mark, .big').forEach(el => el.classList.remove('mark', 'big'));
    ui.line.classList.add('cover');
    const t = tape(R, ui.line) + 300;
    R.later(() => { if (!g || !g.isConnected || !ui.line.classList.contains('cover')) return; mark(ui, which); g.classList.add('big'); }, t);
    if (back && g) R.later(() => { if (g.isConnected) g.classList.add('win'); }, t + back);
    return t + (back || 0);
  }
  const say = (ui, text, bad) => { const s = ui.ctl.querySelector('#say'); if (s) { s.textContent = text; s.className = 'sub ' + (bad ? 'bad' : 'good'); } };
  function showHelp(ui, steps) {
    const h = ui.ctl.querySelector('#help'), s = ui.ctl.querySelector('#stuck'); if (!h) return;
    h.innerHTML = helpHtml(steps); h.hidden = false; if (s) s.hidden = true;
  }
  const STUCK = '<button class="btn soft small" id="stuck" type="button">Stuck? Show me</button>';
  const HEAD = '<div class="help" id="help" hidden></div><p class="sub" id="say" aria-live="polite"></p>';
  const opt = (v, label, o) => `<button class="btn soft opt${o && o.words ? ' words' : ''}" type="button" data-v="${v}">${o && o.sign ? sign(o.sign, '', { mini: true }) : ''}${label}</button>`;
  const TIDY_OPTS = `<div class="duo">${opt('plus', 'A plus', { sign: '+' })}${opt('minus', 'A minus', { sign: MN })}</div>${opt('none', 'No signs touch')}`;
  const TEAM_OPTS = `<div class="duo">${opt('same', 'Same')}${opt('diff', 'Different')}</div>`;
  const SIGN_OPTS = `<div class="duo">${opt('plus', 'Plus', { sign: '+' })}${opt('minus', 'Minus', { sign: MN })}</div>`;

  /* One step where she picks a button. o.once: the first tap counts (a quiz). Otherwise a wrong tap gets its reason
     and she tries again; two wrong taps open the help. o.done({ given, right, say, slip, wrongs, helped }) */
  function choose(R, ui, o) {
    let wrongs = 0, helped = false, over = false;
    ui.ctl.innerHTML = HEAD + o.html + (o.help ? STUCK : ''); want(o.answer);
    const open = () => { if (helped) return; helped = true; showHelp(ui, o.help); if (o.onHelp) o.onHelp(); };
    ui.ctl.onclick = e => {
      const b = e.target.closest('button'); if (!b || over || !R.live()) return;
      if (b.id === 'stuck') return open();
      const v = b.dataset.v; if (v == null) return;
      const right = v === o.answer, why = right ? null : o.wrong(v);
      if (right || o.once) {
        over = true; b.classList.add(right ? 'yes' : 'no'); if (!right) { const r = ui.ctl.querySelector(`[data-v="${o.answer}"]`); if (r) r.classList.add('yes'); }
        if (right) FX.chime('place'); else { FX.settle(); FX.chime('wrong'); reshake(ui.pic); }
        return o.done({ given: v, right, say: right ? '' : why.say, slip: right ? '' : why.slip, wrongs, helped });
      }
      wrongs++; FX.chime('wrong'); reshake(b); b.classList.add('no'); b.disabled = true; say(ui, why.say, true);
      if (wrongs >= 2) open();
    };
  }

  /* ---------- the number pad, with a minus key ---------- */
  const padHtml = () => `${HEAD}<div class="ans"><button class="key neg" id="neg" type="button" aria-label="Minus sign" aria-pressed="false">${sign(MN, '', { mini: true })}</button><span class="box" id="box" aria-live="polite"></span><button class="del" id="del" type="button" aria-label="Rub out">⌫</button></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" type="button" data-k="${d}">${d}</button>`).join('')}</div>
    <div class="duo">${STUCK}<button class="btn" id="check" type="button" disabled>Check</button></div>`;
  function wirePad(ctl, onCheck, max) {
    let v = '', neg = false, off = false;
    const box = ctl.querySelector('#box'), check = ctl.querySelector('#check'), nk = ctl.querySelector('#neg');
    const paint = () => { box.textContent = (neg ? MN : '') + v; check.disabled = !v; nk.classList.toggle('on', neg); nk.setAttribute('aria-pressed', neg ? 'true' : 'false'); };
    const press = k => {
      if (off) return;
      if (k === 'ok') { if (v) onCheck((neg ? -1 : 1) * +v); return; }
      if (k === 'neg') neg = !neg; else if (k === 'del') { if (v) v = v.slice(0, -1); else neg = false; } else if (v.length < (max || 2)) v = (v === '0' ? '' : v) + k;
      paint(); FX.chime('tap');
    };
    ctl.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) press(b.dataset.k); else if (b.id === 'del') press('del'); else if (b.id === 'neg') press('neg'); else if (b.id === 'check') press('ok');
    };
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === '-' || e.key === MN) press('neg'); else if (e.key === 'Enter') press('ok'); else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    const stop = () => { off = true; document.removeEventListener('keydown', onKey); kit.drop(stop); };
    kit.hold(stop);
    return { clear() { v = ''; neg = false; paint(); }, stop };
  }
  /* o.goes: how many tries. o.done({ given, j, helped }) */
  function padStep(R, ui, q, o) {
    let wrongs = 0, helped = false;
    ui.ctl.innerHTML = padHtml(); want(q.answer);
    const open = () => {
      if (helped) return; helped = true; showHelp(ui, o.help); if (o.onHelp) o.onHelp();
      if (q.answer < 0) ui.ctl.querySelector('#neg').classList.add('nudge');          // the help has just said the answer is minus: this is the key for it
    };
    const pad = wirePad(ui.ctl, given => {
      if (!R.live()) return;
      const j = M.judge(q, given);
      if (!j.right && ++wrongs < o.goes) { FX.chime('wrong'); reshake(ui.pic); say(ui, j.slip ? j.say : 'Not yet. Try again.', true); pad.clear(); if (wrongs === 2) open(); return; }
      pad.stop(); o.done({ given, j, helped });
    });
    ui.ctl.querySelector('#stuck').onclick = open;
  }

  /* ---------- the steps, used by Try it and the quizzes ---------- */
  const TIDY_JOB = 'Do two signs touch? Pick what they make.', TEAM_JOB = 'Are the two signs the same or different?';
  function tidyStep(R, ui, q, o) {
    ui.job.textContent = TIDY_JOB;
    choose(R, ui, { html: TIDY_OPTS, answer: q.tidyAnswer, once: o.once, wrong: v => M.judgeTidy(q, v), help: q.helpTidy, onHelp: () => mark(ui, q.helpTidy[0].mark),
      done: r => merge(R, ui, q, () => o.done(r)) });
  }
  const teamHelp = q => ['The sign in front of a number belongs to it.',
    q.terms[0].neg ? `So this is ${M.num(q.terms[0].neg ? -q.terms[0].n : q.terms[0].n)} and ${q.terms[1].neg ? MN : '+'}${q.terms[1].n}.` : 'No sign in front means plus.'];
  const teamWrong = q => ({ slip: 'team', say: q.same ? `Look again. Both numbers are ${word(q.terms[0].neg)}.` : `Look again. The ${q.terms[0].n} is ${word(q.terms[0].neg)}. The ${q.terms[1].n} is ${word(q.terms[1].neg)}.` });
  function teamStep(R, ui, q, o) {
    ui.job.textContent = TEAM_JOB; chips(ui);
    choose(R, ui, { html: TEAM_OPTS, answer: q.same ? 'same' : 'diff', wrong: () => teamWrong(q), help: teamHelp(q), onHelp: () => mark(ui, 'both'), done: o.done });
  }
  const steps = (L, list) => L.id === 'm2' ? list.slice(1) : list;        // lesson 2 has no signs that touch, so its working starts at the second cheat
  const helpPic = (R, ui, q) => merge(R, ui, q, () => { chips(ui); showDots(ui, q); });

  function nextBtn(R, ui, fn) { const b = ui.ctl.querySelector('#next'); if (b) b.onclick = () => { if (R.live()) fn(); }; }
  function feedback(R, ui, q, L, r, label, onNext) {
    ui.ctl.onclick = null;
    ui.line.innerHTML = lineHtml(q, { tidy: true, eq: true }); ui.line.classList.add('chips', 'eq'); settleDots(ui, q);
    ui.ctl.innerHTML = `<p class="verdict ${r.j.right ? 'good' : 'bad'}">${r.j.right ? 'Yes! ' : 'Not this time. '}${esc(q.text)} = ${M.num(q.answer)}</p>${!r.j.right && r.j.slip ? `<p class="sub">${esc(r.j.say)}</p>` : ''}
      <ol class="work steps">${steps(L, q.beats).map(s => `<li>${esc(s.say)} <b class="sum">${esc(s.sum)}</b></li>`).join('')}</ol><button class="btn go" id="next" type="button">${label}</button>`;
    if (r.j.right) { FX.chime('right'); FX.at(ui.pic, 26); } else { FX.settle(); FX.chime('wrong'); reshake(ui.pic); }
    nextBtn(R, ui, onNext);
  }
  const tidyTail = q => q.touch ? `It becomes ${q.tidy}.` : 'Nothing changes.';
  const tidyWhy = q => q.touch ? q.beats[0].say : q.between ? `The ${q.between} sits between the two signs.` : 'There is only one sign here.';
  function tidyVerdict(R, ui, q, r, label, onNext) {
    ui.ctl.onclick = null;
    ui.ctl.innerHTML = `<p class="verdict ${r.right ? 'good' : 'bad'}">${r.right ? 'Yes! ' : 'Not this time. '}${esc(tidyTail(q))}</p><p class="sub">${esc(r.right ? tidyWhy(q) : r.say)}</p>
      <button class="btn go" id="next" type="button">${label}</button>`;
    if (r.right) { FX.chime('right'); FX.at(ui.pic, 22); }
    nextBtn(R, ui, onNext);
  }

  /* ---------- the cheats as pictures ---------- */
  const arrow = '<span class="arrow" aria-hidden="true">→</span>';
  const rule1 = () => `<div class="rule" role="img" aria-label="Minus and minus make plus.">${sign(MN)}${sign(MN)}${arrow}${sign('+', '', { made: true })}</div>
    <div class="rule" role="img" aria-label="Plus and minus make minus.">${sign('+')}${sign(MN)}${arrow}${sign(MN, '', { made: true })}</div>`;
  const rule2 = () => `<div class="rule chips" role="img" aria-label="Minus 4 and minus 5: add. Minus 9.">${chip(-4)}${chip(-5)}${arrow}<span class="how">add</span>${arrow}${chip(-9)}</div>
    <div class="rule chips" role="img" aria-label="Plus 4 and minus 6: take away. Minus 2.">${chip(4)}${chip(-6)}${arrow}<span class="how">take away</span>${arrow}${chip(-2)}</div>`;
  function cheats() {
    return `<section class="screen"><div class="bar"><a class="back" href="${BACK}">Lessons</a><h1>The two cheats</h1><span class="pad44"></span></div>
      <div class="cheats"><div class="sheet cheat"><h2><i>1</i>Signs that touch</h2>${rule1()}<p class="sub">${CHEAT1}</p></div>
      <div class="sheet cheat"><h2><i>2</i>The numbers</h2>${rule2()}<p class="sub">${CHEAT2}</p><p class="sub note">${M.SAY.cover}</p></div></div></section>`;
  }
  function seeEnd(R, host, L, ctx, n, marks, line, again) {
    ctx.done('see');
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead long"><p class="job" id="job">${line}</p><div class="count" id="count"><span>${n} of ${n}</span>${dots(marks, -1, n)}</div></div>
      <div class="split msplit"><div><div class="sumcard rules" id="pic">${L.mode === 'tidy' ? rule1() : rule2()}</div></div>
      <div id="ctl"><div class="stack"><a class="btn go" href="${ctx.base}/try">Go to Try it</a><button class="btn soft" id="again" type="button">Do this again</button></div></div></div>`;
    window.scrollTo(0, 0); hook(L, 'see', 'done', null, n, n);
    FX.chime('win'); FX.at(host.querySelector('#pic'), 34);
    host.querySelector('#again').onclick = () => { if (R.live()) again(); };
  }

  /* ---------- See it ---------- */
  function seeTidy(host, L, ctx) {           // lesson 1: she taps the two signs that touch and watches them become one
    const R = runner(), qs = M.set(L.id, 'see', newSeed()), n = qs.length, marks = []; let i = 0;
    const show = () => {
      const q = qs[i], ui = frame(host, q, 'Tap the two signs that touch.', `${i + 1} of ${n}`, dots(marks, i, n), { tap: true }); let lit = 0, over = false;
      hook(L, 'see', 'see', q, i, n); want(q.touch ? 'pair' : 'none');
      ui.ctl.innerHTML = `${HEAD}<div class="duo">${STUCK}<button class="btn soft small" id="none" type="button">No signs touch</button></div>`;
      const none = ui.ctl.querySelector('#none');
      const win = text => {
        over = true; marks[i] = true; say(ui, text); FX.chime('right'); FX.at(ui.pic, 20);
        ui.count.innerHTML = `<span>${i + 1} of ${n}</span>${dots(marks, -1, n)}`;
        ui.ctl.querySelector('.duo').outerHTML = `<button class="btn go" id="next" type="button">${i + 1 < n ? 'Next one' : 'Finish'}</button>`;
        const h = ui.ctl.querySelector('#help'); if (h) h.hidden = true;
        nextBtn(R, ui, () => { i++; if (i < n) show(); else seeEnd(R, host, L, ctx, n, marks, 'Two signs that touch become one sign.', () => { i = 0; marks.length = 0; show(); }); });
      };
      ui.pic.onclick = e => {
        const t = e.target.closest('button.tok'); if (!t || over || !R.live()) return;
        if (q.touch && t.dataset.pair) {
          if (!t.classList.contains('lit')) { t.classList.add('lit'); lit++; FX.chime('tap'); }
          if (lit === 2) { over = true; merge(R, ui, q, () => win(q.beats[0].say)); }
          return;
        }
        FX.chime('wrong'); reshake(t); say(ui, q.touch ? 'That sign is on its own. Find two side by side.' : M.judgeTidy(q, 'plus').say, true);
      };
      ui.ctl.onclick = e => {
        const b = e.target.closest('button'); if (!b || over || !R.live()) return;
        if (b.id === 'stuck') { showHelp(ui, q.helpTidy); mark(ui, q.helpTidy[0].mark); if (!q.touch) none.classList.add('nudge'); return; }
        if (b.id !== 'none') return;
        if (q.touch) { FX.chime('wrong'); reshake(b); say(ui, 'Look again. Two signs sit side by side.', true); } else win(tidyWhy(q));
      };
    };
    show();
    return R.stop;
  }
  function seeSum(host, L, ctx) {            // lesson 2: same or different, watch the dots, then whose sign
    const R = runner(), qs = M.set(L.id, 'see', newSeed()), n = qs.length, marks = []; let i = 0;
    const show = () => {
      const q = qs[i], ui = frame(host, q, TEAM_JOB, `${i + 1} of ${n}`, dots(marks, i, n));
      hook(L, 'see', 'team', q, i, n); showDots(ui, q);
      teamStep(R, ui, q, { done: () => {
        settleDots(ui, q); say(ui, q.beats[1].say); FX.chime('right');
        R.later(() => {
          ui.job.textContent = 'Which sign does the answer get?'; hook(L, 'see', 'sign', q, i, n);
          choose(R, ui, { html: SIGN_OPTS, answer: q.answer < 0 ? 'minus' : 'plus', wrong: () => ({ slip: 'sign', say: q.beats[2].say }),
            help: [M.SAY.coverAsk(q.terms[0].n, q.terms[1].n), 'Bigger wins the sign.'], onHelp: () => cover(R, ui, q, 1500),
            done: () => {
              marks[i] = true; ui.ctl.onclick = null;
              ui.line.innerHTML = lineHtml(q, { tidy: true, eq: true }); ui.line.classList.remove('cover'); ui.line.classList.add('chips', 'eq');
              ui.count.innerHTML = `<span>${i + 1} of ${n}</span>${dots(marks, -1, n)}`;
              ui.ctl.innerHTML = `<p class="verdict good">${esc(q.text)} = ${M.num(q.answer)}</p><p class="sub good">${esc(q.beats[2].say)}</p><button class="btn go" id="next" type="button">${i + 1 < n ? 'Next one' : 'Finish'}</button>`;
              FX.chime('right'); FX.at(ui.pic, 20);
              nextBtn(R, ui, () => { i++; if (i < n) show(); else seeEnd(R, host, L, ctx, n, marks, CHEAT2, () => { i = 0; marks.length = 0; show(); }); });
            } });
        }, 1700);
      } });
    };
    show();
    return R.stop;
  }
  const see = (host, L, ctx) => L.mode === 'tidy' ? seeTidy(host, L, ctx) : seeSum(host, L, ctx);

  /* ---------- Try it: every step is hers, with as many goes as she needs ---------- */
  function tryIt(host, L, ctx) {
    const R = runner(), qs = M.set(L.id, 'try', newSeed()), n = qs.length, marks = []; let i = 0;
    const ask = () => {
      const q = qs[i], last = i === n - 1, ui = frame(host, q, '', `${i + 1} of ${n}`, dots(marks, i, n));
      const label = last ? 'Start the quiz' : 'Next one';
      const onNext = () => { if (last) { ctx.done('try'); location.hash = ctx.base + '/quiz'; } else { i++; ask(); } };
      const got = () => { marks[i] = true; ui.count.innerHTML = `<span>${i + 1} of ${n}</span>${dots(marks, -1, n)}`; };
      if (L.mode === 'tidy') { hook(L, 'try', 'tidy', q, i, n); return tidyStep(R, ui, q, { done: r => { got(); tidyVerdict(R, ui, q, r, label, onNext); } }); }
      const pad = () => {
        hook(L, 'try', 'pad', q, i, n);
        ui.job.textContent = (q.same ? 'Same signs: add.' : 'Different signs: take away.') + ' Now work it out.'; showDots(ui, q);
        padStep(R, ui, q, { goes: 3, help: steps(L, q.help), onHelp: () => helpPic(R, ui, q), done: r => { got(); feedback(R, ui, q, L, r, label, onNext); } });
      };
      const team = () => { hook(L, 'try', 'team', q, i, n); teamStep(R, ui, q, { done: () => R.later(pad, 500) }); };
      if (q.touch) { hook(L, 'try', 'tidy', q, i, n); tidyStep(R, ui, q, { done: () => R.later(team, 700) }); } else team();
    };
    ask();
    return R.stop;
  }

  /* ---------- Quiz: two taps to say the cheat, then the sums, one go each ---------- */
  const WARM_PIC = [['neg-minus-neg-up', 5, 7], ['pos-plus-neg-down', 4, 6], ['neg-minus', 4, 5], ['pos-minus', 4, 6], ['pos-minus', 4, 6], ['neg-plus-down', 9, 7]];
  const SAID = { plus: 'You picked a plus.', minus: 'You picked a minus.', none: 'You said no signs touch.' };
  const NAMED = { plus: 'a plus', minus: 'a minus', none: 'no signs touch' };
  function quiz(host, L, ctx) {
    const R = runner(), seed = newSeed(), qs = M.set(L.id, 'quiz', seed), warm = M.warm(L.id, seed), n = qs.length, marks = [], detail = [], review = [];
    let i = 0, startedAt = Date.now();
    const warmUp = k => {
      if (k >= warm.length) { startedAt = Date.now(); return ask(); }
      const w = warm[k], idx = M.WARM.findIndex(x => x.ask === w.ask), p = WARM_PIC[idx], q = M.build(p[0], p[1], p[2]);
      const ui = frame(host, q, esc(w.ask), `Warm up ${k + 1} of ${warm.length}`, '');
      hook(L, 'quiz', 'warm', q, k, warm.length);
      if (idx < 2) mark(ui, 'pair'); else { chips(ui); showDots(ui, q); }
      choose(R, ui, { html: `<div class="duo">${w.options.map((o, j) => opt(j, esc(o.label), { words: true })).join('')}</div>`, answer: String(w.options.findIndex(o => o.right)),
        wrong: () => ({ slip: 'warm', say: w.why }),
        done: () => {
          say(ui, w.why);
          let t = 0;
          if (idx < 2) merge(R, ui, q); else if (idx < 4) settleDots(ui, q); else t = cover(R, ui, q, idx === 4 ? 1400 : 0);
          R.later(() => warmUp(k + 1), t ? t + 2200 : 1500);                 // after the last move, time to look at it
        } });
    };
    const ask = () => {
      const q = qs[i], t0 = Date.now(), last = i === n - 1, label = `Question ${i + 1} of ${n}`, ui = frame(host, q, 'Work out the answer.', label, dots(marks, i, n));
      const nextLabel = last ? 'See my score' : 'Next question', onNext = () => { i++; if (i < n) ask(); else finish(); };
      const log = (right, given, correct, slip, helped) => {
        marks.push(right); ui.count.innerHTML = `<span>${label}</span>${dots(marks, -1, n)}`;
        detail.push({ n: q.n, kind: q.kind, topic: 'minus', prompt: L.mode === 'tidy' ? q.text + ': what the signs that touch make' : q.text, given, correct, right, slip: right ? '' : (slip || 'unknown'), ms: Date.now() - t0, helped });
      };
      if (L.mode === 'tidy') {
        hook(L, 'quiz', 'tidy', q, i, n);
        return tidyStep(R, ui, q, { once: true, done: r => {
          log(r.right, NAMED[r.given], NAMED[q.tidyAnswer], r.slip, r.helped);
          if (!r.right) review.push(`<li><div class="mini msum">${esc(q.text)}</div><div>${SAID[r.given]} ${esc(tidyTail(q))}<small>${esc(r.say)}</small></div></li>`);
          tidyVerdict(R, ui, q, r, nextLabel, onNext);
        } });
      }
      hook(L, 'quiz', 'pad', q, i, n);
      padStep(R, ui, q, { goes: 1, help: steps(L, q.help), onHelp: () => helpPic(R, ui, q), done: r => {
        log(r.j.right, r.given, q.answer, r.j.slip, r.helped);
        if (!r.j.right) review.push(`<li><div class="mini msum">${esc(q.text)}</div><div>You wrote ${M.num(r.given)}. The answer is ${M.num(q.answer)}.<small>${steps(L, q.beats).map(s => esc(s.say)).join('<br>')}</small></div></li>`);
        feedback(R, ui, q, L, r, nextLabel, onNext);
      } });
    };
    const finish = () => kit.result(host, L, ctx, R.me, { topic: 'minus', back: BACK, marks, detail, startedAt, review, allRight: 'Every answer right.', againLabel: 'Try a new quiz',
      again: () => quiz(host, L, ctx),
      extra: stars => stars === 0 && L.stages.indexOf('try') >= 0 ? `<a class="btn soft" href="${ctx.base}/try">Go back to Try it</a>` : '' });
    warmUp(0);
    return R.stop;
  }

  window.MinusPlay = { see, tryIt, quiz, cheats, CHEAT1, CHEAT2,
    kit: { sign, numTok, chip, runner, STUCK, HEAD, opt, padHtml, wirePad, want, nextBtn, tape } };   // shared with the Times and divide screens
})();
