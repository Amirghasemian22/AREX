/* AREX V9.6.3 — core/util: pure helpers (no DOM, no storage). UMD: browser (window.AREXCore) + Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.util = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  /** Parse a user-entered number. Blank/invalid -> null (never silently 0). Accepts Persian/Arabic digits and "٫"/"," decimals. */
  function toNum(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
         .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
         .replace(/٫/g, '.').replace(/٬/g, '').replace(/,/g, '.').replace(/\s/g, '');
    if (!/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  /** "HH:MM" -> minutes since midnight, or null. */
  function toMinutes(t) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    return h < 24 && mi < 60 ? h * 60 + mi : null;
  }
  /** Sortable key for a trade (date "YYYY-MM-DD" + time). Missing time sorts to 00:00. */
  function tradeKey(t) { return String(t.date || '') + 'T' + String(t.time || '00:00').padStart(5, '0'); }
  function sortTrades(trades) {
    return trades.map((t, i) => [t, i]).sort((a, b) => {
      const ka = tradeKey(a[0]), kb = tradeKey(b[0]);
      return ka < kb ? -1 : ka > kb ? 1 : a[1] - b[1];
    }).map(x => x[0]);
  }
  /** Day of week (0=Sun) from ISO date, timezone-independent. */
  function weekday(dateIso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateIso || ''));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  }
  const round = (x, d = 4) => (x === null || x === undefined || !Number.isFinite(x)) ? null : Math.round(x * 10 ** d) / 10 ** d;
  return { toNum, toMinutes, tradeKey, sortTrades, weekday, round };
});
