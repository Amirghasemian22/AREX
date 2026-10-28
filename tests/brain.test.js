'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/core/brain.js');

const NOW = new Date(2026, 9, 27, 10, 0, 0);               // local time, Tue 27 Oct 2026
const d = (off = 0) => { const x = new Date(NOW.getTime() + off * 86400000); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const tr = (o) => Object.assign({ id: Math.random(), date: d(0), time: '09:00', symbol: 'XAUUSD', dir: 'buy', sl: '2300', r: '1', usd: '100', setup: 'A', mistakes: [] }, o);
const snap = (extra = {}) => B.snapshot(Object.assign({ now: NOW, trades: [] }, extra));

test('stats: win rate, expectancy, streaks and open-trade detection', () => {
  const s = B.stats([tr({ r: '2', usd: '200' }), tr({ r: '-1', usd: '-100' }), tr({ r: '-1', usd: '-100' }), tr({ r: '', usd: '', exit: '' })]);
  assert.equal(s.n, 3); assert.equal(s.winRate, 33.3); assert.equal(s.totalR, 0); assert.equal(s.streak.type, 'loss'); assert.equal(s.streak.len, 2);
  assert.ok(B.isOpen(tr({ r: '', usd: '', exit: '' })));
});

test('verdict: guard breach and open trade without SL stop; high-impact news cautions; clean data is go', () => {
  assert.equal(B.verdict(snap({ guard: { rules: { dailyLoss: { state: 'breach' } } } })).level, 'stop');
  assert.equal(B.verdict(snap({ trades: [tr({ r: '', usd: '', exit: '', sl: '' })] })).level, 'stop');
  const ev = [{ id: 'e1', name: 'NFP', country: 'US', impact: 'high', date: new Date(NOW.getTime() + 20 * 60000) }];
  const v = B.verdict(snap({ events: ev, cfg: { maxRiskPct: 1, maxTradesPerDay: 5 }, limits: { balance: 1000 }, rulesBy: { '': [{ id: 1, text: 'x', kind: 'mandatory' }] } }));
  assert.equal(v.level, 'caution'); assert.match(v.reasons[0].text, /NFP/);
  assert.equal(B.verdict(snap({ cfg: { maxRiskPct: 1, maxTradesPerDay: 5 }, limits: { balance: 1000 }, rulesBy: { '': [{ id: 1, text: 'x', kind: 'mandatory' }] } })).level, 'go');
});

test('verdict: two losses in a row today is a behavioural caution labelled as a suggestion, not a user rule', () => {
  const s = snap({ trades: [tr({ r: '-1', usd: '-10', time: '08:00' }), tr({ r: '-1', usd: '-10', time: '09:00' })], cfg: { maxRiskPct: 1, maxTradesPerDay: 9 }, limits: { balance: 1000 }, rulesBy: { '': [{ id: 1, text: 'x', kind: 'mandatory' }] } });
  const v = B.verdict(s); assert.equal(v.level, 'caution'); assert.match(v.reasons[0].text, /توصیه/);
});

test('trade cap reached stops; weekend is info only', () => {
  const trades = [tr({}), tr({})];
  assert.equal(B.verdict(snap({ trades, cfg: { maxTradesPerDay: 2 } })).level, 'stop');
  assert.equal(B.verdict(snap({ isWeekend: true, cfg: { maxRiskPct: 1, maxTradesPerDay: 5 }, limits: { balance: 1 }, rulesBy: { '': [{ id: 1, text: 'x', kind: 'mandatory' }] } })).level, 'go');
});

test('proactive alerts: news windows, open trade without SL, guard warn, stable ids for dedupe', () => {
  const ev = [{ id: 'n1', name: 'CPI', country: 'US', impact: 'High', date: new Date(NOW.getTime() + 45 * 60000) }, { id: 'n2', name: 'FOMC', country: 'US', impact: 'high', date: new Date(NOW.getTime() + 10 * 60000) }];
  const a = B.proactive(snap({ events: ev, trades: [tr({ r: '', usd: '', exit: '', sl: '' })], guard: { rules: { dailyLoss: { state: 'warn', usedFrac: 0.85 } } } }));
  const ids = a.map(x => x.id);
  assert.ok(ids.includes('news-60-n1') && ids.includes('news-15-n2') && ids.includes('open-no-sl') && ids.includes('guard-dailyLoss-warn'));
  assert.equal(a.find(x => x.id === 'news-15-n2').level, 'danger');
});

test('answer: greeting, status, news, risk maths, rules, and unknown questions fall through to AI', () => {
  const s = snap({ trades: [tr({ r: '1.5', usd: '150' })], limits: { balance: 10000, riskPerTradePct: 1 }, cfg: { maxRiskPct: 1, maxTradesPerDay: 5 } });
  assert.match(B.answer('سلام', s).text, /سلام/);
  assert.match(B.answer('وضعیت امروز', s).text, /امروز/);
  assert.match(B.answer('اخبار امروز', snap()).text, /تقویم/);
  assert.match(B.answer('با موجودی 10000 دلار و ریسک 2% چقدر ریسک کنم؟', s).text, /\$۲۰۰/);
  assert.match(B.answer('قوانین استراتژی من چیه', snap()).text, /حدس نمی‌زنم/);
  const sr = snap({ rulesBy: { 'Breakout': [{ id: 1, text: 'فقط با تأیید حجم', kind: 'mandatory' }] }, strategies: ['Breakout'] });
  assert.match(B.answer('قوانین Breakout چیه', sr).text, /فقط با تأیید حجم/);
  const u = B.answer('پایتخت فرانسه کجاست', s); assert.equal(u.needsAI, true);
});

test('answer never invents signals and asks for data when journal is empty', () => {
  const s = snap();
  const t = B.answer('میتونم معامله کنم؟', s).text;
  assert.doesNotMatch(t, /بخر|بفروش|buy now|sell now/i);
  assert.match(B.answer('عملکرد من چطوره', s).text, /آماری نمی‌سازم/);
  assert.match(B.answer('قدم بعدی چیه', s).text, /ژورنال/);
});

test('weekly review: compares weeks, surfaces top mistake and missing stop losses, keeps small-sample caveat', () => {
  const trades = [tr({ r: '-1', usd: '-100', mistakes: ['FOMO'], sl: '' }), tr({ r: '-1', usd: '-100', mistakes: ['FOMO'], date: d(-2) }), tr({ r: '2', usd: '200', date: d(-3) }), tr({ r: '1', usd: '100', date: d(-9) })];
  const w = B.weeklyReview(trades, NOW);
  assert.equal(w.empty, false);
  assert.ok(w.lines.some(l => /FOMO/.test(l)) && w.lines.some(l => /بدون حد ضرر/.test(l)) && w.lines.some(l => /نمونه/.test(l)));
  assert.ok(w.focus.length >= 1 && w.focus.length <= 3);
  assert.equal(B.weeklyReview([], NOW).empty, true);
});

test('best/worst groups need a minimum sample; AI context is compact and contains no screenshots', () => {
  const few = [tr({ setup: 'A' }), tr({ setup: 'B', r: '-1', usd: '-1' })];
  assert.doesNotMatch(B.answer('بهترین ستاپ', snap({ trades: few })).text, /بهترین «/);
  const ctx = B.aiContext(snap({ trades: few }));
  assert.ok(JSON.stringify(ctx).length < 9000);
  assert.equal(JSON.stringify(ctx).includes('data:image'), false);
});

test('nightly sync reminder: due after the configured hour when not synced today; clears once synced; off when disabled', () => {
  const late = new Date(2026, 9, 27, 22, 0), mk = sync => B.snapshot({ now: late, trades: [], sync });
  assert.equal(mk({ enabled: true, hour: 21, lastSyncAt: new Date(2026, 9, 26, 22).toISOString() }).syncDue, true);
  assert.equal(mk({ enabled: true, hour: 21, lastSyncAt: new Date(2026, 9, 27, 18).toISOString() }).syncDue, false);
  assert.equal(mk({ enabled: false, hour: 21 }).syncDue, false);
  assert.equal(B.snapshot({ now: new Date(2026, 9, 27, 15), trades: [], sync: { enabled: true, hour: 21 } }).syncDue, false);
  const a = B.proactive(mk({ enabled: true, hour: 21 })).find(x => x.id === 'sync-night'); assert.ok(a && a.view === 'sync');
});
