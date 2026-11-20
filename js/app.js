/* The screens and the way between them: home, subject, lesson list, lesson. */
(function () {
  const app = document.getElementById('app'), Q = window.Questions, CONFIG = window.CONFIG;
  const SUBJECTS = [['maths', 'Maths', '📐'], ['english', 'English', '📖'], ['science', 'Science', '🔬'], ['geography', 'Geography', '🌍'], ['history', 'History', '🏰'],
    ['french', 'French', '🥐'], ['he', 'HE', '🧁'], ['re', 'RE', '🕊️'], ['irish', 'Irish', '☘️'], ['spanish', 'Spanish', '🌞']];
  const STAGES = { see: 'See it', try: 'Try it', quiz: 'Quiz' };
  /* A topic is a list of lessons, the stages each lesson has, and the screens that play them. Scores are kept under maths.<topic>.<lesson>. */
  const TOPICS = {
    angles: { title: 'Angles', icon: '📐', blurb: '5 lessons and a mixed quiz', lessons: Q.LESSONS, find: Q.lesson,
      stages: l => l.tryKinds.length ? ['see', 'try', 'quiz'] : ['quiz'], num: l => l.id === 'mixed' ? '★' : l.id === 'plan' ? '±' : l.id,
      run: (stage, host, L, ctx) => stage === 'see' ? Lessons.see(host, L, ctx) : stage === 'try' ? Player.tryIt(host, L, ctx) : L.plan ? Player.plan(host, L, ctx) : Player.quiz(host, L, ctx) },
    minus: { title: 'Minus numbers', icon: '<b class="minusico">−</b>', blurb: '3 lessons and a mixed quiz', lessons: Minus.LESSONS, find: Minus.lesson, stages: l => l.stages, num: l => l.num,
      run: (stage, host, L, ctx) => MinusPlay[stage === 'try' ? 'tryIt' : stage](host, L, ctx),
      extra: '<a class="btn soft cheatlink" href="#/maths/minus/cheats">See the two cheats</a>' } };
  const topic = id => Object.prototype.hasOwnProperty.call(TOPICS, id) ? TOPICS[id] : null;
  const base = tid => '#/maths/' + tid, key = tid => 'maths.' + tid + '.';
  let stop = null, started = false;

  /* Numbers on a picture stay readable when the picture is small (a short phone with the help open). */
  if (window.ResizeObserver && window.MutationObserver) {
    const fit = p => {
      const s = p.querySelector('svg.dg'), vb = s && p._w ? (s.getAttribute('viewBox') || '').split(/[ ,]+/).map(Number) : []; if (!(vb[2] > 0 && vb[3] > 0)) return;
      const k = Math.min(p._w / vb[2], p._h / vb[3]); if (k > 0) p.style.setProperty('--lab', Math.min(26, Math.max(15, 12.6 / k)).toFixed(1) + 'px');
    };
    const ro = new ResizeObserver(es => es.forEach(e => { const p = e.target; p._w = e.contentRect.width; p._h = e.contentRect.height; fit(p); }));
    new MutationObserver(() => app.querySelectorAll('.pic').forEach(p => {
      if (!p._seen) { p._seen = 1; ro.observe(p); }
      const s = p.querySelector('svg.dg'), vb = s ? s.getAttribute('viewBox') : ''; if (vb !== p._vb) { p._vb = vb; fit(p); }
    })).observe(app, { childList: true, subtree: true });
  }

  function show(html) { if (stop) { try { stop(); } catch (e) {} stop = null; } app.innerHTML = html; window.scrollTo(0, 0); }
  const starRow = n => `<span class="stars" role="img" aria-label="${n} of 3 stars">${'<b>★</b>'.repeat(n)}${'★'.repeat(3 - n)}</span>`;

  function home() {
    show(`<section class="screen"><h1 class="hello"><span class="hi">Hi Anya,</span><span class="ask">what would you like help with today?</span></h1>
      <ul class="subjects">${SUBJECTS.map((s, i) => `<li class="rise" style="--i:${i}"><a class="subject" style="--i:${i}" href="#/s/${s[0]}"><span class="ico" aria-hidden="true">${s[2]}</span><span>${s[1]}</span></a></li>`).join('')}</ul></section>`);
  }

  function subject(id) {
    const s = SUBJECTS.find(x => x[0] === id); if (!s) return home();
    if (id !== 'maths') return show(`<section class="screen"><div class="bar"><a class="back" href="#/">Subjects</a></div>
      <div class="soon"><div class="big" aria-hidden="true">${s[2]}</div><h1>${s[1]} is on its way.</h1><p>Dad is getting it ready for you.</p><a class="btn" href="#/">Back to subjects</a></div></section>`);
    const cards = Object.keys(TOPICS).map((tid, i) => {
      const T = TOPICS[tid], got = T.lessons.reduce((a, l) => a + Store.stars(key(tid) + l.id), 0), all = T.lessons.length * 3;
      return `<li class="rise" style="--i:${i}"><a class="card" href="${base(tid)}"><span class="num" aria-hidden="true">${T.icon}</span><span class="tx"><span class="t">${T.title}</span><span class="s">${T.blurb}</span></span>
      <span class="stars" role="img" aria-label="${got} of ${all} stars"><b>★</b> ${got} of ${all}</span></a></li>`;
    }).join('');
    show(`<section class="screen"><div class="bar"><a class="back" href="#/">Subjects</a></div><h1 class="title">Maths</h1><p class="lead">Pick a topic.</p><ul class="cards">${cards}</ul></section>`);
  }

  function map(tid) {
    const T = TOPICS[tid], K = key(tid), B = base(tid);
    const start = T.lessons.findIndex(l => !Store.best(K + l.id));
    const cards = T.lessons.map((l, i) => {
      const d = s => Store.isDone(K + l.id + '.' + s);
      const stage = T.stages(l).find(s => s !== 'quiz' && !d(s)) || 'quiz';
      return `<li class="rise" style="--i:${i}"><a class="card" href="${B}/${l.id}/${stage}">${i === start ? '<span class="here">Start here</span>' : ''}<span class="num" aria-hidden="true">${T.num(l)}</span>
        <span class="tx"><span class="t">${l.title}</span><span class="s">${l.sum}</span></span>${starRow(Store.stars(K + l.id))}</a></li>`;
    }).join('');
    show(`<section class="screen"><div class="bar"><a class="back" href="#/s/maths">Maths</a><h1>${T.title}</h1><span class="pad44"></span></div><p class="lead">Pick a lesson.</p><ul class="cards two">${cards}</ul>${T.extra || ''}</section>`);
  }

  function lesson(tid, id, stage) {
    const T = TOPICS[tid], L = T.find(id); if (!L) return map(tid);
    const st = T.stages(L), K = key(tid) + L.id + '.', b = `${base(tid)}/${L.id}`;
    if (st.indexOf(stage) < 0) stage = st[0];
    const strip = () => st.map((s, i) => {
      const d = Store.isDone(K + s), on = s === stage;
      return `<li><a class="stage${on ? ' on' : ''}${d ? ' done' : ''}" href="${b}/${s}"${on ? ' aria-current="step"' : ''}><i>${d ? '✓' : i + 1}</i>${STAGES[s]}</a></li>`;
    }).join('');
    show(`<section class="screen"><div class="bar"><a class="back" href="${base(tid)}">Lessons</a><h1>${L.title}</h1><button class="mute" id="mute" type="button"></button></div>
      ${st.length > 1 ? `<ol class="stages${st.length === 2 ? ' two' : ''}" id="strip">${strip()}</ol>` : ''}<div class="sheet" id="stage"></div></section>`);
    const m = document.getElementById('mute');
    const paint = () => { const off = FX.mute(); m.textContent = off ? '🔕' : '🔔'; m.setAttribute('aria-label', off ? 'Sound is off. Turn it on.' : 'Sound is on. Turn it off.'); };
    m.onclick = () => { FX.mute(!FX.mute()); paint(); FX.chime('tap'); }; paint();
    const host = document.getElementById('stage');
    const ctx = { base: b, next: b + (stage === 'see' ? '/try' : '/quiz'),
      done(s) { Store.markDone(K + (s || stage)); const el = document.getElementById('strip'); if (el) el.innerHTML = strip(); } };
    stop = T.run(stage, host, L, ctx);
  }

  function keyScreen() {
    show(`<section class="screen"><form class="keycard" id="kf" autocomplete="off"><h1>Type your key to open your app.</h1>
      <input id="k" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Your key"><p class="err" id="err" role="alert"></p>
      <button class="btn" id="go" type="submit">Open my app</button><p class="sub">Dad has your key.</p></form></section>`);
    const f = document.getElementById('kf'), b = document.getElementById('go'), err = document.getElementById('err');
    f.onsubmit = async e => {
      e.preventDefault(); if (b.disabled) return;
      b.disabled = true; b.setAttribute('aria-busy', 'true'); err.textContent = '';
      const t0 = Date.now(), r = await Store.hello(document.getElementById('k').value);
      await new Promise(ok => setTimeout(ok, Math.max(0, 350 - (Date.now() - t0))));
      if (r === 'anya') return start();
      if (r === 'dad') { location.href = 'admin/' + location.search; return; }
      b.disabled = false; b.removeAttribute('aria-busy');
      err.textContent = r === 'offline' ? 'No internet just now. Try again in a moment.' : 'That key did not work. Check it and try again.';
    };
  }

  function route() {
    const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (p[0] === 's') return subject(p[1]);
    if (p[0] === 'maths' && topic(p[1])) {
      if (p[1] === 'minus' && p[2] === 'cheats') return show(MinusPlay.cheats());
      return p[2] ? lesson(p[1], p[2], p[3]) : map(p[1]);
    }
    home();
  }
  function start() {
    if (!started) {
      started = true; window.addEventListener('hashchange', route); Store.flush();
      Store.pull().then(changed => { if (changed && (location.hash === '#/s/maths' || topic(location.hash.replace('#/maths/', '')))) route(); });
    }
    route();
  }
  /* 'ok' = straight in · 'key' = ask for the key once · 'dad' = this is Dad's key, go to his side */
  async function gate() {
    const linked = Store.takeHashKey();
    if (!CONFIG.api) { if (linked) Store.trust(linked); return 'ok'; }
    if (linked) {
      const r = await Store.hello(linked);
      if (r === 'dad') return 'dad';
      if (r === 'offline') Store.trust(linked);
    }
    return Store.key() ? 'ok' : 'key';
  }

  const gated = gate();
  Intro.play(async () => { const g = await gated; if (g === 'dad') { location.replace('admin/' + location.search); return; } if (g === 'key') keyScreen(); else start(); });
  if ('serviceWorker' in navigator && !CONFIG.local) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
})();
