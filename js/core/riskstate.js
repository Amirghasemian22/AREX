/* AREX V9.6.3 — core/riskstate: high-risk trader-state alerts from real patterns. Pure.
   Every alert carries evidence (trade ids + numbers), a confidence level and the parameters used. Alerts are warnings about
   behaviour patterns in the journal, not predictions and not psychological diagnoses. Missing data => no alert (never invented). */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util,
                      typeof require === 'function' ? require('./analytics.js') : root.AREXCore.analytics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.riskstate = api; }
})(typeof self !== 'undefined' ? self : this, function (U, A) {
  const DEFAULTS = { lossStreak: 3, afterLossTrades: 3, riskJumpFactor: 1.5, adherenceDrop: 20, window: 5 };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  function evaluate(trades, params) {
    const P = Object.assign({}, DEFAULTS, params || {}), sorted = U.sortTrades(trades || []), alerts = [];
    // 1) Current consecutive-loss streak (ending at the most recent trade that has an outcome).
    const withOut = sorted.filter(t => A.outcome(t).v !== null);
    let streak = [];
    for (let i = withOut.length - 1; i >= 0; i--) { if (A.outcome(withOut[i]).v < 0) streak.unshift(withOut[i]); else break; }
    if (streak.length >= P.lossStreak) alerts.push({ id: 'loss_streak', label: 'ضررهای متوالی', value: streak.length, confidence: streak.length >= P.lossStreak + 2 ? 'high' : 'medium',
      evidence: streak.length + ' معامله آخر پشت‌سرهم زیان‌ده بودند (آستانه ' + P.lossStreak + ')', params: { n: streak.length, t: P.lossStreak }, tradeIds: streak.map(t => t.id) });
    // 2) Many trades after the first loss on the most recent trading day.
    const lastDay = sorted.length ? sorted[sorted.length - 1].date : null;
    if (lastDay) {
      const day = sorted.filter(t => t.date === lastDay), fi = day.findIndex(t => { const v = A.outcome(t).v; return v !== null && v < 0; });
      if (fi >= 0 && day.length - 1 - fi >= P.afterLossTrades) alerts.push({ id: 'trades_after_loss', label: 'معاملات متوالی پس از ضرر', value: day.length - 1 - fi, confidence: 'medium',
        evidence: (day.length - 1 - fi) + ' معامله پس از اولین ضرر در ' + lastDay + ' (آستانه ' + P.afterLossTrades + ')', params: { n: day.length - 1 - fi, d: lastDay, t: P.afterLossTrades }, tradeIds: day.slice(fi + 1).map(t => t.id) });
    }
    // 3) Risk escalation: needs riskPct on >= window+1 trades.
    const rp = sorted.filter(t => U.toNum(t.riskPct) !== null);
    if (rp.length >= P.window + 1) {
      const last = rp[rp.length - 1], prev = rp.slice(-1 - P.window, -1), avg = mean(prev.map(t => U.toNum(t.riskPct)));
      if (avg > 0 && U.toNum(last.riskPct) >= avg * P.riskJumpFactor) alerts.push({ id: 'risk_jump', label: 'افزایش ناگهانی ریسک', value: U.round(U.toNum(last.riskPct) / avg, 2), confidence: 'medium',
        evidence: 'ریسک آخرین معامله ' + U.toNum(last.riskPct) + '٪ در برابر میانگین ' + U.round(avg, 2) + '٪ در ' + P.window + ' معامله قبل', params: { last: U.toNum(last.riskPct), avg: U.round(avg, 2), w: P.window }, tradeIds: [last.id] });
    }
    // 4) Adherence drop: needs ruleCompliance on >= 2*window trades.
    const rc = sorted.filter(t => U.toNum(t.ruleCompliance) !== null);
    if (rc.length >= 2 * P.window) {
      const recent = rc.slice(-P.window), before = rc.slice(-2 * P.window, -P.window), a = mean(recent.map(t => U.toNum(t.ruleCompliance))), b = mean(before.map(t => U.toNum(t.ruleCompliance)));
      if (b - a >= P.adherenceDrop) alerts.push({ id: 'adherence_drop', label: 'افت پایبندی به قوانین', value: U.round(b - a, 1), confidence: 'medium',
        evidence: 'میانگین پایبندی از ' + U.round(b, 1) + '٪ به ' + U.round(a, 1) + '٪ رسید (' + P.window + ' معامله اخیر در برابر ' + P.window + ' معامله قبل)', params: { from: U.round(b, 1), to: U.round(a, 1), w: P.window }, tradeIds: recent.map(t => t.id) });
    }
    return { alerts, params: P, status: alerts.length ? 'attention' : 'no_alert',
      note: 'نبود هشدار به معنی ایمن‌بودن نیست؛ فقط الگوهای قابل‌اندازه‌گیری از داده‌های ثبت‌شده بررسی می‌شوند' };
  }
  return { DEFAULTS, evaluate };
});
