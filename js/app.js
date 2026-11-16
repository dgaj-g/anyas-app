/* The screens and the way between them: home, subject, lesson list, lesson. */
(function () {
  const app = document.getElementById('app'), Q = window.Questions, CONFIG = window.CONFIG;
  const SUBJECTS = [['maths', 'Maths', '📐'], ['english', 'English', '📖'], ['science', 'Science', '🔬'], ['geography', 'Geography', '🌍'], ['history', 'History', '🏰'],
    ['french', 'French', '🥐'], ['he', 'HE', '🧁'], ['re', 'RE', '🕊️'], ['irish', 'Irish', '☘️'], ['spanish', 'Spanish', '🌞']];
  const STAGES = [['see', 'See it'], ['try', 'Try it'], ['quiz', 'Quiz']];
  const BASE = '#/maths/angles', DONE = 'maths.angles.';
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
    const got = Q.LESSONS.reduce((a, l) => a + Store.stars(DONE + l.id), 0);
    show(`<section class="screen"><div class="bar"><a class="back" href="#/">Subjects</a></div><h1 class="title">Maths</h1><p class="lead">Pick a topic.</p>
      <ul class="cards"><li class="rise"><a class="card" href="${BASE}"><span class="num" aria-hidden="true">📐</span><span class="tx"><span class="t">Angles</span><span class="s">5 lessons and a mixed quiz</span></span>
      <span class="stars" role="img" aria-label="${got} of ${Q.LESSONS.length * 3} stars"><b>★</b> ${got} of ${Q.LESSONS.length * 3}</span></a></li></ul></section>`);
  }

  function map() {
    const start = Q.LESSONS.findIndex(l => !Store.best(DONE + l.id));
    const cards = Q.LESSONS.map((l, i) => {
      const d = s => Store.isDone(DONE + l.id + '.' + s);
      const stage = !l.tryKinds.length ? 'quiz' : !d('see') ? 'see' : !d('try') ? 'try' : 'quiz';
      return `<li class="rise" style="--i:${i}"><a class="card" href="${BASE}/${l.id}/${stage}">${i === start ? '<span class="here">Start here</span>' : ''}<span class="num" aria-hidden="true">${l.id === 'mixed' ? '★' : l.id === 'plan' ? '±' : l.id}</span>
        <span class="tx"><span class="t">${l.title}</span><span class="s">${l.sum}</span></span>${starRow(Store.stars(DONE + l.id))}</a></li>`;
    }).join('');
    show(`<section class="screen"><div class="bar"><a class="back" href="#/s/maths">Maths</a><h1>Angles</h1><span class="pad44"></span></div><p class="lead">Pick a lesson.</p><ul class="cards two">${cards}</ul></section>`);
  }

  function lesson(id, stage) {
    const L = Q.lesson(id); if (!L) return map();
    const staged = L.tryKinds.length > 0;
    if (!staged) stage = 'quiz'; else if (!STAGES.some(s => s[0] === stage)) stage = 'see';
    const base = `${BASE}/${L.id}`;
    const strip = () => STAGES.map((s, i) => {
      const d = Store.isDone(DONE + L.id + '.' + s[0]), on = s[0] === stage;
      return `<li><a class="stage${on ? ' on' : ''}${d ? ' done' : ''}" href="${base}/${s[0]}"${on ? ' aria-current="step"' : ''}><i>${d ? '✓' : i + 1}</i>${s[1]}</a></li>`;
    }).join('');
    show(`<section class="screen"><div class="bar"><a class="back" href="${BASE}">Lessons</a><h1>${L.title}</h1><button class="mute" id="mute" type="button"></button></div>
      ${staged ? `<ol class="stages" id="strip">${strip()}</ol>` : ''}<div class="sheet" id="stage"></div></section>`);
    const m = document.getElementById('mute');
    const paint = () => { const off = FX.mute(); m.textContent = off ? '🔕' : '🔔'; m.setAttribute('aria-label', off ? 'Sound is off. Turn it on.' : 'Sound is on. Turn it off.'); };
    m.onclick = () => { FX.mute(!FX.mute()); paint(); FX.chime('tap'); }; paint();
    const host = document.getElementById('stage');
    const ctx = { base, next: base + (stage === 'see' ? '/try' : '/quiz'),
      done(s) { Store.markDone(DONE + L.id + '.' + (s || stage)); const el = document.getElementById('strip'); if (el) el.innerHTML = strip(); } };
    stop = stage === 'see' ? Lessons.see(host, L, ctx) : stage === 'try' ? Player.tryIt(host, L, ctx) : L.plan ? Player.plan(host, L, ctx) : Player.quiz(host, L, ctx);
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
    if (p[0] === 'maths' && p[1] === 'angles') return p[2] ? lesson(p[2], p[3]) : map();
    home();
  }
  function start() {
    if (!started) {
      started = true; window.addEventListener('hashchange', route); Store.flush();
      Store.pull().then(changed => { if (changed && (location.hash === BASE || location.hash === '#/s/maths')) route(); });
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
