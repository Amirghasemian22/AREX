/* AREX V9.6.3 — core/analytics: performance metrics. Pure functions.
   Definitions (shown to the user in the UI):
   - Outcome value of a trade: R if the trade has a valid R, else USD pnl (field `usd`). Trades with neither are EXCLUDED and counted.
   - Win: value > 0; Loss: value < 0; Break-even: value == 0. Win Rate = wins / (wins + losses + break-even).
   - Expectancy (R) = mean(R) over trades that have R.  Avg win/loss R from trades with R.
   - Profit Factor = gross profit / |gross loss| in R if >=1 trade has R else in USD; null when there are no losses (undefined, not infinity).
   - Max Drawdown = largest peak-to-trough drop of the cumulative curve (in R and in USD separately), plus % of peak when peak>0.
   - Samples below MIN_SAMPLE are flagged lowSample=true; no statistical claims are made. */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.analytics = api; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  const MIN_SAMPLE = 30;

  function outcome(t) {
    const r = U.toNum(t.r), usd = U.toNum(t.usd);
    return { r, usd, v: r !== null ? r : usd, basis: r !== null ? 'R' : usd !== null ? 'USD' : null };
  }
  function curve(values) {
    let cum = 0, peak = 0, maxDD = 0, maxDDPct = null; const pts = [];
    for (const v of values) {
      cum += v; pts.push(U.round(cum));
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? dd / peak : null; }
    }
    return { points: pts, maxDrawdown: U.round(maxDD), maxDrawdownPctOfPeak: U.round(maxDDPct), final: U.round(cum) };
  }
  function pf(values) {
    let gp = 0, gl = 0;
    for (const v of values) v > 0 ? gp += v : gl += -v;
    return { grossProfit: U.round(gp), grossLoss: U.round(gl), profitFactor: gl > 0 ? U.round(gp / gl) : null };
  }

  function summarize(trades, opts) {
    const minSample = (opts && opts.minSample) || MIN_SAMPLE;
    const sorted = U.sortTrades(Array.isArray(trades) ? trades : []);
    let excluded = 0, wins = 0, losses = 0, be = 0;
    const rVals = [], usdVals = [], winsR = [], lossR = [];
    for (const t of sorted) {
      const o = outcome(t);
      if (o.v === null) { excluded++; continue; }
      o.v > 0 ? wins++ : o.v < 0 ? losses++ : be++;
      if (o.r !== null) { rVals.push(o.r); (o.r > 0 ? winsR : o.r < 0 ? lossR : []).push(o.r); }
      if (o.usd !== null) usdVals.push(o.usd);
    }
    const n = wins + losses + be;
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const rCurve = curve(rVals), uCurve = curve(usdVals);
    const pfBasis = rVals.length ? 'R' : usdVals.length ? 'USD' : null;
    const pfRes = pf(pfBasis === 'R' ? rVals : usdVals);
    return {
      total: sorted.length, counted: n, excluded, wins, losses, breakeven: be,
      winRate: n ? U.round(wins / n) : null,
      avgR: U.round(mean(rVals)), avgWinR: U.round(mean(winsR)), avgLossR: U.round(mean(lossR)),
      expectancyR: U.round(mean(rVals)), rSample: rVals.length,
      profitFactor: pfRes.profitFactor, profitFactorBasis: pfBasis, grossProfit: pfRes.grossProfit, grossLoss: pfRes.grossLoss,
      totalR: rCurve.final, totalUsd: uCurve.final,
      drawdownR: { max: rCurve.maxDrawdown, pctOfPeak: rCurve.maxDrawdownPctOfPeak },
      drawdownUsd: { max: uCurve.maxDrawdown, pctOfPeak: uCurve.maxDrawdownPctOfPeak },
      equityCurveR: rCurve.points, equityCurveUsd: uCurve.points,
      lowSample: n < minSample, minSample,
      notes: excluded ? [excluded + ' معامله بدون R/سود‌وزیان معتبر از محاسبه حذف شد'] : []
    };
  }

  /** Group trades by a key function (symbol / setup / session / weekday...) and summarize each; each group keeps its trade ids. */
  function groupBy(trades, keyFn, opts) {
    const m = new Map();
    for (const t of trades) {
      const keys = [].concat(keyFn(t)); // allows multi-valued (e.g. sessions array)
      for (const k of (keys.length ? keys : [null])) {
        const key = (k === undefined || k === null || k === '') ? '(نامشخص)' : String(k);
        if (!m.has(key)) m.set(key, []);
        m.get(key).push(t);
      }
    }
    return [...m.entries()].map(([key, ts]) => Object.assign({ key, tradeIds: ts.map(t => t.id) }, summarize(ts, opts)))
      .sort((a, b) => b.counted - a.counted);
  }
  const bySymbol = (tr, o) => groupBy(tr, t => String(t.symbol || '').trim().toUpperCase(), o);
  const byStrategy = (tr, o) => groupBy(tr, t => String(t.setup || '').trim(), o);
  const bySession = (tr, o) => groupBy(tr, t => Array.isArray(t.sessions) ? t.sessions : [], o);
  const byWeekday = (tr, o) => groupBy(tr, t => U.weekday(t.date), o);

  /** Heatmap: weekday x hour cells with sample size and trade ids (for drill-down). Hour from `time`; trades without time are listed in `unplaced`. */
  function heatmap(trades, opts) {
    const cells = {}; let unplaced = 0;
    for (const t of trades) {
      const wd = U.weekday(t.date), mins = U.toMinutes(t.time);
      if (wd === null || mins === null || outcome(t).v === null) { unplaced++; continue; }
      const k = wd + '-' + Math.floor(mins / 60);
      (cells[k] = cells[k] || []).push(t);
    }
    const out = Object.keys(cells).map(k => {
      const [wd, h] = k.split('-').map(Number), s = summarize(cells[k], opts);
      return { weekday: wd, hour: h, n: s.counted, totalR: s.totalR, totalUsd: s.totalUsd, winRate: s.winRate, expectancyR: s.expectancyR, lowSample: s.lowSample, tradeIds: cells[k].map(t => t.id) };
    });
    return { cells: out, unplaced };
  }
  return { MIN_SAMPLE, outcome, summarize, groupBy, bySymbol, byStrategy, bySession, byWeekday, heatmap };
});
