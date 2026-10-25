/* AREX V9.6.3 — core/propguard: daily/total loss, profit target and trade-count guard. Pure.
   Uses only CLOSED-trade USD results entered in the journal. Floating (open) P/L is not known, so limits that
   prop firms compute on equity including open positions may be reached earlier than shown (reported in `notes`). */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.propguard = api; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  function level(used, warnAt) { return used >= 1 ? 'breach' : used >= warnAt ? 'warn' : 'ok'; }

  /** cfg: {balance, dailyLossPct|dailyLossUsd, totalLossPct|totalLossUsd, profitTargetPct|profitTargetUsd, maxTradesPerDay, warnAt=0.8, startDate?}
      Any missing rule is reported as 'needs_info' (never guessed). */
  function evaluate(cfg, trades, dateIso) {
    cfg = cfg || {};
    const warnAt = U.toNum(cfg.warnAt) || 0.8;
    const balance = U.toNum(cfg.balance);
    const all = (trades || []).filter(t => !cfg.startDate || String(t.date) >= cfg.startDate);
    let noUsd = 0, total = 0, today = 0, todayCount = 0;
    for (const t of all) {
      const u = U.toNum(t.usd);
      if (String(t.date) === dateIso) todayCount++;
      if (u === null) { noUsd++; continue; }
      total += u; if (String(t.date) === dateIso) today += u;
    }
    const res = { date: dateIso, balance, dailyPnl: U.round(today, 2), totalPnl: U.round(total, 2), equity: balance === null ? null : U.round(balance + total, 2), tradesToday: todayCount, rules: {}, notes: [] };
    const needs = k => ({ state: 'needs_info', missing: k });
    const pctOf = (usd, pct) => { const u = U.toNum(usd); if (u !== null && u > 0 && balance > 0) return u / balance * 100; return U.toNum(pct); };
    const dl = pctOf(cfg.dailyLossUsd, cfg.dailyLossPct), tl = pctOf(cfg.totalLossUsd, cfg.totalLossPct), pt = pctOf(cfg.profitTargetUsd, cfg.profitTargetPct), mt = U.toNum(cfg.maxTradesPerDay);
    if (balance === null || balance <= 0) {
      for (const k of ['dailyLoss', 'totalLoss', 'profitTarget']) res.rules[k] = needs('balance');
    } else {
      if (dl === null) res.rules.dailyLoss = needs('dailyLossPct'); else {
        const limit = balance * dl / 100, used = Math.max(0, -today) / limit;
        res.rules.dailyLoss = { state: level(used, warnAt), limitUsd: U.round(limit, 2), usedUsd: U.round(Math.max(0, -today), 2), usedFrac: U.round(used), remainingUsd: U.round(Math.max(0, limit + today), 2) };
      }
      if (tl === null) res.rules.totalLoss = needs('totalLossPct'); else {
        const limit = balance * tl / 100, used = Math.max(0, -total) / limit;
        res.rules.totalLoss = { state: level(used, warnAt), limitUsd: U.round(limit, 2), usedUsd: U.round(Math.max(0, -total), 2), usedFrac: U.round(used), remainingUsd: U.round(Math.max(0, limit + total), 2) };
      }
      if (pt === null) res.rules.profitTarget = needs('profitTargetPct'); else {
        const target = balance * pt / 100, prog = total / target;
        res.rules.profitTarget = { state: prog >= 1 ? 'reached' : 'in_progress', targetUsd: U.round(target, 2), progressFrac: U.round(Math.max(0, prog)), remainingUsd: U.round(Math.max(0, target - total), 2) };
      }
    }
    if (mt === null) res.rules.tradesPerDay = needs('maxTradesPerDay'); else {
      const used = todayCount / mt;
      res.rules.tradesPerDay = { state: level(used, warnAt), max: mt, used: todayCount, usedFrac: U.round(used) };
    }
    res.noteItems = [];
    if (noUsd) { res.notes.push(noUsd + ' معامله بدون مبلغ دلاری در محاسبه نیامد'); res.noteItems.push({ code: 'no_usd', p: { n: noUsd } }); }
    res.notes.push('فقط معاملات بسته‌شده ثبت‌شده محاسبه می‌شوند؛ سود/زیان شناور (Equity) لحاظ نشده است'); res.noteItems.push({ code: 'closed_only', p: {} });
    const states = Object.values(res.rules).map(r => r.state);
    res.overall = states.includes('breach') ? 'breach' : states.includes('warn') ? 'warn' : states.every(s => s === 'needs_info') ? 'needs_info' : 'ok';
    return res;
  }
  return { evaluate };
});
