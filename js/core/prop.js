/* AREX V9.8.0 — core/prop: prop-firm rule tracking for an account (daily drawdown, max drawdown static/trailing, profit target, trading days).
   Templates are GENERIC examples — the trader must enter their own firm's exact rules. Based on closed-trade P&L (floating P&L is unknown). Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.prop = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const TEMPLATES = {
    challenge10: { label: 'چالش مرحله‌ی ۱ (نمونه): افت روزانه ۵٪، کل ۱۰٪، هدف ۱۰٪', dailyDDPct: 5, maxDDPct: 10, ddType: 'static', targetPct: 10, minDays: 4 },
    challenge5: { label: 'چالش مرحله‌ی ۲ (نمونه): افت روزانه ۵٪، کل ۱۰٪، هدف ۵٪', dailyDDPct: 5, maxDDPct: 10, ddType: 'static', targetPct: 5, minDays: 4 },
    funded: { label: 'حساب فاند (نمونه): افت روزانه ۵٪، کل ۱۰٪، بدون هدف', dailyDDPct: 5, maxDDPct: 10, ddType: 'static', targetPct: 0, minDays: 0 },
    trailing: { label: 'افت شناور (نمونه): روزانه ۴٪، کل ۶٪ از اوج', dailyDDPct: 4, maxDDPct: 6, ddType: 'trailing', targetPct: 8, minDays: 0 },
    custom: { label: 'سفارشی', dailyDDPct: 5, maxDDPct: 10, ddType: 'static', targetPct: 10, minDays: 0 }
  };
  const stamp = t => String(t.closedAt || (t.date + 'T' + (t.time || '00:00'))).slice(0, 16);
  const day = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /** acc: {start, propRules}; trades: this account's trades; ledger: this account's cash flows. */
  function compute(acc, trades, ledger, now) {
    const R = acc && acc.propRules; if (!R) return null; now = now || new Date(); const today = day(now), size = num(acc.start) || 0; if (!(size > 0)) return { error: 'موجودی اولیه حساب صفر است' };
    const ev = trades.filter(t => num(t.usd) !== null).sort((a, b) => stamp(a).localeCompare(stamp(b))), from = R.startDate ? String(R.startDate) : '';
    const inScope = from ? ev.filter(t => String(t.date) >= from) : ev;
    let bal = size, peak = size; inScope.forEach(t => { bal += num(t.usd); peak = Math.max(peak, bal); });
    const todayPnl = inScope.filter(t => t.date === today).reduce((a, t) => a + num(t.usd), 0), pnl = bal - size;
    const dLimit = size * (num(R.dailyDDPct) || 0) / 100, mLimit = size * (num(R.maxDDPct) || 0) / 100;
    const dUsed = Math.max(0, -todayPnl), dFrac = dLimit > 0 ? dUsed / dLimit : 0;
    const floor = R.ddType === 'trailing' ? Math.max(size - mLimit, peak - mLimit) : size - mLimit, mUsed = R.ddType === 'trailing' ? Math.max(0, peak - bal) : Math.max(0, size - bal), mFrac = mLimit > 0 ? mUsed / mLimit : 0;
    const target = size * (num(R.targetPct) || 0) / 100, days = new Set(inScope.map(t => t.date)).size, st = f => (f >= 1 ? 'breach' : f >= .7 ? 'warn' : 'ok');
    const rules = { dailyLoss: { state: st(dFrac), usedFrac: r2(dFrac, 3), usedUsd: r2(dUsed), limitUsd: r2(dLimit), remainingUsd: r2(Math.max(0, dLimit - dUsed)) },
      totalLoss: { state: st(mFrac), usedFrac: r2(mFrac, 3), usedUsd: r2(mUsed), limitUsd: r2(mLimit), remainingUsd: r2(Math.max(0, mLimit - mUsed)), floor: r2(floor), type: R.ddType === 'trailing' ? 'trailing' : 'static' } };
    const overall = rules.dailyLoss.state === 'breach' || rules.totalLoss.state === 'breach' ? 'breach' : rules.dailyLoss.state === 'warn' || rules.totalLoss.state === 'warn' ? 'warn' : 'ok';
    return { overall, rules, balance: r2(bal), pnl: r2(pnl), pnlPct: r2(pnl / size * 100, 2), target: { usd: r2(target), progress: target > 0 ? r2(Math.max(0, pnl) / target, 3) : null, reached: target > 0 && pnl >= target }, days: { count: days, min: num(R.minDays) || 0, ok: days >= (num(R.minDays) || 0) }, readyToPass: target > 0 && pnl >= target && days >= (num(R.minDays) || 0) && overall !== 'breach' };
  }
  return { TEMPLATES, compute };
});
