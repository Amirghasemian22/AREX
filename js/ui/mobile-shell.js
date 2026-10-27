/* AREX V9.8.0 — ui/mobile-shell: phone layout (compact two-row topbar, bottom-sheet assistant, deep links).
   Moves existing nodes (listeners/ids preserved) on phones and puts them back on larger screens. */
(function () {
  'use strict';
  const mq = window.matchMedia('(max-width:760px)'), $ = id => document.getElementById(id);
  const homes = new Map();   // node -> {parent, marker}
  function park(node, target) {
    if (!node || node.parentNode === target) return;
    if (!homes.has(node)) { const marker = document.createComment('arex-home'); node.parentNode.insertBefore(marker, node); homes.set(node, marker); }
    target.appendChild(node);
  }
  function restore() { homes.forEach((marker, node) => { if (marker.parentNode) marker.parentNode.insertBefore(node, marker); }); }
  function layout() {
    const tb = document.querySelector('.topbar'); if (!tb) return;
    document.documentElement.classList.toggle('arex-phone', mq.matches);
    let strip = $('arexTopStrip');
    if (mq.matches) {
      if (!strip) { strip = document.createElement('div'); strip.id = 'arexTopStrip'; strip.className = 'arex-top-strip'; tb.appendChild(strip); }
      const actions = tb.querySelector('.top-actions'); if (!actions) return;
      // row 1 (icons): sync, bell, account  |  row 2 (scroll strip): clock, usdt, win-rate, language, theme
      park($('accountTopBtn'), actions); park($('driveQuickSyncBtn'), actions);
      ['.top-clock', '.top-usdt', '#streakChip', '#topLangSelect', '#themeBtn'].forEach(sel => park(tb.querySelector(sel), strip));
      const bell = tb.querySelector('.changelog-wrap'); if (bell) actions.appendChild(bell);
      actions.insertBefore($('driveQuickSyncBtn'), actions.firstChild);
    } else { restore(); if (strip) strip.remove(); }
  }
  function sheet() {
    const head = document.querySelector('#mascotPanel .arex-bot-head'); if (!head || $('arexSheetClose')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'arexSheetClose'; b.className = 'icon-btn arex-sheet-close'; b.setAttribute('aria-label', 'بستن'); b.textContent = '✕';
    b.addEventListener('click', e => { e.stopPropagation(); const m = $('mascot'); if (m) m.classList.remove('open', 'expanded'); });
    head.appendChild(b);
  }
  function tabState() {
    const cur = (document.querySelector('.view.active') || {}).id || '';
    document.querySelectorAll('.arex-mobile-nav [data-mobile-view]').forEach(b => b.classList.toggle('active', cur === 'view-' + b.dataset.mobileView));
  }
  function deepLink() {
    const go = new URLSearchParams(location.search).get('go'); if (!go || !/^[a-z]+$/.test(go)) return;
    let n = 0; const t = setInterval(() => { const g = $('arexAuthGate'), btn = document.querySelector('.navbtn[data-view="' + go + '"]'); n++;
      if (btn && (!g || getComputedStyle(g).display === 'none')) { btn.click(); clearInterval(t); } else if (n > 40) clearInterval(t); }, 500);
  }
  function init() {
    layout(); sheet(); tabState(); deepLink();
    (mq.addEventListener ? mq.addEventListener('change', layout) : mq.addListener(layout));
    const mo = new MutationObserver(tabState); document.querySelectorAll('.view').forEach(v => mo.observe(v, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('mascot'); if (m) m.classList.remove('open'); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
