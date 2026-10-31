'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const kb = require('../js/core/kb.js');
const KB_FILE = path.join(__dirname, '..', 'private-kb', 'Forex_Strategy_Knowledge_Base.md');
if (!fs.existsSync(KB_FILE)) { test('KB engine tests skipped: private-kb/ is not present (it is deliberately not in the public repo)', { skip: true }, () => {}); return; }
const md = fs.readFileSync(KB_FILE, 'utf8');
const pack = kb.parse(md), ix = kb.buildIndex(pack), ask = (q, o) => kb.answer(ix, q, o || {});

test('parser: structure, 13 conflicts, kinds and strategies are recognised', () => {
  assert.ok(pack.chunks.length > 150);
  const conflicts = pack.chunks.filter(c => c.conflictId); assert.equal(conflicts.length, 13);
  assert.deepEqual(conflicts.map(c => c.conflictId).slice(0, 3), ['K1', 'K2', 'K3']);
  const kinds = new Set(pack.chunks.map(c => c.kind)); ['rule', 'strategy', 'conflict', 'test', 'archive', 'image'].forEach(k => assert.ok(kinds.has(k), 'missing kind ' + k));
  ['gold', 'dowjones', 'cop', 'news'].forEach(s => assert.ok(pack.chunks.some(c => c.strategy === s && c.kind === 'strategy'), 'no strategy ' + s));
  assert.ok(pack.chunks.some(c => c.strategy === 'smc'));
  assert.ok(Object.keys(pack.images).length >= 40);
});

test('answers quote the knowledge base and cite sections', () => {
  const a = ask('ریسک هر معامله چقدر باشه');
  assert.ok(a.confidence >= .5 && /۱٪|۰٫۵٪/.test(a.text)); assert.ok(a.sources.length >= 1 && a.sources.every(s => s.label));
  const b = ask('حد ضرر رو میتونم جابجا کنم'); assert.match(b.text, /جابه‌جایی SL|SL نباید جابه‌جا/); assert.match(b.text, /⛔|ممنوع|نباید|جابه‌جایی/);
  const c = ask('اسپرد چیه'); assert.match(c.text, /اسپرد/); assert.match(c.text, /پیپ/);
});

test('strategy questions stay inside that strategy and never merge strategies', () => {
  const g = ask('قوانین استراتژی طلا'), d = ask('چک لیست استراتژی داوجونز');
  assert.equal(g.strategy, 'gold'); assert.equal(d.strategy, 'dowjones');
  assert.ok(g.hits.every(h => !h.chunk.strategy || h.chunk.strategy === 'gold')); assert.ok(d.hits.every(h => !h.chunk.strategy || h.chunk.strategy === 'dowjones'));
  assert.match(g.text, /ترکیب نکن/); assert.match(d.text, /۱۷/);
});

test('conflicts are reported, and a saved user decision replaces the open warning', () => {
  const all = ask('تعارض ها'); assert.equal(all.conflicts.length, 13); assert.match(all.text, /13 مورد/); assert.match(all.text, /0 مورد را تو/);
  const q = 'فیلتر خبر داوجونز چیه';
  assert.match(ask(q).text, /⚠️ ابهام ثبت‌شده K1/);
  const decided = ask(q, { decisions: { K1: { text: 'قانون پایه معتبر است' } } }); assert.match(decided.text, /✅ K1 — تصمیم تو: قانون پایه معتبر است/); assert.doesNotMatch(decided.text, /⚠️ ابهام ثبت‌شده K1/);
  assert.match(ask('تعارض ها', { decisions: { K1: { text: 'x' } } }).text, /1 مورد را تو/);
});

test('unrelated or unknowable questions get an honest "not found" instead of a guess', () => {
  const a = ask('قیمت بیت کوین فردا چقدره'); assert.equal(a.confidence, 0); assert.match(a.text, /حدس نمی‌زنم/); assert.equal(a.needs, 'ai');
  assert.equal(ask('').confidence, 0);
});

test('typos / spelling variants and synonyms still find the right section', () => {
  assert.match(ask('اردر بلاک چیه').text, /OB|اردربلاک|اوردر/i);
  assert.match(ask('حد ضرر استاپ لاس چطور باشه').text, /SL|حد ضرر/);
  assert.ok(ask('الگوی سر و شانه').images.some(i => /head-and-shoulders/.test(i)));
});

test('checklist intent returns the general setup process verbatim', () => {
  const a = ask('چک لیست قبل از ورود'); assert.match(a.text, /نماد و استراتژی مربوط را تعیین کن/); assert.ok(a.confidence >= .9);
});
