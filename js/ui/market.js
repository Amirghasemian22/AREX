/* AREX V9.8.0 — ui/market: watchlist with live quotes (via your Worker /market), price alerts, and market-reaction capture after news. */
(function () {
  'use strict';
  if (!window.arexRegisterView) return;
  const $ = id => document.getElementById(id), E = window.arexEscape;
  const SYMS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY', 'EUR/GBP', 'XAU/USD', 'XAG/USD', 'DJI', 'SPX', 'NDX'];
  const base = () => (window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL()) || '';
  let quotes = {}, last = 0, timer = null, busy = false, err = '';
  const HTML = `<div class="card"><div class="section-title">👁️ واچ‌لیست</div>
    <div class="arex-wl-add"><select class="txt-input" id="arexWlSel"></select><button class="btn" id="arexWlAdd" type="button">＋ افزودن</button><button class="btn ghost" id="arexWlRefresh" type="button">↻ تازه‌سازی</button></div>
    <div id="arexWlStatus" class="calc-hint" role="status"></div><div id="arexWlList" class="arex-wl-list"></div></div>
  <div class="grid g2"><div class="card"><div class="section-title">🔔 هشدار قیمت</div>
    <form id="arexPaForm" class="form-grid" autocomplete="off"><div><div class="field-lbl">نماد</div><select class="txt-input" id="arexPaSym"></select></div><div><div class="field-lbl">شرط</div><select class="txt-input" id="arexPaDir"><option value="above">رسید/بالاتر از</option><option value="below">رسید/پایین‌تر از</option></select></div>
      <div><div class="field-lbl">قیمت</div><input class="txt-input" id="arexPaPrice" type="number" step="any" inputmode="decimal" required></div><div><div class="field-lbl">یادداشت</div><input class="txt-input" id="arexPaNote" maxlength="60"></div>
      <div class="arex-span2"><button class="btn" type="submit">افزودن هشدار</button></div></form><div id="arexPaList"></div></div>
  <div class="card"><div class="section-title">📰 واکنش بازار به خبر</div><div class="calc-hint">برنامه هنگام باز بودن، قیمت نمادهای واچ‌لیست را دقیقه‌ی خبر مهم و ۱۵ و ۶۰ دقیقه بعد ثبت می‌کند و میانگین حرکت هر خبر را می‌سازد.</div><div id="arexNrList"></div></div></div>`;

  const pair = s => s;
  async function fetchQuotes() {
    const v = arexV98(), list = v.watchlist.concat(v.alerts.filter(a => a.on).map(a => a.symbol)); const syms = [...new Set(list)].slice(0, 8);
    if (!syms.length) { err = ''; return; } if (!base()) { err = 'آدرس Worker تنظیم نشده (تنظیمات ← اعلان‌ها).'; return; }
    try { const r = await fetch(base() + '/market?symbols=' + encodeURIComponent(syms.join(',')), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); (d.quotes || []).forEach(q => { if (q && q.symbol && Number.isFinite(+q.price)) { const prev = quotes[q.symbol]; quotes[q.symbol] = { price: +q.price, prev: prev ? prev.price : null, at: Date.now() }; } }); err = ''; last = Date.now(); }
    catch (e) { err = 'دریافت قیمت ممکن نشد: ' + (e.message || e); }
  }
  function checkAlerts() {
    const v = arexV98(); let changed = false;
    v.alerts.forEach(a => { const q = quotes[a.symbol]; if (!a.on || !q) return; const hit = a.dir === 'above' ? q.price >= a.price : q.price <= a.price;
      if (hit) { a.on = false; a.firedAt = new Date().toISOString(); changed = true; notify('هشدار قیمت ' + a.symbol, (a.dir === 'above' ? 'رسید به ' : 'افتاد به ') + q.price + ' (هدف ' + a.price + ')' + (a.note ? ' — ' + a.note : ''), '🎯', { view: 'market', tag: 'pa-' + a.id }); } });
    if (changed) arexV98Save();
  }
  function captureNews() {
    const v = arexV98(), evs = window.__arexFcEvents || [], now = Date.now(), wl = v.watchlist; if (!wl.length) return; let changed = false;
    evs.filter(e => /high|3|red/i.test(String(e.impact || e._impact || ''))).forEach(e => { const t = e.date instanceof Date ? e.date.getTime() : Date.parse(e.date); if (!Number.isFinite(t)) return; const age = (now - t) / 60000;
      const slot = age >= -3 && age <= 3 ? 'p0' : age >= 12 && age <= 20 ? 'p15' : age >= 55 && age <= 70 ? 'p60' : null; if (!slot) return;
      const rec = v.reactions[e.id] = v.reactions[e.id] || { name: e.name, country: e.country, at: new Date(t).toISOString(), prices: {} };
      wl.forEach(s => { const q = quotes[s]; if (!q || now - q.at > 150000) return; const p = rec.prices[s] = rec.prices[s] || {}; if (p[slot] === undefined) { p[slot] = q.price; changed = true; } }); });
    if (changed) arexV98Save();
  }
  function render() {
    const v = arexV98(); if (!$('arexWlList')) return;
    $('arexWlSel').innerHTML = SYMS.filter(s => !v.watchlist.includes(s)).map(s => `<option>${s}</option>`).join('');
    $('arexPaSym').innerHTML = SYMS.map(s => `<option>${s}</option>`).join('');
    $('arexWlStatus').textContent = err || (last ? 'آخرین به‌روزرسانی: ' + new Date(last).toLocaleTimeString('fa-IR') + ' · هر ۶۰ ثانیه تا زمانی که برنامه باز است' : (base() ? 'برای دیدن قیمت‌ها نماد اضافه کن.' : 'برای قیمت زنده، آدرس Worker را در تنظیمات اعلان‌ها وارد کن (Worker با کلید Twelve Data).'));
    $('arexWlList').innerHTML = v.watchlist.length ? v.watchlist.map(s => { const q = quotes[s], d = q && q.prev !== null ? q.price - q.prev : null; return `<div class="arex-wl-row"><b>${E(s)}</b><span class="arex-wl-price">${q ? q.price : '—'}</span><span class="${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d === null ? '' : (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + Math.abs(d).toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}</span><button class="del-x" data-wl="${E(s)}" aria-label="حذف">✕</button></div>`; }).join('') : '<div class="empty">واچ‌لیست خالی است.</div>';
    $('arexPaList').innerHTML = v.alerts.length ? v.alerts.map(a => `<div class="arex-wl-row"><b>${E(a.symbol)}</b><span>${a.dir === 'above' ? '≥' : '≤'} ${a.price}</span><span class="${a.on ? 'pos' : 'muted'}">${a.on ? 'فعال' : 'فعال‌شده'}</span><button class="del-x" data-pa="${E(a.id)}" aria-label="حذف">✕</button></div>`).join('') : '<div class="empty">هشداری تعریف نشده.</div>';
    const names = {}; Object.values(v.reactions).forEach(r => { Object.keys(r.prices).forEach(s => { const p = r.prices[s]; if (p.p0 && p.p15) { const k = r.name + '|' + s; (names[k] = names[k] || []).push({ d15: (p.p15 - p.p0) / p.p0 * 100, d60: p.p60 ? (p.p60 - p.p0) / p.p0 * 100 : null }); } }); });
    const rows = Object.keys(names).map(k => { const [n, s] = k.split('|'), a = names[k], avg = (x) => x.length ? x.reduce((p, c) => p + Math.abs(c), 0) / x.length : null, d60 = a.map(x => x.d60).filter(x => x !== null); return `<tr><td>${E(n)}</td><td>${E(s)}</td><td>${arexFmt.fa(a.length)}</td><td>${arexFmt.fa(avg(a.map(x => x.d15)).toFixed(2))}٪</td><td>${d60.length ? arexFmt.fa(avg(d60).toFixed(2)) + '٪' : '—'}</td></tr>`; });
    $('arexNrList').innerHTML = rows.length ? `<div class="arex-imp-table"><table class="arex-table"><thead><tr><th>خبر</th><th>نماد</th><th>دفعات</th><th>میانگین حرکت ۱۵د</th><th>۶۰د</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<div class="empty">هنوز واکنشی ثبت نشده؛ برنامه باید هنگام انتشار خبر مهم باز و Worker متصل باشد.</div>';
  }
  async function tick() { if (busy || document.hidden) return; busy = true; try { await fetchQuotes(); checkAlerts(); captureNews(); if ($('view-market') && $('view-market').classList.contains('active')) render(); } finally { busy = false; } }
  function startTimer() { if (timer) return; timer = setInterval(tick, 60000); setTimeout(tick, 5000); }
  function mount() {
    const sec = arexRegisterView({ id: 'market', title: 'بازار و هشدارها', sub: 'واچ‌لیست، هشدار قیمت و واکنش بازار به خبر', html: HTML, icon: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>', onShow: () => { render(); tick(); } }); if (!sec) return;
    $('arexWlAdd').addEventListener('click', () => { const v = arexV98(), s = $('arexWlSel').value; if (s && !v.watchlist.includes(s)) { v.watchlist.push(s); arexV98Save(); render(); tick(); } });
    $('arexWlRefresh').addEventListener('click', () => { tick().then(render); });
    $('arexWlList').addEventListener('click', e => { const b = e.target.closest('[data-wl]'); if (b) { const v = arexV98(); v.watchlist = v.watchlist.filter(s => s !== b.dataset.wl); arexV98Save(); render(); } });
    $('arexPaForm').addEventListener('submit', e => { e.preventDefault(); const v = arexV98(), price = parseFloat($('arexPaPrice').value); if (!Number.isFinite(price)) return; v.alerts.push({ id: AREXCore.ledger.uid('pa'), symbol: $('arexPaSym').value, dir: $('arexPaDir').value, price, note: $('arexPaNote').value.trim(), on: true, createdAt: new Date().toISOString() }); arexV98Save(); $('arexPaPrice').value = ''; $('arexPaNote').value = ''; render(); tick(); toast('هشدار قیمت ثبت شد ✓'); });
    $('arexPaList').addEventListener('click', e => { const b = e.target.closest('[data-pa]'); if (b) { const v = arexV98(); v.alerts = v.alerts.filter(a => a.id !== b.dataset.pa); arexV98Save(); render(); } });
    startTimer();
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
})();
