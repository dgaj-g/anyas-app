#!/usr/bin/env node
// Local test server: serves the repo root and fakes the score-sheet API (same rules as backend/Code.gs).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8787;
const ANYA = process.env.ANYA_KEY || 'test-anya';
const DAD = process.env.DAD_KEY || 'test-dad';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

let store = [];
let wrong = [];       // timestamps of wrong-key requests
let lockedUntil = 0;
let down = false;

const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const clip = v => String(v == null ? '' : v).slice(0, 200);
const num = v => { v = Number(v); return isFinite(v) ? v : 0; };
const bad = { ok: false, error: 'bad-request' };

function noteWrong() {
  const now = Date.now();
  wrong = wrong.filter(t => now - t < 600000);
  wrong.push(now);
  if (wrong.length >= 10) { lockedUntil = now + 300000; wrong = []; }
}

function save(list) {
  if (!Array.isArray(list) || list.length > 50) return bad;
  for (const a of list) {
    if (!a || typeof a !== 'object' || a.id == null || a.id === '' || a.lesson == null || a.lesson === '' ||
      a.score == null || a.total == null) return bad;
  }
  const saved = [];
  for (const a of list) {
    const id = clip(a.id);
    saved.push(id);
    if (store.some(s => s.id === id)) continue;
    const detail = Array.isArray(a.detail) ? a.detail.slice(0, 60).map(d => {
      const o = {};
      Object.keys(d || {}).forEach(k => { o[k] = typeof d[k] === 'string' ? clip(d[k]) : d[k]; });
      return o;
    }) : [];
    store.push({
      id, subject: clip(a.subject), topic: clip(a.topic), lesson: clip(a.lesson), lessonTitle: clip(a.lessonTitle),
      score: num(a.score), total: num(a.total), startedAt: clip(a.startedAt), finishedAt: clip(a.finishedAt),
      durationSec: num(a.durationSec), device: clip(a.device), appVersion: clip(a.appVersion), detail
    });
  }
  return { ok: true, saved };
}

function handle(b) {
  if (!b || typeof b !== 'object' || typeof b.action !== 'string') return bad;
  if (['hello', 'save', 'progress', 'admin'].indexOf(b.action) < 0) return bad;
  if (Date.now() < lockedUntil) return { ok: false, error: 'locked' };
  const key = norm(b.key);
  const role = key && key === norm(DAD) ? 'dad' : key && key === norm(ANYA) ? 'anya' : null;
  if (!role) { noteWrong(); return { ok: false, error: 'bad-key' }; }
  if (b.action === 'hello') return { ok: true, role };
  if (b.action === 'save') return save(b.attempts);
  if (b.action === 'progress') {
    return { ok: true, attempts: store.map(a => { const c = Object.assign({}, a); delete c.detail; return c; }) };
  }
  if (role !== 'dad') return { ok: false, error: 'bad-key' };
  return { ok: true, attempts: store, now: new Date().toISOString() };
}

function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, extra || {}));
  res.end(body);
}
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (res, obj) => send(res, 200, JSON.stringify(obj), 'application/json; charset=utf-8', CORS);

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'bad path', 'text/plain'); }
  if (rel.indexOf('\0') >= 0) return send(res, 400, 'bad path', 'text/plain');
  let file = path.resolve(ROOT, '.' + path.sep + rel);
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) return send(res, 403, 'forbidden', 'text/plain');
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e2, data) => {
      if (e2) return send(res, 404, 'not found', 'text/plain');
      send(res, 200, data, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    });
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', CORS);
  if (p === '/api' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 5e6) req.destroy(); });
    req.on('end', () => {
      if (down) return send(res, 503, 'down', 'text/plain', CORS);
      let b;
      try { b = JSON.parse(raw); } catch (e) { return json(res, bad); }
      try { json(res, handle(b)); } catch (e) { json(res, bad); }
    });
    return;
  }
  if (p === '/__attempts' && req.method === 'GET') return json(res, store);
  if (p === '/__reset' && req.method === 'POST') {
    store = []; wrong = []; lockedUntil = 0; down = false;
    return json(res, { ok: true });
  }
  if (p === '/__down' && req.method === 'POST') {
    down = url.searchParams.get('on') === '1';
    return json(res, { ok: true, down });
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
  send(res, 405, 'method not allowed', 'text/plain');
}).listen(PORT, () => console.log('mock server on http://localhost:' + PORT));
