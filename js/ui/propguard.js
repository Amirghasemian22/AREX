/* AREX V9.6.3 — ui/propguard: account/prop-firm guard panel inside each challenge card. Logic lives in js/core/propguard.js. Texts: V9T (js/i18n/v9.js). */
(function () {
  const esc = v => escapeHtml(v == null ? '' : String(v));
  const fa = v => (typeof faDigits === 'function') ? faDigits(String(v)) : String(v);
  const usd = x => x === null || x === undefined ? '—' : fa(Number(x).toFixed(2)) + '$';
  let guardCfg = {}, cfgLoaded = false;
  // `storage` is declared by the main inline script (loaded after this file), so it is only touched lazily, never at load time.
  function loadCfg() {
    if (cfgLoaded) return; cfgLoaded = true;
    storage.get('guardCfg').then(r => { if (r && r.value) { guardCfg = JSON.parse(r.value); if (!window.__arexGuardCfg) window.__arexGuardCfg = guardCfg; if (typeof renderChallenges === 'function') renderChallenges(); } }).catch(() => {});
  }

  function row(label, r, used, extra) {
    if (r.state === 'needs_info') return '<div class="v9-guard-row"><span>' + label + '</span><span class="v9-badge v9-low">' + V9T('st.needs_info') + ': ' + esc(V9T('pg.missing.' + r.missing)) + '</span></div>';
    const frac = Math.min(1, Math.max(0, used)), color = r.state === 'breach' ? 'var(--red)' : r.state === 'warn' ? '#e8c25a' : 'var(--green)';
    return '<div class="v9-guard-row"><div class="ch-bar-lbl"><span>' + label + '</span><span style="color:' + color + '">' + V9T('st.' + r.state) + ' · ' + extra + '</span></div><div class="ch-bar-track"><i style="width:' + (frac * 100).toFixed(0) + '%;background:' + color + '"></i></div></div>';
  }
  window.arexGuardHtml = function (c) {
    if (!window.AREXCore || !AREXCore.propguard) return '';
    loadCfg(); if (window.__arexGuardCfg) guardCfg = window.__arexGuardCfg;
    const today = typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0, 10);
    const ledger = (c.trades || []).map(t => ({ date: t.date, usd: t.pnl }));
    const g = AREXCore.propguard.evaluate({ balance: c.balance, dailyLossUsd: c.dailyLossLimit, totalLossUsd: c.maxLossLimit, profitTargetUsd: c.profitTarget }, ledger, today);
    const gt = AREXCore.propguard.evaluate({ maxTradesPerDay: guardCfg.maxTradesPerDay }, state.trades || [], today).rules.tradesPerDay;
    const R = g.rules, lim = (r, key) => r.limitUsd !== undefined ? V9T('pg.usedOf', { p: fa((r.usedFrac * 100).toFixed(0)), l: usd(r.limitUsd), r: usd(r.remainingUsd) }) : '';
    let h = '<div class="v9-guard"><div class="v9-find-h"><b>' + V9T('pg.title') + '</b><span class="v9-badge v9-' + (g.overall === 'breach' ? 'low' : g.overall === 'warn' ? 'medium' : 'high') + '">' + V9T('st.' + g.overall) + '</span></div>';
    h += '<div class="v9-find-b">' + V9T('pg.equity', { e: usd(g.equity), d: usd(g.dailyPnl), t: usd(g.totalPnl) }) + '</div>';
    h += row(V9T('pg.rowDaily'), R.dailyLoss, R.dailyLoss.usedFrac, lim(R.dailyLoss));
    h += row(V9T('pg.rowTotal'), R.totalLoss, R.totalLoss.usedFrac, lim(R.totalLoss));
    h += row(V9T('pg.rowTarget'), R.profitTarget.state === 'needs_info' ? R.profitTarget : Object.assign({}, R.profitTarget, { state: 'ok' }), R.profitTarget.progressFrac, R.profitTarget.targetUsd !== undefined ? V9T('pg.targetOf', { p: fa((R.profitTarget.progressFrac * 100).toFixed(0)), l: usd(R.profitTarget.targetUsd) }) : '');
    h += row(V9T('pg.rowTrades'), gt, gt.usedFrac, gt.max !== undefined ? V9T('pg.nOf', { a: fa(gt.used), b: fa(gt.max) }) : '');
    h += '<details class="v9-details"><summary>' + V9T('pg.limits') + '</summary><ul>' + (g.noteItems || []).map(n => '<li>' + esc(V9T('pg.note.' + n.code, n.p)) + '</li>').join('') + '<li>' + V9T('pg.noteDay') + '</li><li>' + V9T('pg.noteLimits') + '</li></ul></details></div>';
    return h;
  };
})();

/* Merged guard across ACTIVE challenges (worst state per rule) for the Pre-Trade Gate. */
window.arexGuardMerged = function () {
  if (!window.AREXCore || !AREXCore.propguard || typeof state === 'undefined') return null;
  const today = typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0, 10);
  const rank = { breach: 3, warn: 2, ok: 1, needs_info: 0 }, rules = {}; let any = false;
  (state.propChallenges || []).filter(c => !c.passed && !c.failed).forEach(c => {
    any = true;
    const g = AREXCore.propguard.evaluate({ balance: c.balance, dailyLossUsd: c.dailyLossLimit, totalLossUsd: c.maxLossLimit, profitTargetUsd: c.profitTarget }, (c.trades || []).map(t => ({ date: t.date, usd: t.pnl })), today);
    ['dailyLoss', 'totalLoss'].forEach(k => { const r = g.rules[k]; if (r && (!rules[k] || (rank[r.state] || 0) > (rank[rules[k].state] || 0))) rules[k] = r; });
  });
  return any ? { rules } : null;
};
