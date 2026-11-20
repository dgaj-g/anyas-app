(function () {
  'use strict';
  var KEY_NAME = 'anya.dadKey';
  var SLIPS = {
    half: 'Used 180 where it needed 360', full: 'Used 360 where it needed 180',
    square: 'Missed the right angle (90)', share: 'Did not share between the equal angles',
    one: 'Took away only one of the angles', subtract: 'Subtracted the two angles from each other',
    same: 'Copied an angle from the picture', twin: 'Missed an equal angle',
    other: 'Gave the other size of angle', inside: 'Gave the inside angle, not the outside one',
    near: 'Close: an adding or subtracting slip',
    mixed: 'Took one angle away, then added the other', added: 'Added the angles but did not take them from the whole',
    toobig: 'Answer bigger than the whole',
    'plan-gap': 'Chose to take one angle from the other', 'plan-add': 'Chose to add to the whole instead of taking away',
    'plan-mixed': 'Chose the working that takes one away then adds the other'
  };
  // Minus numbers has its own slips: 'added' and 'near' mean something else there.
  var MINUS_SLIPS = {
    notTidied: 'Did not join the two signs that touch first',
    twoMinus: 'Made a plus from two minus signs that do not touch',
    sign: 'Right number, wrong sign',
    tookAway: 'Took away when the signs were the same (should add)',
    added: 'Added when the signs were different (should take away)',
    near: 'Close: an adding or taking away slip',
    notTouching: 'Joined two signs that do not touch',
    oneSign: 'Said signs touch when there was only one sign',
    missedTouch: 'Missed the two signs that touch',
    twins: 'Two minus signs: picked a minus, not a plus',
    oddPair: 'A plus and a minus: picked a plus, not a minus'
  };
  function isMinus(a) { return !!a && (a.topic === 'minus' || /^m(\d+|mix)$/.test(String(a.lesson || ''))); }
  function slipLabel(d, a) { return ((d.topic === 'minus' || isMinus(a)) ? MINUS_SLIPS[d.slip] : SLIPS[d.slip]) || 'Something else'; }
  function lessonName(a) {
    var t = a.lessonTitle || ('Lesson ' + a.lesson);
    return isMinus(a) ? 'Minus numbers: ' + t : (a.lesson === 'mixed' ? 'Angles: ' + t : t);
  }
  function show(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : v; }
  var MSG = {
    'bad-key': 'That key did not work.', locked: 'Too many tries. Wait five minutes.',
    net: 'Could not reach the score sheet. Check the connection.', other: 'Something went wrong. Try again.'
  };
  var app = document.getElementById('app');
  var cfg = window.CONFIG || {};
  var api = cfg.api || '';
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    var q = new URLSearchParams(location.search).get('api');
    if (q) api = q;
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    [].concat(kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear() { while (app.firstChild) app.removeChild(app.firstChild); }
  function getKey() { try { return localStorage.getItem(KEY_NAME) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(KEY_NAME, k); else localStorage.removeItem(KEY_NAME); } catch (e) {} }

  // POST to the score sheet. Resolves {ok,...}; rejects with Error('net') on network failure.
  function call(body) {
    return fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('net'); return r.json(); })
      .catch(function () { throw new Error('net'); });
  }
  // Busy state for a button for at least 300 ms.
  function busy(btn, work) {
    var label = btn.textContent;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.textContent = '';
    btn.appendChild(el('span', { class: 'spin', 'aria-hidden': 'true' }));
    btn.appendChild(document.createTextNode(label));
    var min = new Promise(function (r) { setTimeout(r, 300); });
    return Promise.all([work(), min]).then(function (v) { return v[0]; }, function (e) {
      return min.then(function () { throw e; });
    }).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
    function done() { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
  }

  // ---- screens ----
  function notConnected() {
    clear();
    app.appendChild(el('section', { class: 'card' }, [el('p', { text: 'The score sheet is not connected yet.' })]));
  }

  function keyScreen(msg) {
    clear();
    var input = el('input', { type: 'text', id: 'key', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    var err = el('p', { class: 'err', role: 'alert', text: msg || '' });
    var btn = el('button', { class: 'btn', type: 'submit', text: 'Open' });
    var form = el('form', { class: 'card' }, [
      el('h2', { text: "Anya's scores" }),
      el('div', { class: 'form-row' }, [
        el('div', {}, [el('label', { for: 'key', text: "Dad's key" }), input]), btn]),
      err
    ]);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var k = input.value.trim();
      if (!k) { err.textContent = MSG['bad-key']; return; }
      err.textContent = '';
      busy(btn, function () { return load(k); }).catch(function (e) { err.textContent = errText(e); });
    });
    app.appendChild(form);
    input.focus();
  }
  function errText(e) { return MSG[e && e.message] || MSG.other; }

  // Fetch admin data with a key; on success store the key and draw the page.
  function load(k) {
    return call({ action: 'admin', key: k }).then(function (r) {
      if (!r.ok) throw new Error(r.error === 'bad-request' ? 'other' : r.error);
      setKey(k);
      render(r);
    });
  }

  // ---- helpers for the data ----
  function stars(pct) { return pct >= 100 ? 3 : pct >= 80 ? 2 : pct >= 60 ? 1 : 0; }
  function starEl(n) {
    var s = el('span', { class: 'stars', role: 'img', 'aria-label': n + (n === 1 ? ' star' : ' stars') });
    for (var i = 0; i < 3; i++) s.appendChild(el('span', i < n ? { 'aria-hidden': 'true', text: '★' } : { class: 'off', 'aria-hidden': 'true', text: '★' }));
    return s;
  }
  function pct(a) { return a.total > 0 ? Math.round(a.score / a.total * 100) : 0; }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function when(iso, withTime) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var s = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONS[d.getMonth()];
    return withTime ? s + ', ' + two(d.getHours()) + ':' + two(d.getMinutes()) : s;
  }
  function dur(sec) {
    sec = Math.round(Number(sec) || 0);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m ? m + ' min ' + s + ' s' : s + ' s';
  }
  function stamp(a) { return a.finishedAt || a.startedAt || ''; }
  function time(a) { var t = new Date(stamp(a)).getTime(); return isNaN(t) ? 0 : t; }
  function lessonOrder(l) {
    if (l === 'plan') return 3.5;
    if (l === 'mixed') return 50;
    if (/^m\d+$/.test(l)) return 100 + parseInt(l.slice(1), 10);
    if (l === 'mmix') return 150;
    var n = parseInt(l, 10); return isNaN(n) ? 999 : n;
  }

  // ---- main page ----
  function render(data) {
    clear();
    var attempts = (data.attempts || []).slice().sort(function (a, b) { return time(b) - time(a); });
    var upd = new Date(data.now);
    if (isNaN(upd)) upd = new Date();

    var refresh = el('button', { class: 'btn ghost', type: 'button', text: 'Refresh' });
    refresh.addEventListener('click', function () {
      busy(refresh, function () { return load(getKey()); }).catch(function (e) {
        if (e.message === 'bad-key') { setKey(''); keyScreen(errText(e)); } else flash(errText(e));
      });
    });
    var forget = el('button', { class: 'link', type: 'button', text: 'Forget this device' });
    forget.addEventListener('click', function () { setKey(''); keyScreen(''); });
    var note = el('span', { text: 'Updated ' + two(upd.getHours()) + ':' + two(upd.getMinutes()) });
    app.appendChild(el('header', { class: 'top' }, [
      el('h1', { text: "Anya's scores" }),
      el('div', { class: 'tools' }, [note, refresh, forget])
    ]));
    var status = el('p', { class: 'err', role: 'status' });
    function flash(t) { status.textContent = t; status.style.color = '#ffd6ea'; }
    app.appendChild(status);

    if (!attempts.length) {
      app.appendChild(el('section', { class: 'card' }, [el('p', { text: 'No quizzes yet.' })]));
      return;
    }
    app.appendChild(summaries(attempts));
    app.appendChild(slips(attempts));
    app.appendChild(everyQuiz(attempts));
  }

  function summaries(attempts) {
    var by = {};
    attempts.forEach(function (a) { (by[a.lesson] = by[a.lesson] || []).push(a); });
    var wrap = el('div', { class: 'cards' });
    Object.keys(by).sort(function (x, y) { return lessonOrder(x) - lessonOrder(y); }).forEach(function (l) {
      var list = by[l];
      var best = list.reduce(function (m, a) { return pct(a) > pct(m) ? a : m; }, list[0]);
      var last = list[0]; // already newest first
      var card = el('section', { class: 'card sum' }, [
        el('h3', { text: lessonName(last) }),
        el('div', {}, [el('span', { class: 'big', text: best.score + ' / ' + best.total }), ' ', starEl(stars(pct(best)))]),
        el('dl', {}, [
          el('dt', { text: 'Best' }), el('dd', { text: pct(best) + '%' }),
          el('dt', { text: 'Last' }), el('dd', { text: last.score + ' / ' + last.total + ' (' + when(stamp(last), false) + ')' }),
          el('dt', { text: 'Quizzes' }), el('dd', { text: String(list.length) })
        ])
      ]);
      wrap.appendChild(card);
    });
    return wrap;
  }

  function slips(attempts) {
    var tally = {};
    attempts.forEach(function (a) {
      (a.detail || []).forEach(function (d) {
        if (d.right === false) {
          var label = slipLabel(d, a);
          tally[label] = (tally[label] || 0) + 1;
        }
      });
    });
    var keys = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    var card = el('section', { class: 'card' }, [el('h2', { text: 'What slips most' })]);
    if (!keys.length) { card.appendChild(el('p', { text: 'No wrong answers yet.' })); return card; }
    var max = tally[keys[0]];
    var ul = el('ul', { class: 'bars' });
    keys.forEach(function (k) {
      var fill = el('i'); fill.style.width = Math.max(4, Math.round(tally[k] / max * 100)) + '%';
      ul.appendChild(el('li', {}, [
        el('div', { class: 'bar-label' }, [el('span', { text: k }), el('b', { text: String(tally[k]) })]),
        el('div', { class: 'bar', 'aria-hidden': 'true' }, [fill])
      ]));
    });
    card.appendChild(ul);
    return card;
  }

  function everyQuiz(attempts) {
    var card = el('section', { class: 'card' }, [el('h2', { text: 'Every quiz' })]);
    attempts.forEach(function (a, i) {
      var id = 'q' + i;
      var btn = el('button', { class: 'row-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, [
        el('span', { class: 'when', text: when(stamp(a), true) }),
        el('span', { class: 'meta', text: lessonName(a) + ' · ' + dur(a.durationSec) }),
        el('span', { class: 'right' }, [el('span', { class: 'score', text: a.score + ' / ' + a.total }), starEl(stars(pct(a)))])
      ]);
      var panel = el('div', { id: id, hidden: '' });
      var built = false;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) panel.setAttribute('hidden', ''); else panel.removeAttribute('hidden');
        if (!open && !built) { built = true; panel.appendChild(questions(a)); }
      });
      card.appendChild(el('div', { class: 'quiz' }, [btn, panel]));
    });
    return card;
  }

  function questions(a) {
    var ul = el('ul', { class: 'qs' });
    var d = a.detail || [];
    if (!d.length) return el('p', { class: 'small', text: 'No question details saved.' });
    d.forEach(function (q) {
      var line = [
        el('span', { class: 'mark ' + (q.right ? 'ok' : 'no'), 'aria-label': q.right ? 'right' : 'wrong', text: q.right ? '✓' : '✗' }),
        'Anya: ' + show(q.given) + ' · Answer: ' + show(q.correct)
      ];
      var extra = [];
      if (!q.right) extra.push(el('span', { class: 'tag note', text: slipLabel(q, a) }));
      if (q.helped) extra.push(el('span', { class: 'tag', text: 'used help' }));
      if (q.ms != null) extra.push(el('span', { class: 'small nw', text: Math.round(q.ms / 1000) + ' s' }));
      var detail = el('div', { class: 'detail' }, [].concat(extra.map(function (x, i) { return i ? [' ', x] : [x]; }).reduce(function (m, x) { return m.concat(x); }, [])));
      ul.appendChild(el('li', {}, [
        el('span', { class: 'n', text: String(q.n) }),
        el('div', {}, [el('div', { text: q.prompt || '' }), el('div', {}, line)]),
        detail
      ]));
    });
    return ul;
  }

  // ---- start ----
  if (!api) { notConnected(); return; }
  var m = /^#k=(.+)$/.exec(location.hash);
  if (m) {
    var hk; try { hk = decodeURIComponent(m[1]); } catch (e) { hk = m[1]; }
    setKey(hk.trim());
    history.replaceState(null, '', location.pathname + location.search);
  }
  var stored = getKey();
  if (!stored) keyScreen('');
  else load(stored).catch(function (e) {
    if (e.message === 'bad-key') { setKey(''); keyScreen(errText(e)); }
    else { keyScreen(errText(e)); }
  });
})();
