'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tc = require('../js/core/tradecalc.js');
const L = require('../js/core/ledger.js');
const Q = require('../js/core/quant.js');
const M = require('../js/core/mt5.js');

test('tradecalc: planned RR, realized R against original SL, partial closes and fees', () => {
  assert.equal(tc.plannedRR({ dir: 'buy', entry: 100, sl: 99, tp: 102.5 }), 2.5);
  assert.equal(tc.plannedRR({ dir: 'sell', entry: 100, sl: 101, tp: 98 }), 2);
  assert.equal(tc.plannedRR({ dir: 'buy', entry: 100, sl: 101, tp: 102 }), null);          // SL on the wrong side
  assert.equal(tc.realizedR({ dir: 'buy', entry: 100, sl: 100, slOriginal: 99, exit: 101.5 }), 1.5);
  const t = { dir: 'buy', entry: '1.1000', sl: '1.0950', partials: [{ price: 1.105, lots: 0.5 }, { price: 1.11, lots: 0.5 }] };
  assert.equal(tc.weightedExit(t.partials).price, 1.1075);
  assert.equal(tc.realizedR(t), 1.5);
  assert.equal(tc.netUsd(100, -7, -1.5), 91.5);
});

test('tradecalc.enrich fills blanks but never overwrites what the user typed', () => {
  const e = tc.enrich({ symbol: 'EURUSD', dir: 'buy', entry: '1.1000', sl: '1.0950', tp: '1.1100', exit: '1.1050', lots: '0.5', commission: '-3.5', swap: '0' });
  assert.equal(e.plannedRR, 2); assert.equal(e.r, '1'); assert.equal(e.gross, '250'); assert.equal(e.usd, '246.5'); assert.equal(e.rAuto, true);
  const keep = tc.enrich({ symbol: 'EURUSD', dir: 'buy', entry: '1.1', sl: '1.095', exit: '1.105', r: '0.8', gross: '10', lots: '1' });
  assert.equal(keep.r, undefined); assert.equal(keep.gross, undefined);
  assert.equal(tc.estimateUsd({ symbol: 'XAUUSD', dir: 'sell', entry: 2000, exit: 1990, lots: 0.1 }), 100);
  assert.equal(tc.estimateUsd({ symbol: 'EURGBP', dir: 'buy', entry: 1, exit: 2, lots: 1 }), null);   // unknown contract: no guess
});

test('ledger: real balance, flow-adjusted drawdown and per-account separation', () => {
  const v = L.ensure({}, { balance: 1000 }); v.accounts.push({ id: 'p1', name: 'Prop 10k', type: 'prop', start: 10000, createdAt: '2026-01-01' });
  v.ledger.push({ id: 'l1', accountId: 'acc_main', date: '2026-02-01', type: 'deposit', amount: 500 }, { id: 'l2', accountId: 'acc_main', date: '2026-03-01', type: 'withdraw', amount: 300 });
  const trades = [{ id: 1, date: '2026-02-02', usd: '200' }, { id: 2, date: '2026-02-03', usd: '-100' }, { id: 3, date: '2026-02-04', usd: '50', accountId: 'p1' }];
  const all = L.all(v, trades), main = all.find(a => a.id === 'acc_main'), prop = all.find(a => a.id === 'p1');
  assert.equal(main.balance, 1000 + 500 - 300 + 100); assert.equal(main.deposits, 500); assert.equal(main.withdrawals, 300); assert.equal(main.maxDD, 100);
  assert.equal(prop.balance, 10050); assert.equal(prop.trades, 1);
  assert.equal(L.combined(v, trades).pop().balance, 1300 + 10050);
});

