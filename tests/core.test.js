// AREX V9.6.3 — unit tests for the pure core. Run: node --test tests/
const test = require('node:test'), assert = require('node:assert/strict');
const U = require('../js/core/util.js'), A = require('../js/core/analytics.js'), P = require('../js/core/propguard.js'),
      E = require('../js/core/errors.js'), Q = require('../js/core/quality.js'), M = require('../js/core/migrate.js');
const near = (a, b, e = 1e-4) => assert.ok(Math.abs(a - b) < e, a + ' ≠ ' + b);

test('toNum: blanks/invalid are null, Persian digits & decimals parsed', () => {
  assert.equal(U.toNum(''), null); assert.equal(U.toNum('abc'), null); assert.equal(U.toNum(undefined), null);
  assert.equal(U.toNum('۱٫۵'), 1.5); assert.equal(U.toNum('-2'), -2); assert.equal(U.toNum('0'), 0);
});

const T = (id, date, time, r, extra) => Object.assign({ id, date, time, symbol: 'XAUUSD', dir: 'buy', r: String(r) }, extra || {});
test('analytics.summarize: hand-computed values (R = 2,-1,-1,3,-1)', () => {
  const s = A.summarize([T(1, '2026-01-01', '10:00', 2), T(2, '2026-01-02', '10:00', -1), T(3, '2026-01-03', '10:00', -1), T(4, '2026-01-04', '10:00', 3), T(5, '2026-01-05', '10:00', -1)]);
  assert.equal(s.wins, 2); assert.equal(s.losses, 3); near(s.winRate, 0.4); near(s.avgR, 0.4); near(s.expectancyR, 0.4);
  near(s.profitFactor, 5 / 3); assert.deepEqual(s.equityCurveR, [2, 1, 0, 3, 2]);
  near(s.drawdownR.max, 2); near(s.drawdownR.pctOfPeak, 1); assert.equal(s.lowSample, true);
});
test('analytics: trades without R/USD are excluded and reported; no losses -> PF null', () => {
  const s = A.summarize([T(1, '2026-01-01', '', 1), { id: 2, date: '2026-01-02' }]);
  assert.equal(s.excluded, 1); assert.equal(s.counted, 1); assert.equal(s.profitFactor, null); assert.ok(s.notes.length === 1);
  const e = A.summarize([]); assert.equal(e.winRate, null); assert.equal(e.total, 0);
});
test('analytics: USD fallback when R missing; sorting is by date+time, not input order', () => {
  const s = A.summarize([{ id: 2, date: '2026-01-02', usd: '-50' }, { id: 1, date: '2026-01-01', usd: '100' }]);
  assert.equal(s.profitFactorBasis, 'USD'); near(s.profitFactor, 2); assert.deepEqual(s.equityCurveUsd, [100, 50]);
});
test('analytics.groupBy / heatmap keep trade ids for drill-down', () => {
  const tr = [T(1, '2026-01-05', '09:15', 1, { sessions: ['London'] }), T(2, '2026-01-05', '09:45', -1, { sessions: ['London', 'NewYork'] }), T(3, '2026-01-06', '', 1)];
  const bs = A.bySession(tr); assert.deepEqual(bs.find(g => g.key === 'London').tradeIds, [1, 2]); assert.ok(bs.find(g => g.key === '(نامشخص)'));
  const h = A.heatmap(tr); assert.equal(h.unplaced, 1); assert.equal(h.cells.length, 1); assert.equal(h.cells[0].n, 2); assert.deepEqual(h.cells[0].tradeIds, [1, 2]);
});

