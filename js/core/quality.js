/* AREX V9.6.3 — core/quality: trader-quality score. Pure, transparent, and INDEPENDENT of profit/loss.
   Weights are exported (WEIGHTS) so the UI can display them. Components without data are omitted and the remaining
   weights are renormalised; `coverage` states how much of the total weight actually had data. */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.quality = api; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  const WEIGHTS = { ruleAdherence: 35, riskManagement: 25, journalQuality: 20, discipline: 20 };
  const LOG_FIELDS = ['setup', 'note', 'entry', 'sl', 'exit', 'time', 'symbol'];
  const filled = v => v !== undefined && v !== null && String(v).trim() !== '';
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  /** cfg: {maxTradesPerDay?, maxRiskPct?}. Never reads r / usd / pnl. */
  function score(trades, cfg) {
    cfg = cfg || {}; trades = trades || [];
    const comp = {};
    // 1) Rule adherence = mean ruleCompliance (%) over trades that have it.
    const rc = trades.map(t => U.toNum(t.ruleCompliance)).filter(x => x !== null);
    comp.ruleAdherence = rc.length ? { value: mean(rc), n: rc.length, howKey: 'ruleAdherence', how: 'میانگین درصد رعایت چک‌لیست قوانین' } : null;
    // 2) Risk management = mean of (share with SL set) and (share within maxRiskPct, if both riskPct data and cap exist).
    const slRate = trades.length ? trades.filter(t => U.toNum(t.sl) !== null).length / trades.length * 100 : null;
    const cap = U.toNum(cfg.maxRiskPct), withRisk = trades.filter(t => U.toNum(t.riskPct) !== null);
    const parts = []; if (slRate !== null) parts.push(slRate);
    if (cap !== null && withRisk.length) parts.push(withRisk.filter(t => U.toNum(t.riskPct) <= cap).length / withRisk.length * 100);
    comp.riskManagement = parts.length ? { value: mean(parts), n: trades.length, howKey: parts.length > 1 ? 'riskManagement2' : 'riskManagement1', how: 'درصد معاملات دارای SL' + (parts.length > 1 ? ' و درصد ریسک در سقف مجاز' : '') } : null;
    // 3) Journal quality = mean completeness over LOG_FIELDS.
    comp.journalQuality = trades.length ? { value: mean(trades.map(t => LOG_FIELDS.filter(f => filled(t[f])).length / LOG_FIELDS.length * 100)), n: trades.length, howKey: 'journalQuality', howParams: { fields: LOG_FIELDS.join(', ') }, how: 'کامل‌بودن فیلدهای ثبت: ' + LOG_FIELDS.join('، ') } : null;
    // 4) Discipline = mean of (share of trades with no mistake tag) and (share of days within trade cap, if cap given).
    const dparts = [];
    if (trades.length) dparts.push(trades.filter(t => !(t.mistakes && t.mistakes.length)).length / trades.length * 100);
    const mt = U.toNum(cfg.maxTradesPerDay);
    if (mt !== null && trades.length) { const d = {}; trades.forEach(t => d[t.date] = (d[t.date] || 0) + 1); const days = Object.values(d); dparts.push(days.filter(c => c <= mt).length / days.length * 100); }
    comp.discipline = dparts.length ? { value: mean(dparts), n: trades.length, howKey: dparts.length > 1 ? 'discipline2' : 'discipline1', how: 'درصد معاملات بدون برچسب اشتباه' + (dparts.length > 1 ? ' و روزهای در سقف تعداد معامله' : '') } : null;

    let wsum = 0, acc = 0; const out = {};
    for (const k of Object.keys(WEIGHTS)) {
      const c = comp[k];
      out[k] = c ? { score: U.round(c.value, 1), weight: WEIGHTS[k], n: c.n, how: c.how, howKey: c.howKey, howParams: c.howParams } : { score: null, weight: WEIGHTS[k], n: 0, how: 'داده کافی نیست' };
      if (c) { wsum += WEIGHTS[k]; acc += c.value * WEIGHTS[k]; }
    }
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    return { overall: wsum ? U.round(acc / wsum, 1) : null, coverage: U.round(wsum / total, 2), components: out, tradeCount: trades.length,
             note: 'این امتیاز فقط کیفیت رفتار و ثبت را می‌سنجد و به سود/زیان یا تضمین سود ربطی ندارد' };
  }
  return { WEIGHTS, LOG_FIELDS, score };
});