test('quant: ratios need data; Monte-Carlo is deterministic, respects risk and flags ruin', () => {
  const mk = (rs) => rs.map((r, i) => ({ r: String(r), usd: String(r * 100), date: '2026-01-' + String(i % 28 + 1).padStart(2, '0'), time: '10:00' }));
  assert.equal(Q.ratios(mk([1, -1]), 10000).insufficient, true);
  const good = mk([2, -1, 1.5, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 2, -1, 1.5, -1, 2, -1, 1, -1, 2, -1]);
  const r = Q.ratios(good, 10000); assert.ok(r.sharpeR > 0 && r.sortinoR > 0 && r.maxDDR >= 1);
  const a = Q.monteCarlo(good, { riskPct: 1, trials: 800 }), b = Q.monteCarlo(good, { riskPct: 1, trials: 800 });
  assert.deepEqual(a, b); assert.ok(a.profitProb > 80); assert.ok(a.fan.length > 10);
  const risky = Q.monteCarlo(mk([-1, -1, -1, 1, -1, 0.5, -1, -1, 1, -1, -1, -1, 1, -1, -1, 2, -1, -1, -1, -1, 1]), { riskPct: 10, trials: 800 });
  assert.ok(risky.ruinProb > 40, 'losing system at 10% risk must show high ruin probability');
  assert.equal(Q.monteCarlo(mk([1, -1]), {}).insufficient, true);
});

test('quant.maeMfe: suggests stop from winners MAE and measures captured MFE', () => {
  const t = [1, 2, 3, 1.5, 2.5, -1].map((r, i) => ({ r: String(r), mae: String(0.3 + i * 0.1), mfe: String(Math.max(r, 0) + 1) }));
  const m = Q.maeMfe(t); assert.ok(m.slSuggestionR > 0.3 && m.captureWin < 100 && m.leftOnTableR > 0);
  assert.equal(Q.maeMfe([{ r: '1' }]).insufficient, true);
});

test('mt5: parses MT5 positions, MT4 statements and generic CSV; dedupes by ticket; converts to trades', () => {
  const row = c => '<tr>' + c.map(x => '<td>' + x + '</td>').join('') + '</tr>';
  const mt5 = '<table>' + row(['Time', 'Position', 'Symbol', 'Type', 'Volume', 'Price', 'S / L', 'T / P', 'Time', 'Price', 'Commission', 'Swap', 'Profit']) +
    row(['2026.10.27 08:15:01', '55011223', 'EURUSD', 'buy', '0.50', '1.10000', '1.09500', '1.11000', '2026.10.27 11:40:30', '1.10500', '-3.50', '0.00', '250.00']) +
    row(['2026.10.27 12:00:00', '55011224', 'XAUUSD', 'sell', '0.10', '2 000.50', '2 010.00', '1 980.00', '2026.10.27 13:00:00', '1 990.50', '-0.70', '-0.10', '100.00']) + '</table>';
  const d = M.parse(mt5); assert.equal(d.length, 2); assert.equal(d[0].lots, 0.5); assert.equal(d[1].entry, 2000.5);
  const t = M.toTrade(d[0], { accountId: 'acc_main' });
  assert.equal(t.symbol, 'EURUSD'); assert.equal(t.date, '2026-10-27'); assert.equal(t.r, '1'); assert.equal(t.usd, '246.5'); assert.equal(t.ticket, '55011223');
  const mt4 = '<table>' + row(['Ticket', 'Open Time', 'Type', 'Size', 'Item', 'Price', 'S / L', 'T / P', 'Close Time', 'Price', 'Commission', 'Taxes', 'Swap', 'Profit']) + row(['123456', '2026.10.01 09:00:00', 'sell', '1.00', 'gbpusd', '1.3000', '1.3050', '1.2900', '2026.10.01 10:00:00', '1.2950', '-7.00', '0.00', '-1.00', '500.00']) + '</table>';
  assert.equal(M.parse(mt4)[0].symbol, 'gbpusd'); assert.equal(M.toTrade(M.parse(mt4)[0], {}).r, '1');
  const csv = 'Ticket,Open Time,Type,Volume,Symbol,Price,S/L,T/P,Close Time,Price,Commission,Swap,Profit\n777,2026.10.02 10:00:00,buy,0.2,USDJPY,150.00,149.50,151.00,2026.10.02 12:00:00,150.80,-1,0,160\n';
  assert.equal(M.parse(csv)[0].ticket, '777');
  assert.equal(M.toNumber('1 234,56'), 1234.56); assert.equal(M.key('a', { ticket: 5 }), 'a:5');
  assert.deepEqual(M.parse('nothing useful'), []);
});

