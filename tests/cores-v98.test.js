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
