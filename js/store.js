/* What the device remembers, and sending scores to the score sheet. window.Store
   Everything is kept on the device first, so nothing is lost with no internet. */
window.Store = (function () {
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const api = () => window.CONFIG.api;
  let key = read('anya.key', ''), best = read('anya.best', {}), done = read('anya.done', {}), queue = read('anya.queue', []), sending = null;

  function device() {
    const u = navigator.userAgent;
    if (/iPhone/.test(u)) return 'iPhone';
    if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(u)) return 'Android';
    if (/Macintosh/.test(u)) return 'Mac';
    return 'Other';
  }
  const newId = () => 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  async function post(body) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal });
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  /* A link that ends in #k=<key> signs the device in once; the key is then taken out of the address. */
  function takeHashKey() {
    const m = /^#k=(.+)$/.exec(location.hash); if (!m) return '';
    let k = ''; try { k = clean(decodeURIComponent(m[1])); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    return k;
  }
  /* 'anya' | 'dad' | 'bad' | 'offline' */
  async function hello(k) {
    k = clean(k); if (!k) return 'bad';
    let r; try { r = await post({ action: 'hello', key: k }); } catch (e) { return 'offline'; }
    if (!r || !r.ok) return 'bad';
    if (r.role === 'dad') { try { localStorage.setItem('anya.dadKey', k); } catch (e) {} return 'dad'; }
    key = k; write('anya.key', key); return 'anya';
  }
  function trust(k) { key = clean(k); write('anya.key', key); }   // a key from her link, kept while there is no internet to check it
  function forget() { key = ''; write('anya.key', ''); }

  function flush() {
    if (!api() || !key || !queue.length) return Promise.resolve([]);
    if (sending) return sending;
    sending = post({ action: 'save', key, attempts: queue }).then(r => {
      if (!r || !r.ok) return [];
      const saved = r.saved || []; queue = queue.filter(a => saved.indexOf(a.id) < 0); write('anya.queue', queue); return saved;
    }).catch(() => []).finally(() => { sending = null; });
    return sending;
  }
  const bestKey = a => [a.subject, a.topic, a.lesson].join('.');
  function keepBest(a) {
    const k = bestKey(a), old = best[k], stars = window.Questions.stars(a.score, a.total);
    if (!old || a.score / a.total > old.score / old.total) { best[k] = { score: a.score, total: a.total, stars, at: a.finishedAt }; return true; }
    return false;
  }
  /* 'saved' (on the score sheet) | 'kept' (waiting on this device) | 'local' (no score sheet yet) */
  async function saveAttempt(a) {
    keepBest(a); write('anya.best', best);
    queue.push(a); if (queue.length > 200) queue = queue.slice(-200); write('anya.queue', queue);
    if (!api() || !key) return 'local';
    if (sending) await sending;
    const saved = await flush();
    return saved.indexOf(a.id) >= 0 ? 'saved' : 'kept';
  }
  /* Bring her stars down from the score sheet, so a new device shows them too. */
  async function pull() {
    if (!api() || !key) return false;
    let r; try { r = await post({ action: 'progress', key }); } catch (e) { return false; }
    if (!r || !r.ok) return false;
    let changed = false;
    (r.attempts || []).forEach(a => { if (a && a.total && keepBest(a)) changed = true; if (a && !done[bestKey(a) + '.quiz']) { done[bestKey(a) + '.quiz'] = 1; changed = true; } });
    if (changed) { write('anya.best', best); write('anya.done', done); }
    return changed;
  }
  window.addEventListener('online', () => { flush(); });

  return {
    key: () => key, device, newId, takeHashKey, hello, trust, forget, saveAttempt, flush, pull,
    best: id => best[id] || null,
    stars: id => (best[id] ? best[id].stars : 0),
    isDone: id => !!done[id],
    markDone: id => { if (!done[id]) { done[id] = 1; write('anya.done', done); } },
    waiting: () => queue.length,
  };
})();
