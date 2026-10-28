/* AREX V9.8.0 — ui/brain-ui: connects AREXCore.brain to the page (chat, dashboard card, in-site alerts).
   Local-first: answers come from the user's own journal/risk/strategy/calendar data; the optional AI Worker is
   used only for questions the local engine cannot answer, and only with a Google token sent to a trusted host. */
(function () {
  'use strict';
  const B = () => window.AREXCore && AREXCore.brain;
  const $ = id => document.getElementById(id);
  const hist = [];
  let kbCache = { rulesBy: {}, strategies: [] }, busy = false, greeted = false;

  async function refreshKB() {
    try {
      if (typeof arexLoadKB !== 'function' || !AREXCore.strategykb) return;
      const kb = await arexLoadKB(), now = new Date();
      const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const names = [...new Set(((kb && kb.rules) || []).map(r => r.strategy).filter(Boolean))].slice(0, 12), rulesBy = {};
      [''].concat(names).forEach(n => { try { rulesBy[n] = AREXCore.strategykb.rulesForTrade(kb, { date, time, setup: n }).rules || []; } catch (e) { rulesBy[n] = []; } });
      kbCache = { rulesBy, strategies: names };
    } catch (e) { /* KB is optional */ }
  }
  function snap() {
    const st = (typeof state !== 'undefined' && state) || {}, now = new Date();
    const d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    let guard = null; try { guard = typeof arexGuardMerged === 'function' ? arexGuardMerged() : null; } catch (e) {}
    let wk = false; try { wk = typeof isForexWeekend === 'function' ? isForexWeekend(now) : false; } catch (e) {}
    let v98 = null; try { v98 = window.arexV98 ? window.arexV98() : null; } catch (e) {}
    const cfg = Object.assign({}, window.__arexGuardCfg || {}), plan = v98 && v98.weekPlans && v98.weekPlans[window.arexWeekKey ? window.arexWeekKey() : ''];
    if (plan && plan.locked) { if (plan.maxTrades) cfg.maxTradesPerDay = plan.maxTrades; if (plan.maxRiskPct) cfg.maxRiskPct = plan.maxRiskPct; }
    const limits = Object.assign({}, st.riskLimits || {}); if (v98 && v98.accounts && window.AREXCore && AREXCore.ledger) { try { const a = AREXCore.ledger.all(v98, st.trades || []).find(x => x.id === v98.activeAccountId); if (a && a.balance > 0) limits.balance = a.balance; } catch (e) {} }
    return B().snapshot({ trades: st.trades || [], now, guard, cfg, limits, events: window.__arexFcEvents || [],
      sync: { enabled: !window.AREX_LOCAL_TEST_MODE, lastSyncAt: st.lastSyncAt, hour: v98 && v98.prefs ? v98.prefs.syncHour : 21 },
      dailyLog: (st.dailyLogs || {})[d] || null, rulesBy: kbCache.rulesBy, strategies: kbCache.strategies, isWeekend: wk });
  }
  const go = view => { if (view === 'sync') { const sb = document.getElementById('driveQuickSyncBtn'); if (sb) sb.click(); return; } const b = document.querySelector('.navbtn[data-view="' + view + '"]'); if (b) b.click(); const m = $('mascot'); if (m && window.matchMedia('(max-width:760px)').matches) m.classList.remove('open'); };
  function mkBtn(label, fn, cls) { const b = document.createElement('button'); b.type = 'button'; b.className = cls || 'chip'; b.textContent = label; b.addEventListener('click', fn); return b; }

  /* ---------- chat ---------- */
  function addMsg(role, text, extra) {
    const h = $('arexChatHistory'); if (!h) return;
    const el = document.createElement('div'); el.className = 'arex-chat-msg ' + role;
    const lb = document.createElement('small'); lb.textContent = role === 'user' ? 'شما' : 'آرکس'; el.appendChild(lb);
    const body = document.createElement('div'); body.className = 'arex-brain-text'; body.textContent = text; el.appendChild(body);
    if (extra && extra.nav && extra.nav.length) { const row = document.createElement('div'); row.className = 'arex-brain-actions'; extra.nav.forEach(n => row.appendChild(mkBtn('↗ ' + n.label, () => go(n.view), 'chip arex-go-chip'))); el.appendChild(row); }
    h.appendChild(el); h.scrollTop = h.scrollHeight;
    hist.push({ role: role === 'user' ? 'user' : 'assistant', content: text }); if (hist.length > 20) hist.splice(0, 2);
    if (extra && extra.chips) setChips(extra.chips);
  }
  function setChips(list) {
    let box = $('arexBrainChips');
    if (!box) { const form = $('arexChatForm'); if (!form) return; box = document.createElement('div'); box.id = 'arexBrainChips'; box.className = 'mascot-chips arex-brain-chips'; form.parentNode.insertBefore(box, form); }
    box.textContent = ''; (list || []).slice(0, 4).forEach(c => box.appendChild(mkBtn(c, () => window.arexBrainAsk(c))));
  }
  async function askAI(text, s) {
    const ep = window.arexReadAiEndpoint && window.arexReadAiEndpoint(); if (!ep) return { error: 'no_endpoint' };
    window.arexAssertTrustedWorker(ep);
    const token = await window.arexGetDriveAccessToken();
    const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ messages: hist.slice(-12), context: { app: 'AREX V9.8.0', language: 'fa', timezone: 'Asia/Tehran', brain: B().aiContext(s), instruction: 'Answer only from the supplied context. Do not invent prices, news or rules. No buy/sell signals. If data is missing, say what to add.' } }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json(), a = data.answer || data.reply || data.text;
    if (typeof a !== 'string' || !a.trim()) throw new Error('پاسخ خالی');
    return { text: a.trim() };
  }
  window.arexBrainAsk = async function (text) {
    if (busy || !text) return; busy = true;
    const send = $('arexChatSend'); if (send) send.disabled = true;
    try {
      await refreshKB(); addMsg('user', text);
      const s = snap(), ans = B().answer(text, s);
      if (!ans.needsAI) { addMsg('assistant', ans.text, ans); return; }
      try {
        const ai = await askAI(text, s);
        if (ai.error === 'no_endpoint') addMsg('assistant', ans.text + '\nبرای پاسخ به سؤال‌های عمومی‌تر، آدرس AI Worker را در «تنظیمات ← دستیار» وصل کن. تا آن موقع می‌توانم از داده‌های خودت (وضعیت امروز، ریسک، اخبار، قوانین، مرور هفتگی) جواب بدهم.', ans);
        else addMsg('assistant', ai.text, { chips: ans.chips });
      } catch (e) { addMsg('assistant', ans.text + '\n(اتصال به AI ممکن نشد: ' + String(e.message || e).slice(0, 80) + ')', ans); }
    } finally { busy = false; if (send) send.disabled = false; }
  };
  async function greet() {
    if (greeted || !B()) return; greeted = true; await refreshKB();
    const s = snap(), n = B().nextAction(s);
    addMsg('assistant', B().answer('سلام', s).text + '\n\n👉 ' + n.text, { nav: n.view ? [{ label: (B().NAV && B().NAV[n.view]) || n.view, view: n.view }] : [], chips: B().defaultChips(s) });
  }
  function openBot(q) { const m = $('mascot'); if (!m) return; m.classList.add('open'); greet().then(() => { if (q) window.arexBrainAsk(q); }); }
  window.arexBrainOpen = openBot;

  /* ---------- dashboard card ---------- */
  function renderCard() {
    if (!B()) return; const dash = $('view-dashboard'); if (!dash) return;
    let card = $('arexBrainCard');
    if (!card) { card = document.createElement('section'); card.id = 'arexBrainCard'; card.className = 'card arex-brain-card'; card.setAttribute('aria-live', 'polite'); const ob = $('overdueBanner'); dash.insertBefore(card, (ob && ob.parentNode === dash ? ob.nextSibling : dash.firstChild)); }
    const s = snap(), v = B().verdict(s), n = B().nextAction(s); card.dataset.level = v.level; card.textContent = '';
    const head = document.createElement('div'); head.className = 'arex-brain-head';
    const t = document.createElement('b'); t.textContent = '🧠 وضعیت AREX'; const badge = document.createElement('span'); badge.className = 'arex-brain-badge ' + v.level; badge.textContent = v.label; head.append(t, badge); card.appendChild(head);
    const ul = document.createElement('ul'); ul.className = 'arex-brain-list';
    (v.reasons.length ? v.reasons.slice(0, 3) : [{ text: 'مورد هشداردهنده‌ای در داده‌های ثبت‌شده نیست.' }]).forEach(r => { const li = document.createElement('li'); li.textContent = r.text; ul.appendChild(li); }); card.appendChild(ul);
    const next = document.createElement('div'); next.className = 'arex-brain-next'; next.textContent = '👉 ' + n.text; card.appendChild(next);
    const row = document.createElement('div'); row.className = 'arex-brain-actions';
    if (n.view) row.appendChild(mkBtn('برو', () => go(n.view), 'btn'));
    if (s.syncDue && n.view !== 'sync') row.appendChild(mkBtn('☁️ Sync', () => go('sync'), 'btn'));
    row.appendChild(mkBtn('از آرکس بپرس', () => openBot(), 'btn ghost')); row.appendChild(mkBtn('مرور هفتگی', () => openBot('مرور هفتگی'), 'btn ghost')); card.appendChild(row);
  }

  /* ---------- proactive in-site alerts ---------- */
  const CAT = a => /^guard|trades-cap|open-no-sl|loss-streak/.test(a.id) ? 'risk' : /^news/.test(a.id) ? 'calendar' : /^weekly/.test(a.id) ? 'weekly' : /^sync/.test(a.id) ? 'system' : /^journal/.test(a.id) ? 'daily' : '';
  function external(a, day) {   // Telegram goes through the same Worker + category switches the user already configured
    try { const p = (window.arexV98 && arexV98().prefs) || {}; if (a.level === 'info' || p.extAlerts === false) return; const c = CAT(a);
      if (c && window.arexSendTelegramNotification) window.arexSendTelegramNotification(c, a.title, a.body, 'brain-' + a.id + '-' + day).catch(() => {}); } catch (e) {}
  }
  const SEEN_KEY = 'arex-brain-seen-v1';
  function seenMap() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } }
  function tick() {
    if (!B() || typeof state === 'undefined' || typeof notify !== 'function') return;
    const gate = $('arexAuthGate'); if (gate && getComputedStyle(gate).display !== 'none') return;
    refreshKB().then(() => {
      const s = snap(), seen = seenMap(), day = s.today, fresh = {};
      Object.keys(seen).forEach(k => { if (seen[k] === day) fresh[k] = day; });
      const order = { danger: 0, warn: 1, info: 2 };
      B().proactive(s).filter(a => !fresh[a.id]).sort((a, b) => order[a.level] - order[b.level]).slice(0, 2).forEach(a => { notify(a.title, a.body, a.icon, { silent: a.level === 'info', skipTelegram: true, tag: 'brain-' + a.id, view: a.view || '' }); fresh[a.id] = day; external(a, day); });
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(fresh)); } catch (e) {}
      renderCard();
    });
  }
  function init() {
    if (!B()) return;
    const m = $('mascot'); if (m) m.addEventListener('click', () => { if (m.classList.contains('open')) greet(); }, true);
    setTimeout(tick, 4000); setInterval(tick, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.navbtn,.arex-mobile-nav button')) setTimeout(renderCard, 350); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
