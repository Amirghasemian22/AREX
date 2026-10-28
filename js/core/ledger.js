/* AREX V9.8.0 — core/ledger: accounts (demo/live/prop), deposits/withdrawals and real-balance equity curves. Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.ledger = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const TYPES = { demo: 'دمو', live: 'لایو', prop: 'پراپ' };
  const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function ensure(v98, riskLimits) {
    v98.accounts = Array.isArray(v98.accounts) ? v98.accounts : []; v98.ledger = Array.isArray(v98.ledger) ? v98.ledger : [];
    if (!v98.accounts.length) v98.accounts.push({ id: 'acc_main', name: 'حساب اصلی', type: 'live', currency: 'USD', start: num(riskLimits && riskLimits.balance) || 0, createdAt: new Date().toISOString() });
    if (!v98.accounts.some(a => a.id === v98.activeAccountId)) v98.activeAccountId = v98.accounts[0].id;
    return v98;
  }
  const accountOf = (t, v98) => (t.accountId && v98.accounts.some(a => a.id === t.accountId)) ? t.accountId : v98.accounts[0].id;
  const tradesOf = (trades, v98, accId) => trades.filter(t => accountOf(t, v98) === accId);
  const pnl = t => num(t.usd) || 0;
  const stamp = t => String(t.closedAt || (t.date + 'T' + (t.time || '00:00'))).slice(0, 16);

  /** Chronological events (trades + cash flows) with running balance. */
  function series(acc, trades, ledger) {
    const ev = [];
    trades.forEach(t => { if (num(t.usd) !== null) ev.push({ k: 'trade', at: stamp(t), pnl: pnl(t), id: t.id, symbol: t.symbol }); });
    ledger.filter(l => l.accountId === acc.id).forEach(l => ev.push({ k: l.type, at: String(l.date).slice(0, 10) + 'T00:00', flow: (l.type === 'withdraw' ? -1 : 1) * Math.abs(num(l.amount) || 0), id: l.id }));
    ev.sort((a, b) => a.at.localeCompare(b.at) || (a.k === 'trade' ? 1 : -1));
    let bal = num(acc.start) || 0, cap = bal, cum = 0, peak = cap, maxDD = 0, maxDDpct = 0;
    const pts = [{ at: (acc.createdAt || '').slice(0, 10), balance: r2(bal), k: 'start' }];
    ev.forEach(e => {
      if (e.k === 'trade') { bal += e.pnl; cum += e.pnl; } else { bal += e.flow; cap += e.flow; peak += e.flow; }   // a cash flow moves the peak too, so withdrawals never look like drawdowns
      const eq = cap + cum;                                   // flow-adjusted equity: drawdowns are not caused by withdrawals
      peak = Math.max(peak, eq); const dd = peak - eq; maxDD = Math.max(maxDD, dd); if (peak > 0) maxDDpct = Math.max(maxDDpct, dd / peak * 100);
      pts.push({ at: e.at, balance: r2(bal), equity: r2(eq), k: e.k, id: e.id });
    });
    return { points: pts, balance: r2(bal), pnl: r2(cum), maxDD: r2(maxDD), maxDDpct: r2(maxDDpct, 1) };
  }
  function summary(acc, trades, ledger) {
    const s = series(acc, trades, ledger), L = ledger.filter(l => l.accountId === acc.id);
    const dep = L.filter(l => l.type !== 'withdraw').reduce((a, l) => a + Math.abs(num(l.amount) || 0), 0), wd = L.filter(l => l.type === 'withdraw').reduce((a, l) => a + Math.abs(num(l.amount) || 0), 0);
    const base = (num(acc.start) || 0) + dep;
    return Object.assign({ id: acc.id, name: acc.name, type: acc.type, deposits: r2(dep), withdrawals: r2(wd), trades: trades.length, returnPct: base > 0 ? r2(s.pnl / base * 100, 1) : null }, s);
  }
  function all(v98, trades) { return v98.accounts.map(a => summary(a, tradesOf(trades, v98, a.id), v98.ledger)); }
  /** Combined curve across accounts (balances summed on a shared timeline). */
  function combined(v98, trades) {
    const per = v98.accounts.map(a => series(a, tradesOf(trades, v98, a.id), v98.ledger).points);
    const ats = [...new Set(per.flat().map(p => p.at))].sort(), last = per.map(() => 0);
    return ats.map(at => { per.forEach((pts, i) => { for (const p of pts) if (p.at <= at) last[i] = p.balance; }); return { at, balance: r2(last.reduce((x, y) => x + y, 0)) }; });
  }
  return { TYPES, uid, ensure, accountOf, tradesOf, series, summary, all, combined };
});
