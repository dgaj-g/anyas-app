/* Stars, sparkles, confetti and the little sounds. window.FX */
window.FX = (function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sky = document.getElementById('sky'), fx = document.getElementById('fx');
  const sctx = sky.getContext('2d'), ctx = fx.getContext('2d');
  const TINTS = ['#ffffff', '#ffe2a8', '#ffb3d2', '#ffd98a', '#e9d5ff'];
  const PAPER = ['#ff6fb5', '#ffd36e', '#b469ff', '#22c5a5', '#ffffff', '#ff9ec4'];
  let W = 0, H = 0, dpr = 1, stars = [], parts = [], pen = null, running = false, lastSky = 0;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    [sky, fx].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
    const n = Math.round(Math.min(170, W * H / 4800));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.pow(Math.random(), 1.5) * H * .92, r: Math.random() * 1.25 + .35, p: Math.random() * 6.28, s: .5 + Math.random() * 1.3, c: TINTS[(Math.random() * 3) | 0] }));
    drawSky(performance.now());
  }
  function drawSky(t) {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = reduce ? .8 : .3 + .7 * Math.abs(Math.sin(s.p + t / 1000 * s.s));
      sctx.globalAlpha = a * (1 - s.y / H * .55); sctx.fillStyle = s.c;
      sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 6.283); sctx.fill();
      if (s.r > 1.3) { sctx.globalAlpha *= .5; sctx.fillRect(s.x - s.r * 3.2, s.y - .4, s.r * 6.4, .8); sctx.fillRect(s.x - .4, s.y - s.r * 3.2, .8, s.r * 6.4); }
    }
    sctx.globalAlpha = 1;
  }
  function star4(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rr = i % 2 ? r * .3 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function frame(t) {
    if (document.hidden) { running = false; return; }
    if (!reduce && t - lastSky > 70) { drawSky(t); lastSky = t; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (parts.length || pen) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.age += 16; if (p.age >= p.life) { parts.splice(i, 1); continue; }
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy *= p.drag; p.rot += p.spin;
        const k = 1 - p.age / p.life; ctx.fillStyle = p.c;
        if (p.paper) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, k * 3); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.age / 90 + p.rot)); ctx.fillRect(-p.r, -p.r * .6, p.r * 2, p.r * 1.2); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; }
        else { ctx.globalAlpha = k * k * (0.55 + .45 * Math.sin(p.age / 40 + p.rot)); star4(p.x, p.y, p.r * (.4 + k * .6), p.rot); }
      }
      if (pen) {
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(pen.x, pen.y, 0, pen.x, pen.y, pen.r * 4);
        g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.25, 'rgba(255,225,170,.7)'); g.addColorStop(1, 'rgba(255,120,190,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pen.x, pen.y, pen.r * 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; star4(pen.x, pen.y, pen.r * 2.4, t / 300);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(frame);
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  function add(x, y, o) {
    if (parts.length > 700) return;
    const a = o.a != null ? o.a : Math.random() * 6.283, v = o.v != null ? o.v : 1 + Math.random() * 3;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g != null ? o.g : .04, drag: o.drag || .97, life: o.life || 700 + Math.random() * 600, age: 0,
      r: o.r || 2 + Math.random() * 4, rot: Math.random() * 6.28, spin: (Math.random() - .5) * .2, c: o.c || TINTS[(Math.random() * TINTS.length) | 0], paper: !!o.paper });
    wake();
  }
  function burst(x, y, n, o) { if (reduce) return; for (let i = 0; i < (n || 18); i++) add(x, y, Object.assign({ v: 1 + Math.random() * (o && o.power || 4.2) }, o)); }
  function trail(x, y, n) { if (reduce) return; for (let i = 0; i < (n || 1); i++) add(x + (Math.random() - .5) * 6, y + (Math.random() - .5) * 6, { v: Math.random() * .9, g: .03, life: 500 + Math.random() * 700, r: 1.5 + Math.random() * 3.2 }); }
  function at(el, n, o) { if (!el) return; const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n, o); }
  let fall = 0;
  /* Falling paper stops quickly when the next thing on screen is not a celebration. */
  function settle() { fall++; parts.forEach(p => { if (p.paper) p.life = Math.min(p.life, p.age + 350); }); }
  function confetti() {
    if (reduce) return;
    const me = ++fall;
    for (let i = 0; i < 130; i++) setTimeout(() => me === fall && add(Math.random() * W, -10, { a: Math.PI / 2 + (Math.random() - .5) * .8, v: 2 + Math.random() * 3, g: .05, drag: .992, life: 2600 + Math.random() * 1400, r: 4 + Math.random() * 4, c: PAPER[(Math.random() * PAPER.length) | 0], paper: true }), i * 9);
  }
  function setPen(x, y, r) { pen = x == null ? null : { x, y, r: r || 5 }; if (pen) wake(); }

  /* sounds: soft bell tones, made in the browser; nothing to download */
  let ac = null, muted = false;
  try { muted = localStorage.getItem('anya.mute') === '1'; } catch (e) {}
  const TUNES = { tap: [[740, 0, .07]], place: [[988, 0, .1]], right: [[784, 0, .22], [1047, .09, .26], [1319, .18, .42]], wrong: [[392, 0, .2], [330, .13, .32]],
    hit: [[1047, 0, .16], [1568, .08, .34]], win: [[784, 0, .2], [988, .13, .2], [1175, .26, .2], [1568, .39, .7]] };
  function chime(name) {
    if (name === 'wrong') settle();   // no party paper falling over a "not that one"
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime + .01, vol = name === 'tap' ? .045 : .1;
      (TUNES[name] || []).forEach(([f, dt, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(vol, t + dt + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dt + d);
        o.connect(g); g.connect(ac.destination); o.start(t + dt); o.stop(t + dt + d + .05);
      });
    } catch (e) {}
  }
  function mute(v) { if (v != null) { muted = !!v; try { localStorage.setItem('anya.mute', muted ? '1' : '0'); } catch (e) {} } return muted; }

  window.addEventListener('resize', size); document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  size(); wake();
  return { burst, trail, at, confetti, settle, paper: () => parts.filter(p => p.paper).length, pen: setPen, chime, mute, reduce };
})();
