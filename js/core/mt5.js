/* AREX V9.8.0 — core/mt5: MT4/MT5 statement (HTML) and CSV parsers + conversion to AREX trades. Pure; no DOM. */
(function (root, factory) {
  const api = factory(root.AREXCore && root.AREXCore.tradecalc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.mt5 = api; }
})(typeof self !== 'undefined' ? self : this, function (tc) {
  if (!tc && typeof require === 'function') { try { tc = require('./tradecalc.js'); } catch (e) {} }
  const ENT = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ENT[m]).replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  const isDate = s => /^\d{4}[.\-/]\d{2}[.\-/]\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s);
  const iso = s => { const m = String(s || '').match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}:\d{2})(:\d{2})?/); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}${m[5] || ':00'}` : ''; };
  const dirOf = s => { const x = String(s || '').toLowerCase().trim(); return x === 'buy' ? 'buy' : x === 'sell' ? 'sell' : null; };
  function toNumber(v) {
    let s = String(v == null ? '' : v).replace(/[\s\u00a0\u2009]/g, '').replace(/[^0-9,.\-+]/g, ''); if (!s || s === '-') return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, ''); else if (s.includes(',')) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    const n = parseFloat(s); return Number.isFinite(n) ? n : null;
  }
  function htmlRows(html) {
    const rows = []; String(html || '').replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, inner) => { const cells = []; inner.replace(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi, (__, attrs, c) => { cells.push(clean(c)); const span = /colspan\s*=\s*"?(\d+)/i.exec(attrs); if (span) for (let i = 1; i < Math.min(+span[1], 12); i++) cells.push(''); }); if (cells.length) rows.push(cells); return ''; });
    return rows;
  }
  function delimited(text) {
    const t = String(text || '').replace(/^\uFEFF/, ''), first = t.split(/\r?\n/, 1)[0] || '';
    const d = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === d) { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell.trim()); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cell += ch; }
    row.push(cell.trim()); if (row.some(x => x !== '')) rows.push(row); return rows;
  }
  const deal = o => Object.assign({ ticket: '', symbol: '', dir: 'buy', lots: null, entry: null, exit: null, sl: null, tp: null, openedAt: '', closedAt: '', commission: 0, swap: 0, gross: null }, o);

  /** MT5 positions row: Time, Position, Symbol, Type, Volume, Price, S/L, T/P, Time, Price, Commission, Swap, Profit. */
  function mt5Row(c) { if (c.length < 13 || !isDate(c[0]) || !/^\d{4,}$/.test(c[1]) || !dirOf(c[3]) || !isDate(c[8])) return null;
    return deal({ ticket: c[1], symbol: c[2], dir: dirOf(c[3]), lots: toNumber(c[4]), entry: toNumber(c[5]), sl: toNumber(c[6]), tp: toNumber(c[7]), openedAt: iso(c[0]), closedAt: iso(c[8]), exit: toNumber(c[9]), commission: toNumber(c[10]) || 0, swap: toNumber(c[11]) || 0, gross: toNumber(c[12]) }); }
  /** MT4 row: Ticket, Open Time, Type, Size, Item, Price, S/L, T/P, Close Time, Price, Commission, Taxes, Swap, Profit. */
  function mt4Row(c) { if (c.length < 14 || !/^\d{4,}$/.test(c[0]) || !isDate(c[1]) || !dirOf(c[2]) || !isDate(c[8])) return null;
    return deal({ ticket: c[0], openedAt: iso(c[1]), dir: dirOf(c[2]), lots: toNumber(c[3]), symbol: c[4], entry: toNumber(c[5]), sl: toNumber(c[6]), tp: toNumber(c[7]), closedAt: iso(c[8]), exit: toNumber(c[9]), commission: toNumber(c[10]) || 0, swap: toNumber(c[12]) || 0, gross: toNumber(c[13]) }); }
  function fromRows(rows) {
    const out = []; rows.forEach(c => { const d = mt5Row(c) || mt4Row(c); if (d) out.push(d); }); if (out.length) return out;
    // generic CSV: header based
    const hi = rows.findIndex(r => r.some(x => /^(ticket|position|deal|order)$/i.test(x)) && r.some(x => /symbol|item|instrument/i.test(x)));
    if (hi < 0) return [];
    const H = rows[hi].map(x => x.toLowerCase().replace(/[^a-z]/g, '')), idx = (...n) => { for (const k of n) { const i = H.indexOf(k); if (i >= 0) return i; } return -1; };
    const times = H.map((h, i) => (/^(time|opentime|closetime|opened|closed)/.test(h) ? i : -1)).filter(i => i >= 0), prices = H.map((h, i) => (h === 'price' || h === 'openprice' || h === 'closeprice' ? i : -1)).filter(i => i >= 0);
    const iT = idx('ticket', 'position', 'deal', 'order'), iS = idx('symbol', 'item', 'instrument'), iD = idx('type', 'direction', 'side'), iV = idx('volume', 'size', 'lots', 'lot');
    const iO = idx('opentime', 'opened') >= 0 ? idx('opentime', 'opened') : times[0], iC = idx('closetime', 'closed') >= 0 ? idx('closetime', 'closed') : times[1];
    const iE = idx('openprice') >= 0 ? idx('openprice') : prices[0], iX = idx('closeprice') >= 0 ? idx('closeprice') : prices[1];
    const iSL = idx('sl', 'stoploss'), iTP = idx('tp', 'takeprofit', 'takeprofit'), iCm = idx('commission', 'fee', 'fees'), iSw = idx('swap'), iP = idx('profit', 'pl', 'pnl');
    rows.slice(hi + 1).forEach(c => { const dir = dirOf(c[iD]); if (!dir || iT < 0 || !c[iT]) return;
      out.push(deal({ ticket: c[iT], symbol: c[iS] || '', dir, lots: toNumber(c[iV]), entry: toNumber(c[iE]), exit: toNumber(c[iX]), sl: toNumber(c[iSL]), tp: toNumber(c[iTP]), openedAt: iso(c[iO]), closedAt: iso(c[iC]), commission: toNumber(c[iCm]) || 0, swap: toNumber(c[iSw]) || 0, gross: toNumber(c[iP]) })); });
    return out;
  }
  const parse = (text, name) => fromRows(/<tr/i.test(text) ? htmlRows(text) : delimited(text));
  const key = (accountId, d) => accountId + ':' + String(d.ticket);
  /** Convert a deal to an AREX trade (net USD = profit + commission + swap). */
  function toTrade(d, o) {
    o = o || {}; const openedAt = d.openedAt || d.closedAt, date = (openedAt || '').slice(0, 10), time = (openedAt || '').slice(11, 16);
    const t = { id: o.id || (Date.now() * 1000 + Math.floor(Math.random() * 1000)), date, time, symbol: String(d.symbol).toUpperCase(), dir: d.dir, entry: d.entry == null ? '' : String(d.entry), sl: d.sl ? String(d.sl) : '', tp: d.tp ? String(d.tp) : '', exit: d.exit == null ? '' : String(d.exit),
      r: '', usd: '', setup: '', note: '', mistakes: [], tags: [], lots: d.lots, commission: d.commission || 0, swap: d.swap || 0, gross: d.gross == null ? '' : String(d.gross), openedAt, closedAt: d.closedAt, ticket: String(d.ticket), accountId: o.accountId, source: o.source || 'mt-import', slOriginal: d.sl || null };
    if (tc) { const e = tc.enrich(t); Object.keys(e).forEach(k => { t[k] = e[k]; }); }
    return t;
  }
  return { toNumber, htmlRows, delimited, parse, fromRows, key, toTrade };
});
