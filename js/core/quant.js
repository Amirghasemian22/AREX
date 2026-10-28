/* AREX V9.8.0 — core/quant: Sharpe/Sortino, drawdown, MAE/MFE and Monte-Carlo risk of ruin. Pure + deterministic (seeded). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.quant = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
  const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))] : null;
  const stamp = t => String(t.closedAt || (t.date + 'T' + (t.time || '00:00')));
  const closed = trades => trades.filter(t => num(t.r) !== null).slice().sort((a, b) => stamp(a).localeCompare(stamp(b)));
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** Per-trade (R) and daily (% of balance) risk-adjusted ratios. */
  function ratios(trades, startBalance) {
    const c = closed(trades), R = c.map(t => num(t.r)); if (R.length < 5) return { insufficient: true, n: R.length };
    const m = mean(R), s = sd(R), dn = Math.sqrt(R.reduce((a, x) => a + (x < 0 ? x * x : 0), 0) / R.length);
    let cum = 0, peak = 0, maxDD = 0; R.forEach(x => { cum += x; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum); });
    const out = { n: R.length, meanR: r2(m), sdR: r2(s), sharpeR: s > 0 ? r2(m / s) : null, sortinoR: dn > 0 ? r2(m / dn) : null, maxDDR: r2(maxDD), totalR: r2(cum), calmarR: maxDD > 0 ? r2(cum / maxDD) : null };
    const bal = num(startBalance);
    if (bal > 0) {
      const byDay = {}; c.forEach(t => { const u = num(t.usd); if (u !== null) byDay[String(t.date)] = (byDay[String(t.date)] || 0) + u; });
      let eq = bal; const rets = Object.keys(byDay).sort().map(d => { const r = byDay[d] / eq; eq += byDay[d]; return r; });
      if (rets.length >= 5) { const dm = mean(rets), ds = sd(rets), dd = Math.sqrt(rets.reduce((a, x) => a + (x < 0 ? x * x : 0), 0) / rets.length); out.sharpeDaily = ds > 0 ? r2(dm / ds * Math.sqrt(252)) : null; out.sortinoDaily = dd > 0 ? r2(dm / dd * Math.sqrt(252)) : null; out.days = rets.length; }
    }
    return out;
  }

  /** Bootstrap Monte-Carlo of the journal's own R-distribution. */
  function monteCarlo(trades, o) {
    o = Object.assign({ trials: 3000, horizon: 100, riskPct: 1, ruinPct: 30, seed: 1234 }, o || {});
    const R = closed(trades).map(t => num(t.r)); if (R.length < 20) return { insufficient: true, n: R.length, need: 20 };
    const f = o.riskPct / 100, floor = 1 - o.ruinPct / 100, rand = rng(o.seed), H = o.horizon, step = Math.max(1, Math.ceil(H / 40));
    const marks = []; for (let i = step; i <= H; i += step) marks.push(i); if (marks[marks.length - 1] !== H) marks.push(H);
    const at = marks.map(() => new Float64Array(o.trials)), finals = new Float64Array(o.trials), dds = new Float64Array(o.trials);
    let ruined = 0, profit = 0;
    for (let k = 0; k < o.trials; k++) {
      let eq = 1, peak = 1, dd = 0, ruin = false, mi = 0;
      for (let i = 1; i <= H; i++) {
        eq *= Math.max(0, 1 + f * R[Math.floor(rand() * R.length)]); if (eq > peak) peak = eq; dd = Math.max(dd, 1 - eq / peak);
        if (!ruin && eq <= floor) ruin = true;
        if (i === marks[mi]) { at[mi][k] = eq; mi++; }
      }
      finals[k] = eq; dds[k] = dd; if (ruin) ruined++; if (eq > 1) profit++;
    }
    const sortedF = Array.from(finals).sort((a, b) => a - b), sortedD = Array.from(dds).sort((a, b) => a - b);
    const fan = marks.map((m, i) => { const s = Array.from(at[i]).sort((a, b) => a - b); return { n: m, p5: r2(pct(s, .05), 3), p25: r2(pct(s, .25), 3), p50: r2(pct(s, .5), 3), p75: r2(pct(s, .75), 3), p95: r2(pct(s, .95), 3) }; });
    return { trials: o.trials, horizon: H, riskPct: o.riskPct, ruinPct: o.ruinPct, n: R.length, ruinProb: r2(ruined / o.trials * 100, 1), profitProb: r2(profit / o.trials * 100, 1),
      final: { p5: r2(pct(sortedF, .05), 3), p50: r2(pct(sortedF, .5), 3), p95: r2(pct(sortedF, .95), 3) }, ddMedianPct: r2(pct(sortedD, .5) * 100, 1), ddP95Pct: r2(pct(sortedD, .95) * 100, 1), fan };
  }

  /** MAE/MFE in R units (positive magnitudes, entered per trade). Needs >=5 trades that carry the data. */
  function maeMfe(trades) {
    const t = trades.filter(x => num(x.r) !== null && (num(x.mae) !== null || num(x.mfe) !== null)); if (t.length < 5) return { insufficient: true, n: t.length };
    const win = t.filter(x => num(x.r) > 0), loss = t.filter(x => num(x.r) < 0), avg = (a, k) => { const v = a.map(x => Math.abs(num(x[k]))).filter(Number.isFinite); return v.length ? r2(mean(v)) : null; };
    const maeW = win.map(x => Math.abs(num(x.mae))).filter(Number.isFinite).sort((a, b) => a - b), mfeW = win.map(x => ({ mfe: Math.abs(num(x.mfe)), r: num(x.r) })).filter(x => Number.isFinite(x.mfe));
    const out = { n: t.length, avgMAEwin: avg(win, 'mae'), avgMAEloss: avg(loss, 'mae'), avgMFEwin: avg(win, 'mfe'), avgMFEloss: avg(loss, 'mfe') };
    if (maeW.length >= 5) out.slSuggestionR = r2(pct(maeW, .9));
    if (mfeW.length >= 5) { out.captureWin = r2(mean(mfeW.map(x => x.r)) / mean(mfeW.map(x => x.mfe)) * 100, 0); out.leftOnTableR = r2(mean(mfeW.map(x => Math.max(0, x.mfe - x.r)))); }
    if (out.avgMFEwin !== null && out.avgMAEwin) out.edgeRatio = r2(out.avgMFEwin / out.avgMAEwin);
    return out;
  }
  return { mean, sd, closed, ratios, monteCarlo, maeMfe };
});
