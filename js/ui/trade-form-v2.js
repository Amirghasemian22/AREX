/* AREX V9.8.0 — ui/trade-form-v2: lots, fees, timeframe, open/close time, partial closes, account, setup quality, MAE/MFE,
   automatic RR / R / P&L. The legacy form stays intact; this module adds fields and hooks into save/edit/reset. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), tc = () => AREXCore.tradecalc, E = window.arexEscape;
  const TF = ['', 'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'], QUAL = [['', '—'], ['5', 'A+ (عالی)'], ['4', 'A'], ['3', 'B'], ['2', 'C'], ['1', 'D (ضعیف)']];
  let partials = [];
  const val = id => { const e = $(id); return e ? e.value : ''; };
  const num = v => tc().num(v);
  const HTML = `<div id="trV98" class="arex-trv98">
    <div class="arex-trv98-title">⚙️ جزئیات اجرا <small>(برای R و سود/زیان خودکار)</small></div>
    <div class="form-grid">
      <div><div class="field-lbl">حساب</div><select class="txt-input" id="trxAccount"></select></div>
      <div><div class="field-lbl">لات / حجم</div><input class="txt-input" id="trxLots" type="number" step="any" min="0" inputmode="decimal" placeholder="0.10"></div>
      <div><div class="field-lbl">تایم‌فریم</div><select class="txt-input" id="trxTf">${TF.map(t => `<option value="${t}">${t || '—'}</option>`).join('')}</select></div>
      <div><div class="field-lbl">کیفیت ستاپ</div><select class="txt-input" id="trxQuality">${QUAL.map(q => `<option value="${q[0]}">${q[1]}</option>`).join('')}</select></div>
      <div><div class="field-lbl">کمیسیون ($، معمولاً منفی)</div><input class="txt-input" id="trxComm" type="number" step="any" inputmode="decimal" placeholder="-3.5"></div>
      <div><div class="field-lbl">سواپ ($)</div><input class="txt-input" id="trxSwap" type="number" step="any" inputmode="decimal" placeholder="0"></div>
      <div><div class="field-lbl">زمان باز شدن</div><input class="txt-input" id="trxOpen" type="datetime-local"></div>
      <div><div class="field-lbl">زمان بسته شدن</div><input class="txt-input" id="trxClose" type="datetime-local"></div>
      <div><div class="field-lbl">MAE (بیشترین برگشت علیه تو، به R)</div><input class="txt-input" id="trxMae" type="number" step="any" min="0" inputmode="decimal" placeholder="0.4"></div>
      <div><div class="field-lbl">MFE (بیشترین سود شناور، به R)</div><input class="txt-input" id="trxMfe" type="number" step="any" min="0" inputmode="decimal" placeholder="2.1"></div>
    </div>
    <div class="field-lbl" style="margin-top:8px">بستن‌های جزئی <small>(قیمت و لات؛ میانگین وزنی خروج خودکار حساب می‌شود)</small></div>
    <div id="trxPartials"></div><button class="btn ghost" type="button" id="trxAddPartial">＋ بستن جزئی</button>
    <div id="trxPreview" class="arex-trx-preview" aria-live="polite"></div></div>`;

  function renderPartials() {
    $('trxPartials').innerHTML = partials.map((p, i) => `<div class="arex-partial"><input class="txt-input" type="number" step="any" inputmode="decimal" placeholder="قیمت" data-i="${i}" data-k="price" value="${E(p.price)}"><input class="txt-input" type="number" step="any" inputmode="decimal" placeholder="لات" data-i="${i}" data-k="lots" value="${E(p.lots)}"><button class="del-x" type="button" data-del="${i}" aria-label="حذف">✕</button></div>`).join('');
  }
  function draft() {
    return { symbol: val('trSymbol'), dir: val('trDir'), entry: val('trEntry'), sl: val('trSl'), slOriginal: val('trSlOrig') || null, tp: val('trTp'), exit: val('trExit'), r: val('trR'), gross: val('trUsd'), lots: val('trxLots'), commission: val('trxComm'), swap: val('trxSwap'), partials, openedAt: val('trxOpen'), closedAt: val('trxClose') };
  }
  function preview() {
    const d = draft(), e = tc().enrich(d), box = $('trxPreview'), parts = [];
    if (e.plannedRR) parts.push('RR برنامه‌ریزی‌شده <b>۱ : ' + arexFmt.fa(e.plannedRR) + '</b>');
    const r = num(d.r) !== null ? num(d.r) : (e.r ? num(e.r) : null);
    if (r !== null) parts.push('R واقعی <b class="' + (r < 0 ? 'neg' : 'pos') + '">' + arexFmt.fa(r) + 'R</b>' + (num(d.r) === null ? ' <small>(خودکار)</small>' : ''));
    if (e.exit !== undefined && num(d.exit) === null) parts.push('خروج میانگین <b>' + arexFmt.fa(e.exit) + '</b>');
    if (e.usd !== undefined) parts.push('سود/زیان خالص <b class="' + (+e.usd < 0 ? 'neg' : 'pos') + '">' + arexFmt.money(+e.usd) + '</b>' + (e.usdAuto ? ' <small>(تخمین USD)</small>' : ''));
    else if (num(d.gross) !== null) parts.push('خالص <b>' + arexFmt.money(tc().netUsd(d.gross, d.commission, d.swap)) + '</b>');
    if (e.durationMin !== undefined) parts.push('مدت <b>' + arexFmt.fa(e.durationMin >= 60 ? Math.floor(e.durationMin / 60) + 'س ' + (e.durationMin % 60) + 'د' : e.durationMin + 'د') + '</b>');
    box.innerHTML = parts.length ? parts.join(' · ') : '<span class="muted">ورود، حد ضرر، تارگت و خروج را وارد کن؛ RR و R خودکار محاسبه می‌شوند.</span>';
    const rEl = $('trR'), uEl = $('trUsd');
    if (rEl && !rEl.value) rEl.placeholder = e.r ? 'خودکار: ' + e.r : 'مثلاً 1.5 یا -1';
    if (uEl && !uEl.value) uEl.placeholder = e.gross ? 'خودکار: ' + e.gross : '';
  }
  function fillAccounts(sel) { const v = arexV98(); const s = $('trxAccount'); const cur = sel || s.value || v.activeAccountId; s.innerHTML = v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)} (${AREXCore.ledger.TYPES[a.type] || a.type})</option>`).join(''); s.value = v.accounts.some(a => a.id === cur) ? cur : v.activeAccountId; }

  /* ---- hooks called from the legacy save / edit / reset code ---- */
  window.arexTradeExtraApply = function (trade) {
    const v = arexV98(), n = id => num(val(id));
    trade.updatedAt = new Date().toISOString();
    trade.accountId = val('trxAccount') || v.activeAccountId; trade.lots = n('trxLots'); trade.timeframe = val('trxTf') || ''; trade.quality = val('trxQuality') || '';
    trade.commission = n('trxComm') || 0; trade.swap = n('trxSwap') || 0; trade.mae = n('trxMae'); trade.mfe = n('trxMfe');
    trade.partials = partials.filter(p => num(p.price) !== null && num(p.lots) > 0).map(p => ({ price: num(p.price), lots: num(p.lots) }));
    trade.openedAt = val('trxOpen') || (trade.date ? trade.date + 'T' + (trade.time || '00:00') : ''); trade.closedAt = val('trxClose') || '';
    const prev = (state.trades || []).find(x => x.id === trade.id);                          // editing: remember the ORIGINAL stop/target so changes are visible later
    if (prev) { if (num(prev.sl) !== null && num(trade.sl) !== null && num(prev.sl) !== num(trade.sl) && !trade.slOriginal) trade.slOriginal = prev.slOriginal || prev.sl; else if (prev.slOriginal && !trade.slOriginal) trade.slOriginal = prev.slOriginal;
      if (num(prev.tp) !== null && num(trade.tp) !== null && num(prev.tp) !== num(trade.tp)) trade.tpOriginal = prev.tpOriginal || prev.tp; else if (prev.tpOriginal) trade.tpOriginal = prev.tpOriginal; }
    if (!trade.riskPct && $('trRiskPct') && $('trRiskPct').value) trade.riskPct = $('trRiskPct').value;
    trade.gross = String(trade.usd == null ? '' : trade.usd);                               // the typed P/L is the GROSS result
    const e = tc().enrich(trade);
    if (e.exit !== undefined && !trade.exit) trade.exit = String(e.exit);
    if (e.r !== undefined && !String(trade.r).trim()) { trade.r = e.r; trade.rAuto = true; } else trade.rAuto = false;
    if (e.gross !== undefined && !String(trade.gross).trim()) { trade.gross = e.gross; trade.usdAuto = true; } else trade.usdAuto = false;
    const net = tc().netUsd(trade.gross, trade.commission, trade.swap); trade.usd = net === null ? '' : String(net);
    trade.plannedRR = e.plannedRR; if (e.durationMin !== undefined) trade.durationMin = e.durationMin; else delete trade.durationMin;
    if (typeof window.arexPlanCheck === 'function') { const msg = window.arexPlanCheck(trade); if (msg) { toast(msg); throw new Error('arex_plan_blocked'); } }
    return trade;
  };
  window.arexTradeExtraLoad = function (t) {
    fillAccounts(t.accountId); const set = (id, v) => { const e = $(id); if (e) e.value = v == null ? '' : v; };
    set('trxLots', t.lots); set('trxTf', t.timeframe); set('trxQuality', t.quality); set('trxComm', t.commission || ''); set('trxSwap', t.swap || ''); set('trxOpen', t.openedAt && /T/.test(t.openedAt) ? String(t.openedAt).slice(0, 16) : ''); set('trxClose', t.closedAt ? String(t.closedAt).slice(0, 16) : ''); set('trxMae', t.mae); set('trxMfe', t.mfe);
    if (t.gross !== undefined && t.gross !== '') set('trUsd', t.gross); if (t.rAuto) set('trR', '');            // auto values stay auto when editing
    partials = (t.partials || []).map(p => ({ price: p.price, lots: p.lots })); renderPartials(); preview();
  };
  window.arexTradeExtraReset = function () { ['trxLots', 'trxTf', 'trxQuality', 'trxComm', 'trxSwap', 'trxOpen', 'trxClose', 'trxMae', 'trxMfe'].forEach(id => { const e = $(id); if (e) e.value = ''; }); partials = []; renderPartials(); fillAccounts(arexV98().activeAccountId); preview(); };
  window.arexTradeMeta = function (t) { const v = arexV98(), a = v.accounts.find(x => x.id === t.accountId); return (t.lots ? ' · ' + t.lots + ' لات' : '') + (t.timeframe ? ' · ' + E(t.timeframe) : '') + (a && v.accounts.length > 1 ? ' · ' + E(a.name) : '') + (t.quality ? ' · کیفیت ' + E(QUAL.find(q => q[0] === String(t.quality)) ? QUAL.find(q => q[0] === String(t.quality))[1] : t.quality) : '') + (t.plannedRR ? ' · RR ' + t.plannedRR : '') + (t.rAuto ? ' · R خودکار' : ''); };

  function mount() {
    const sym = $('trSymbol'); if (!sym || $('trV98')) return; const grid = sym.closest('.form-grid'); if (!grid) return;
    grid.insertAdjacentHTML('afterend', HTML); fillAccounts(); renderPartials(); preview();
    const form = $('trV98');
    form.addEventListener('input', e => { const i = e.target.dataset && e.target.dataset.i; if (i !== undefined) partials[+i][e.target.dataset.k] = e.target.value; preview(); });
    $('trxAddPartial').addEventListener('click', () => { partials.push({ price: '', lots: '' }); renderPartials(); });
    $('trxPartials').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { partials.splice(+b.dataset.del, 1); renderPartials(); preview(); } });
    ['trSymbol', 'trDir', 'trEntry', 'trSl', 'trTp', 'trExit', 'trR', 'trUsd', 'trSlOrig'].forEach(id => { const e = $(id); if (e) { e.addEventListener('input', preview); e.addEventListener('change', preview); } });
    document.addEventListener('arex:view', e => { if (e.detail.name === 'trades') fillAccounts(); });
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
})();
