/**
 * Anya's App - score sheet backend (Google Apps Script, V8, standalone).
 * Deploy as a web app: Execute as "Me", Who has access "Anyone".
 * Run setup() once by hand from the editor. Keys live in Script Properties.
 */
const SITE = 'https://dgaj-g.github.io/anyas-app/';
const HEADER = ['id', 'savedAt', 'subject', 'topic', 'lesson', 'lessonTitle', 'score', 'total',
  'percent', 'startedAt', 'finishedAt', 'durationSec', 'device', 'appVersion', 'detailJSON'];
const WORDS = ('rose comet pearl lily daisy poppy tulip pansy iris lilac peony orchid violet jasmine ' +
  'clover willow maple cherry plum peach berry mango lemon melon honey sugar candy toffee fudge cocoa ' +
  'mint vanilla cream jelly cupcake cookie muffin waffle sky cloud rain star moon sun dawn dusk breeze ' +
  'rainbow sunset twilight meadow river brook lake ocean wave shell coral reef sand island bay opal ruby ' +
  'amber jade topaz onyx agate garnet crystal diamond sapphire emerald moonstone silver gold copper ' +
  'velvet silk satin lace ribbon bow button bell chime song tune dance swan robin wren dove finch lark ' +
  'bunny fawn kitten pony otter panda koala lamb duckling firefly butterfly ladybird bee sparkle glow ' +
  'shimmer twinkle gleam bright happy merry jolly sunny cosy gentle swift brave kind lucky').split(' ');

function doGet() { return out({ ok: true, app: "Anya's App" }); }

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return out(handle(body));
  } catch (err) {
    return out({ ok: false, error: 'bad-request' });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Lower-case and keep only a-z and 0-9, so "Rose-Comet 4821" matches "rosecomet4821".
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function handle(b) {
  if (!b || typeof b !== 'object' || typeof b.action !== 'string') return { ok: false, error: 'bad-request' };
  if (['hello', 'save', 'progress', 'admin'].indexOf(b.action) < 0) return { ok: false, error: 'bad-request' };
  const props = PropertiesService.getScriptProperties();
  const key = norm(b.key);
  if (isLocked()) return { ok: false, error: 'locked' };
  const role = key && key === norm(props.getProperty('DAD_KEY')) ? 'dad'
    : key && key === norm(props.getProperty('ANYA_KEY')) ? 'anya' : null;
  if (!role) { noteWrongKey(); return { ok: false, error: 'bad-key' }; }
  if (b.action === 'hello') return { ok: true, role: role };
  if (b.action === 'save') return save(b.attempts);
  if (b.action === 'progress') return { ok: true, attempts: readAttempts(false) };
  if (role !== 'dad') return { ok: false, error: 'bad-key' };
  return { ok: true, attempts: readAttempts(true), now: new Date().toISOString() };
}

// ---- throttle: 10 wrong keys in 10 minutes locks every keyed request for 5 minutes ----
function isLocked() { return CacheService.getScriptCache().get('locked') === '1'; }
function noteWrongKey() {
  const c = CacheService.getScriptCache();
  const n = Number(c.get('wrong') || 0) + 1;
  if (n >= 10) { c.put('locked', '1', 300); c.remove('wrong'); } else c.put('wrong', String(n), 600);
}

// ---- saving ----
function clip(v) { return String(v == null ? '' : v).slice(0, 200); }
function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
// A sheet cell: text that starts like a formula is stored as plain text.
function cell(v) { const s = clip(v); return /^[=+\-@]/.test(s) ? "'" + s : s; }

function save(list) {
  if (!Array.isArray(list) || list.length > 50) return { ok: false, error: 'bad-request' };
  for (const a of list) {
    if (!a || typeof a !== 'object' || a.id == null || a.id === '' || a.lesson == null || a.lesson === '' ||
      a.score == null || a.total == null) return { ok: false, error: 'bad-request' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getSheetByName('Attempts');
    const last = sh.getLastRow();
    const have = {};
    if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(r => { have[String(r[0])] = true; });
    const rows = [], saved = [], now = new Date().toISOString();
    for (const a of list) {
      const id = clip(a.id);
      saved.push(id);
      if (have[id]) continue;
      have[id] = true;
      const score = num(a.score), total = num(a.total);
      const detail = Array.isArray(a.detail) ? a.detail.slice(0, 60).map(clipDeep) : [];
      let json = JSON.stringify(detail);
      if (json.length > 45000) json = '[]';
      rows.push([cell(id), now, cell(a.subject), cell(a.topic), cell(a.lesson), cell(a.lessonTitle), score, total,
        total > 0 ? Math.round(score / total * 100) : 0, cell(a.startedAt), cell(a.finishedAt),
        num(a.durationSec), cell(a.device), cell(a.appVersion), json]);
    }
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    return { ok: true, saved: saved };
  } finally { lock.releaseLock(); }
}

function clipDeep(d) {
  const o = {};
  Object.keys(d || {}).forEach(k => { o[k] = typeof d[k] === 'string' ? clip(d[k]) : d[k]; });
  return o;
}

function readAttempts(withDetail) {
  const sh = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getSheetByName('Attempts');
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADER.length).getValues().map(r => {
    const a = { id: String(r[0]), subject: r[2], topic: r[3], lesson: String(r[4]), lessonTitle: r[5],
      score: r[6], total: r[7], startedAt: String(r[9]), finishedAt: String(r[10]), durationSec: r[11],
      device: r[12], appVersion: String(r[13]) };
    if (withDetail) { try { a.detail = JSON.parse(r[14] || '[]'); } catch (e) { a.detail = []; } }
    return a;
  });
}

// ---- setup (run by hand) ----
function pick() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }
function digits() { return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }

function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  if (!props.getProperty('SHEET_ID')) {
    ss = SpreadsheetApp.create("Anya's App scores");
    const sh = ss.getSheets()[0].setName('Attempts');
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
    ['A:F', 'J:K', 'M:O'].forEach(function (r) { sh.getRange(r).setNumberFormat('@'); });
    ss.insertSheet('Keys');
    props.setProperty('SHEET_ID', ss.getId());
  } else ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  if (!props.getProperty('ANYA_KEY') || !props.getProperty('DAD_KEY')) newKeys();
  Logger.log('Spreadsheet: ' + ss.getUrl());
}

// Makes fresh keys for both people and rewrites the Keys tab.
function newKeys() {
  const props = PropertiesService.getScriptProperties();
  const anya = pick() + '-' + pick() + '-' + digits();
  const dad = 'dad-' + pick() + '-' + pick() + '-' + pick() + '-' + digits();
  props.setProperty('ANYA_KEY', anya);
  props.setProperty('DAD_KEY', dad);
  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  const sh = ss.getSheetByName('Keys') || ss.insertSheet('Keys');
  sh.clear();
  sh.getRange(1, 1, 3, 3).setValues([['Who', 'Key', 'Ready-made link'],
    ['Anya', anya, SITE + '#k=' + anya], ['Dad', dad, SITE + 'admin/#k=' + dad]]);
  sh.getRange(1, 1, 1, 3).setFontWeight('bold');
  sh.autoResizeColumns(1, 3);
  Logger.log('Keys written. Spreadsheet: ' + ss.getUrl());
}
