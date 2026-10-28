/* AREX V9.8.0 — ui/views: tiny registry so new pages (accounts, market, review center) plug into goView + sidebar + shell,
   and one persisted store (state.workspaceState.v98) that is saved with the journal and included in Drive backups. */
(function () {
  'use strict';
  const reg = {}, ICON = d => '<span class="ic"><svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg></span>';
  window.arexV98 = function () {
    const ws = (state.workspaceState = state.workspaceState || {}); const v = (ws.v98 = ws.v98 || {});
    v.accounts = v.accounts || []; v.ledger = v.ledger || []; v.watchlist = v.watchlist || []; v.alerts = v.alerts || []; v.reactions = v.reactions || {}; v.weekPlans = v.weekPlans || {}; v.weeklyReviews = v.weeklyReviews || {}; v.prefs = v.prefs || {};
    if (window.AREXCore && AREXCore.ledger) AREXCore.ledger.ensure(v, state.riskLimits);
    return v;
  };
  window.arexV98Save = () => { try { queueSave('assistantState'); } catch (e) {} };
  window.arexRegisterView = function (o) {
    if (reg[o.id]) return reg[o.id];
    const content = document.querySelector('.content'); if (!content) return null;
    const sec = document.createElement('section'); sec.className = 'view'; sec.id = 'view-' + o.id; sec.innerHTML = o.html || ''; content.appendChild(sec);
    const side = document.getElementById('sidebar'), btn = document.createElement('button'); btn.type = 'button'; btn.className = 'navbtn'; btn.dataset.view = o.id; btn.innerHTML = ICON(o.icon || '<circle cx="12" cy="12" r="8"/>') + ' <span>' + o.title + '</span>';
    btn.addEventListener('click', () => goView(o.id));
    const foot = side && side.querySelector('.sidebar-foot'); if (side) side.insertBefore(btn, foot || null);
    reg[o.id] = o; if (window.arexShell && arexShell.relabel) { try { arexShell.relabel(); } catch (e) {} }
    return sec;
  };
  function patchGoView() {
    if (typeof window.goView !== 'function' || window.goView.__v98) return;
    const old = window.goView;
    const wrapped = function (name) {
      const r = old.apply(this, arguments);
      const o = reg[name];
      if (o) { const t = document.getElementById('pageTitle'), s = document.getElementById('pageSub'); if (t) t.textContent = o.title; if (s) s.textContent = o.sub || ''; try { o.onShow && o.onShow(); } catch (e) { console.error(e); } }
      document.dispatchEvent(new CustomEvent('arex:view', { detail: { name } }));
      return r;
    };
    wrapped.__v98 = true; window.goView = wrapped;
  }
  patchGoView(); document.addEventListener('DOMContentLoaded', patchGoView); window.addEventListener('load', patchGoView);
  window.arexWeekKey = function (d) { d = d ? new Date(d) : new Date(); const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return x.getUTCFullYear() + '-W' + String(Math.ceil(((x - y0) / 86400000 + 1) / 7)).padStart(2, '0'); };
  window.arexEscape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.arexFmt = { money: v => (v === null || v === undefined || !Number.isFinite(+v) ? '—' : (v < 0 ? '-' : '') + '$' + Math.abs(+v).toLocaleString('en-US', { maximumFractionDigits: 2 })), fa: v => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) };
})();
