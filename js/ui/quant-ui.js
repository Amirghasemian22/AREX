/* AREX V9.8.0 — ui/quant-ui: advanced analytics card (Sharpe/Sortino, Monte-Carlo risk of ruin, MAE/MFE). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.arexEscape, fa = v => (v === null || v === undefined ? '—' : arexFmt.fa(v));
  const css = 'arex-quant';
  function trades() {
    const v = arexV98(), all = state.trades || [], sel = $('arexQSel') ? $('arexQSel').value : '__all';
    return sel === '__all' ? all : AREXCore.ledger.tradesOf(all, v, sel);
  }
  function fan(mc) {
    const W = 640, H = 230, pad = 28, f = mc.fan, hi = Math.max(1.05, ...f.map(x => x.p95)), lo = Math.min(0.6, ...f.map(x => x.p5)), span = hi - lo;
    const x = i => pad + i * (W - pad - 10) / (f.length - 1), y = v => 10 + (hi - v) * (H - 34) / span, line = k => f.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1)).join(' ');
    const band = (a, b) => f.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[a]).toFixed(1)).join(' ') + ' ' + f.slice().reverse().map((p, i) => 'L' + x(f.length - 1 - i).toFixed(1) + ' ' + y(p[b]).toFixed(1)).join(' ') + 'Z';
    const ruinY = y(1 - mc.ruinPct / 100);
    return `<svg viewBox="0 0 ${W} ${H}" class="arex-curve" role="img" aria-label="Monte Carlo"><path d="${band('p95', 'p5')}" fill="#1e90ff" opacity=".12"/><path d="${band('p75', 'p25')}" fill="#1e90ff" opacity=".22"/><path d="${line('p50')}" fill="none" stroke="#1e90ff" stroke-width="2.2"/>
      <line x1="${pad}" x2="${W - 10}" y1="${y(1)}" y2="${y(1)}" stroke="currentColor" opacity=".35" stroke-dasharray="4"/><line x1="${pad}" x2="${W - 10}" y1="${ruinY}" y2="${ruinY}" stroke="#f87171" stroke-dasharray="5"/>
      <text x="${W - 12}" y="${ruinY - 4}" text-anchor="end" font-size="10" fill="#f87171">آستانه نابودی −${mc.ruinPct}٪</text><text x="4" y="${y(1) + 4}" font-size="10" fill="currentColor" opacity=".7">1×</text><text x="4" y="14" font-size="10" fill="currentColor" opacity=".7">${hi.toFixed(2)}×</text><text x="4" y="${H - 10}" font-size="10" fill="currentColor" opacity=".7">${lo.toFixed(2)}×</text></svg>`;
  }
  const kpi = (l, v, cls) => `<div class="arex-kpi"><small>${E(l)}</small><b class="${cls || ''}">${v}</b></div>`;
  function mount() {
    const view = $('view-analytics'); if (!view || $('arexQuantCard')) return;
    const v = arexV98(), card = document.createElement('section'); card.className = 'card'; card.id = 'arexQuantCard';
    card.innerHTML = `<div class="section-title">🧮 تحلیل پیشرفته: Sharpe/Sortino، ریسک نابودی (مونت‌کارلو)، MAE/MFE</div>
      <div class="arex-q-controls"><div><div class="field-lbl">حساب</div><select class="txt-input" id="arexQSel"><option value="__all">همه حساب‌ها</option>${v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)}</option>`).join('')}</select></div>
      <div><div class="field-lbl">ریسک هر معامله (٪)</div><input class="txt-input" id="arexQRisk" type="number" step="0.1" min="0.05" value="${(state.riskLimits && +state.riskLimits.riskPerTradePct) || 1}" inputmode="decimal"></div>
      <div><div class="field-lbl">افق (تعداد معامله)</div><select class="txt-input" id="arexQH"><option>50</option><option selected>100</option><option>200</option><option>500</option></select></div>
      <div><div class="field-lbl">آستانه نابودی (افت ٪)</div><select class="txt-input" id="arexQRuin"><option>10</option><option>20</option><option selected>30</option><option>50</option></select></div>
      <div style="align-self:end"><button class="btn" id="arexQRun" type="button">اجرای تحلیل</button></div></div>
      <div id="arexQOut" aria-live="polite"></div>`;
    view.insertBefore(card, view.firstChild);
    $('arexQRun').addEventListener('click', run); $('arexQSel').addEventListener('change', run);
  }
  function run() {
    const out = $('arexQOut'); if (!out) return; out.innerHTML = '<div class="empty">در حال محاسبه…</div>';
    setTimeout(() => {
      const t = trades(), Q = AREXCore.quant, v = arexV98(), acc = v.accounts.find(a => a.id === ($('arexQSel').value)) || null, bal = acc ? acc.start : (v.accounts[0] && v.accounts[0].start);
      const rt = Q.ratios(t, bal), risk = Math.max(0.05, parseFloat($('arexQRisk').value) || 1), H = +$('arexQH').value, ruin = +$('arexQRuin').value;
      const mc = Q.monteCarlo(t, { riskPct: risk, horizon: H, ruinPct: ruin, trials: 3000 }), mm = Q.maeMfe(t); let html = '';
      if (rt.insufficient) html += `<div class="empty">برای Sharpe/Sortino حداقل ۵ معامله‌ی بسته با R لازم است (الان ${fa(rt.n)}).</div>`;
      else html += `<div class="arex-kpis">${kpi('Sharpe (R)', fa(rt.sharpeR))}${kpi('Sortino (R)', fa(rt.sortinoR))}${kpi('Sharpe روزانه', fa(rt.sharpeDaily))}${kpi('Sortino روزانه', fa(rt.sortinoDaily))}${kpi('بیشترین افت (R)', fa(rt.maxDDR))}${kpi('Calmar (R)', fa(rt.calmarR))}${kpi('امید ریاضی (R)', fa(rt.meanR), rt.meanR < 0 ? 'neg' : 'pos')}</div><div class="calc-hint">Sharpe/Sortino روزانه فقط با موجودی اولیه‌ی حساب و حداقل ۵ روز معاملاتی محاسبه می‌شود.</div>`;
      if (mc.insufficient) html += `<div class="empty">برای مونت‌کارلو حداقل ${mc.need} معامله‌ی بسته با R لازم است (الان ${fa(mc.n)}).</div>`;
      else {
        const lvl = mc.ruinProb >= 10 ? 'neg' : mc.ruinProb >= 2 ? 'warn' : 'pos';
        html += `<h4 style="margin:14px 0 6px">مونت‌کارلو (${fa(mc.trials)} مسیر، ${fa(mc.horizon)} معامله، ریسک ${fa(mc.riskPct)}٪)</h4><div class="arex-kpis">${kpi('احتمال ریسک نابودی (افت ' + fa(mc.ruinPct) + '٪)', fa(mc.ruinProb) + '٪', lvl)}${kpi('احتمال سود', fa(mc.profitProb) + '٪')}${kpi('سرمایه نهایی (میانه)', fa(mc.final.p50) + '×')}${kpi('بدترین ۵٪', fa(mc.final.p5) + '×', 'neg')}${kpi('افت میانه', fa(mc.ddMedianPct) + '٪')}${kpi('افت بدترین ۵٪', fa(mc.ddP95Pct) + '٪', 'neg')}</div>${fan(mc)}`;
        const best = [0.25, 0.5, 0.75, 1, 1.5, 2, 3].filter(r => Q.monteCarlo(t, { riskPct: r, horizon: H, ruinPct: ruin, trials: 1200 }).ruinProb <= 1).pop();
        html += `<div class="arex-q-note">${mc.ruinProb >= 5 ? '⚠️ با این ریسک، احتمال نابودی بالاست.' : '✅ ریسک نابودی با این تنظیم پایین است.'} ${best ? `بیشترین ریسک هر معامله‌ای که در این داده‌ها احتمال نابودی ≤ ۱٪ می‌دهد: <b>${fa(best)}٪</b>.` : 'حتی در ۰٫۲۵٪ ریسک، احتمال نابودی بیش از ۱٪ است؛ استراتژی نیاز به بازنگری دارد.'} <small>(بر پایه‌ی ${fa(mc.n)} معامله‌ی ثبت‌شده؛ نمونه‌ی کوچک = اطمینان کم، و آینده تضمین نیست.)</small></div>`;
      }
      html += '<h4 style="margin:14px 0 6px">MAE / MFE</h4>';
      html += mm.insufficient ? `<div class="empty">برای تحلیل MAE/MFE در فرم معامله (جزئیات اجرا) مقدار MAE و MFE را به R ثبت کن (الان ${fa(mm.n)} معامله دارای داده؛ حداقل ۵ لازم است).</div>` : `<div class="arex-kpis">${kpi('میانگین MAE برنده‌ها', fa(mm.avgMAEwin) + 'R')}${kpi('میانگین MAE بازنده‌ها', fa(mm.avgMAEloss) + 'R')}${kpi('میانگین MFE برنده‌ها', fa(mm.avgMFEwin) + 'R')}${kpi('نسبت Edge', fa(mm.edgeRatio))}${kpi('سود گرفته‌شده از MFE', mm.captureWin === undefined ? '—' : fa(mm.captureWin) + '٪')}${kpi('سود جا‌مانده', mm.leftOnTableR === undefined ? '—' : fa(mm.leftOnTableR) + 'R')}</div>${mm.slSuggestionR ? `<div class="arex-q-note">💡 ۹۰٪ معاملات برنده بیش از <b>${fa(mm.slSuggestionR)}R</b> برگشت علیه تو نداشته‌اند؛ حد ضرر تنگ‌تر از این مقدار احتمالاً برنده‌ها را زود بیرون می‌اندازد.</div>` : ''}`;
      out.innerHTML = html;
    }, 30);
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
  document.addEventListener('arex:view', e => { if (e.detail.name === 'analytics') { mount(); const s = $('arexQSel'), v = arexV98(); if (s) { const cur = s.value; s.innerHTML = `<option value="__all">همه حساب‌ها</option>` + v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)}</option>`).join(''); s.value = [...s.options].some(o => o.value === cur) ? cur : '__all'; } run(); } });
})();
