#!/usr/bin/env node
/* Makes the home-screen icons.  NODE_PATH=$(npm root -g) node tools/make-icons.js */
const puppeteer = require('puppeteer'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'icons');
const font = fs.readFileSync(path.join(root, 'fonts/allura.woff2')).toString('base64');
const star = (x, y, r, o) => { const k = r * 0.2; return `<path opacity="${o}" d="M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z"/>`; };
const STARS = [[396, 124, 34, 1], [438, 204, 14, .9], [104, 150, 17, .9], [120, 384, 12, .8], [404, 388, 20, .95], [70, 262, 8, .7], [300, 70, 9, .75]];
const html = k => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:A;src:url(data:font/woff2;base64,${font})}
html,body{margin:0}body{width:512px;height:512px;overflow:hidden;position:relative;background:radial-gradient(125% 95% at 50% 110%,#f58fb0 0%,#b83b8e 34%,#5b1e6e 64%,#1e0b3a 100%)}
.a{position:absolute;left:0;right:0;top:50%;transform:translateY(-46%);text-align:center;font:400 ${Math.round(430 * k)}px/1 A;color:#fff6e6;text-shadow:0 0 ${Math.round(30 * k)}px rgba(255,217,138,.8),0 8px 20px rgba(30,11,58,.5)}
svg{position:absolute;inset:0}</style><div class="a">A</div><svg viewBox="0 0 512 512" fill="#ffd98a">${STARS.map(s => star(256 + (s[0] - 256) * k, 256 + (s[1] - 256) * k, s[2] * k, s[3])).join('')}</svg>`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await puppeteer.launch({ headless: 'shell' }), p = await b.newPage();
  await p.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  for (const [name, k] of [['icon-512.png', 1], ['icon-512-maskable.png', 0.74]]) {
    await p.setContent(html(k)); await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 200));
    await p.screenshot({ path: path.join(out, name) });
  }
  await b.close();
  for (const n of [192, 180]) execFileSync('sips', ['-z', String(n), String(n), path.join(out, 'icon-512.png'), '--out', path.join(out, `icon-${n}.png`)], { stdio: 'ignore' });
  console.log('icons:', fs.readdirSync(out).join(', '));
})();
