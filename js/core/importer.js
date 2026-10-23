/* AREX V9.6.3 — core/importer: CSV / broker-report trade import. Pure (no DOM/storage).
   Flow: parseCSV -> suggestMapping (user can edit) -> preview (validate + duplicates) -> caller commits only the ok rows -> undoImport(batchId).
   Nothing is guessed: ambiguous dates (e.g. 03/04/2026) require an explicit dateFormat; Jalali dates are rejected, not converted. */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.importer = api; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  const FIELDS = ['date', 'time', 'symbol', 'dir', 'entry', 'sl', 'tp', 'exit', 'usd', 'r', 'setup', 'note', 'extId', 'volume', 'commission', 'swap'];
  const ALIASES = {
    date: ['date', 'open time', 'opentime', 'time', 'تاریخ', 'زمان باز', 'datetime', 'open date'],
    time: ['time of day', 'ساعت', 'hour'],
    symbol: ['symbol', 'instrument', 'pair', 'نماد', 'item'],
    dir: ['type', 'direction', 'side', 'dir', 'جهت', 'action'],
    entry: ['entry', 'open price', 'price', 'entry price', 'ورود', 'نقطه ورود'],
    sl: ['sl', 's / l', 's/l', 'stop loss', 'stoploss', 'stop', 'حد ضرر'],
    tp: ['tp', 't / p', 't/p', 'take profit', 'takeprofit', 'حد سود'],
    exit: ['exit', 'close price', 'exit price', 'خروج', 'نقطه خروج'],
    usd: ['profit', 'pnl', 'p/l', 'p&l', 'net profit', 'سود', 'سود/زیان', 'usd'],
    r: ['r', 'r multiple', 'r-multiple', 'rr', 'نتیجه r'],
    setup: ['setup', 'strategy', 'استراتژی', 'ستاپ'],
    note: ['note', 'notes', 'comment', 'توضیح', 'یادداشت'],
    extId: ['ticket', 'position', 'order', 'deal', 'id', 'position id'],
    volume: ['volume', 'lots', 'size', 'حجم'],
    commission: ['commission', 'کمیسیون'], swap: ['swap', 'سواپ']
  };

  function stripBOM(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }
  function detectDelimiter(text) {
    const head = text.split(/\r?\n/).slice(0, 5).join('\n'); let best = ',', bc = -1;
    for (const d of [',', ';', '\t']) { const c = head.split(d).length; if (c > bc) { bc = c; best = d; } }
    return best;
  }
  /** RFC-4180-style parser: quotes, escaped quotes, delimiters/newlines inside quotes, CRLF. Returns {rows, delimiter}. */
  function parseCSV(text, delimiter) {
    text = stripBOM(String(text || '')); const d = delimiter || detectDelimiter(text);
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === d) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row); }
    return { rows, delimiter: d, unterminatedQuote: q };
  }

  /** Header -> field suggestion. Duplicate "Time"/"Price" (MT5 open/close pairs): 1st = open (date/entry), 2nd = close (ignored time / exit). */
  function suggestMapping(headers) {
    const map = {}; const seen = {}; const hasDate = headers.some(h => String(h).trim().toLowerCase() === 'date');
    headers.forEach((h, idx) => {
      const k = String(h).trim().toLowerCase(); seen[k] = (seen[k] || 0) + 1;
      let field = null;
      if (k === 'price') field = seen[k] === 1 ? 'entry' : 'exit';
      else if (k === 'time') field = hasDate ? (seen[k] === 1 ? 'time' : null) : (seen[k] === 1 ? 'date' : null);
      else for (const f of FIELDS) if (ALIASES[f].includes(k) && !(f in map)) { field = f; break; }
      if (field && !(field in map)) map[field] = idx;
    });
    return map;
  }

  const JALALI = y => y >= 1200 && y <= 1700;
  /** -> {date:'YYYY-MM-DD', time:'HH:MM'|''} or {error}. fmt: 'ymd'|'dmy'|'mdy'|undefined (only ymd is accepted without fmt). */
  function parseDateTime(raw, fmt) {
    const s = String(raw || '').trim(); if (!s) return { error: 'تاریخ خالی است', code: 'date_empty', p: {} };
    const m = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/.exec(s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    if (!m) return { error: 'قالب تاریخ قابل‌خواندن نیست: ' + s.slice(0, 30), code: 'date_unreadable', p: { s: s.slice(0, 30) } };
    let y, mo, d; const a = +m[1], b = +m[2], c = +m[3];
    if (m[1].length === 4) { y = a; mo = b; d = c; }
    else if (m[3].length === 4) {
      if (fmt === 'dmy') { d = a; mo = b; y = c; } else if (fmt === 'mdy') { mo = a; d = b; y = c; }
      else return { error: 'قالب تاریخ مبهم است (روز/ماه)؛ قالب dmy یا mdy را مشخص کنید', code: 'date_ambiguous', p: {} };
    } else return { error: 'سال چهاررقمی یافت نشد', code: 'date_noyear', p: {} };
    if (JALALI(y)) return { error: 'تاریخ شمسی پشتیبانی نمی‌شود؛ قبل از ورود به میلادی تبدیل کنید', code: 'date_jalali', p: {} };
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (mo < 1 || mo > 12 || d < 1 || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: 'تاریخ نامعتبر: ' + s.slice(0, 30), code: 'date_invalid', p: { s: s.slice(0, 30) } };
    const pad = n => String(n).padStart(2, '0');
    const time = m[4] !== undefined ? pad(+m[4]) + ':' + m[5] : '';
    if (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59)) return { error: 'ساعت نامعتبر', code: 'time_invalid', p: {} };
    return { date: y + '-' + pad(mo) + '-' + pad(d), time };
  }
  function parseDir(raw) {
    const x = String(raw || '').trim().toLowerCase();
    if (/^(buy|long|b|خرید)$/.test(x)) return 'buy';
    if (/^(sell|short|s|فروش)$/.test(x)) return 'sell';
    return null;
  }
  const NON_TRADE = /^(balance|deposit|withdrawal|credit|correction|bonus|interest|charge|واریز|برداشت)$/i;

  function dupKey(t) {
    if (t.extId) return 'x:' + String(t.extId).trim();
    return ['k', t.date, t.time || '', String(t.symbol).toUpperCase(), t.dir, U.toNum(t.entry), U.toNum(t.exit), U.toNum(t.usd)].join('|');
  }

  /** Build one trade from a row. opts: {dateFormat, netOfCosts}. Returns {trade, errors, warnings, skipped}. */
  function normalizeRow(cells, map, opts) {
    opts = opts || {}; const get = f => (f in map && map[f] < cells.length) ? String(cells[map[f]]).trim() : '';
    const errors = [], warnings = [], items = [];
    const E = (text, code, p) => { errors.push(text); items.push({ code, p: p || {} }); };
    const W = (text, code, p) => { warnings.push(text); items.push({ code, p: p || {} }); };
    const typeRaw = get('dir');
    if (typeRaw && NON_TRADE.test(typeRaw)) return { skipped: 'ردیف غیرمعامله‌ای (' + typeRaw + ')', skippedItem: { code: 'nontrade', p: { t: typeRaw } }, errors, warnings, items: [] };
    const dt = parseDateTime(get('date'), opts.dateFormat); if (dt.error) E(dt.error, dt.code, dt.p);
    if (!dt.error && !dt.time) { const tm = /^(\d{1,2}):(\d{2})/.exec(get('time')); if (tm && +tm[1] < 24 && +tm[2] < 60) dt.time = String(+tm[1]).padStart(2, '0') + ':' + tm[2]; }
    const symbol = get('symbol'); if (!symbol) E('نماد خالی است', 'symbol_empty');
    const dir = parseDir(typeRaw); if (!dir) E('جهت معامله نامعتبر: «' + typeRaw + '»', 'dir_invalid', { t: typeRaw });
    const num = (f, label) => { const raw = get(f); if (raw === '') return ''; const n = U.toNum(raw); if (n === null) { E(label + ' عدد معتبر نیست: ' + raw.slice(0, 20), 'num_invalid', { f: f, v: raw.slice(0, 20) }); return ''; } return String(n); };
    const entry = num('entry', 'ورود'), sl = num('sl', 'SL'), tp = num('tp', 'TP'), exit = num('exit', 'خروج');
    let usd = num('usd', 'سود/زیان'), r = num('r', 'R');
    if (usd !== '' && opts.netOfCosts) { const c = U.toNum(get('commission')) || 0, sw = U.toNum(get('swap')) || 0; usd = String(U.round(+usd + c + sw, 6)); }
    if (r === '' && entry !== '' && sl !== '' && exit !== '' && dir) {
      const risk = dir === 'buy' ? +entry - +sl : +sl - +entry;
      if (risk > 0) { r = String(U.round((dir === 'buy' ? +exit - +entry : +entry - +exit) / risk, 4)); W('R از ورود/SL/خروج محاسبه شد', 'r_computed'); }
      else W('SL در سمت نادرست ورود است؛ R محاسبه نشد', 'r_sl_side');
    }
    if (usd === '' && r === '') W('نه R و نه سود/زیان موجود است؛ در آمار لحاظ نمی‌شود', 'no_outcome');
    if (errors.length) return { errors, warnings, items };
    return { errors, warnings, items, trade: { date: dt.date, time: dt.time, symbol: symbol.toUpperCase(), dir, entry, sl, tp, exit, r, usd, setup: get('setup'), note: get('note'), extId: get('extId') || undefined, mistakes: [], ruleCompliance: null } };
  }

  /** Full preview. Nothing is persisted. existing = current trades (for duplicate detection). */
  function preview(text, mapping, existing, opts) {
    const parsed = parseCSV(text, opts && opts.delimiter);
    const out = { delimiter: parsed.delimiter, headers: parsed.rows[0] || [], rows: [], counts: { ok: 0, error: 0, duplicate: 0, skipped: 0 }, fileErrors: [], fileErrorItems: [] };
    if (parsed.unterminatedQuote) { out.fileErrors.push('گیومه بسته‌نشده در فایل؛ ممکن است ردیف‌ها خراب شده باشند'); out.fileErrorItems.push({ code: 'unterminated', p: {} }); }
    if (parsed.rows.length < 2) { out.fileErrors.push('فایل داده‌ای ندارد'); out.fileErrorItems.push({ code: 'no_data', p: {} }); return out; }
    const map = mapping || suggestMapping(out.headers);
    for (const need of ['date', 'symbol', 'dir']) if (!(need in map)) { out.fileErrors.push('ستون الزامی نگاشت نشده: ' + need); out.fileErrorItems.push({ code: 'missing_col', p: { c: need } }); }
    if (out.fileErrors.some(e => e.startsWith('ستون'))) return out;
    const seen = new Set((existing || []).map(dupKey));
    parsed.rows.slice(1).forEach((cells, i) => {
      const line = i + 2, res = normalizeRow(cells, map, opts);
      let status, issues = res.errors.concat(res.warnings), issueItems = (res.items || []).slice();
      if (res.skipped) { status = 'skipped'; issues = [res.skipped]; issueItems = [res.skippedItem]; }
      else if (res.errors.length) status = 'error';
      else { const k = dupKey(res.trade); if (seen.has(k)) { status = 'duplicate'; issues.push('تکراری (موجود در ژورنال یا داخل همین فایل)'); issueItems.push({ code: 'duplicate', p: {} }); } else { status = 'ok'; seen.add(k); } }
      out.counts[status]++; out.rows.push({ line, status, trade: res.trade || null, issues, issueItems });
    });
    return out;
  }
  /** Stamp ok rows with ids + batch id, ready to be added by the caller. idGen must return unique numbers. */
  function commit(prev, batchId, idGen) {
    return prev.rows.filter(r => r.status === 'ok').map(r => Object.assign({}, r.trade, { id: idGen(), importBatch: batchId }));
  }
  /** Remove every trade that came from a batch (undo). Returns {trades, removed}. */
  function undoImport(trades, batchId) {
    const keep = trades.filter(t => t.importBatch !== batchId);
    return { trades: keep, removed: trades.length - keep.length };
  }
  return { FIELDS, parseCSV, detectDelimiter, suggestMapping, parseDateTime, parseDir, normalizeRow, preview, commit, undoImport, dupKey };
});
