/* AREX V9.8.0 — ui/shell: one navigation model, two layouts.
   Desktop: grouped sidebar, 2-column dashboard (main + rail), journal workspace (list + sticky entry form).
   Phone: bottom tabs + "More" sheet, collapsible sections, entry form as a full-screen sheet with a floating button.
   All features are identical on both; only presentation differs. Existing nodes are MOVED, never cloned, so ids/listeners survive. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), qs = (s, r) => (r || document).querySelector(s), qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const narrow = window.matchMedia('(max-width:1099px)');
  const lang = () => { try { return (typeof state !== 'undefined' && state.language) || 'fa'; } catch (e) { return 'fa'; } };
  const L = (fa, en) => (lang() === 'fa' ? fa : en);

  /* ---------- single navigation model ---------- */
  const GROUPS = [
    { id: 'today', fa: 'امروز', en: 'Today', items: ['dashboard', 'roadmap', 'calendar', 'sessions'] },
    { id: 'trade', fa: 'معامله', en: 'Trade', items: ['trades', 'risk', 'assistant', 'scenarios'] },
    { id: 'analyze', fa: 'تحلیل', en: 'Analyze', items: ['analytics', 'backtest', 'propfirm'] },
    { id: 'discipline', fa: 'انضباط', en: 'Discipline', items: ['strategy', 'daily', 'psych', 'goals'] },
    { id: 'tools', fa: 'ابزارها', en: 'Tools', items: ['workspace', 'obsidian'] },
    { id: 'system', fa: 'تنظیمات', en: 'Settings', items: ['settings'] }
  ];
  const LABEL = {
    dashboard: ['داشبورد', 'Dashboard'], roadmap: ['برنامه روزانه', 'Daily plan'], calendar: ['تقویم اقتصادی', 'Economic calendar'], sessions: ['سشن‌های بازار', 'Market sessions'],
    trades: ['ژورنال معاملات', 'Trade journal'], risk: ['مدیریت ریسک', 'Risk'], assistant: ['بررسی پیش از معامله', 'Pre-trade check'], scenarios: ['سناریوهای در انتظار', 'Pending scenarios'],
    analytics: ['تحلیل عملکرد', 'Performance'], backtest: ['بک‌تست', 'Backtest'], propfirm: ['پراپ‌فرم', 'Prop firm'],
    strategy: ['استراتژی و قوانین', 'Strategy & rules'], daily: ['گزارش روزانه', 'Daily review'], psych: ['روان‌شناسی', 'Psychology'], goals: ['اهداف', 'Goals'],
    workspace: ['ابزارهای تکمیلی', 'Extra tools'], obsidian: ['اتصال Obsidian', 'Obsidian'], settings: ['تنظیمات', 'Settings']
  };
  const lbl = v => (LABEL[v] ? L(LABEL[v][0], LABEL[v][1]) : v);
  const go = v => { const b = qs('.sidebar .navbtn[data-view="' + v + '"]'); if (b) b.click(); closeMore(); };

  function regroupSidebar() {
    const sb = $('sidebar'); if (!sb) return;
    const anchor = qs('.sidebar-foot', sb); if (!anchor) return;
    const btn = {}; qsa('.navbtn[data-view]', sb).forEach(b => { btn[b.dataset.view] = b; });
    const old = qsa('.nav-group', sb);
    GROUPS.forEach(g => {
      let box = sb.querySelector('.nav-group[data-nav-v2="' + g.id + '"]');
      if (!box) { box = document.createElement('div'); box.className = 'nav-group arex-nav-v2'; box.dataset.navV2 = g.id; const t = document.createElement('div'); t.className = 'nav-group-title'; box.appendChild(t); sb.insertBefore(box, anchor); }
      box.firstChild.textContent = L(g.fa, g.en);
      g.items.forEach(v => { if (btn[v]) box.appendChild(btn[v]); });
    });
    qsa('.navbtn[data-view]', sb).forEach(b => { const v = b.dataset.view; if (!LABEL[v]) return; Array.from(b.childNodes).forEach(n => { if (!(n.nodeType === 1 && n.classList.contains('ic')) && !(n.nodeType === 1 && n.classList.contains('arex-nav-label'))) n.remove(); });
      let sp = qs('.arex-nav-label', b); if (!sp) { sp = document.createElement('span'); sp.className = 'arex-nav-label'; b.appendChild(sp); } sp.textContent = lbl(v); b.removeAttribute('data-i18n'); b.setAttribute('aria-label', lbl(v)); });
    old.forEach(g => { if (!g.classList.contains('arex-nav-v2') && !g.querySelector('.navbtn')) g.remove(); });   // legacy empty groups
    qsa('.nav-group:not(.arex-nav-v2)', sb).forEach(g => { if (!g.querySelector('.navbtn')) g.remove(); });
  }

  /* ---------- phone: bottom tabs + More sheet ---------- */
  function buildTabs() {
    const nav = qs('.arex-mobile-nav'); if (!nav) return;
    const tab = (v, ic, label, extra) => '<button type="button" ' + (v ? 'data-mobile-view="' + v + '"' : '') + ' ' + (extra || '') + '><span class="mobile-nav-icon" aria-hidden="true">' + ic + '</span><span>' + label + '</span></button>';
    nav.innerHTML = tab('dashboard', '◧', L('امروز', 'Today')) + tab('trades', '☰', L('معاملات', 'Trades')) +
      '<button type="button" id="arexMobileBot" class="arex-tab-bot" aria-label="' + L('دستیار آرکس', 'AREX assistant') + '"><span class="mobile-nav-icon" aria-hidden="true">✦</span><span>' + L('آرکس', 'AREX') + '</span></button>' +
      tab('analytics', '◔', L('تحلیل', 'Analyze')) + tab('', '⋯', L('بیشتر', 'More'), 'id="arexMobileMore"');
    nav.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault();
      if (b.id === 'arexMobileBot') { closeMore(); window.arexBrainOpen && window.arexBrainOpen(); } else if (b.id === 'arexMobileMore') toggleMore(); else if (b.dataset.mobileView) go(b.dataset.mobileView); };
  }
  function moreSheet() {
    let s = $('arexMoreSheet'); if (!s) { s = document.createElement('div'); s.id = 'arexMoreSheet'; s.className = 'arex-more-sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', L('همه بخش‌ها', 'All sections')); document.body.appendChild(s); s.addEventListener('click', e => { if (e.target === s) closeMore(); }); }
    s.textContent = '';
    const card = document.createElement('div'); card.className = 'arex-more-card';
    const head = document.createElement('div'); head.className = 'arex-more-head'; const h = document.createElement('b'); h.textContent = L('همه بخش‌ها', 'All sections'); const x = document.createElement('button'); x.type = 'button'; x.className = 'icon-btn'; x.textContent = '✕'; x.setAttribute('aria-label', L('بستن', 'Close')); x.onclick = closeMore; head.append(h, x); card.appendChild(head);
    GROUPS.forEach(g => {
      const t = document.createElement('div'); t.className = 'arex-more-title'; t.textContent = L(g.fa, g.en); card.appendChild(t);
      const grid = document.createElement('div'); grid.className = 'arex-more-grid';
      g.items.forEach(v => { const src = qs('.sidebar .navbtn[data-view="' + v + '"]'); if (!src) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'arex-more-tile';
        const ic = document.createElement('span'); ic.className = 'ic'; const sic = qs('.ic', src); if (sic) ic.innerHTML = sic.innerHTML; const tx = document.createElement('span'); tx.textContent = lbl(v); b.append(ic, tx); b.onclick = () => go(v); grid.appendChild(b); });
      card.appendChild(grid);
    });
    s.appendChild(card); return s;
  }
  const toggleMore = () => { const s = moreSheet(); s.classList.toggle('open'); document.documentElement.classList.toggle('arex-more-open', s.classList.contains('open')); };
  function closeMore() { const s = $('arexMoreSheet'); if (s) s.classList.remove('open'); document.documentElement.classList.remove('arex-more-open'); }

  /* ---------- collapsible sections (phone only; CSS hides the headers on desktop) ---------- */
  function collapsible(el, title, open, order, always) {
    if (!el || el.dataset.accDone) return; el.dataset.accDone = '1';
    const h = document.createElement('button'); h.type = 'button'; h.className = 'arex-acc-h' + (always ? ' arex-acc-always' : ''); if (always) el.classList.add('arex-acc-always-el'); h.setAttribute('aria-expanded', String(!!open));
    const t = document.createElement('span'); t.textContent = title; const c = document.createElement('i'); c.textContent = '▾'; h.append(t, c);
    el.parentNode.insertBefore(h, el); if (!open) el.classList.add('arex-acc-closed'); if (order) { h.style.setProperty('--o', order); el.style.setProperty('--o', order); }
    h.addEventListener('click', () => { const o = el.classList.toggle('arex-acc-closed'); h.setAttribute('aria-expanded', String(!o)); });
    el._accHeader = h;
  }
  const openAcc = el => { if (el && el.classList.contains('arex-acc-closed')) { el.classList.remove('arex-acc-closed'); if (el._accHeader) el._accHeader.setAttribute('aria-expanded', 'true'); } };

  /* ---------- dashboard: main + rail (desktop), prioritised stack (phone) ---------- */
  function dashboard() {
    const d = $('view-dashboard'); if (!d || d.dataset.shell) return; d.dataset.shell = '1';
    const main = document.createElement('div'), rail = document.createElement('div'); main.className = 'arex-dash-main'; rail.className = 'arex-dash-rail';
    const first = $('arexDashboardKpis'); d.insertBefore(main, first); d.insertBefore(rail, first);
    ['arexDashboardKpis', 'arexDailyRoadmap', 'arexDashboardWarnings', 'arexDashboardPerformance', 'arexDashboardInsights'].forEach(id => $(id) && main.appendChild($(id)));
    qsa(':scope > .v5-primary-grid, :scope > .ind-grid', d).forEach(n => main.appendChild(n));
    ['dashboardTvCalendar', 'dashboardDailyCheck'].forEach(id => $(id) && rail.appendChild($(id)));
    [['arexBrainCard', 1], ['arexDashboardKpis', 2], ['arexDailyRoadmap', 3], ['arexDashboardInsights', 4], ['arexDashboardWarnings', 10]].forEach(([id, o]) => $(id) && $(id).style.setProperty('--o', o));
    const coach = $('arexDashboardCoach'); if (coach) coach.classList.add('arex-merged-into-brain');   // duplicate of the Brain card's "next step"
    collapsible($('dashboardTvCalendar'), L('تقویم اقتصادی', 'Economic calendar'), false, 6);
    collapsible($('arexDashboardPerformance'), L('روند عملکرد', 'Performance trend'), true, 5);
    collapsible(qs('.v5-primary-grid', d), L('اهداف و حدود معاملاتی', 'Goals & limits'), false, 7);
    collapsible($('dashboardDailyCheck'), L('جمع‌بندی امروز', 'Today wrap-up'), false, 8);
    collapsible(qs('.ind-grid', d), L('شاخص‌های بازار (اختیاری)', 'Market gauges (optional)'), false, 9, true);
  }

  /* ---------- journal workspace ---------- */
  function journal() {
    const v = $('view-trades'); if (!v || v.dataset.shell) return; v.dataset.shell = '1';
    const cards = qsa(':scope > .card', v), form = cards[0], stats = cards[1], hist = qs(':scope > .arex-journal-history', v);
    if (!form || !hist) return;
    form.classList.add('arex-trade-form'); if (stats) stats.classList.add('arex-trade-stats'); hist.classList.add('arex-trade-history');
    const bar = document.createElement('div'); bar.className = 'arex-form-sheet-bar';
    const t = document.createElement('b'); t.textContent = L('ثبت معامله جدید', 'New trade'); const x = document.createElement('button'); x.type = 'button'; x.className = 'icon-btn'; x.textContent = '✕'; x.setAttribute('aria-label', L('بستن', 'Close')); bar.append(t, x); form.insertBefore(bar, form.firstChild);
    const ph = document.createComment('arex-trade-form-home');
    // The sheet is moved to <body> while open so it can cover the topbar/tab bar (the view has its own stacking context).
    const close = () => { form.classList.remove('arex-sheet-open'); document.documentElement.classList.remove('arex-sheet-lock'); if (ph.parentNode) { ph.parentNode.insertBefore(form, ph); ph.remove(); } };
    x.addEventListener('click', close);
    const fab = document.createElement('button'); fab.type = 'button'; fab.id = 'arexTradeFab'; fab.className = 'arex-fab'; fab.textContent = '＋ ' + L('ثبت معامله', 'New trade');
    fab.addEventListener('click', () => { if (!ph.parentNode) { form.parentNode.insertBefore(ph, form); document.body.appendChild(form); } form.classList.add('arex-sheet-open'); document.documentElement.classList.add('arex-sheet-lock'); form.scrollTop = 0; });
    document.body.appendChild(fab);
    const list = $('tradesList'); if (list) new MutationObserver(() => { if (narrow.matches && form.classList.contains('arex-sheet-open')) close(); }).observe(list, { childList: true });
    new MutationObserver(() => { fab.style.display = v.classList.contains('active') ? '' : 'none'; }).observe(v, { attributes: true, attributeFilter: ['class'] });
    fab.style.display = v.classList.contains('active') ? '' : 'none';
  }

  /* ---------- settings / analytics extras: accordions on phone ---------- */
  function settings() {
    const g = qs('#view-settings > .grid'); if (!g || g.dataset.shell) return; g.dataset.shell = '1';
    qsa(':scope > *', g).forEach((card, i) => { const h = qs('h2,h3,h4,.section-title,.card-title,b', card); const title = h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : L('بخش ', 'Section ') + (i + 1); collapsible(card, title, i === 0); });
    qsa('.settings-jumpbar a, .settings-jumpbar button').forEach(a => a.addEventListener('click', () => { const id = (a.getAttribute('href') || '').replace('#', ''), t = id && $(id); const c = t && (t.closest('#view-settings > .grid > *') || t); openAcc(c); }));
  }
  function analytics() { const e = $('arexV9Extra'); if (e) collapsible(e, L('تحلیل‌های بیشتر', 'More analytics'), false); }

  function relabel() { regroupSidebar(); buildTabs(); const s = $('arexMoreSheet'); if (s) { const o = s.classList.contains('open'); moreSheet(); s.classList.toggle('open', o); } }
  function init() {
    regroupSidebar(); buildTabs(); dashboard(); journal(); settings(); analytics();
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage.__arexShell) { const old = window.applyLanguage; window.applyLanguage = function () { const r = old.apply(this, arguments); try { relabel(); } catch (e) {} return r; }; window.applyLanguage.__arexShell = true; }
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMore(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { const s = $('navSearch'); if (s) { e.preventDefault(); s.focus(); s.select(); } } });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.sidebar .navbtn')) closeMore(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.arexShell = { go, relabel, groups: GROUPS };
})();