test('propguard: warn at 80% daily loss, other rules computed; missing rules => needs_info', () => {
  const tr = [{ id: 1, date: '2026-01-04', usd: '-200' }, { id: 2, date: '2026-01-05', usd: '-250' }, { id: 3, date: '2026-01-05', usd: '-150' }];
  const r = P.evaluate({ balance: 10000, dailyLossPct: 5, totalLossPct: 10, profitTargetPct: 8, maxTradesPerDay: 3 }, tr, '2026-01-05');
  assert.equal(r.rules.dailyLoss.limitUsd, 500); near(r.rules.dailyLoss.usedFrac, 0.8); assert.equal(r.rules.dailyLoss.state, 'warn');
  near(r.rules.totalLoss.usedFrac, 0.6); assert.equal(r.rules.totalLoss.state, 'ok'); assert.equal(r.equity, 9400);
  assert.equal(r.rules.tradesPerDay.state, 'ok'); assert.equal(r.overall, 'warn');
  const n = P.evaluate({}, tr, '2026-01-05'); assert.equal(n.overall, 'needs_info'); assert.equal(n.rules.dailyLoss.missing, 'balance');
});
test('propguard: breach at 100% and target reached', () => {
  const r = P.evaluate({ balance: 1000, dailyLossPct: 5, profitTargetPct: 10 }, [{ date: 'd', usd: '-60' }], 'd'); assert.equal(r.rules.dailyLoss.state, 'breach'); assert.equal(r.overall, 'breach');
  const g = P.evaluate({ balance: 1000, profitTargetPct: 10 }, [{ date: 'd', usd: '120' }], 'd'); assert.equal(g.rules.profitTarget.state, 'reached');
});

test('errors: tag categories, low compliance, revenge-timing (low confidence) and needsInfo — nothing invented', () => {
  const tr = [T(1, '2026-01-05', '10:00', -1, { mistakes: ['انتقام‌ترید'], ruleCompliance: 60 }), T(2, '2026-01-05', '10:20', -1, { ruleCompliance: 100 }), T(3, '2026-01-06', '10:10', 2, { ruleCompliance: 100 })];
  const d = E.detect(tr, {});
  const f = id => d.findings.find(x => x.id === id);
  assert.equal(f('tag:revenge').count, 1); assert.equal(f('tag:revenge').confidence, 'high');
  assert.equal(f('rules:low_compliance').count, 1);
  assert.equal(f('timing:after_loss').count, 1); assert.equal(f('timing:after_loss').confidence, 'low'); assert.deepEqual(f('timing:after_loss').tradeIds, [2]);
  assert.equal(f('limit:overtrading'), undefined); assert.ok(d.needsInfo.some(n => n.id === 'overtrading')); assert.ok(d.needsInfo.some(n => n.id === 'sl_moved'));
  near(f('tag:revenge').estCostR, -1);
});
test('errors: overtrading with user cap; over-risk needs riskPct; SL widened', () => {
  const tr = [T(1, '2026-01-05', '09:00', 1, { riskPct: 2, sl: '1990', slOriginal: '1995' }), T(2, '2026-01-05', '10:00', 1), T(3, '2026-01-05', '11:00', -1)];
  const d = E.detect(tr, { maxTradesPerDay: 2, maxRiskPct: 1 });
  assert.deepEqual(d.findings.find(x => x.id === 'limit:overtrading').tradeIds, [3]);
  assert.equal(d.findings.find(x => x.id === 'limit:over_risk').count, 1);
  assert.equal(d.findings.find(x => x.id === 'data:sl_widened').count, 1);   // buy: SL moved lower = further from entry
  assert.ok(d.needsInfo.some(n => n.id === 'over_risk_partial'));
});

