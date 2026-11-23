/* Times and divide: the screens. See it, Try it, Quiz, the two taps before a quiz, and the cheats card.
   The sums, every line of words and the judging live in times.js; this file only draws them.
   The sign bars, the number pad and the run rules are shared with Minus numbers (MinusPlay.kit, Player.kit).
   A sum is drawn from its pieces so a number can be tapped, ringed, covered, or moved across the equals. */
(function () {
  'use strict';
  const T = window.Times, CONFIG = window.CONFIG, FX = window.FX, kit = window.Player.kit, MK = window.MinusPlay.kit;
  const { esc, newSeed, reshake, dots } = kit;
  const { sign, runner, STUCK, HEAD, opt, padHtml, wirePad, want, nextBtn } = MK;
  const SAY = T.SAY, MN = T.M, BACK = '#/maths/times';
  const BX = '<i class="bx" role="img" aria-label="box"></i>';
  const tx = s => esc(s).split(T.BOX).join(BX);                 // words may name the box: it is drawn, not typed
  const isPM = v => v === '+' || v === MN;
  const WATCH = 'Now watch the last steps.', WHOLE = 'That is the whole sum.';

  /* ---------- the pieces of a sum ---------- */
  /* A plus or minus sign that belongs to the number after it (they share an id) is worn by that number's chip. */
  const wornBy = (toks, i) => { const p = toks[i - 1], t = toks[i]; return p && p.k === 'op' && isPM(p.v) && p.id && p.id === t.id && t.v > 0 ? p.v : null; };
  /* o.tap: 'all' makes every number a button; a list of ids makes those numbers buttons. */
  function lineHtml(toks, o) {
    o = o || {};
    return toks.map((t, i) => {
      const at = t.id ? ` data-id="${t.id}"` : '';
      if (t.k === 'num') {
        const worn = wornBy(toks, i), neg = worn ? worn === MN : t.v < 0;
        const cls = `grp ${t.bare ? 'bare' : !worn && t.v === 0 ? 'zero' : neg ? 'minus' : 'plus'}${t.br ? ' br' : ''}${t.fill ? ' fill' : ''}${t.ring ? ' ring' : ''}`;
        const par = c => t.br ? `<span class="tok par" aria-hidden="true">${c}</span>` : '';
        const body = `${par('(')}${neg ? sign(MN) : worn || (t.plus && t.v > 0) ? sign('+') : ''}<span class="tok num">${Math.abs(t.v)}</span>${par(')')}`;
        const tap = o.tap === 'all' || (Array.isArray(o.tap) && t.id && o.tap.indexOf(t.id) >= 0);
        return tap ? `<button class="${cls} tapnum" type="button" data-i="${i}"${t.id ? ` data-t="${t.id}"` : ''}${at} aria-label="${neg ? 'minus ' : ''}${Math.abs(t.v)}">${body}</button>`
          : `<span class="${cls}" data-i="${i}"${at}>${body}</span>`;
      }
      if (t.k === 'op') {
        const nx = toks[i + 1];
        if (nx && nx.k === 'num' && wornBy(toks, i + 1)) return '';
        return isPM(t.v) ? `<span class="opg"${at}>${sign(t.v)}</span>` : `<span class="tok op"${at} aria-hidden="true">${t.v}</span>`;
      }
      if (t.k === 'eq') return '<span class="tok eq" aria-hidden="true">=</span>';
      if (t.k === 'box') return '<span class="tok qbox" aria-hidden="true"></span>';
      if (t.k === 'sq') return '<span class="tok sq" aria-hidden="true">2</span>';
      return `<span class="tok par big"${at} aria-hidden="true">${t.k === 'lb' ? '(' : ')'}</span>`;
    }).join('');
  }

  /* The signs on their own: what the signs are, and the sign they make. 0 is the box, whose sign is not known yet.
     s.pairs: the list holds only the minus signs; they are drawn in pairs, with any one left over on its own. */
  function srowHtml(s, o) {
    const sc = v => v === 0 ? '<span class="sc q">?</span>' : `<span class="sc ${v < 0 ? 'minus' : 'plus'}">${sign(v < 0 ? MN : '+', '', { mini: true })}</span>`;
    let h;
    if (s.pairs) {
      const n = s.signs.filter(v => v < 0).length;
      h = Array.from({ length: Math.floor(n / 2) }, () => `<span class="pairp">${sc(-1)}${sc(-1)}<i class="pbadge">${sign('+', '', { mini: true })}</i></span>`).join('')
        + (n % 2 ? `<span class="pairp one">${sc(-1)}</span>` : '');
    } else h = s.signs.map(sc).join('');
    if (s.made) h += `<span class="arrow" aria-hidden="true">→</span><span class="sc made ${s.made < 0 ? 'minus' : 'plus'}${o && o.pop ? ' pop' : ''}">${sign(s.made < 0 ? MN : '+', '', { mini: true })}</span>`;
    return h;
  }

  /* ---------- the help: each step is one short line, with her own numbers shown beside it ---------- */
  const CHIP_RE = new RegExp('([+' + MN + '])(\\d+)', 'g');
  const showChips = s => esc(s).replace(CHIP_RE, (m, sg, n) => `<span class="hchip ${sg === '+' ? 'plus' : 'minus'}">${sg}${n}</span>`);
  const helpHtml = steps => '<ol>' + steps.map(s => `<li><span class="say">${tx(s.say)}</span>${s.show ? ` <span class="hshow">${showChips(s.show)}</span>` : ''}`
    + `${s.srow ? ` <span class="srow" aria-hidden="true">${srowHtml(s.srow)}</span>` : ''}${(s.sums || []).map(x => ` <b class="sum">${tx(x)}</b>`).join('')}</li>`).join('') + '</ol>';
  const say = (ui, text, bad) => { const s = ui.ctl.querySelector('#say'); if (s) { s.innerHTML = tx(text); s.className = 'sub ' + (bad ? 'bad' : 'good'); } };
  const carry = ui => { if (ui.keep) say(ui, ui.keep); };        // the last thing the picture said stays while she does the next step
  function showHelp(ui, steps) {
    const h = ui.ctl.querySelector('#help'), s = ui.ctl.querySelector('#stuck'); if (!h) return;
    h.innerHTML = helpHtml(steps); h.hidden = false; if (s) s.hidden = true;
    // A "Look again" line that only repeats a help step goes: the help card now says it, with the sum.
    const y = ui.ctl.querySelector('#say');
    if (y && y.classList.contains('bad')) { const t = y.textContent.replace(/^Look again\.\s*/, '').trim();
      if (!t || steps.some(x => x.say.indexOf(t) >= 0 || t.indexOf(x.say) >= 0)) { y.innerHTML = ''; y.className = 'sub'; } }
  }

  /* ---------- the card ---------- */
  const cardHtml = (q, plain) => `<div class="sumcard tcard" id="pic" role="img" aria-label="${esc(q.desc)}"><div class="sumline${plain ? '' : ' chips'}" id="line">${lineHtml(q.toks)}</div>
    <div class="srow" id="srow" aria-hidden="true" hidden></div><p class="dotsum" id="dsum" hidden></p><div class="sumline${plain ? '' : ' chips'} meas" aria-hidden="true"></div></div>`;
  function frame(host, q, job, label, dotHtml) {
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead long"><p class="job" id="job">${job}</p><div class="count" id="count"><span>${label}</span>${dotHtml}</div></div>
      <div class="split msplit"><div>${cardHtml(q, q.fam === 'add')}</div><div id="ctl"></div></div>`;
    window.scrollTo(0, 0);
    const $ = s => host.querySelector(s);
    const ui = { ctl: $('#ctl'), pic: $('#pic'), line: $('#line'), job: $('#job'), count: $('#count'), srow: $('#srow'), dsum: $('#dsum'), meas: $('.meas'), toks: q.toks, keep: '' };
    fitLine(ui, q);
    return ui;
  }
  /* One size for the whole question: the longest line it will ever show must fit the card, so nothing jumps or spills. */
  let refit = null;
  window.addEventListener('resize', () => { if (refit) refit(); });
  function fitLine(ui, q) {
    const cands = [lineHtml(q.toks)], steps = (q.see || []).concat(q.try || []);
    if (q.fullToks) cands.push(lineHtml(q.fullToks));
    steps.forEach(s => { if (s.type === 'tap') cands.push(lineHtml(q.toks, { tap: s.all ? 'all' : s.right.concat(s.other || []) })); });
    steps.concat(q.fin || []).forEach(s => [].concat(s.then || s).forEach(t => { if (t.line) cands.push(lineHtml(t.line)); }));
    const run = () => {
      if (!ui.line.isConnected) { if (refit === run) refit = null; return; }
      ui.line.style.fontSize = '';
      const base = parseFloat(getComputedStyle(ui.line).fontSize), avail = ui.pic.clientWidth - 24;
      const widest = px => { ui.meas.style.fontSize = px + 'px'; let w = 0; cands.forEach(c => { ui.meas.innerHTML = c; w = Math.max(w, ui.meas.getBoundingClientRect().width); }); return w; };
      let size = base;
      for (let k = 0; k < 14 && size > 22; k++) { const w = widest(size); if (w <= avail) break; size = Math.max(22, Math.min(size - 2, Math.floor(size * avail / w))); }
      ui.meas.innerHTML = '';
      if (size < base) ui.line.style.fontSize = size + 'px';
    };
    refit = run; run();
  }
  const hook = (L, stage, mode, q, i, n) => { if (CONFIG.local) window.__q = { topic: 'times', lesson: L.id, stage, mode, kind: q && q.kind, text: q && q.text, full: q && q.full, i, n }; };

  /* ---------- what the picture can do ---------- */
  function setLine(ui, toks, o) { ui.toks = toks; ui.line.innerHTML = lineHtml(toks, o); ui.line.classList.remove('cover'); }
  function mark(ui, ids) {
    ui.line.querySelectorAll('.mark').forEach(el => el.classList.remove('mark'));
    ids.forEach(id => ui.line.querySelectorAll(`[data-id="${id}"]`).forEach(el => { void el.offsetWidth; el.classList.add('mark'); }));
  }
  function showFull(ui, q) { setLine(ui, q.fullToks); ui.pic.setAttribute('aria-label', T.speak(q.fullToks)); }
  /* A number changes side: it lifts off, crosses the equals and lands wearing its new sign. */
  function hop(R, ui, toks, id) {
    const old = ui.line.querySelector(`.grp[data-id="${id}"]`), from = old && old.getBoundingClientRect(), oldHtml = old && old.outerHTML;
    setLine(ui, toks);
    const now = ui.line.querySelector(`.grp[data-id="${id}"]`);
    if (!now) return;
    if (!old || CONFIG.fast || FX.reduce || !now.animate) { now.classList.add('landed'); return; }
    const to = now.getBoundingClientRect(), box = ui.pic.getBoundingClientRect(), g = document.createElement('div');
    const x0 = from.left - box.left - ui.pic.clientLeft, y0 = from.top - box.top - ui.pic.clientTop;
    g.className = 'sumline chips hopg'; g.setAttribute('aria-hidden', 'true');
    g.style.cssText = `left:${x0}px;top:${y0}px;font-size:${getComputedStyle(ui.line).fontSize}`;
    g.innerHTML = `<span>${oldHtml}</span><span>${now.outerHTML}</span>`;
    ui.pic.appendChild(g); now.style.visibility = 'hidden';
    const dx = to.left - from.left, dy = to.top - from.top, lift = -Math.max(8, Math.min(y0 - 4, from.height * .6)), ms = 760, opts = { duration: ms, fill: 'forwards' };
    g.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${dx / 2}px, ${dy / 2 + lift}px)` }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    g.firstChild.animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: 0, offset: .6 }, { opacity: 0 }], opts);
    g.lastChild.animate([{ opacity: 0 }, { opacity: 0, offset: .4 }, { opacity: 1, offset: .6 }, { opacity: 1 }], opts);
    FX.chime('place');
    R.later(() => { g.remove(); now.style.visibility = ''; now.classList.add('landed'); }, ms + 20);
  }
  /* After a step the picture may: show a new line (a number may hop across the equals), ring a piece, cover the signs,
     show the sign row, show a small sum, show the finished sum, and say one line. */
  function applyThen(R, ui, t, q) {
    if (t.line) { if (t.hop) hop(R, ui, t.line, t.hop); else setLine(ui, t.line); ui.srow.hidden = true; ui.dsum.hidden = true; }
    if (t.mark) mark(ui, t.mark);
    if (t.cover) { ui.line.querySelectorAll('.lit, .mark').forEach(el => el.classList.remove('lit', 'mark')); ui.line.classList.add('cover'); }
    if (t.srow) { ui.srow.innerHTML = srowHtml(t.srow, { pop: true }); ui.srow.hidden = false; }
    if (t.dsum) { ui.dsum.innerHTML = tx(t.dsum); ui.dsum.hidden = false; }
    if (t.full) showFull(ui, q);
    if (t.say) { ui.keep = t.say; say(ui, t.say); }
  }
  /* Several of those, one after another, each given time to be read. */
  function play(R, ui, thens, q, done, gap) {
    const list = [].concat(thens || []); let k = 0;
    const next = () => { if (k >= list.length) return done(); const t = list[k++]; applyThen(R, ui, t, q); R.later(next, t.hop ? gap + 600 : gap); };
    next();
  }

  /* ---------- her steps ---------- */
  /* One step where she picks a button. A wrong pick gets its reason and she picks again; two wrong picks open the help. */
  function choose(R, ui, o) {
    let wrongs = 0, helped = false, over = false;
    ui.ctl.innerHTML = HEAD + o.html + (o.help ? STUCK : ''); want(o.answer); carry(ui);
    const open = () => { if (helped) return; helped = true; showHelp(ui, o.help); };
    ui.ctl.onclick = e => {
      const b = e.target.closest('button'); if (!b || over || !R.live()) return;
      if (b.id === 'stuck') return open();
      const v = b.dataset.v; if (v == null) return;
      if (v === o.answer) {
        over = true; b.classList.add('yes'); FX.chime('place');
        ui.ctl.querySelectorAll('#stuck, #help').forEach(el => { el.hidden = true; });
        return o.done({ helped, wrongs });
      }
      wrongs++; FX.chime('wrong'); reshake(b); b.classList.add('no'); b.disabled = true; say(ui, o.wrong(v), true);
      if (wrongs >= 2) open();
    };
  }
  const CHIP_ONE = new RegExp('^([+' + MN + '])(\\d+)$');
  const chipLabel = s => { const m = CHIP_ONE.exec(s); return m ? `<span class="sumline chips ochips" role="img" aria-label="${m[1] === '+' ? 'plus' : 'minus'} ${m[2]}"><span class="grp ${m[1] === '+' ? 'plus' : 'minus'}">${sign(m[1])}<span class="tok num">${m[2]}</span></span></span>` : esc(s); };
  function optsHtml(step, q) {
    let o = step.opts;
    if (step.look === 'sign') return `<div class="duo">${o.map(x => opt(x.v, esc(x.label), { sign: x.v === 'plus' ? '+' : MN })).join('')}</div>`;
    if (step.look === 'chips') return `<div class="duo">${o.map(x => opt(x.v, chipLabel(x.label))).join('')}</div>`;
    if (step.look === 'words') {                                 // two answers in words: which side each sits on changes from sum to sum
      if (q.seed != null ? q.seed % 2 : Math.random() < .5) o = o.slice().reverse();
      const long = o.some(x => x.label.length > 9);
      return `<div class="duo">${o.map(x => opt(x.v, tx(x.label), { words: long })).join('')}</div>`;
    }
    return `<div class="duo">${o.map(x => opt(x.v, esc(x.label))).join('')}</div>`;
  }
  const pickStep = (R, ui, q, step, done) => choose(R, ui, { html: optsHtml(step, q), answer: step.answer, wrong: v => step.wrong[v] || 'Look again.', help: step.hp, done });

  /* She taps numbers in the sum itself. step.all: every minus number must be tapped. Otherwise one number is the right one. */
  function tapStep(R, ui, step, done) {
    let wrongs = 0, helped = false, over = false;
    const all = !!step.all, need = step.right.map(String), lit = new Set();
    if (all && !need.length) return done();
    setLine(ui, ui.toks, { tap: all ? 'all' : step.right.concat(step.other || []) });
    ui.pic.removeAttribute('role');
    ui.ctl.innerHTML = HEAD + STUCK; want(all ? step.right : step.right[0]); carry(ui);
    const open = () => { if (helped) return; helped = true; showHelp(ui, step.hp); };
    ui.ctl.onclick = e => { const b = e.target.closest('button'); if (b && b.id === 'stuck' && !over && R.live()) open(); };
    ui.line.onclick = e => {
      const b = e.target.closest('button.tapnum'); if (!b || over || !R.live()) return;
      const key = all ? b.dataset.i : b.dataset.t;
      if (need.indexOf(key) < 0) {
        wrongs++; FX.chime('wrong'); reshake(b); say(ui, all ? 'Look again. ' + step.hp[0].say : step.wrong, true);
        if (wrongs >= 2) open();
        return;
      }
      if (lit.has(key)) return;
      lit.add(key); b.classList.add('lit'); FX.chime('tap');
      if (all && lit.size < need.length) return;
      over = true; ui.line.onclick = null; ui.pic.setAttribute('role', 'img');
      setLine(ui, ui.toks);
      if (all) need.forEach(ix => { const g = ui.line.querySelector(`.grp[data-i="${ix}"]`); if (g) g.classList.add('lit'); });
      ui.ctl.querySelectorAll('#stuck, #help').forEach(el => { el.hidden = true; });
      FX.chime('place'); done();
    };
  }
  /* A pad in the middle of a sum (the brackets): as many goes as she needs, and each wrong answer gets its reason. */
  function midPad(R, ui, step, done) {
    let wrongs = 0, helped = false;
    ui.ctl.innerHTML = padHtml(); want(step.answer); carry(ui);
    const open = () => { if (helped) return; helped = true; showHelp(ui, step.hp); };
    const pad = wirePad(ui.ctl, given => {
      if (!R.live()) return;
      if (given === step.answer) { pad.stop(); FX.chime('place'); return done(); }
      const s = (step.slips || []).find(x => x.value === given);
      wrongs++; FX.chime('wrong'); reshake(ui.pic); say(ui, s ? s.say : step.other, true); pad.clear();
      if (wrongs === 2) open();
    }, 3);
    ui.ctl.querySelector('#stuck').onclick = open;
  }
  /* The pad for the answer. o.goes: how many tries. o.done({ given, j, helped }) */
  function finalPad(R, ui, q, o) {
    let wrongs = 0, helped = false;
    ui.ctl.innerHTML = padHtml(); want(q.answer); carry(ui);
    const open = () => {
      if (helped) return; helped = true; showHelp(ui, q.help);
      if (q.answer < 0) ui.ctl.querySelector('#neg').classList.add('nudge');          // the help has just said the answer is minus: this is the key for it
    };
    const pad = wirePad(ui.ctl, given => {
      if (!R.live()) return;
      const j = T.judge(q, given);
      if (!j.right && ++wrongs < o.goes) { FX.chime('wrong'); reshake(ui.pic); say(ui, j.slip ? j.say : 'Not yet. Try again.', true); pad.clear(); if (wrongs === 2) open(); return; }
      pad.stop(); o.done({ given, j, helped });
    }, 3);
    ui.ctl.querySelector('#stuck').onclick = open;
  }
  /* Her steps for one sum, in order. Picks, taps and the pad for the brackets happen here; the pad for the answer is handed back. */
  function runSteps(R, ui, q, L, stage, steps, i, n, gap, done) {
    let k = 0;
    const next = () => {
      if (k >= steps.length) return done();
      const step = steps[k++], after = () => play(R, ui, step.then, q, next, gap);
      if (step.type === 'pad' && step.answer == null) return done(step);
      ui.job.innerHTML = tx(step.job);
      if (step.type === 'pick') { hook(L, stage, 'pick', q, i, n); pickStep(R, ui, q, step, after); }
      else if (step.type === 'tap') { hook(L, stage, step.all ? 'tap-all' : 'tap-one', q, i, n); tapStep(R, ui, step, after); }
      else { hook(L, stage, 'mid', q, i, n); midPad(R, ui, step, after); }
    };
    next();
  }

  /* ---------- the working after an answer ---------- */
  const beatHtml = b => `<li>${tx(b.say)}${b.srow ? ` <span class="srow" aria-hidden="true">${srowHtml(b.srow)}</span>` : ''}${b.sum ? ` <b class="sum">${tx(b.sum)}</b>` : ''}</li>`;
  function feedback(R, ui, q, L, stage, r, label, onNext, i, n) {
    ui.ctl.onclick = null; showFull(ui, q); ui.job.innerHTML = tx(q.job); hook(L, stage, 'next', q, i, n);
    ui.ctl.innerHTML = `<p class="verdict ${r.j.right ? 'good' : 'bad'}">${r.j.right ? 'Yes! ' : 'Not this time. '}${tx(q.full)}</p>${!r.j.right && r.j.slip ? `<p class="sub">${tx(r.j.say)}</p>` : ''}
      <ol class="work steps">${q.beats.map(beatHtml).join('')}</ol><button class="btn go" id="next" type="button">${label}</button>`;
    if (r.j.right) { FX.chime('right'); FX.at(ui.pic, 26); } else { FX.settle(); FX.chime('wrong'); reshake(ui.pic); }
    nextBtn(R, ui, onNext);
  }

  /* ---------- the cheats as pictures ---------- */
  const N = (v, o) => Object.assign({ k: 'num', v }, o), O = (v, id) => id ? { k: 'op', v, id } : { k: 'op', v }, EQ = { k: 'eq' }, BOXT = { k: 'box' };
  const arrow = '<span class="arrow" aria-hidden="true">→</span>';
  const row = (label, html, cls) => `<div class="rule${cls ? ' ' + cls : ''}" role="img" aria-label="${label}">${html}</div>`;
  const nm = v => v === '+' ? 'plus' : 'minus';
  const signRow = (a, op, b) => {
    const made = a === b ? '+' : MN;
    return row(`${a === b ? 'Same' : 'Different'} signs. ${nm(a)} ${op === T.X ? 'times' : 'divided by'} ${nm(b)} makes ${nm(made)}.`,
      `${sign(a)}<span class="tok op" aria-hidden="true">${op}</span>${sign(b)}${arrow}${sign(made, '', { made: true })}`);
  };
  const srowRow = (label, s) => row(label, `<span class="srow">${srowHtml(s)}</span>`);
  const PIC = {
    sign: op => signRow(MN, op, MN) + signRow('+', op, MN),
    both: () => signRow(MN, T.X, MN) + signRow(MN, T.D, '+'),
    number: () => row('Cover the signs. 4 times 3 is 12.', lineHtml([N(-4), O(T.X), N(3, { plus: true }), EQ, N(12, { bare: true })]), 'chips cover')
      + row('Minus 4 times plus 3 is minus 12.', lineHtml([N(-4), O(T.X), N(3, { plus: true }), EQ, N(-12)]), 'chips'),
    pairs: () => srowRow('Three minus signs. One pair, and one left over, make a minus.', { signs: [-1, -1, -1], pairs: true, made: -1 })
      + srowRow('Two minus signs. One pair makes a plus.', { signs: [-1, -1], pairs: true, made: 1 }),
    box: () => row('Box times minus 4 equals minus 44.', lineHtml([BOXT, O(T.X), N(-4), EQ, N(-44, { ring: true })]), 'chips')
      + srowRow('The answer is minus, so the two signs are different: plus and minus.', { signs: [1, -1], made: -1 }),
    change: () => row('Box take away 5 equals minus 8.', lineHtml([BOXT, O(MN, 'm'), N(5, { id: 'm', ring: true }), EQ, N(-8)]), 'chips')
      + row('Box equals minus 8 plus 5.', lineHtml([BOXT, EQ, N(-8), O('+', 'm'), N(5, { id: 'm', ring: true })]), 'chips'),
  };
  function cheats() {
    const card = (n, title, pic, words, notes) => `<div class="sheet cheat"><h2><i>${n}</i>${title}</h2>${pic}<p class="sub">${words}</p>${notes.map(x => `<p class="sub note">${x}</p>`).join('')}</div>`;
    return `<section class="screen"><div class="bar"><a class="back" href="${BACK}">Lessons</a><h1>The cheats</h1><span class="pad44"></span></div><div class="cheats tcheats">`
      + card(1, 'The sign', PIC.both(), SAY.same + '<br>' + SAY.diff, [SAY.noSign, SAY.tell])
      + card(2, 'The number', PIC.number(), SAY.coverT, [SAY.coverD])
      + card(3, 'Three numbers', PIC.pairs(), SAY.pair + ' ' + SAY.left, [SAY.little])
      + card(4, `A box with ${T.X} or ${T.D}`, PIC.box(), SAY.boxDiff + '<br>' + SAY.boxSame, [SAY.find])
      + card(5, `A box with + or ${MN}`, PIC.change(), SAY.change, [SAY.first])
      + '</div></section>';
  }
  const END = {
    t1: () => ({ line: SAY.rule, pic: PIC.sign(T.X) }), t2: () => ({ line: SAY.rule, pic: PIC.sign(T.D) }), t3: () => ({ line: SAY.pair, pic: PIC.pairs() }),
    t4: () => ({ line: SAY.boxDiff, pic: PIC.box() }), t5: () => ({ line: SAY.change, pic: PIC.change() }),
  };
  function seeEnd(R, host, L, ctx, n, marks, again) {
    const e = (END[L.id] || END.t1)();
    ctx.done('see');
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead long"><p class="job" id="job">${e.line}</p><div class="count" id="count"><span>${n} of ${n}</span>${dots(marks, -1, n)}</div></div>
      <div class="split msplit"><div><div class="sumcard rules" id="pic">${e.pic}</div></div>
      <div id="ctl"><div class="stack"><a class="btn go" href="${ctx.base}/try">Go to Try it</a><button class="btn soft" id="again" type="button">Do this again</button></div></div></div>`;
    window.scrollTo(0, 0); hook(L, 'see', 'done', null, n, n);
    FX.chime('win'); FX.at(host.querySelector('#pic'), 34);
    host.querySelector('#again').onclick = () => { if (R.live()) again(); };
  }

  /* ---------- See it: she does the thinking steps, then watches the numbers being done ---------- */
  function see(host, L, ctx) {
    const R = runner(), n0 = T.set(L.id, 'see', newSeed()), n = n0.length, marks = []; let qs = n0, i = 0;
    const again = () => { qs = T.set(L.id, 'see', newSeed()); i = 0; marks.length = 0; show(); };
    const show = () => {
      const q = qs[i], ui = frame(host, q, '', `${i + 1} of ${n}`, dots(marks, i, n));
      const end = () => {
        marks[i] = true; ui.ctl.onclick = null; ui.job.textContent = WHOLE; hook(L, 'see', 'next', q, i, n);
        ui.count.innerHTML = `<span>${i + 1} of ${n}</span>${dots(marks, -1, n)}`;
        ui.ctl.innerHTML = `<p class="verdict good">${tx(q.full)}</p><p class="sub good">${tx(ui.keep)}</p><button class="btn go" id="next" type="button">${i + 1 < n ? 'Next one' : 'Finish'}</button>`;
        FX.chime('right'); FX.at(ui.pic, 20);
        nextBtn(R, ui, () => { i++; if (i < n) show(); else seeEnd(R, host, L, ctx, n, marks, again); });
      };
      runSteps(R, ui, q, L, 'see', q.see, i, n, 1500, () => {
        const fin = q.fin || [];
        if (!fin.length) return end();
        ui.ctl.onclick = null; ui.ctl.innerHTML = HEAD; ui.job.textContent = WATCH; hook(L, 'see', 'watch', q, i, n);
        play(R, ui, fin, q, end, 2000);
      });
    };
    show();
    return R.stop;
  }

  /* ---------- Try it: every step is hers, with as many goes as she needs ---------- */
  function tryIt(host, L, ctx) {
    const R = runner(), qs = T.set(L.id, 'try', newSeed()), n = qs.length, marks = []; let i = 0;
    const ask = () => {
      const q = qs[i], last = i === n - 1, ui = frame(host, q, '', `${i + 1} of ${n}`, dots(marks, i, n));
      const label = last ? 'Start the quiz' : 'Next one';
      const onNext = () => { if (last) { ctx.done('try'); location.hash = ctx.base + '/quiz'; } else { i++; ask(); } };
      runSteps(R, ui, q, L, 'try', q.try, i, n, 1200, step => {
        hook(L, 'try', 'pad', q, i, n); ui.job.innerHTML = tx(step ? step.job : q.job);
        finalPad(R, ui, q, { goes: 3, done: r => {
          marks[i] = true; ui.count.innerHTML = `<span>${i + 1} of ${n}</span>${dots(marks, -1, n)}`;
          feedback(R, ui, q, L, 'try', r, label, onNext, i, n);
        } });
      });
    };
    ask();
    return R.stop;
  }

  /* ---------- Quiz: two taps to say the cheat, then the sums, one go each ---------- */
  /* The picture for each warm-up, in the order of Times.WARM. before: shown with the question. after: shown once she is right. */
  const WARM_PIC = [
    { toks: [N(-3), O(T.X), N(-5)], before: { srow: { signs: [-1, -1] } }, after: { srow: { signs: [-1, -1], made: 1 } } },
    { toks: [N(-4), O(T.X), N(6)], before: { srow: { signs: [-1, 1] } }, after: { srow: { signs: [-1, 1], made: -1 } } },
    { toks: [N(-4), O(T.X), N(3)], after: { srow: { signs: [-1, 1] } } },
    { toks: [N(-12), O(T.D), N(-3)], before: { srow: { signs: [-1, -1] } }, after: { srow: { signs: [-1, -1], made: 1 } } },
    { toks: [N(12), O(T.D), N(-4)], before: { srow: { signs: [1, -1] } }, after: { srow: { signs: [1, -1], made: -1 } } },
    { toks: [N(-4), O(T.X), N(6, { id: 'k' })], before: { mark: ['k'] }, after: { line: [N(-4), O(T.X), N(6, { id: 'k', plus: true })], mark: ['k'] } },
    { toks: [N(-2), O(T.X), N(-3), O(T.X), N(-4)], before: { srow: { signs: [-1, -1, -1], pairs: true } }, after: { srow: { signs: [-1, -1, -1], pairs: true, made: -1 } } },
    { toks: [N(-2), O(T.X), N(3), O(T.X), N(-4)], before: { srow: { signs: [-1, -1], pairs: true } }, after: { srow: { signs: [-1, -1], pairs: true, made: 1 } } },
    { toks: [N(-5, { br: true }), { k: 'sq' }], after: { dsum: `${MN}5 ${T.X} ${MN}5` } },
    { toks: [BOXT, O(T.X), N(-3), EQ, N(-12, { id: 'c' })], before: { mark: ['c'] }, after: { srow: { signs: [0, -1], made: -1 } } },
    { toks: [BOXT, O(T.X), N(-3), EQ, N(12, { id: 'c' })], before: { mark: ['c'] }, after: { srow: { signs: [0, -1], made: 1 } } },
    { toks: [BOXT, O('+', 'm'), N(4, { id: 'm' }), EQ, N(9, { id: 'c' })], before: { mark: ['m'] }, after: { line: [BOXT, EQ, N(9, { id: 'c' }), O(MN, 'm'), N(4, { id: 'm' })], hop: 'm' } },
    { toks: [{ k: 'lb', id: 'b' }, N(-6), O(T.X), N(-5), { k: 'rb', id: 'b' }, O(T.D), BOXT, EQ, N(3)], before: { mark: ['b'] }, after: { mark: ['b'] } },
    { toks: [N(-4), O(MN), N(5)], plain: true },
    { toks: [N(-3), O(MN), N(6)], plain: true },
  ];
  function quiz(host, L, ctx) {
    const R = runner(), seed = newSeed(), qs = T.set(L.id, 'quiz', seed), warm = T.warm(L.id, seed), n = qs.length, marks = [], detail = [], review = [];
    let i = 0, startedAt = Date.now();
    const warmUp = k => {
      if (k >= warm.length) { startedAt = Date.now(); return ask(); }
      const w = warm[k], p = WARM_PIC[T.WARM.findIndex(x => x.ask === w.ask)] || WARM_PIC[0];
      const pq = { toks: p.toks, desc: T.speak(p.toks), fam: p.plain ? 'add' : 'warm', fin: p.after ? [p.after] : [] };
      const ui = frame(host, pq, tx(w.ask), `Warm up ${k + 1} of ${warm.length}`, '');
      hook(L, 'quiz', 'warm', { kind: 'warm', text: w.ask }, k, warm.length);
      if (p.before) applyThen(R, ui, p.before, pq);
      choose(R, ui, { html: `<div class="duo">${w.options.map((o, j) => opt(j, tx(o.label), { words: true })).join('')}</div>`, answer: String(w.options.findIndex(o => o.right)),
        wrong: () => w.why,
        done: () => { if (p.after) applyThen(R, ui, p.after, pq); say(ui, w.why); R.later(() => warmUp(k + 1), p.after && p.after.hop ? 2400 : 1700); } });
    };
    const ask = () => {
      const q = qs[i], t0 = Date.now(), last = i === n - 1, label = `Question ${i + 1} of ${n}`, ui = frame(host, q, tx(q.job), label, dots(marks, i, n));
      const nextLabel = last ? 'See my score' : 'Next question', onNext = () => { i++; if (i < n) ask(); else finish(); };
      hook(L, 'quiz', 'pad', q, i, n);
      finalPad(R, ui, q, { goes: 1, done: r => {
        const right = r.j.right;
        marks.push(right); ui.count.innerHTML = `<span>${label}</span>${dots(marks, -1, n)}`;
        detail.push({ n: q.n, kind: q.rowKind || q.kind, topic: q.topic, prompt: q.text, given: r.given, correct: q.answer, right, slip: right ? '' : (r.j.slip || 'unknown'), ms: Date.now() - t0, helped: r.helped });
        if (!right) review.push(`<li class="wide"><div class="mini msum">${tx(q.text)}</div><div>You wrote ${T.num(r.given)}. The answer is ${T.num(q.answer)}.<small>${q.beats.map(b => tx(b.say)).join('<br>')}</small></div></li>`);
        feedback(R, ui, q, L, 'quiz', r, nextLabel, onNext, i, n);
      } });
    };
    const finish = () => kit.result(host, L, ctx, R.me, { topic: 'times', back: BACK, marks, detail, startedAt, review, allRight: 'Every answer right.', againLabel: 'Try a new quiz',
      again: () => quiz(host, L, ctx),
      extra: stars => stars === 0 && L.stages.indexOf('try') >= 0 ? `<a class="btn soft" href="${ctx.base}/try">Go back to Try it</a>` : '' });
    warmUp(0);
    return R.stop;
  }

  window.TimesPlay = { see, tryIt, quiz, cheats };
})();