const BH = require('../js/core/behavior.js');
test('behavior.audit: flags only what is machine-checkable, cites sections, marks open conflicts as decisions', () => {
  const t = (o) => Object.assign({ id: Math.random(), date: '2026-10-27', time: '09:00', dir: 'buy', entry: '100', sl: '99', tp: '102', r: '-1', usd: '-10', symbol: 'X', mistakes: [] }, o);
  const trades = [t({ time: '09:00' }), t({ time: '09:40' }), t({ time: '10:20' }), t({ time: '11:00', sl: '', slOriginal: '' }), t({ time: '11:30', slOriginal: '99.5', sl: '98.5', riskPct: 2, plannedRR: 1.2 })];
  const a = BH.audit(trades, { balanceOf: () => 200 });
  const rules = a.items.map(i => i.rule);
  assert.ok(rules.includes('NO_SL') && rules.includes('SL_WIDENED') && rules.includes('RISK_CAP') && rules.includes('LOW_RR'));
  assert.ok(a.items.find(i => i.rule === 'LOSS_STREAK_STOP' && i.level === 'decision'), 'the 2-3 losses rule is an open conflict (K4)');
  assert.ok(a.items.find(i => i.rule === 'LOSS_STREAK_STOP' && i.level === 'violation'), 'after 3 straight losses it is a violation');
  assert.ok(a.items.find(i => i.rule === 'DAY_LOSS_STOP'), '3% daily loss on a 200$ balance');
  assert.ok(a.items.every(i => /^§\d+\.\d+$/.test(i.source)));
  assert.equal(BH.audit([t({ riskPct: 0.5 })], {}).summary.violations, 0);
  assert.ok(BH.audit(trades, { decisions: { K4: { text: 'x' } }, balanceOf: () => 200 }).items.find(i => i.rule === 'LOSS_STREAK_STOP' && i.level === 'info'));
});

test('behavior.analyze: revenge trades, SL widening and a bad hour are reported with numbers', () => {
  const mk = (i, o) => Object.assign({ id: i, date: '2026-10-' + String(1 + (i % 20)).padStart(2, '0'), time: '10:00', dir: 'buy', entry: '100', sl: '99', r: '-1', usd: '-10', lots: 0.1 }, o);
  const trades = []; for (let d = 1; d <= 6; d++) { const dd = '2026-10-' + String(d).padStart(2, '0'); trades.push(mk(d * 10, { date: dd, time: '10:00', closedAt: dd + 'T10:10:00' }), mk(d * 10 + 1, { date: dd, time: '10:15', lots: 0.3, r: '-1', usd: '-30' })); }
  trades.push(mk(900, { slOriginal: '99', sl: '98', date: '2026-10-09' }));
  const r = BH.analyze(trades, {}); assert.ok(r.revenge.length >= 6 && r.revenge[0].biggerLot); assert.equal(r.widened, 1); assert.ok(r.insights.some(x => /🔁/.test(x)) && r.insights.some(x => /SL/.test(x)));
});

