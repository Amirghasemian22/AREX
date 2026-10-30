/* AREX V9.8.0 — ui/accounts: demo/live/prop accounts, deposits & withdrawals ledger, real-balance equity curve. */
(function () {
  'use strict';
  if (!window.arexRegisterView) return;
  const E = window.arexEscape, $ = id => document.getElementById(id), LG = () => AREXCore.ledger, money = v => arexFmt.money(v);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const HTML = `
  <div class="card arex-acc-top" id="arexAccTotal"></div>
  <div class="arex-acc-grid" id="arexAccList"></div>
  <div class="grid g2 arex-acc-forms">
    <div class="card"><div class="section-title">＋ حساب جدید / ویرایش</div>
      <form id="arexAccForm" class="form-grid" autocomplete="off">
        <input type="hidden" id="arexAccId">
        <div><div class="field-lbl">نام حساب</div><input class="txt-input" id="arexAccName" required maxlength="40" placeholder="مثلاً پراپ ۱۰K"></div>
        <div><div class="field-lbl">نوع</div><select class="txt-input" id="arexAccType"><option value="live">لایو</option><option value="demo">دمو</option><option value="prop">پراپ</option></select></div>
        <div><div class="field-lbl">موجودی اولیه ($)</div><input class="txt-input" id="arexAccStart" type="number" step="any" min="0" inputmode="decimal" required></div>
        <div><div class="field-lbl">واحد پول</div><input class="txt-input" id="arexAccCur" value="USD" maxlength="5"></div>
        <div class="arex-span2" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit" id="arexAccSave">ذخیره حساب</button><button class="btn ghost" type="button" id="arexAccCancel" style="display:none">انصراف</button></div>
      </form></div>
    <div class="card"><div class="section-title">💸 واریز / برداشت</div>
      <form id="arexLedgerForm" class="form-grid" autocomplete="off">
        <div><div class="field-lbl">حساب</div><select class="txt-input" id="arexLedAcc"></select></div>
        <div><div class="field-lbl">نوع</div><select class="txt-input" id="arexLedType"><option value="deposit">واریز</option><option value="withdraw">برداشت</option></select></div>
        <div><div class="field-lbl">مبلغ ($)</div><input class="txt-input" id="arexLedAmt" type="number" step="any" min="0" inputmode="decimal" required></div>
        <div><div class="field-lbl">تاریخ</div><input class="txt-input" id="arexLedDate" type="date"></div>
        <div class="arex-span2"><div class="field-lbl">توضیح (اختیاری)</div><input class="txt-input" id="arexLedNote" maxlength="80"></div>
        <div class="arex-span2"><button class="btn" type="submit">ثبت</button></div>
      </form></div>
  </div>
  <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="section-title" style="margin:0">📈 منحنی موجودی واقعی</div><select class="txt-input" id="arexAccCurveSel" style="max-width:220px"></select></div><div id="arexAccCurve"></div><div class="calc-hint">موجودی = موجودی اولیه + واریزها − برداشت‌ها + سود/زیان خالص معاملات. حداکثر افت بر اساس سرمایه‌ی تعدیل‌شده با واریز/برداشت محاسبه می‌شود.</div></div>
  <div class="card"><div class="section-title">🧾 دفتر واریز و برداشت</div><div id="arexLedList"></div></div>`;

  function curve(points) {
    if (points.length < 2) return '<div class="empty">برای رسم منحنی حداقل یک رویداد (معامله یا واریز) لازم است.</div>';
    const W = 640, H = 220, vals = points.map(p => p.balance), min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
    const x = i => 12 + i * (W - 24) / (points.length - 1), y = v => 14 + (max - v) * (H - 34) / span;
    const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.balance).toFixed(1)).join(' ');
    const flows = points.map((p, i) => (p.k === 'deposit' || p.k === 'withdraw') ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.balance).toFixed(1)}" r="4" fill="${p.k === 'deposit' ? '#33c589' : '#f87171'}"><title>${p.k === 'deposit' ? 'واریز' : 'برداشت'}</title></circle>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="arex-curve" role="img" aria-label="equity"><defs><linearGradient id="arexAccG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1e90ff" stop-opacity=".35"/><stop offset="1" stop-color="#1e90ff" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${x(points.length - 1)} ${H - 20} L12 ${H - 20} Z" fill="url(#arexAccG)"/><path d="${d}" fill="none" stroke="#1e90ff" stroke-width="2.2"/>${flows}
      <text x="12" y="12" font-size="11" fill="currentColor" opacity=".7">${money(max)}</text><text x="12" y="${H - 6}" font-size="11" fill="currentColor" opacity=".7">${money(min)}</text></svg>`;
  }
  function propPanel(a, s) {
    const c = a && a.propRules ? AREXCore.prop.compute(a, AREXCore.ledger.tradesOf(state.trades || [], arexV98(), a.id), arexV98().ledger, new Date()) : null;
    if (!c || c.error) return `<div class="arex-prop"><div class="calc-hint">${c && c.error ? E(c.error) : 'قوانین پراپ این حساب تنظیم نشده.'}</div><button class="btn ghost" data-act="prop" data-id="${E(a.id)}" type="button">⚙️ تنظیم قوانین پراپ</button></div>`;
    const bar = (label, frac, text, st) => `<div class="arex-prop-row"><div class="arex-prop-lbl"><span>${label}</span><b class="${st === 'breach' ? 'neg' : st === 'warn' ? 'warn' : 'pos'}">${text}</b></div><div class="arex-bar"><i class="${st}" style="width:${Math.min(100, Math.round(frac * 100))}%"></i></div></div>`;
    const d = c.rules.dailyLoss, m = c.rules.totalLoss;
    return `<div class="arex-prop"><div class="arex-prop-head"><b>قوانین پراپ</b><span class="arex-badge ${c.overall === 'breach' ? 'prop' : c.overall === 'warn' ? 'demo' : 'on'}">${c.overall === 'breach' ? 'نقض شد' : c.overall === 'warn' ? 'نزدیک حد' : 'در محدوده'}</span></div>
      ${bar('افت روزانه', d.usedFrac, money(d.usedUsd) + ' از ' + money(d.limitUsd) + ' · باقی ' + money(d.remainingUsd), d.state)}${bar('افت کل ' + (m.type === 'trailing' ? '(شناور)' : '(ثابت)'), m.usedFrac, money(m.usedUsd) + ' از ' + money(m.limitUsd) + ' · کف ' + money(m.floor), m.state)}
      ${c.target.usd > 0 ? bar('هدف سود', c.target.progress || 0, money(c.pnl) + ' از ' + money(c.target.usd), c.target.reached ? 'ok' : 'ok') : ''}
      <div class="calc-hint">روز معاملاتی: ${arexFmt.fa(c.days.count)}${c.days.min ? ' از حداقل ' + arexFmt.fa(c.days.min) : ''} ${c.readyToPass ? '· ✅ شرایط عبور کامل است' : ''}<br>بر پایه‌ی سود/زیان معاملات بسته؛ سود/زیان شناور را بروکر ملاک می‌کند. قوانین را مطابق شرکت خودت تنظیم کن.</div>
      <button class="btn ghost" data-act="prop" data-id="${E(a.id)}" type="button">⚙️ ویرایش قوانین</button></div>`;
  }
  function propEditor(a) {
    const T = AREXCore.prop.TEMPLATES, r = a.propRules || Object.assign({}, T.challenge10, { startDate: new Date().toISOString().slice(0, 10) });
    const bg = document.createElement('div'); bg.className = 'arex-modal-bg'; bg.innerHTML = `<div class="arex-modal" role="dialog"><div class="arex-modal-head"><b>قوانین پراپ — ${E(a.name)}</b><button class="icon-btn" type="button" id="pe_x" aria-label="بستن">✕</button></div>
      <div class="calc-hint">قالب‌ها فقط نمونه‌ی عمومی‌اند؛ اعداد دقیق شرکت خودت را وارد کن.</div><div class="field-lbl">قالب</div><select class="txt-input" id="pe_t">${Object.keys(T).map(k => `<option value="${k}">${E(T[k].label)}</option>`).join('')}</select>
      <div class="form-grid"><div><div class="field-lbl">افت روزانه ٪</div><input class="txt-input" id="pe_d" type="number" step="0.1" value="${r.dailyDDPct}"></div><div><div class="field-lbl">افت کل ٪</div><input class="txt-input" id="pe_m" type="number" step="0.1" value="${r.maxDDPct}"></div><div><div class="field-lbl">نوع افت کل</div><select class="txt-input" id="pe_ty"><option value="static" ${r.ddType !== 'trailing' ? 'selected' : ''}>ثابت (از موجودی اولیه)</option><option value="trailing" ${r.ddType === 'trailing' ? 'selected' : ''}>شناور (از اوج)</option></select></div><div><div class="field-lbl">هدف سود ٪ (۰ = ندارد)</div><input class="txt-input" id="pe_g" type="number" step="0.1" value="${r.targetPct}"></div><div><div class="field-lbl">حداقل روز معاملاتی</div><input class="txt-input" id="pe_n" type="number" value="${r.minDays}"></div><div><div class="field-lbl">تاریخ شروع</div><input class="txt-input" id="pe_s" type="date" value="${E(r.startDate || '')}"></div></div>
      <div class="arex-modal-foot"><button class="btn ghost" id="pe_off" type="button">حذف قوانین</button><button class="btn" id="pe_ok" type="button">ذخیره</button></div></div>`;
    document.body.appendChild(bg); const $$ = id => bg.querySelector('#' + id), close = () => bg.remove(); $$('pe_x').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
    $$('pe_t').onchange = e => { const t = T[e.target.value]; $$('pe_d').value = t.dailyDDPct; $$('pe_m').value = t.maxDDPct; $$('pe_ty').value = t.ddType; $$('pe_g').value = t.targetPct; $$('pe_n').value = t.minDays; };
    $$('pe_off').onclick = () => { delete a.propRules; arexV98Save(); close(); render(); };
    $$('pe_ok').onclick = () => { a.propRules = { dailyDDPct: +$$('pe_d').value || 0, maxDDPct: +$$('pe_m').value || 0, ddType: $$('pe_ty').value, targetPct: +$$('pe_g').value || 0, minDays: +$$('pe_n').value || 0, startDate: $$('pe_s').value || '' }; arexV98Save(); close(); render(); toast('قوانین پراپ ذخیره شد ✓'); };
  }
  window.arexPropGuard = function () { const v = arexV98(), a = v.accounts.find(x => x.id === v.activeAccountId); if (!a || a.type !== 'prop' || !a.propRules) return null; const c = AREXCore.prop.compute(a, AREXCore.ledger.tradesOf(state.trades || [], v, a.id), v.ledger, new Date()); return c && !c.error ? { overall: c.overall, rules: { dailyLoss: c.rules.dailyLoss, totalLoss: c.rules.totalLoss } } : null; };
  function render() {
    const v = arexV98(), LGR = LG(), trades = state.trades || [], sums = LGR.all(v, trades);
    const total = sums.reduce((a, s) => a + s.balance, 0), pnl = sums.reduce((a, s) => a + s.pnl, 0);
    $('arexAccTotal').innerHTML = `<div class="arex-acc-total"><div><small>مجموع موجودی همه حساب‌ها</small><b>${money(total)}</b></div><div><small>سود/زیان خالص کل</small><b class="${pnl < 0 ? 'neg' : 'pos'}">${money(pnl)}</b></div><div><small>تعداد حساب</small><b>${arexFmt.fa(sums.length)}</b></div></div>`;
    $('arexAccList').innerHTML = sums.map(s => { const a = v.accounts.find(x => x.id === s.id), act = v.activeAccountId === s.id;
      return `<div class="card arex-acc-card ${act ? 'active' : ''}"><div class="arex-acc-head"><b>${E(s.name)}</b><span class="arex-badge ${s.type}">${LGR.TYPES[s.type] || s.type}</span>${act ? '<span class="arex-badge on">فعال</span>' : ''}</div>
        <div class="arex-acc-bal">${money(s.balance)}</div>
        <div class="arex-acc-stats"><span>سود/زیان <b class="${s.pnl < 0 ? 'neg' : 'pos'}">${money(s.pnl)}</b></span><span>بازده <b>${s.returnPct === null ? '—' : arexFmt.fa(s.returnPct) + '٪'}</b></span><span>حداکثر افت <b>${arexFmt.fa(s.maxDDpct)}٪</b></span><span>معاملات <b>${arexFmt.fa(s.trades)}</b></span><span>واریز <b>${money(s.deposits)}</b></span><span>برداشت <b>${money(s.withdrawals)}</b></span></div>
        ${s.type === 'prop' ? propPanel(a, s) : ''}
        <div class="arex-acc-actions">${act ? '' : `<button class="btn ghost" data-act="use" data-id="${E(s.id)}">فعال کن</button>`}<button class="btn ghost" data-act="risk" data-id="${E(s.id)}" title="موجودی این حساب به‌عنوان مبنای محاسبه ریسک">مبنای ریسک</button><button class="btn ghost" data-act="edit" data-id="${E(s.id)}">ویرایش</button>${v.accounts.length > 1 ? `<button class="btn ghost" data-act="del" data-id="${E(s.id)}">حذف</button>` : ''}</div></div>`; }).join('');
    const opts = v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)}</option>`).join('');
    $('arexLedAcc').innerHTML = opts; $('arexLedAcc').value = v.activeAccountId;
    const sel = $('arexAccCurveSel'), prev = sel.value; sel.innerHTML = '<option value="__all">همه حساب‌ها (مجموع)</option>' + opts; sel.value = [...sel.options].some(o => o.value === prev) ? prev : v.activeAccountId;
    const pts = sel.value === '__all' ? LGR.combined(v, trades) : LGR.series(v.accounts.find(a => a.id === sel.value), LGR.tradesOf(trades, v, sel.value), v.ledger).points;
    $('arexAccCurve').innerHTML = curve(pts);
    const rows = v.ledger.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40);
    $('arexLedList').innerHTML = rows.length ? rows.map(l => { const a = v.accounts.find(x => x.id === l.accountId); return `<div class="arex-led-row"><span>${E(l.date)}</span><span>${E(a ? a.name : '—')}</span><b class="${l.type === 'withdraw' ? 'neg' : 'pos'}">${l.type === 'withdraw' ? '−' : '+'}${money(Math.abs(l.amount))}</b><span class="muted">${E(l.note || '')}</span><button class="del-x" data-led="${E(l.id)}" aria-label="حذف">✕</button></div>`; }).join('') : '<div class="empty">هنوز واریز یا برداشتی ثبت نشده.</div>';
  }
  function resetForm() { $('arexAccId').value = ''; $('arexAccForm').reset(); $('arexAccCur').value = 'USD'; $('arexAccCancel').style.display = 'none'; $('arexAccSave').textContent = 'ذخیره حساب'; }
  function mount() {
    const sec = arexRegisterView({ id: 'accounts', title: 'حساب‌ها و دفتر', sub: 'دمو، لایو و پراپ جدا؛ موجودی واقعی با واریز و برداشت', html: HTML, icon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>', onShow: render });
    if (!sec) return;
    $('arexLedDate').value = today();
    $('arexAccForm').addEventListener('submit', e => { e.preventDefault(); const v = arexV98(), id = $('arexAccId').value, name = $('arexAccName').value.trim(); if (!name) return;
      const rec = { name, type: $('arexAccType').value, start: Math.max(0, parseFloat($('arexAccStart').value) || 0), currency: ($('arexAccCur').value || 'USD').toUpperCase() };
      if (id) Object.assign(v.accounts.find(a => a.id === id) || {}, rec); else { const a = Object.assign({ id: LG().uid('acc'), createdAt: new Date().toISOString() }, rec); v.accounts.push(a); if (v.accounts.length === 2 && !(state.trades || []).some(t => t.accountId)) { /* keep first as default */ } }
      arexV98Save(); resetForm(); render(); toast('حساب ذخیره شد ✓'); });
    $('arexAccCancel').addEventListener('click', resetForm);
    $('arexLedgerForm').addEventListener('submit', e => { e.preventDefault(); const v = arexV98(), amt = Math.abs(parseFloat($('arexLedAmt').value));
      if (!(amt > 0)) { toast('مبلغ معتبر وارد کن'); return; }
      v.ledger.push({ id: LG().uid('led'), accountId: $('arexLedAcc').value, type: $('arexLedType').value, amount: amt, date: $('arexLedDate').value || today(), note: $('arexLedNote').value.trim() });
      arexV98Save(); $('arexLedAmt').value = ''; $('arexLedNote').value = ''; render(); toast('ثبت شد ✓'); });
    $('arexAccList').addEventListener('click', e => { const b = e.target.closest('button[data-act]'); if (!b) return; const v = arexV98(), a = v.accounts.find(x => x.id === b.dataset.id); if (!a) return;
      if (b.dataset.act === 'use') { v.activeAccountId = a.id; arexV98Save(); render(); }
      else if (b.dataset.act === 'edit') { $('arexAccId').value = a.id; $('arexAccName').value = a.name; $('arexAccType').value = a.type; $('arexAccStart').value = a.start; $('arexAccCur').value = a.currency || 'USD'; $('arexAccCancel').style.display = ''; $('arexAccSave').textContent = 'ذخیره تغییرات'; $('arexAccName').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      else if (b.dataset.act === 'risk') { const s = LG().summary(a, LG().tradesOf(state.trades || [], v, a.id), v.ledger); state.riskLimits = state.riskLimits || {}; state.riskLimits.balance = s.balance; queueSave('riskLimits'); toast('موجودی ' + a.name + ' مبنای محاسبه ریسک شد ✓'); }
      else if (b.dataset.act === 'prop') { propEditor(a); }
      else if (b.dataset.act === 'del') { if (!confirm('حساب «' + a.name + '» حذف شود؟ معاملات آن حذف نمی‌شوند و به حساب اول منتقل می‌شوند.')) return; v.accounts = v.accounts.filter(x => x.id !== a.id); v.ledger = v.ledger.filter(l => l.accountId !== a.id); (state.trades || []).forEach(t => { if (t.accountId === a.id) t.accountId = v.accounts[0].id; }); queueSave('trades'); arexV98(); arexV98Save(); render(); } });
    $('arexLedList').addEventListener('click', e => { const b = e.target.closest('[data-led]'); if (!b) return; if (!confirm('این ردیف حذف شود؟')) return; const v = arexV98(); v.ledger = v.ledger.filter(l => l.id !== b.dataset.led); arexV98Save(); render(); });
    $('arexAccCurveSel').addEventListener('change', render);
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
  window.arexRenderAccounts = render;
})();
