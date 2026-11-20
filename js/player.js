/* "Try it" (three guided questions), the Quiz (scored, saved) and "Add or take away?" (she picks the working). window.Player */
window.Player = (function () {
  const Q = window.Questions, D = window.Diagram, CONFIG = window.CONFIG;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const newSeed = () => CONFIG.seed || 1 + Math.floor(Math.random() * 2147483000);
  const reshake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  const dots = (marks, now, n) => { let s = ''; for (let k = 0; k < n; k++) s += `<i class="${k < marks.length ? (marks[k] ? 'y' : 'n') : k === now ? 'now' : ''}"></i>`; return s; };
  const pic = q => D.svg(q.spec, { alt: esc(q.desc) });
  let livePad = null, run = 0;

  function frame(host, q, job, label, dotHtml) {
    host.className = 'sheet';
    host.innerHTML = `<div class="qhead"><p class="job" id="job">${job}</p><div class="count" id="count"><span>${label}</span>${dotHtml}</div></div>
      <div class="split"><div><div class="pic" id="pic">${pic(q)}</div></div><div id="ctl"></div></div>`;
    window.scrollTo(0, 0);
    const $ = id => host.querySelector('#' + id);
    return { ctl: $('ctl'), pic: $('pic'), job: $('job'), count: $('count') };
  }
  const padHtml = () => `<div class="ans"><em>x</em> = <span class="box" id="box" aria-live="polite"></span>° <button class="del" id="del" type="button" aria-label="Rub out">⌫</button></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button class="key" type="button" data-k="${d}">${d}</button>`).join('')}</div>
    <div class="duo"><button class="btn soft small" id="stuck" type="button">Stuck? Show me</button><button class="btn" id="check" type="button" disabled>Check</button></div>`;

  /* The number pad. She can also type on a real keyboard. */
  function wirePad(ctl, onCheck) {
    const box = ctl.querySelector('#box'), check = ctl.querySelector('#check'); let v = '', off = false;
    const paint = () => { box.textContent = v; check.disabled = !v; };
    const press = k => {
      if (off) return;
      if (k === 'ok') { if (v) onCheck(+v); return; }
      if (k === 'del') v = v.slice(0, -1); else if (v === '0') v = k; else if (v.length < 3) v += k;
      paint(); FX.chime('tap');
    };
    ctl.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.k) press(b.dataset.k); else if (b.id === 'del') press('del'); else if (b.id === 'check') press('ok'); };
    const onKey = e => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); };
    document.addEventListener('keydown', onKey);
    if (livePad) livePad();
    const stop = () => { off = true; document.removeEventListener('keydown', onKey); if (livePad === stop) livePad = null; };
    livePad = stop;
    return { clear() { v = ''; paint(); }, stop };
  }
  /* The help: each step is a short line, then the sum it means with her numbers. The last sum is left for her.
     Some questions also have a help picture, with one more thing marked on it. */
  const helpHtml = steps => '<ol>' + steps.map(t => typeof t === 'string' ? `<li><span class="say">${esc(t)}</span></li>`
    : `<li><span class="say">${esc(t.say)}</span>${(t.sums || []).map(x => `<b class="sum">${esc(x)}</b>`).join('')}</li>`).join('') + '</ol>';
  function showHelp(ui, steps, q, spec) {
    const h = ui.ctl.querySelector('#help'), s = ui.ctl.querySelector('#stuck');
    h.innerHTML = helpHtml(steps); h.hidden = false; if (s) s.hidden = true;
    if (spec && q) ui.pic.innerHTML = D.svg(spec, { alt: esc(q.desc) });
    ui.pic.classList.remove('hint'); void ui.pic.offsetWidth; ui.pic.classList.add('hint');
  }
  function ringFor(q, value) {
    if (!q.ring) return '';
    const sq = (q.spec.arcs || []).some(a => a.square); let k = 0;
    const parts = q.ring.pieces.map(v => ({ v, cls: sq && v === 90 ? 'sq' : 'k' + Math.min(k++, 2) }));
    for (let i = 0; i < q.ring.n; i++) parts.push({ v: value, cls: 'x' });
    return Ring.html({ total: q.ring.total, parts });
  }
  function feedback(ui, q, given, j, nextLabel, onNext) {
    const ring = ringFor(q, j.right ? q.answer : given);
    if (q.reveal) ui.pic.innerHTML = D.svg(q.reveal, { alt: esc(q.desc) });
    ui.ctl.onclick = null;
    ui.ctl.innerHTML = `<p class="verdict ${j.right ? 'good' : 'bad'}">${j.right ? 'Yes! ' : 'Not this time. '}x = ${q.answer}°</p>${!j.right && j.say ? `<p class="sub">${esc(j.say)}</p>` : ''}
      <div class="fb${ring ? '' : ' solo'}">${ring}<ol class="work">${q.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <button class="btn go" id="next" type="button">${nextLabel}</button>`;
    if (j.right) { FX.chime('right'); FX.at(ui.pic, 26); } else { FX.settle(); FX.chime('wrong'); reshake(ui.pic); }
    ui.ctl.querySelector('#next').onclick = onNext;
  }

  /* ---------- Try it: three guided questions, no score ---------- */
  function tryIt(host, L, ctx) {
    const qs = Q.set(L.id, 'try', newSeed()), n = qs.length, me = ++run; let i = 0;
    function ask() {
      const q = qs[i]; let wrongs = 0;
      const ui = frame(host, q, esc(q.choice.ask), `Try ${i + 1} of ${n}`, dots(new Array(i).fill(true), i, n));
      const right = q.choice.options.find(o => o.right);
      if (CONFIG.local) window.__answer = right.label;
      ui.ctl.innerHTML = `<div class="help" id="help" hidden></div><p class="sub bad" id="say" aria-live="polite"></p>
        <div class="duo">${q.choice.options.map((o, k) => `<button class="btn soft opt" type="button" data-o="${k}">${esc(o.label)}</button>`).join('')}</div>
        <button class="btn soft small" id="stuck" type="button">Stuck? Show me</button>`;
      ui.ctl.querySelector('#stuck').onclick = () => showHelp(ui, q.choiceHelp, q, q.topic === 'par' ? q.helpSpec : null);
      ui.ctl.querySelectorAll('.opt').forEach(b => { b.onclick = () => {
        if (!q.choice.options[+b.dataset.o].right) { FX.chime('wrong'); reshake(b); ui.ctl.querySelector('#say').textContent = 'Not that one. Look at the picture again.'; return; }
        FX.chime('place'); find();
      }; });
      function find() {
        ui.job.textContent = (q.total ? `They add up to ${q.total}°.` : `Yes: ${right.label.toLowerCase()}.`) + ' Now find x.';
        ui.ctl.innerHTML = `<div class="help" id="help" hidden></div><p class="sub bad" id="say" aria-live="polite" hidden></p>${padHtml()}`;
        if (CONFIG.local) window.__answer = q.answer;
        ui.ctl.querySelector('#stuck').onclick = () => showHelp(ui, q.help, q, q.helpSpec);
        const pad = wirePad(ui.ctl, given => {
          const j = Q.judge(q, given), last = i + 1 >= n;
          if (!j.right && ++wrongs < 3) {
            const say = ui.ctl.querySelector('#say'); say.textContent = j.say || 'Not yet. Try again.'; say.hidden = false;
            pad.clear(); FX.chime('wrong'); reshake(ui.pic); if (wrongs === 2) showHelp(ui, q.help, q, q.helpSpec); return;
          }
          pad.stop();
          feedback(ui, q, given, j, last ? 'Start the quiz' : 'Next one', () => {
            if (me !== run) return;
            if (last) { ctx.done('try'); location.hash = ctx.base + '/quiz'; } else { i++; ask(); }
          });
        });
      }
    }
    ask();
    return stopAll;
  }

  /* ---------- The score screen, shared by the Quiz and "Add or take away?" ---------- */
  function result(host, L, ctx, me, o) {
    const n = o.marks.length, score = o.marks.filter(Boolean).length, stars = Q.stars(score, n), end = Date.now();
    const A = { id: Store.newId(), subject: 'maths', topic: o.topic || 'angles', lesson: L.id, lessonTitle: L.title, score, total: n, startedAt: new Date(o.startedAt).toISOString(), finishedAt: new Date(end).toISOString(),
      durationSec: Math.round((end - o.startedAt) / 1000), device: Store.device(), appVersion: CONFIG.version, detail: o.detail };
    const dev = /iPad|iPhone/.test(A.device) ? A.device : 'device';
    host.className = 'sheet result';
    host.innerHTML = `<div class="bigstars" role="img" aria-label="${stars} of 3 stars">${[0, 1, 2].map(k => k < stars ? `<b style="--i:${k}">★</b>` : '★').join('')}</div>
      <p class="score">${score} out of ${n}</p><p class="savenote" id="save" aria-live="polite">Saving your score…</p>
      ${o.review.length ? `<p class="sub">Look at ${o.review.length === 1 ? 'this one' : 'these'} again.</p><ul class="review">${o.review.join('')}</ul>` : `<p class="sub">${o.allRight}</p>`}
      <div class="stack"><button class="btn" id="again" type="button">${o.againLabel}</button>${o.extra ? o.extra(stars) : ''}<a class="btn soft" href="${o.back || '#/maths/angles'}">Back to lessons</a></div>`;
    window.scrollTo(0, 0); ctx.done('quiz');
    if (stars === 3) { FX.chime('win'); FX.confetti(); } else if (stars) { FX.chime('right'); FX.at(host.querySelector('.bigstars'), 30); }
    host.querySelector('#again').onclick = () => { if (me === run) o.again(); };
    Store.saveAttempt(A).then(r => {
      const el = host.querySelector('#save'); if (!el || me !== run) return;
      el.textContent = r === 'saved' ? 'Score saved.' : r === 'kept' ? `Score kept on this ${dev}. It will send itself later.` : `Score kept on this ${dev}.`;
    });
  }

  /* ---------- Add or take away?: she chooses what to do; the sums are done for her ---------- */
  function plan(host, L, ctx) {
    const qs = Q.set(L.id, 'quiz', newSeed()), n = qs.length, marks = [], detail = [], review = [], startedAt = Date.now(), me = ++run; let i = 0;
    const said = o => o.label || o.lines.join(', then ');
    function round() {
      const q = qs[i], P = Q.plan(q, L.plan[i]), t0 = Date.now(), W = q.ring.total, p = q.ring.pieces, S = p.reduce((a, b) => a + b, 0);
      const two = p.length === 2, working = P.mode === 'working', label = `Round ${i + 1} of ${n}`, lines = [];
      const correct = working ? `${p.join(' + ')} = ${S}, then ${W} − ${S} = x` : two ? `Add them, then take ${S} from ${W}` : `Take ${S} from ${W}`;
      const sq = (q.spec.arcs || []).some(a => a.square);
      const known = still => { let k = 0; return p.map(v => ({ v, cls: sq && v === 90 ? 'sq' : 'k' + Math.min(k++, 2), still })); };
      const ui = frame(host, q, '', label, dots(marks, i, n)); ui.job.parentNode.classList.add('long');
      let s = 0, helped = false, slip = null, busy = false;
      if (CONFIG.local) window.__q = q;
      function show() {
        const st = P.steps[s]; busy = false;
        ui.job.textContent = st.job;
        if (CONFIG.local) window.__plan = { round: i, step: s, steps: P.steps.length, right: st.options.findIndex(o => o.right), mode: P.mode, done: false };
        ui.ctl.innerHTML = `<div class="help" id="help" hidden></div><p class="sub bad" id="say" aria-live="polite"></p>
          ${working ? '' : `<div class="fb" id="ring">${Ring.html({ total: W, parts: known(s > 0), note: 'x = ?', words: false })}<ol class="work"><li class="fact">${esc(q.help[0])}</li>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>`}
          <div class="${working ? 'stack' : 'duo'}" id="opts">${st.options.map((o, k) => `<button class="btn soft opt ${o.lines ? 'lines' : 'words'}" type="button" data-o="${k}">${o.lines ? o.lines.map(l => `<span>${esc(l)}</span>`).join('') : esc(o.label)}</button>`).join('')}</div>
          <button class="btn soft small" id="stuck" type="button">Stuck? Show me</button>`;
        const $ = id => ui.ctl.querySelector('#' + id);
        $('stuck').onclick = () => { helped = true; showHelp(ui, st.help); };
        ui.ctl.querySelectorAll('.opt').forEach(b => { b.onclick = () => {
          if (busy || b.disabled || me !== run) return;
          const o = st.options[+b.dataset.o];
          if (!o.right) {                                   // the reason takes the help's place, so it is always seen
            if (!slip) slip = { tag: o.tag, given: said(o), why: o.why };
            FX.chime('wrong'); reshake(b); b.disabled = true; b.classList.add('no');
            $('help').hidden = true; $('stuck').hidden = false; $('say').textContent = o.why; return;
          }
          busy = true; b.classList.add('yes'); FX.chime('place'); st.work.forEach(l => lines.push(l));
          setTimeout(() => { if (me !== run) return; if (++s < P.steps.length) show(); else done(); }, 420);
        }; });
      }
      function done() {
        const clean = !slip; marks.push(clean);
        detail.push({ n: q.n, kind: q.kind, topic: q.topic, prompt: q.desc, given: clean ? correct : slip.given, correct, right: clean, slip: clean ? '' : slip.tag, ms: Date.now() - t0, helped });
        if (!clean) review.push(`<li><div class="mini">${D.svg(q.reveal || q.spec, { alt: esc(q.desc) })}</div><div>You picked “${esc(slip.given)}”.<small>${esc(slip.why)}<br>${lines.map(esc).join('<br>')}</small></div></li>`);
        if (q.reveal) ui.pic.innerHTML = D.svg(q.reveal, { alt: esc(q.desc) });
        ui.job.textContent = two ? `Add first. Then take the total from ${W}°.` : `Take the angle you know from ${W}°.`;
        ui.count.innerHTML = `<span>${label}</span>${dots(marks, -1, n)}`;
        ui.ctl.innerHTML = `<p class="verdict${clean ? ' good' : ''}">${clean ? 'Yes! ' : 'Now you have it. '}x = ${q.answer}°</p>
          <div class="fb">${Ring.html({ total: W, parts: known(true).concat({ v: q.answer, cls: 'x' }) })}<ol class="work">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>
          <button class="btn go" id="next" type="button">${i + 1 < n ? 'Next one' : 'See my score'}</button>`;
        if (CONFIG.local) window.__plan.done = true;
        FX.chime('right'); if (clean) FX.at(ui.pic, 26);
        ui.ctl.querySelector('#next').onclick = () => { if (me !== run) return; i++; if (i < n) round(); else finish(); };
      }
      show();
    }
    const finish = () => result(host, L, ctx, me, { marks, detail, startedAt, review, allRight: 'Every choice right.', againLabel: 'Play again', again: () => plan(host, L, ctx) });
    round();
    return stopAll;
  }

  /* ---------- Quiz: one go at each question, then the score ---------- */
  const ADD_OR_TAKE = /^(mixed|added|toobig|subtract|one)$/;   // slips that are about choosing to add or take away
  function quiz(host, L, ctx) {
    const qs = Q.set(L.id, 'quiz', newSeed()), n = qs.length, marks = [], detail = [], startedAt = Date.now(), me = ++run; let i = 0;
    function ask() {
      const q = qs[i], t0 = Date.now(); let helped = false;
      const ui = frame(host, q, 'Find x.', `Question ${i + 1} of ${n}`, dots(marks, i, n));
      if (CONFIG.local) { window.__answer = q.answer; window.__q = q; }
      ui.ctl.innerHTML = `<div class="help" id="help" hidden></div>${padHtml()}`;
      ui.ctl.querySelector('#stuck').onclick = () => { helped = true; showHelp(ui, q.help, q, q.helpSpec); };
      const pad = wirePad(ui.ctl, given => {
        pad.stop();
        const j = Q.judge(q, given); marks.push(j.right);
        detail.push({ n: q.n, kind: q.kind, topic: q.topic, prompt: q.desc, given, correct: q.answer, right: j.right, slip: j.right ? '' : (j.slip || 'unknown'), ms: Date.now() - t0, helped });
        ui.count.innerHTML = `<span>Question ${i + 1} of ${n}</span>${dots(marks, -1, n)}`;
        feedback(ui, q, given, j, i + 1 < n ? 'Next question' : 'See my score', () => { if (me !== run) return; i++; if (i < n) ask(); else finish(); });
      });
    }
    const finish = () => result(host, L, ctx, me, { marks, detail, startedAt, allRight: 'Every answer right.', againLabel: 'Try a new quiz', again: () => quiz(host, L, ctx),
      review: detail.filter(d => !d.right).map(d => { const q = qs[d.n - 1];
        return `<li><div class="mini">${D.svg(q.reveal || q.spec, { alt: esc(q.desc) })}</div><div>You wrote ${d.given}°. x = ${d.correct}°<small>${q.steps.map(esc).join('<br>')}</small></div></li>`; }),
      extra: stars => (detail.some(d => !d.right && ADD_OR_TAKE.test(d.slip)) ? '<a class="btn soft" href="#/maths/angles/plan/quiz">Practise add or take away</a>' : '')
        + (stars === 0 && L.tryKinds.length ? `<a class="btn soft" href="${ctx.base}/try">Go back to Try it</a>` : '') });
    ask();
    return stopAll;
  }
  function stopAll() { run++; if (livePad) livePad(); }
  /* The pieces the Minus numbers screens share with these ones. */
  const kit = { esc, newSeed, reshake, dots, helpHtml, result, stopAll, begin: () => ++run, live: me => me === run,
    hold(stop) { if (livePad) livePad(); livePad = stop; }, drop(stop) { if (livePad === stop) livePad = null; } };
  return { tryIt, quiz, plan, kit };
})();
