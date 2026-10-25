/* AREX V9.6.3 — ui/pretrade: Pre-Trade Gate panel in the trade form. Logic: js/core/pretrade.js. Informational only; it never blocks saving a journal entry. Texts: V9T. */
(function () {
  const esc = v => escapeHtml(v == null ? '' : String(v));
  const VC = { allowed: 'high', blocked: 'low', needs_info: 'medium' };
  const LV = { block: '⛔', missing: '❓', warn: '⚠️', info: 'ℹ️' };
  let ticked = new Set(), cfgCache = null;
  const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  async function cfg() { if (window.__arexGuardCfg) return window.__arexGuardCfg; if (cfgCache) return cfgCache; try { const r = await storage.get('guardCfg'); cfgCache = r && r.value ? JSON.parse(r.value) : {}; } catch (e) { cfgCache = {}; } if (!window.__arexGuardCfg) window.__arexGuardCfg = cfgCache; return cfgCache; }
  function reasonText(r) {
    const p = Object.assign({}, r.p); if (p.w) p.w = V9T('pt.w.' + p.w);
    const s = r.code ? V9T('pt.r.' + r.code, p) : r.text; return s === 'pt.r.' + r.code ? r.text : s;
  }
  function ensure() {
    const slot = document.getElementById('pretradeGate'); if (!slot) return null;
    if (!slot.dataset.ready) {
      slot.dataset.ready = '1';
      slot.innerHTML = '<details class="v9-details" id="ptBox" style="margin:10px 0"><summary data-v9="pt.title"></summary><div class="section-sub" style="margin-top:6px" data-v9="pt.intro"></div><button type="button" class="btn ghost" id="ptRun" data-v9="pt.run"></button><div id="ptOut" style="margin-top:8px"></div></details>';
      document.getElementById('ptRun').addEventListener('click', run);
    }
    slot.querySelectorAll('[data-v9]').forEach(el => { el.textContent = V9T(el.dataset.v9); });   // re-applied on every language change
    return slot;
  }
  async function run() {
    const out = document.getElementById('ptOut'); if (!out) return;
    const kb = await arexLoadKB(), c = await cfg(), setup = val('trSetup').trim(), d = typeof todayIso === 'function' ? todayIso() : new Date().toISOString().slice(0, 10);
    const now = new Date(), hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const rt = AREXCore.strategykb.rulesForTrade(kb, { date: d, time: hhmm, setup });
    const res = AREXCore.pretrade.evaluate({ trade: { dir: val('trDir'), entry: val('trEntry'), sl: val('trSl'), tp: val('trTp'), riskPct: val('trRiskPct') }, cfg: { maxRiskPct: c.maxRiskPct, minRR: c.minRR, maxTradesPerDay: c.maxTradesPerDay },
      guard: typeof arexGuardMerged === 'function' ? arexGuardMerged() : null, rules: rt.rules, ticked: [...ticked], tradesToday: (state.trades || []).filter(t => t.date === d).length, hasStrategy: !!setup });
    const order = { block: 0, missing: 1, warn: 2, info: 3 };
    out.innerHTML = '<div class="v9-find-h"><b>' + V9T('pt.result') + ' <span class="v9-badge v9-' + VC[res.verdict] + '">' + V9T('pt.v.' + res.verdict) + '</span></b>' + (res.rr !== null ? '<span class="v9-find-b">' + V9T('pt.rr') + ' ' + esc(res.rr) + '</span>' : '') + '</div>' +
      (rt.version ? '<div class="v9-find-b v9-muted">' + V9T('pt.version', { n: esc(rt.version.n), d: esc(rt.version.date) }) + (rt.ambiguous ? ' — ' + V9T('pt.sameDay') : '') + '</div>' : '') +
      (rt.rules.length ? '<div class="field-lbl" style="margin-top:8px">' + V9T('pt.rulesHint') + '</div>' + rt.rules.map(r => '<label class="imp-chk" style="margin:3px 0"><input type="checkbox" data-pt="' + esc(r.id) + '"' + (ticked.has(r.id) ? ' checked' : '') + '> <span>' + esc(r.text) + ' <small class="v9-muted">(' + V9T('kind.' + r.kind) + ')</small></span></label>').join('') : '') +
      '<ul style="margin:8px 0;padding-inline-start:18px;font-size:12px">' + res.reasons.slice().sort((a, b) => order[a.level] - order[b.level]).map(r => '<li>' + LV[r.level] + ' ' + esc(reasonText(r)) + '</li>').join('') + '</ul><div class="imp-note">' + V9T('pt.disclaimer') + '</div>';
    out.querySelectorAll('[data-pt]').forEach(cb => cb.addEventListener('change', () => { cb.checked ? ticked.add(cb.dataset.pt) : ticked.delete(cb.dataset.pt); run(); }));
  }
  window.initArexPretrade = ensure;
})();
