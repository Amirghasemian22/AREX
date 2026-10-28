/* AREX V9.8.0 — ui/onboarding: 3-step setup (balance, risk, sessions) replacing the 10-step tour; plus a settings card for alerts/sync prefs. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.arexEscape;
  const KEY = 'arex-v98-onboarded';
  function apply(f) {
    const v = arexV98(), a = v.accounts[0]; a.name = f.name || a.name; a.type = f.type; a.start = f.start; a.currency = f.cur || 'USD';
    state.riskLimits = Object.assign({}, state.riskLimits, { balance: f.start, riskPerTradePct: f.risk, dailyLossPct: f.daily }); queueSave('riskLimits');
    const cfg = Object.assign({}, window.__arexGuardCfg || {}, { maxTradesPerDay: f.maxT, minRR: f.minRR, maxRiskPct: f.risk }); window.__arexGuardCfg = cfg; try { storage.set('guardCfg', JSON.stringify(cfg)); } catch (e) {}
    v.prefs.sessions = f.sessions; v.prefs.syncHour = f.syncHour; if (!v.watchlist.length) v.watchlist = f.watch; arexV98Save();
    try { localStorage.setItem(KEY, '1'); } catch (e) {} toast('راه‌اندازی انجام شد ✓');
  }
  function open(force) {
    if ($('arexOnb')) return; const v = arexV98(), a = v.accounts[0]; let step = 0; const f = { name: a.name || 'حساب اصلی', type: a.type || 'live', start: a.start || 0, cur: a.currency || 'USD', risk: 1, daily: 3, maxT: 3, minRR: 1.5, sessions: ['london', 'newyork'], syncHour: 21, watch: ['EUR/USD', 'XAU/USD'] };
    const bg = document.createElement('div'); bg.id = 'arexOnb'; bg.className = 'arex-modal-bg'; document.body.appendChild(bg);
    const row = (l, i) => `<div><div class="field-lbl">${l}</div>${i}</div>`, titles = ['حساب و موجودی', 'ریسک', 'سشن و یادآوری'];
    const read = () => { const g = id => $(id) && $(id).value;
      if (step === 0) { f.name = g('onbName').trim() || f.name; f.type = g('onbType'); f.start = Math.max(0, parseFloat(g('onbStart')) || 0); f.cur = (g('onbCur') || 'USD').toUpperCase(); }
      if (step === 1) { f.risk = Math.max(0.05, parseFloat(g('onbRisk')) || 1); f.daily = Math.max(0.1, parseFloat(g('onbDaily')) || 3); f.maxT = Math.max(1, parseInt(g('onbMaxT')) || 3); f.minRR = Math.max(0.1, parseFloat(g('onbRR')) || 1.5); }
      if (step === 2) { f.sessions = [...bg.querySelectorAll('[data-ses]:checked')].map(c => c.dataset.ses); f.syncHour = Math.min(23, Math.max(0, parseInt(g('onbSync')) || 21)); f.watch = [...bg.querySelectorAll('[data-wl]:checked')].map(c => c.dataset.wl); } };
    const paint = () => {
      const body = step === 0 ? row('نام حساب', `<input class="txt-input" id="onbName" value="${E(f.name)}" maxlength="40">`) + row('نوع حساب', `<select class="txt-input" id="onbType"><option value="live" ${f.type === 'live' ? 'selected' : ''}>لایو</option><option value="demo" ${f.type === 'demo' ? 'selected' : ''}>دمو</option><option value="prop" ${f.type === 'prop' ? 'selected' : ''}>پراپ</option></select>`) + row('موجودی اولیه ($)', `<input class="txt-input" id="onbStart" type="number" step="any" min="0" inputmode="decimal" value="${f.start || ''}" placeholder="مثلاً 10000">`) + row('واحد پول', `<input class="txt-input" id="onbCur" value="${E(f.cur)}" maxlength="5">`)
        : step === 1 ? row('ریسک هر معامله (٪)', `<input class="txt-input" id="onbRisk" type="number" step="0.1" min="0.05" inputmode="decimal" value="${f.risk}">`) + row('سقف ضرر روزانه (٪)', `<input class="txt-input" id="onbDaily" type="number" step="0.1" min="0.1" inputmode="decimal" value="${f.daily}">`) + row('حداکثر معامله در روز', `<input class="txt-input" id="onbMaxT" type="number" min="1" value="${f.maxT}">`) + row('حداقل RR قابل‌قبول', `<input class="txt-input" id="onbRR" type="number" step="0.1" min="0.1" inputmode="decimal" value="${f.minRR}">`)
        : `<div class="field-lbl">سشن‌هایی که معامله می‌کنی</div><div class="arex-days">${[['asia', 'آسیا'], ['london', 'لندن'], ['newyork', 'نیویورک']].map(([k, l]) => `<label class="arex-chk"><input type="checkbox" data-ses="${k}" ${f.sessions.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>` + row('ساعت یادآوری همگام‌سازی شبانه (۰ تا ۲۳)', `<input class="txt-input" id="onbSync" type="number" min="0" max="23" value="${f.syncHour}">`) + `<div class="field-lbl">نمادهای واچ‌لیست</div><div class="arex-days">${['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'DJI'].map(s => `<label class="arex-chk"><input type="checkbox" data-wl="${s}" ${f.watch.includes(s) ? 'checked' : ''}> ${s}</label>`).join('')}</div>`;
      bg.innerHTML = `<div class="arex-modal" role="dialog" aria-label="راه‌اندازی سریع"><div class="arex-modal-head"><b>راه‌اندازی سریع · مرحله ${arexFmt.fa(step + 1)} از ۳ — ${titles[step]}</b></div><div class="arex-dots">${[0, 1, 2].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><div class="form-grid" style="margin-top:10px">${body}</div>
        <div class="arex-modal-foot">${step ? '<button class="btn ghost" id="onbBack" type="button">قبلی</button>' : '<button class="btn ghost" id="onbSkip" type="button">بعداً</button>'}<button class="btn" id="onbNext" type="button">${step === 2 ? 'شروع ✓' : 'بعدی'}</button></div></div>`;
      $('onbNext').onclick = () => { read(); if (step === 2) { apply(f); bg.remove(); window.arexRenderAccounts && arexRenderAccounts(); } else { step++; paint(); } };
      if ($('onbBack')) $('onbBack').onclick = () => { read(); step--; paint(); };
      if ($('onbSkip')) $('onbSkip').onclick = () => { try { localStorage.setItem(KEY, 'skipped'); } catch (e) {} bg.remove(); };
    };
    paint();
  }
  window.arexOnboard = open;
  function maybe() {
    if (localStorage.getItem(KEY) || typeof state === 'undefined') return; const gate = $('arexAuthGate'); if (gate && getComputedStyle(gate).display !== 'none') return;
    const v = arexV98(); if ((state.trades || []).length || (v.accounts[0] && v.accounts[0].start > 0)) { try { localStorage.setItem(KEY, 'auto'); } catch (e) {} return; } open();
  }
  /* settings card */
  function settingsCard() {
    const grid = document.querySelector('#view-settings > .grid'); if (!grid || $('arexV98Settings')) return; const v = arexV98(), p = v.prefs;
    const c = document.createElement('div'); c.className = 'card'; c.id = 'arexV98Settings';
    c.innerHTML = `<div class="section-title">🔔 هشدارها، همگام‌سازی و راه‌اندازی (۹٫۸)</div>
      <label class="arex-chk"><input type="checkbox" id="s98Ext" ${p.extAlerts === false ? '' : 'checked'}> ارسال هشدارهای مهم آرکس (ریسک/خبر/همگام‌سازی) به تلگرام، اگر Worker و تلگرام بالا فعال باشند</label>
      <label class="arex-chk"><input type="checkbox" id="s98Ing" ${p.autoIngest ? 'checked' : ''}> دریافت خودکار معاملات EA (MT5) پس از Sync</label>
      <div class="field-lbl">ساعت یادآوری همگام‌سازی شبانه</div><input class="txt-input" id="s98Hour" type="number" min="0" max="23" value="${p.syncHour == null ? 21 : p.syncHour}" style="max-width:120px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="s98Push" type="button">فعال‌سازی اعلان‌های سیستم</button><button class="btn ghost" id="s98Onb" type="button">راه‌اندازی سریع</button><button class="btn ghost" id="s98Login" type="button">اجبار به ورود دوباره</button></div>
      <div class="calc-hint">اعلان‌های سیستم تا وقتی برنامه (PWA) باز یا در پس‌زمینه‌ی زنده باشد کار می‌کنند؛ اعلان وقتی برنامه کاملاً بسته است به سرور Push نیاز دارد، پس برای آن از تلگرام استفاده کن.</div>`;
    grid.appendChild(c);
    $('s98Ext').onchange = e => { p.extAlerts = e.target.checked; arexV98Save(); }; $('s98Ing').onchange = e => { p.autoIngest = e.target.checked; arexV98Save(); };
    $('s98Hour').onchange = e => { p.syncHour = Math.min(23, Math.max(0, parseInt(e.target.value) || 21)); arexV98Save(); };
    $('s98Push').onclick = async () => { if (!('Notification' in window)) { toast('مرورگر از اعلان پشتیبانی نمی‌کند.'); return; } const r = await Notification.requestPermission(); if (r === 'granted') { state.notifEnabled = true; queueSave('settings'); notify('AREX', 'اعلان‌های سیستم فعال شد.', '✅'); } else toast('اجازه‌ی اعلان داده نشد.'); };
    $('s98Onb').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) {} open(true); };
    $('s98Login').onclick = () => { if (confirm('در اجرای بعدی صفحه‌ی ورود نمایش داده شود؟')) { try { localStorage.setItem('arex-force-login', '1'); } catch (e) {} toast('دفعه‌ی بعد صفحه‌ی ورود نمایش داده می‌شود.'); } };
  }
  document.addEventListener('arex:view', e => { if (e.detail.name === 'settings') settingsCard(); });
  setTimeout(settingsCard, 1500); setTimeout(maybe, 3500);
})();
