/* AREX V9.8.0 — core/report: professional monthly report (standalone printable HTML) and full CSV export. Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.report = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const out = t => { const r = num(t.r), u = num(t.usd); return r !== null && r !== 0 ? Math.sign(r) : (u !== null && u !== 0 ? Math.sign(u) : (r === 0 || u === 0 ? 0 : null)); };
  function stats(a) {
    const c = a.filter(t => out(t) !== null), w = c.filter(t => out(t) > 0), l = c.filter(t => out(t) < 0), rs = c.map(t => num(t.r)).filter(v => v !== null), us = c.map(t => num(t.usd)).filter(v => v !== null);
    const gw = us.filter(v => v > 0).reduce((x, y) => x + y, 0), gl = Math.abs(us.filter(v => v < 0).reduce((x, y) => x + y, 0));
    return { n: c.length, wins: w.length, losses: l.length, winRate: c.length ? r2(w.length / c.length * 100, 1) : null, totalR: rs.length ? r2(rs.reduce((x, y) => x + y, 0)) : null, avgR: rs.length ? r2(rs.reduce((x, y) => x + y, 0) / rs.length) : null,
      usd: us.length ? r2(us.reduce((x, y) => x + y, 0)) : null, pf: gl > 0 ? r2(gw / gl) : null, avgWin: w.length ? r2(w.map(t => num(t.usd) || 0).reduce((x, y) => x + y, 0) / w.length) : null, avgLoss: l.length ? r2(l.map(t => num(t.usd) || 0).reduce((x, y) => x + y, 0) / l.length) : null };
  }
  function group(trades, keyFn) { const m = {}; trades.forEach(t => [].concat(keyFn(t) || []).filter(Boolean).forEach(k => (m[k] = m[k] || []).push(t))); return Object.keys(m).map(k => Object.assign({ key: k }, stats(m[k]))).sort((a, b) => (b.usd || 0) - (a.usd || 0)); }
  const fmt = v => (v === null || v === undefined ? '—' : String(v));
  const money = v => (v === null || v === undefined ? '—' : (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US'));
  function equitySvg(pts) {
    if (pts.length < 2) return '<div class="muted">داده‌ی کافی برای منحنی سرمایه نیست.</div>';
    const W = 640, H = 180, min = Math.min(...pts, 0), max = Math.max(...pts, 0), span = (max - min) || 1, x = i => 10 + i * (W - 20) / (pts.length - 1), y = v => 10 + (max - v) * (H - 20) / span;
    const d = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="equity curve"><line x1="10" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" stroke="#bbb" stroke-dasharray="4"/><path d="${d}" fill="none" stroke="#1a73e8" stroke-width="2"/></svg>`;
  }
  const tbl = (title, rows) => rows.length ? `<h3>${esc(title)}</h3><table><thead><tr><th>مورد</th><th>معامله</th><th>برد٪</th><th>میانگین R</th><th>مجموع R</th><th>سود/زیان</th></tr></thead><tbody>${rows.slice(0, 12).map(r => `<tr><td>${esc(r.key)}</td><td>${r.n}</td><td>${fmt(r.winRate)}</td><td>${fmt(r.avgR)}</td><td>${fmt(r.totalR)}</td><td class="${(r.usd || 0) < 0 ? 'neg' : 'pos'}">${money(r.usd)}</td></tr>`).join('')}</tbody></table>` : '';

  /** opts: {title, month:'YYYY-MM'|null, trades, accounts:[{name,type,balance,deposits,withdrawals,maxDDpct}], quant:{...}, mc:{...}, generatedAt} */
  function monthly(opts) {
    const trades = (opts.trades || []).filter(t => !opts.month || String(t.date).startsWith(opts.month)).slice().sort((a, b) => (String(a.date) + String(a.time || '')).localeCompare(String(b.date) + String(b.time || '')));
    const s = stats(trades); let cum = 0; const curve = [0].concat(trades.filter(t => num(t.usd) !== null).map(t => (cum += num(t.usd)))); 
    const byDay = {}; trades.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + (num(t.usd) || 0); });
    const days = Object.keys(byDay).sort().map(d => `<div class="day ${byDay[d] < 0 ? 'neg' : 'pos'}" title="${esc(d)}"><small>${esc(d.slice(8))}</small><b>${money(r2(byDay[d]))}</b></div>`).join('');
    const withSl = trades.filter(t => num(t.sl) !== null).length, comp = trades.map(t => num(t.ruleCompliance)).filter(v => v !== null), prr = trades.map(t => num(t.plannedRR)).filter(v => v !== null);
    const ranked = trades.filter(t => num(t.usd) !== null).slice().sort((a, b) => num(b.usd) - num(a.usd)), row = t => `<tr><td>${esc(t.date)}</td><td>${esc(t.symbol)}</td><td>${esc(t.dir)}</td><td>${esc(t.setup || '')}</td><td>${fmt(num(t.r))}</td><td>${money(num(t.usd))}</td></tr>`;
    const q = opts.quant || {}, mc = opts.mc && !opts.mc.insufficient ? opts.mc : null;
    const kpi = (l, v) => `<div class="kpi"><small>${esc(l)}</small><b>${esc(v)}</b></div>`;
    return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title || 'AREX')} — ${esc(opts.month || 'گزارش')}</title>
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Vazirmatn,Tahoma,system-ui,sans-serif;color:#111;background:#fff;margin:0;padding:18px;line-height:1.7;font-size:13px}h1{margin:0 0 2px;font-size:22px}h2{font-size:16px;margin:20px 0 8px;border-bottom:2px solid #1a73e8;padding-bottom:4px}h3{font-size:13px;margin:14px 0 4px}.muted{color:#666}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kpi{border:1px solid #ddd;border-radius:10px;padding:8px 10px}.kpi small{display:block;color:#666;font-size:11px}.kpi b{font-size:16px;direction:ltr;unicode-bidi:plaintext}table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px}th,td{border-bottom:1px solid #e5e5e5;padding:4px 6px;text-align:right}th{background:#f4f6fa}.pos{color:#0a7d3b}.neg{color:#c62828}.days{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px}.day{border:1px solid #ddd;border-radius:8px;padding:4px 6px;text-align:center}.day.pos{background:#e8f6ee}.day.neg{background:#fdecea}.day small{display:block;color:#666}svg{width:100%;height:auto}.foot{margin-top:18px;color:#888;font-size:11px}@media print{body{padding:0}.noprint{display:none}h2,table{break-inside:avoid}}@media(max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}}</style></head><body>
<button class="noprint" onclick="window.print()" style="float:left;padding:8px 14px">چاپ / ذخیره PDF</button>
<h1>${esc(opts.title || 'AREX')} — گزارش ${esc(opts.month || 'کل دوره')}</h1><div class="muted">تولید شده در ${esc(opts.generatedAt || '')} · ${s.n} معامله بسته‌شده</div>
<h2>خلاصه</h2><div class="kpis">${kpi('سود/زیان خالص', money(s.usd))}${kpi('مجموع R', fmt(s.totalR))}${kpi('وین‌ریت', s.winRate === null ? '—' : s.winRate + '٪')}${kpi('میانگین R', fmt(s.avgR))}${kpi('ضریب سود', fmt(s.pf))}${kpi('میانگین برد', money(s.avgWin))}${kpi('میانگین باخت', money(s.avgLoss))}${kpi('پایبندی به SL', trades.length ? Math.round(withSl / trades.length * 100) + '٪' : '—')}</div>
<h2>منحنی سرمایه (سود/زیان تجمعی)</h2>${equitySvg(curve)}
<h2>سود و زیان روزانه</h2><div class="days">${days || '<span class="muted">—</span>'}</div>
${opts.accounts && opts.accounts.length ? `<h2>حساب‌ها</h2><table><thead><tr><th>حساب</th><th>نوع</th><th>موجودی</th><th>واریز</th><th>برداشت</th><th>حداکثر افت</th></tr></thead><tbody>${opts.accounts.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${money(a.balance)}</td><td>${money(a.deposits)}</td><td>${money(a.withdrawals)}</td><td>${fmt(a.maxDDpct)}٪</td></tr>`).join('')}</tbody></table>` : ''}
<h2>تفکیک عملکرد</h2>${tbl('ستاپ', group(trades, t => t.setup))}${tbl('نماد', group(trades, t => t.symbol && String(t.symbol).toUpperCase()))}${tbl('سشن', group(trades, t => t.sessions))}${tbl('روز هفته', group(trades, t => t.date && WD[new Date(t.date + 'T12:00:00').getDay()]))}${tbl('اشتباهات', group(trades, t => t.mistakes))}
<h2>انضباط و کیفیت اجرا</h2><div class="kpis">${kpi('میانگین پایبندی به قوانین', comp.length ? Math.round(comp.reduce((a, b) => a + b, 0) / comp.length) + '٪' : '—')}${kpi('میانگین RR برنامه‌ریزی‌شده', prr.length ? r2(prr.reduce((a, b) => a + b, 0) / prr.length) : '—')}${kpi('Sharpe (R)', fmt(q.sharpeR))}${kpi('Sortino (R)', fmt(q.sortinoR))}</div>
${mc ? `<h2>شبیه‌سازی مونت‌کارلو (${mc.trials} اجرا، ${mc.horizon} معامله، ریسک ${mc.riskPct}٪)</h2><div class="kpis">${kpi('احتمال ریسک نابودی (افت ' + mc.ruinPct + '٪)', mc.ruinProb + '٪')}${kpi('احتمال سود', mc.profitProb + '٪')}${kpi('افت میانه', mc.ddMedianPct + '٪')}${kpi('افت بدترین ۵٪', mc.ddP95Pct + '٪')}</div>` : ''}
${ranked.length ? `<h2>بهترین و بدترین معاملات</h2><table><thead><tr><th>تاریخ</th><th>نماد</th><th>جهت</th><th>ستاپ</th><th>R</th><th>سود/زیان</th></tr></thead><tbody>${ranked.slice(0, 5).map(row).join('')}${ranked.length > 5 ? ranked.slice(-5).reverse().map(row).join('') : ''}</tbody></table>` : ''}
<div class="foot">این گزارش از داده‌های ژورنال شخصی ساخته شده است؛ توصیه‌ی مالی یا تضمین سود نیست.</div></body></html>`;
  }
  const COLS = ['id', 'date', 'time', 'openedAt', 'closedAt', 'accountId', 'symbol', 'dir', 'lots', 'timeframe', 'entry', 'sl', 'slOriginal', 'tp', 'exit', 'plannedRR', 'r', 'mae', 'mfe', 'gross', 'commission', 'swap', 'usd', 'setup', 'quality', 'ruleCompliance', 'riskPct', 'emotionBefore', 'emotionAfter', 'mistakes', 'tags', 'note', 'ticket', 'source'];
  function tradesToCsv(trades) {
    const q = v => { const s = Array.isArray(v) ? v.join('|') : String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '\uFEFF' + COLS.join(',') + '\n' + trades.map(t => COLS.map(c => q(t[c])).join(',')).join('\n');
  }
  return { stats, group, monthly, tradesToCsv, COLS, esc };
});
