/* AREX V9.8.0 — core/tradecalc: pure trade maths (planned RR, realized R, partial closes, fees, USD estimate). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.tradecalc = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/٫/g, '.').replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const sign = dir => (/sell|short|فروش/i.test(String(dir || '')) ? -1 : 1);
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /** Reward:risk planned from entry / SL / TP. */
  function plannedRR(t) {
    const e = num(t.entry), sl = num(t.sl), tp = num(t.tp), s = sign(t.dir);
    if (e === null || sl === null || tp === null) return null;
    const risk = (e - sl) * s, reward = (tp - e) * s;
    return risk > 0 && reward > 0 ? r2(reward / risk) : null;
  }
  /** Weighted average exit from partial closes [{price, lots}]. */
  function weightedExit(partials) {
    const p = (partials || []).map(x => ({ price: num(x.price), lots: num(x.lots) })).filter(x => x.price !== null && x.lots !== null && x.lots > 0);
    if (!p.length) return null;
    const tot = p.reduce((a, x) => a + x.lots, 0);
    return { price: p.reduce((a, x) => a + x.price * x.lots, 0) / tot, lots: tot };
  }
  /** Realized R against the ORIGINAL stop when known. */
  function realizedR(t) {
    const e = num(t.entry), s = sign(t.dir), sl = num(t.slOriginal) !== null ? num(t.slOriginal) : num(t.sl);
    let x = num(t.exit); const w = weightedExit(t.partials); if (x === null && w) x = w.price;
    if (e === null || sl === null || x === null) return null;
    const risk = (e - sl) * s; if (!(risk > 0)) return null;
    return r2(((x - e) * s) / risk);
  }
  /** Approximate USD P/L (USD account). Only for instruments with a known contract size; otherwise null. */
  function estimateUsd(t) {
    const e = num(t.entry), lots = num(t.lots), s = sign(t.dir); let x = num(t.exit); const w = weightedExit(t.partials); if (x === null && w) x = w.price;
    if (e === null || x === null || lots === null) return null;
    const sym = norm(t.symbol), d = (x - e) * s;
    if (/^XAUUSD/.test(sym)) return r2(d * 100 * lots);
    if (/^XAGUSD/.test(sym)) return r2(d * 5000 * lots);
    if (/^(US30|DJI|DJ30|NAS100|NDX|USTEC|US500|SPX500|SPX)/.test(sym)) return r2(d * lots);
    if (/^[A-Z]{3}USD$/.test(sym)) return r2(d * 100000 * lots);
    if (/^USD(JPY|CHF|CAD)$/.test(sym) && x > 0) return r2((d * 100000 * lots) / x);
    return null;
  }
  const netUsd = (gross, commission, swap) => { const g = num(gross); if (g === null) return null; return r2(g + (num(commission) || 0) + (num(swap) || 0)); };
  const durationMin = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) && y >= x ? Math.round((y - x) / 60000) : null; };
  /** Derived fields; never overwrites values the user typed. */
  function enrich(t) {
    const out = { plannedRR: plannedRR(t) }, w = weightedExit(t.partials);
    if (num(t.exit) === null && w) out.exit = r2(w.price, 5);
    const r = num(t.r) !== null ? null : realizedR(Object.assign({}, t, out.exit !== undefined ? { exit: out.exit } : {}));
    if (r !== null) { out.r = String(r); out.rAuto = true; }
    if (num(t.gross) === null && num(t.usd) === null) { const u = estimateUsd(Object.assign({}, t, out.exit !== undefined ? { exit: out.exit } : {})); if (u !== null) { out.gross = String(u); out.usdAuto = true; } }
    const g = num(t.gross) !== null ? t.gross : out.gross;
    if (g !== undefined && g !== null && g !== '') { const n = netUsd(g, t.commission, t.swap); if (n !== null) out.usd = String(n); }
    const d = durationMin(t.openedAt, t.closedAt); if (d !== null) out.durationMin = d;
    return out;
  }
  return { num, sign, plannedRR, weightedExit, realizedR, estimateUsd, netUsd, durationMin, enrich };
});