test('quality: weights sum to 100, score independent of profit/loss, missing components renormalised', () => {
  assert.equal(Object.values(Q.WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const base = [T(1, '2026-01-05', '10:00', 5, { setup: 'x', note: 'n', entry: '1', sl: '0.9', exit: '1.2', ruleCompliance: 100 })];
  const flipped = [Object.assign({}, base[0], { r: '-5', usd: '-999' })];
  assert.deepEqual(Q.score(base).components, Q.score(flipped).components); assert.equal(Q.score(base).overall, Q.score(flipped).overall);
  const none = Q.score([]); assert.equal(none.overall, null); assert.equal(none.coverage, 0);
  const partial = Q.score([{ id: 1, date: 'd' }]); assert.equal(partial.components.ruleAdherence.score, null); assert.ok(partial.coverage < 1 && partial.overall !== null);
});

test('migrate: additive, idempotent, non-mutating, rollback exact, too-new refused', () => {
  const v1 = { trades: [{ id: 1, date: '2026-01-01', symbol: 'EURUSD', note: 'keep me' }], psych: [1, 2, 3], riskLimits: { a: 1 } };
  const snapshot = JSON.stringify(v1);
  const m = M.migrateState(v1);
  assert.equal(JSON.stringify(v1), snapshot);                                   // input untouched
  assert.equal(m.changed, true); assert.equal(m.state.schemaVersion, 2); assert.equal(m.state.trades[0].note, 'keep me');
  assert.deepEqual(m.state.psych, [1, 2, 3]); assert.ok(Array.isArray(m.state.trades[0].tags)); assert.equal(m.state.trades[0].riskPct, null);
  const again = M.migrateState(m.state); assert.equal(again.changed, false); assert.deepEqual(again.state, m.state);   // idempotent
  assert.equal(JSON.stringify(M.rollback(M.createBackup(v1, '2026-10-22T00:00:00Z'))), snapshot);
  assert.equal(M.migrateState({ schemaVersion: 99 }).tooNew, true);
  assert.throws(() => M.rollback({ kind: 'x' }));
});

// ---------- importer ----------
const I = require('../js/core/importer.js');
test('importer.parseCSV: quotes, embedded delimiter/newline, BOM, CRLF, ; delimiter', () => {
  const r = I.parseCSV('\uFEFFa;b;c\r\n1;"x;y";"line1\nline2"\r\n2;"q""uote";z\r\n');
  assert.equal(r.delimiter, ';'); assert.equal(r.rows.length, 3);
  assert.deepEqual(r.rows[1], ['1', 'x;y', 'line1\nline2']); assert.equal(r.rows[2][1], 'q"uote');
  assert.equal(I.parseCSV('a,b\n"oops,1').unterminatedQuote, true);
});
test('importer.suggestMapping: MT5-style duplicate Time/Price and separate Date+Time', () => {
  const m = I.suggestMapping(['Time', 'Position', 'Symbol', 'Type', 'Volume', 'Price', 'S / L', 'T / P', 'Time', 'Price', 'Commission', 'Swap', 'Profit']);
  assert.equal(m.date, 0); assert.equal(m.extId, 1); assert.equal(m.entry, 5); assert.equal(m.exit, 9); assert.equal(m.sl, 6); assert.equal(m.usd, 12);
  const m2 = I.suggestMapping(['Date', 'Time', 'Symbol', 'Side']); assert.equal(m2.date, 0); assert.equal(m2.time, 1);
});
test('importer.parseDateTime: MT5 format ok; ambiguous needs format; Jalali/invalid rejected', () => {
  assert.deepEqual(I.parseDateTime('2026.03.04 09:05:33'), { date: '2026-03-04', time: '09:05' });
  assert.ok(I.parseDateTime('03/04/2026').error.includes('مبهم'));
  assert.deepEqual(I.parseDateTime('03/04/2026', 'dmy'), { date: '2026-04-03', time: '' });
  assert.deepEqual(I.parseDateTime('03/04/2026', 'mdy'), { date: '2026-03-04', time: '' });
  assert.ok(I.parseDateTime('1405/01/10').error.includes('شمسی')); assert.ok(I.parseDateTime('2026-02-30').error); assert.ok(I.parseDateTime('').error);
});
const CSV = 'Date,Time,Symbol,Type,Price,SL,Price,Profit,Ticket,Comment\n' +
  '2026-03-04,09:05,xauusd,buy,2000,1990,2020,200,T1,good\n' +
  '2026-03-04,10:00,EURUSD,sell,1.1000,1.1050,1.0900,50,T2,\n' +      // R = (1.1-1.09)/0.005 = 2
  '2026-03-04,10:00,EURUSD,sell,1.1000,1.1050,1.0900,50,T2,\n' +      // duplicate inside file
  '2026-03-05,,GBPUSD,hold,1.3,,,,T3,\n' +                            // bad direction
  '2026-03-06,08:00,,buy,1,,,,T4,\n' +                                // no symbol
  '2026-03-07,08:00,USD,balance,,,,1000,T5,\n';                       // non-trade row
test('importer.preview: ok/duplicate/error/skipped counts, computed R, uppercase symbol, line numbers', () => {
  const p = I.preview(CSV, null, [{ id: 9, date: '2026-03-06', time: '08:00', symbol: 'X', dir: 'buy', extId: 'ZZ' }]);
  assert.deepEqual(p.counts, { ok: 2, error: 2, duplicate: 1, skipped: 1 });
  const ok = p.rows.filter(r => r.status === 'ok'); assert.equal(ok[0].trade.symbol, 'XAUUSD'); assert.equal(ok[0].trade.r, '2'); assert.equal(ok[1].trade.r, '2');
  assert.ok(ok[1].issues.some(x => x.includes('محاسبه'))); assert.equal(p.rows.find(r => r.status === 'duplicate').line, 4); assert.equal(p.rows.find(r => r.status === 'error' && r.line === 5).issues[0].includes('جهت'), true);
});
test('importer: duplicates against existing journal, commit stamps batch ids, undo removes exactly the batch', () => {
  const first = I.preview(CSV, null, []); let n = 100; const added = I.commit(first, 'b1', () => ++n);
  assert.equal(added.length, 2); assert.ok(added.every(t => t.importBatch === 'b1' && t.id > 100));
  const existing = [{ id: 1, date: '2026-01-01', symbol: 'A', dir: 'buy' }].concat(added);
  const again = I.preview(CSV, null, existing); assert.equal(again.counts.ok, 0); assert.equal(again.counts.duplicate, 3);
  const u = I.undoImport(existing, 'b1'); assert.equal(u.removed, 2); assert.equal(u.trades.length, 1);
});
test('importer: missing required column reported; netOfCosts only when asked; empty file', () => {
  assert.ok(I.preview('a,b\n1,2', null, []).fileErrors.some(e => e.includes('date')));
  assert.ok(I.preview('', null, []).fileErrors.length === 1);
  const h = 'Time,Symbol,Type,Profit,Commission,Swap\n2026.03.04 10:00,EURUSD,buy,100,-7,-3\n';
  assert.equal(I.preview(h, null, []).rows[0].trade.usd, '100'); assert.equal(I.preview(h, null, [], { netOfCosts: true }).rows[0].trade.usd, '90');
});

// ---------- riskstate + propguard USD limits ----------
const RS = require('../js/core/riskstate.js');
test('riskstate: loss streak, trades after loss, risk jump, adherence drop — each with evidence; none when data missing', () => {
  const mk = (i, day, r, extra) => Object.assign({ id: i, date: day, time: '1' + (i % 10) + ':00', r: String(r) }, extra || {});
  const tr = [mk(1, '2026-02-01', 1), mk(2, '2026-02-02', -1), mk(3, '2026-02-02', -1), mk(4, '2026-02-02', -1), mk(5, '2026-02-02', -1), mk(6, '2026-02-02', -1)];
  const r = RS.evaluate(tr); const ids = r.alerts.map(a => a.id);
  assert.ok(ids.includes('loss_streak')); assert.ok(ids.includes('trades_after_loss'));
  assert.equal(r.alerts.find(a => a.id === 'loss_streak').value, 5); assert.deepEqual(r.alerts.find(a => a.id === 'loss_streak').tradeIds, [2, 3, 4, 5, 6]);
  assert.ok(!ids.includes('risk_jump') && !ids.includes('adherence_drop'));      // no riskPct / compliance data -> no invented alerts
  const rj = []; for (let i = 1; i <= 6; i++) rj.push(mk(i, '2026-03-0' + i, 1, { riskPct: i < 6 ? 1 : 2, ruleCompliance: 100 }));
  assert.equal(RS.evaluate(rj).alerts.find(a => a.id === 'risk_jump').value, 2);
  const ad = []; for (let i = 1; i <= 10; i++) ad.push(mk(i, '2026-03-' + String(i).padStart(2, '0'), 1, { ruleCompliance: i <= 5 ? 100 : 60 }));
  assert.equal(RS.evaluate(ad).alerts.find(a => a.id === 'adherence_drop').value, 40);
  assert.equal(RS.evaluate([]).status, 'no_alert'); assert.equal(RS.evaluate([mk(1, '2026-01-01', -1)]).alerts.length, 0);
});
test('propguard: absolute USD limits equal the same percentage limits', () => {
  const tr = [{ date: 'd', usd: '-400' }];
  const a = P.evaluate({ balance: 10000, dailyLossUsd: 500, totalLossUsd: 1000, profitTargetUsd: 800 }, tr, 'd');
  const b = P.evaluate({ balance: 10000, dailyLossPct: 5, totalLossPct: 10, profitTargetPct: 8 }, tr, 'd');
  assert.deepEqual(a.rules, b.rules); assert.equal(a.rules.dailyLoss.state, 'warn');
});

// ---------- strategykb ----------
const K = require('../js/core/strategykb.js');
let _id = 0; const gid = () => 'r' + (++_id);
const NOW = (date, time) => ({ date, time: time || '09:00', iso: date + 'T' + (time || '09:00') + ':00Z' });
test('strategykb: proposals are not official; approval needs a reason and creates a frozen version', () => {
  let kb = K.emptyKB();
  assert.ok(K.propose(kb, { text: '', kind: 'confirmed' }, NOW('2026-01-01'), gid).error);
  assert.ok(K.propose(kb, { text: 'x', kind: 'bogus' }, NOW('2026-01-01'), gid).error);
  const p = K.propose(kb, { text: 'ورود فقط پس از تأیید ساختار', kind: 'confirmed', strategy: 'اردربلاک' }, NOW('2026-01-01'), gid); kb = p.kb;
  assert.equal(kb.rules[0].status, 'proposed'); assert.equal(kb.versions.length, 0);
  assert.ok(K.approve(kb, p.id, '   ', NOW('2026-01-02')).error);
  const a = K.approve(kb, p.id, 'تأیید اولیه', NOW('2026-01-02')); kb = a.kb;
  assert.equal(kb.rules[0].status, 'official'); assert.equal(kb.versions.length, 1); assert.deepEqual(kb.versions[0].diff.added, [p.id]);
  assert.ok(K.approve(kb, p.id, 'again', NOW('2026-01-03')).error);   // already official
});
test('strategykb: hypotheses can never be approved; rejected proposals leave no version', () => {
  const p = K.propose(K.emptyKB(), { text: 'فرضیه', kind: 'hypothesis' }, NOW('2026-01-01'), gid);
  assert.ok(K.approve(p.kb, p.id, 'x', NOW('2026-01-02')).error.includes('فرضیه'));
  const r = K.reject(p.kb, p.id, NOW('2026-01-02')); assert.equal(r.kb.rules[0].status, 'rejected'); assert.equal(r.kb.versions.length, 0);
});
test('strategykb: revise/retire keep history; old snapshots are frozen; versionAt picks the version valid at trade time', () => {
  let kb = K.emptyKB(); const p = K.propose(kb, { text: 'ریسک هر معامله یک درصد', kind: 'mandatory', param: { key: 'risk', value: '1' } }, NOW('2026-01-01'), gid);
  kb = K.approve(p.kb, p.id, 'v1', NOW('2026-01-10', '08:00')).kb;
  const rv = K.revise(kb, p.id, { text: 'ریسک هر معامله نیم درصد', param: { key: 'risk', value: '0.5' } }, 'کاهش ریسک', NOW('2026-02-01', '12:00'), gid); kb = rv.kb;
  assert.equal(kb.versions.length, 2); assert.equal(kb.versions[0].snapshot[0].text, 'ریسک هر معامله یک درصد');   // v1 untouched
  assert.equal(kb.rules.find(r => r.id === p.id).status, 'retired'); assert.equal(kb.rules.find(r => r.id === rv.id).supersedes, p.id);
  assert.equal(K.versionAt(kb, { date: '2026-01-05' }).version, null);
  assert.equal(K.versionAt(kb, { date: '2026-01-20' }).version.n, 1); assert.equal(K.versionAt(kb, { date: '2026-02-02' }).version.n, 2);
  assert.equal(K.versionAt(kb, { date: '2026-02-01', time: '11:59' }).version.n, 1); assert.equal(K.versionAt(kb, { date: '2026-02-01', time: '12:00' }).version.n, 2);
  const amb = K.versionAt(kb, { date: '2026-02-01' }); assert.equal(amb.ambiguous, true); assert.equal(amb.version.n, 1);
  const rt = K.rulesForTrade(kb, { date: '2026-01-20', setup: 'x' }); assert.equal(rt.rules.length, 1); assert.equal(rt.rules[0].text, 'ریسک هر معامله یک درصد');
  kb = K.retire(kb, rv.id, 'دیگر استفاده نمی‌شود', NOW('2026-03-01')).kb; assert.equal(kb.versions.length, 3); assert.equal(kb.versions[2].snapshot.length, 0);
  assert.ok(K.retire(kb, rv.id, 'x', NOW('2026-03-02')).error);
});
test('strategykb: strategy scoping in rulesForTrade; conflicts: duplicate, param mismatch, low-confidence negation', () => {
  let kb = K.emptyKB(); const add = (f) => { const p = K.propose(kb, f, NOW('2026-01-01'), gid); kb = p.kb; return p.id; };
  const a = add({ text: 'ورود فقط در سشن لندن', kind: 'confirmed', strategy: 'A' }), b = add({ text: 'ورود فقط در سشن لندن', kind: 'confirmed', strategy: 'A' });
  const c = add({ text: 'حد ضرر', kind: 'mandatory', param: { key: 'RR', value: '2' } }), d = add({ text: 'نسبت سود به زیان', kind: 'mandatory', param: { key: 'rr', value: '3' } });
  const e = add({ text: 'باید معامله بدون خبر انجام شود', kind: 'confirmed' }), f = add({ text: 'نباید معامله بدون خبر انجام شود', kind: 'confirmed' });
  const g = add({ text: 'قانون دیگر', kind: 'confirmed', strategy: 'B' });
  const cs = K.conflicts(kb); const has = (x, y, t) => cs.some(q => q.a === x && q.b === y && q.type === t);
  assert.ok(has(a, b, 'duplicate')); assert.ok(has(c, d, 'param_mismatch')); assert.ok(has(e, f, 'negation'));
  assert.equal(cs.find(q => q.type === 'negation').confidence, 'low'); assert.ok(!cs.some(q => q.a === a && q.b === g));   // different strategies are not compared
  kb = K.approve(kb, a, 'ok', NOW('2026-01-02')).kb; kb = K.approve(kb, g, 'ok', NOW('2026-01-02')).kb;
  assert.equal(K.rulesForTrade(kb, { date: '2026-01-05', setup: 'A' }).rules.length, 1); assert.equal(K.rulesForTrade(kb, { date: '2026-01-05', setup: 'B' }).rules[0].text, 'قانون دیگر');
});
test('strategykb: legacy import creates proposals only, dedupes, unclassified -> hypothesis', () => {
  const meta = t => ({ 'الف': 'confirmed', 'ب': 'mandatory' }[t] || 'unclassified');
  const r = K.importLegacy(K.emptyKB(), ['الف', 'ب', 'ج', 'الف'], meta, NOW('2026-01-01'), gid);
  assert.equal(r.added, 3); assert.equal(r.skipped, 1); assert.ok(r.kb.rules.every(x => x.status === 'proposed')); assert.equal(r.kb.rules.find(x => x.text === 'ج').kind, 'hypothesis'); assert.equal(r.kb.versions.length, 0);
  assert.equal(K.evolution(r.kb).length, 0);
});

// ---------- pretrade gate ----------
const G = require('../js/core/pretrade.js');
test('pretrade: complete valid trade within user limits -> allowed; RR computed; undefined limits are info only', () => {
  const r = G.evaluate({ trade: { dir: 'buy', entry: '2000', sl: '1990', tp: '2030', riskPct: '0.5' }, cfg: { maxRiskPct: 1, minRR: 2, maxTradesPerDay: 3 }, tradesToday: 1, hasStrategy: true, rules: [{ id: 'a', text: 'قانون', kind: 'mandatory' }], ticked: ['a'] });
  assert.equal(r.verdict, 'allowed'); assert.equal(r.rr, 3); assert.ok(r.disclaimer.includes('تضمین'));
  const n = G.evaluate({ trade: { dir: 'sell', entry: '1', sl: '1.1', tp: '0.8' }, cfg: {}, hasStrategy: false });
  assert.equal(n.verdict, 'allowed'); assert.ok(n.reasons.filter(x => x.level === 'info').length >= 4);   // nothing invented
});
test('pretrade: missing fields => needs_info; wrong-side SL/TP, risk over cap, mandatory unticked, breached guard, trade cap => blocked', () => {
  assert.equal(G.evaluate({ trade: { dir: 'buy', entry: '1' }, cfg: {} }).verdict, 'needs_info');
  assert.equal(G.evaluate({ trade: { dir: 'buy', entry: '100', sl: '101', tp: '110' }, cfg: {} }).verdict, 'blocked');
  assert.equal(G.evaluate({ trade: { dir: 'sell', entry: '100', sl: '101', tp: '102' }, cfg: {} }).verdict, 'blocked');
  const base = { trade: { dir: 'buy', entry: '100', sl: '99', tp: '103', riskPct: '2' }, hasStrategy: true };
  assert.ok(G.evaluate(Object.assign({}, base, { cfg: { maxRiskPct: 1 } })).reasons.some(x => x.ref === 'riskPct' && x.level === 'block'));
  assert.equal(G.evaluate(Object.assign({}, base, { cfg: { minRR: 4 } })).verdict, 'blocked');
  assert.equal(G.evaluate(Object.assign({}, base, { rules: [{ id: 'm', text: 'x', kind: 'mandatory' }], ticked: [] })).verdict, 'blocked');
  const soft = G.evaluate(Object.assign({}, base, { rules: [{ id: 'c', text: 'x', kind: 'confirmed' }, { id: 'p', text: 'y', kind: 'preference' }], ticked: [] })); assert.equal(soft.verdict, 'allowed'); assert.ok(soft.reasons.some(x => x.level === 'warn'));
  assert.equal(G.evaluate(Object.assign({}, base, { guard: { rules: { dailyLoss: { state: 'breach' } } } })).verdict, 'blocked');
  const w = G.evaluate(Object.assign({}, base, { guard: { rules: { dailyLoss: { state: 'warn', usedFrac: 0.85 } } } })); assert.equal(w.verdict, 'allowed'); assert.ok(w.reasons.some(x => x.level === 'warn' && x.text.includes('85')));
  assert.equal(G.evaluate(Object.assign({}, base, { cfg: { maxTradesPerDay: 2 }, tradesToday: 2 })).verdict, 'blocked');
  assert.ok(G.evaluate(Object.assign({}, base, { cfg: { maxRiskPct: 1 }, trade: { dir: 'buy', entry: '100', sl: '99', tp: '103' } })).reasons.some(x => x.ref === 'riskPct' && x.level === 'missing'));
});

// ---------- i18n dictionary integrity (fa / en / de) ----------
test('i18n: fa/en/de have identical key sets, identical {placeholders}, no empty values; V9T falls back safely', () => {
  const vm = require('node:vm'), fs = require('node:fs'), ctx = { window: {}, document: undefined };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../js/i18n/v9.js', 'utf8'), ctx);
  const d = ctx.AREX_V9_I18N, ph = s => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
  assert.deepEqual(Object.keys(d.en).sort(), Object.keys(d.fa).sort()); assert.deepEqual(Object.keys(d.de).sort(), Object.keys(d.fa).sort());
  for (const k of Object.keys(d.fa)) for (const l of ['fa', 'en', 'de']) { assert.ok(d[l][k] && d[l][k].trim(), l + ':' + k + ' is empty'); assert.equal(ph(d[l][k]), ph(d.fa[k]), 'placeholders differ in ' + l + ':' + k); }
  assert.equal(ctx.V9T('a.noData'), 'داده ناکافی');                       // default language fa (no state)
  assert.equal(ctx.V9T('no.such.key'), 'no.such.key');                     // never throws, returns the key
  assert.equal(ctx.V9T('a.ofTotal', { n: 5 }), 'از 5 معامله در فیلتر'); assert.equal(ctx.V9T('a.ofTotal'), 'از {n} معامله در فیلتر');
  assert.ok(Object.keys(d.fa).length >= 300);
});