const MG = require('../js/core/merge.js');
test('merge: two devices union their trades, the newer edit wins, deletions are not resurrected, local prefs stay', () => {
  const T = (id, o) => Object.assign({ id, date: '2026-10-0' + (id % 9 + 1), symbol: 'EURUSD', r: '1', usd: '100' }, o);
  const assistant = (v98) => JSON.stringify({ workspaceState: { v98 } });
  const A = { trades: JSON.stringify([T(1), T(2, { r: '1', updatedAt: '2026-10-05T10:00:00Z', note: 'old' }), T(3)]), settings: JSON.stringify({ theme: 'dark', lang: 'fa' }), assistantState: assistant({ accounts: [{ id: 'acc_main', name: 'A' }], deleted: { trades: { 3: '2026-10-06T00:00:00Z' } }, ledger: [{ id: 'l1', amount: 5 }] }), 'tradeshot:1:entry': 'dataA' };
  const B = { trades: JSON.stringify([T(2, { updatedAt: '2026-10-07T10:00:00Z', note: 'new', r: '2' }), T(3), T(4)]), settings: JSON.stringify({ theme: 'light', extra: 1 }), assistantState: assistant({ accounts: [{ id: 'acc_main', name: 'A' }, { id: 'acc_prop', name: 'P' }], ledger: [{ id: 'l2', amount: 7 }], deleted: {} }), 'tradeshot:4:entry': 'dataB' };
  const { data, report } = MG.mergeAll(A, B), trades = JSON.parse(data.trades);
  assert.deepEqual(trades.map(t => t.id).sort(), [1, 2, 4]);                 // 3 was deleted on A -> stays deleted
  assert.equal(trades.find(t => t.id === 2).note, 'new'); assert.equal(trades.find(t => t.id === 2).r, '2');
  const v = JSON.parse(data.assistantState).workspaceState.v98; assert.equal(v.accounts.length, 2); assert.equal(v.ledger.length, 2); assert.ok(v.deleted.trades['3']);
  const st = JSON.parse(data.settings); assert.equal(st.theme, 'dark'); assert.equal(st.extra, 1);   // local value wins, missing keys are filled
  assert.equal(data['tradeshot:1:entry'], 'dataA'); assert.equal(data['tradeshot:4:entry'], 'dataB');
  assert.ok(report.added >= 1 && report.updated >= 1);
  assert.deepEqual(MG.mergeAll(A, A).data.trades, A.trades);                  // merging with itself changes nothing
});
test('merge: a stale device cannot erase newer trades (both directions give the same set)', () => {
  const a = { trades: JSON.stringify([{ id: 1 }, { id: 2 }]) }, b = { trades: JSON.stringify([{ id: 2 }, { id: 3 }]) };
  const ab = JSON.parse(MG.mergeAll(a, b).data.trades).map(t => t.id).sort(), ba = JSON.parse(MG.mergeAll(b, a).data.trades).map(t => t.id).sort();
  assert.deepEqual(ab, [1, 2, 3]); assert.deepEqual(ba, [1, 2, 3]);
});

const PR = require('../js/core/prop.js');
test('prop: daily and max drawdown, trailing floor, target progress and trading days', () => {
  const acc = { start: 10000, propRules: Object.assign({}, PR.TEMPLATES.challenge10, { startDate: '' }) }, now = new Date(2026, 9, 27, 12);
  const tr = (d, usd) => ({ date: d, time: '10:00', usd: String(usd) });
  let c = PR.compute(acc, [tr('2026-10-25', 300), tr('2026-10-26', 400), tr('2026-10-27', -200)], [], now);
  assert.equal(c.balance, 10500); assert.equal(c.rules.dailyLoss.limitUsd, 500); assert.equal(c.rules.dailyLoss.usedUsd, 200); assert.equal(c.rules.dailyLoss.remainingUsd, 300); assert.equal(c.rules.dailyLoss.state, 'ok');
  assert.equal(c.target.usd, 1000); assert.equal(c.target.progress, .5); assert.equal(c.days.count, 3); assert.equal(c.days.ok, false); assert.equal(c.readyToPass, false);
  c = PR.compute(acc, [tr('2026-10-27', -400)], [], now); assert.equal(c.rules.dailyLoss.state, 'warn'); assert.equal(c.overall, 'warn');
  c = PR.compute(acc, [tr('2026-10-27', -500)], [], now); assert.equal(c.overall, 'breach');
  const trail = { start: 10000, propRules: Object.assign({}, PR.TEMPLATES.trailing) };
  c = PR.compute(trail, [tr('2026-10-20', 800), tr('2026-10-21', -500)], [], now); assert.equal(c.rules.totalLoss.type, 'trailing'); assert.equal(c.rules.totalLoss.usedUsd, 500); assert.equal(c.rules.totalLoss.floor, 10200);
  assert.equal(PR.compute({ start: 0, propRules: {} }, [], [], now).error != null, true); assert.equal(PR.compute({ start: 1 }, [], [], now), null);
});
