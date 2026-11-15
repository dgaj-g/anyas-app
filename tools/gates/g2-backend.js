/* G2: runs backend/Code.gs against stand-in Google services, so slips are caught before it is pasted.  node tools/gates/g2-backend.js */
const fs = require('fs'), vm = require('vm');
const props = {}, cache = {}, books = {};
function Sheet(name) { this.name = name; this.rows = []; this.fmt = {}; }
Sheet.prototype = {
  setName(n) { this.name = n; return this; }, getLastRow() { return this.rows.length; }, setFrozenRows() {}, clear() { this.rows = []; }, autoResizeColumns() {},
  getRange(a, b, c, d) { const sh = this; if (typeof a === 'string') return { setNumberFormat(f) { sh.fmt[a] = f; return this; } };
    return { setValues(v) { if (v.length !== c || v.some(r => r.length !== d)) throw new Error('range size mismatch ' + v.length + 'x' + v[0].length + ' vs ' + c + 'x' + d); v.forEach((r, i) => { sh.rows[a - 1 + i] = sh.rows[a - 1 + i] || []; r.forEach((x, j) => { sh.rows[a - 1 + i][b - 1 + j] = x; }); }); return this; },
      getValues() { const o = []; for (let i = 0; i < c; i++) { const r = []; for (let j = 0; j < d; j++) r.push((sh.rows[a - 1 + i] || [])[b - 1 + j] ?? ''); o.push(r); } return o; }, setFontWeight() { return this; }, setNumberFormat() { return this; } }; } };
function Book(name) { this.name = name; this.id = 'id' + Object.keys(books).length; this.sheets = [new Sheet('Sheet1')]; books[this.id] = this; }
Book.prototype = { getSheets() { return this.sheets; }, insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }, getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, getId() { return this.id; }, getUrl() { return 'https://sheet/' + this.id; } };
const g = { console,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  SpreadsheetApp: { create: n => new Book(n), openById: id => books[id] },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ text: s, setMimeType() { return this; } }) },
  Logger: { log() {} } };
vm.createContext(g); vm.runInContext(fs.readFileSync(process.argv[2] || require('path').join(__dirname, '../../backend/Code.gs'), 'utf8'), g);
const post = b => JSON.parse(vm.runInContext('doPost', g)({ postData: { contents: typeof b === 'string' ? b : JSON.stringify(b) } }).text);
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
vm.runInContext('setup()', g); vm.runInContext('setup()', g);
ok(Object.keys(books).length === 1, 'setup twice makes one sheet');
const book = Object.values(books)[0], keys = book.getSheetByName('Keys').rows, anya = props.ANYA_KEY, dad = props.DAD_KEY;
ok(book.name === "Anya's App scores" && book.getSheetByName('Attempts').rows[0].length === 15, 'sheet + header');
ok(keys.length === 3 && keys[1][2] === 'https://dgaj-g.github.io/anyas-app/#k=' + anya && keys[2][2] === 'https://dgaj-g.github.io/anyas-app/admin/#k=' + dad, 'keys tab links');
ok(/^[a-z]+-[a-z]+-\d{4}$/.test(anya) && /^dad-[a-z]+-[a-z]+-[a-z]+-\d{4}$/.test(dad), 'key shapes');
ok(JSON.parse(vm.runInContext('doGet', g)().text).ok === true, 'doGet');
ok(post({ action: 'hello', key: anya.toUpperCase().replace(/-/g, ' ') }).role === 'anya', 'hello anya, loose typing');
ok(post({ action: 'hello', key: dad }).role === 'dad', 'hello dad');
ok(post('not json').error === 'bad-request' && post({ action: 'x', key: anya }).error === 'bad-request', 'bad requests');
const A = n => ({ id: 'a-' + n, subject: 'maths', topic: 'angles', lesson: n % 2 ? 1 : 'mixed', lessonTitle: '=HYPERLINK("x")', score: 4, total: 5, startedAt: '2026-11-15T10:00:00.000Z', finishedAt: '2026-11-15T10:03:00.000Z', durationSec: 180, device: 'iPhone', appVersion: '1',
  detail: [{ n: 1, kind: 'line2', prompt: 'p', given: 40, correct: 46, right: false, slip: 'subtract', ms: 9000, helped: true }] });
let r = post({ action: 'save', key: anya, attempts: [A(1), A(2)] }); ok(r.ok && r.saved.length === 2, 'save two');
r = post({ action: 'save', key: anya, attempts: [A(2), A(3)] }); ok(r.ok && r.saved.length === 2 && book.getSheetByName('Attempts').rows.length === 4, 'no duplicate rows');
ok(book.getSheetByName('Attempts').rows[1][5].startsWith("'="), 'formula text made safe');
ok(post({ action: 'save', key: anya, attempts: [{ id: 'z' }] }).error === 'bad-request', 'broken attempt refused');
r = post({ action: 'progress', key: anya }); ok(r.ok && r.attempts.length === 3 && r.attempts[0].detail === undefined && r.attempts[1].lesson === 'mixed', 'progress, no detail');
ok(post({ action: 'admin', key: anya }).error === 'bad-key', "Anya's key cannot open Dad's side");
r = post({ action: 'admin', key: dad }); ok(r.ok && r.attempts.length === 3 && r.attempts[0].detail[0].slip === 'subtract' && r.attempts[0].score === 4, "Dad's side with detail");
for (let i = 0; i < 9; i++) ok(post({ action: 'hello', key: 'wrong' + i }).error === 'bad-key', 'wrong key ' + i);
ok(post({ action: 'hello', key: 'wrong' }).error === 'bad-key' && post({ action: 'hello', key: anya }).error === 'locked', 'tenth wrong key locks');
delete cache.locked; const before = anya; vm.runInContext('newKeys()', g);
ok(props.ANYA_KEY && post({ action: 'hello', key: props.ANYA_KEY }).role === 'anya' && (props.ANYA_KEY === before || post({ action: 'hello', key: before }).error === 'bad-key'), 'newKeys swaps keys');
console.log(fails ? fails + ' FAILED' : 'score-sheet script: all checks passed');
