/* AREX V9.6.3 — ui/strategy: versioned strategy knowledge base + evolution history on the Strategy page. Logic: js/core/strategykb.js.
   Proposed rules never count; approval/revision/retirement always asks for a reason and creates an immutable version. Texts: V9T. */
(function () {
  const K = () => AREXCore.strategykb;
  const esc = v => escapeHtml(v == null ? '' : String(v));
  const fa = v => (typeof faDigits === 'function') ? faDigits(String(v)) : String(v);
  let kb = null, loading = null, seq = 0;
  window.__arexKBPromise = null;

  function nowObj() { const d = new Date(), p = n => String(n).padStart(2, '0'); const date = typeof todayIso === 'function' ? todayIso() : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); return { date, time: p(d.getHours()) + ':' + p(d.getMinutes()), iso: d.toISOString() }; }
  const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  window.arexLoadKB = function () {
    if (kb) return Promise.resolve(kb);
    if (!loading) loading = storage.get('strategyKB').then(r => { kb = r && r.value ? JSON.parse(r.value) : K().emptyKB(); window.__arexKB = kb; return kb; }).catch(() => { kb = K().emptyKB(); window.__arexKB = kb; return kb; });
    return loading;
  };
  const errText = res => { const s = V9T('kb.err.' + res.code); return s === 'kb.err.' + res.code ? res.error : s; };
  async function commit(res, okKey) {
    if (res.error) { toast(errText(res)); return false; }
    kb = res.kb; window.__arexKB = kb;
    try { await storage.set('strategyKB', JSON.stringify(kb)); } catch (e) { toast(V9T('a.saveFailed')); return false; }
    if (okKey) toast(V9T(okKey.k, okKey.p)); render(); return true;
  }
  function ensureContainer() {
    const host = document.getElementById('view-strategy'); if (!host || document.getElementById('v9KB')) return;
    const d = document.createElement('section'); d.className = 'card'; d.id = 'v9KB'; d.style.marginTop = '16px'; host.appendChild(d);
  }
  const ask = (msg, def) => { const v = prompt(msg, def || ''); return v === null ? null : v.trim(); };

  function ruleCard(r, conflicts) {
    const cf = conflicts.filter(c => c.a === r.id || c.b === r.id);
    let actions = '';
    if (r.status === 'proposed') actions = '<button type="button" class="chip" data-kb="approve" data-id="' + esc(r.id) + '">' + V9T('kb.approve') + '</button><button type="button" class="chip" data-kb="reject" data-id="' + esc(r.id) + '">' + V9T('kb.reject') + '</button>';
    if (r.status === 'official') actions = '<button type="button" class="chip" data-kb="revise" data-id="' + esc(r.id) + '">' + V9T('kb.revise') + '</button><button type="button" class="chip" data-kb="retire" data-id="' + esc(r.id) + '">' + V9T('kb.retire') + '</button>';
    return '<div class="v9-find"><div class="v9-find-h"><b>' + esc(r.text) + '</b><span class="v9-badge v9-' + (r.status === 'official' ? 'high' : r.status === 'proposed' ? 'medium' : 'low') + '">' + V9T('kb.st.' + r.status) + ' · ' + V9T('kind.' + r.kind) + '</span></div>' +
      '<div class="v9-find-b v9-muted">' + (r.strategy ? V9T('kb.strategyLbl') + ' ' + esc(r.strategy) : V9T('kb.global')) + (r.param ? ' · ' + esc(r.param.key) + ' = ' + esc(r.param.value) : '') + '</div>' +
      (r.examples.length ? '<div class="v9-find-b">' + V9T('kb.example') + ' ' + esc(r.examples.join(' | ')) + '</div>' : '') + (r.exceptions.length ? '<div class="v9-find-b">' + V9T('kb.exception') + ' ' + esc(r.exceptions.join(' | ')) + '</div>' : '') +
      cf.map(c => '<div class="v9-warn">⚠ ' + esc(V9T('kb.cf.' + c.code, c.p)) + ' (' + V9T('kb.cfConf.' + c.confidence) + ')</div>').join('') +
      (actions ? '<div class="v9-tabs" style="margin:4px 0 0">' + actions + '</div>' : '') + '</div>';
  }
  function evolutionHtml() {
    const ev = K().evolution(kb); if (!ev.length) return '<div class="empty">' + V9T('kb.noVersions') + '</div>';
    const groups = {}; (state.trades || []).forEach(t => { const v = K().versionAt(kb, t).version; const k = v ? v.n : 0; (groups[k] = groups[k] || []).push(t); });
    return ev.slice().reverse().map(v => {
      const s = AREXCore.analytics.summarize(groups[v.n] || []), d = v.diff;
      return '<div class="v9-find"><div class="v9-find-h"><b>' + V9T('kb.versionTitle', { n: fa(v.n), d: esc(v.date), t: esc(v.time) }) + '</b><span class="v9-badge v9-high">' + V9T('kb.officialCount', { n: fa(v.ruleCount) }) + '</span></div>' +
        '<div class="v9-find-b">' + V9T('kb.reasonLbl') + ' ' + esc(v.reason) + '</div>' +
        '<div class="v9-find-b v9-muted">' + V9T('kb.diffSummary', { a: fa(d.added.length), r: fa(d.removed.length), c: fa(d.changed.length) }) + '</div>' +
        d.changed.map(c => '<div class="v9-find-b">«' + esc(c.fromText) + '» → «' + esc(c.toText) + '»</div>').join('') +
        '<div class="v9-find-b">' + (s.counted ? V9T('kb.periodResults', { n: fa(s.counted), w: s.winRate === null ? '—' : fa((s.winRate * 100).toFixed(0)) + '%', e: s.expectancyR === null ? '—' : fa(s.expectancyR.toFixed(2)) }) + (s.lowSample ? ' · <span class="v9-badge v9-low">' + V9T('a.lowSampleBadge') + '</span>' : '') : V9T('kb.noPeriodTrades')) + '</div></div>';
    }).join('') + ((groups[0] || []).length ? '<div class="imp-note">' + V9T('kb.beforeFirst', { n: fa(groups[0].length) }) + '</div>' : '') + ruleAuditHtml();
  }
  function ruleAuditHtml() {
    if (!window.AREXCore || !AREXCore.ruleaudit) return '';
    const a = AREXCore.ruleaudit.audit(kb, state.trades || []);
    const esc2 = v => esc(v == null ? '—' : v);
    const groups = a.groups.length ? '<div class="v9-find"><b>نتایج به تفکیک نسخه</b>' + a.groups.map(g => '<div class="v9-find-b">نسخه ' + fa(g.versionN) + ' · ' + fa(g.count) + ' معامله · ' + (g.avgCompliance == null ? 'پایبندی ثبت نشده' : 'میانگین پایبندی ' + fa(g.avgCompliance.toFixed(1)) + '٪') + ' · ' + (g.withR ? 'مجموع R: ' + fa(g.netR.toFixed(2)) : 'نتیجه R ثبت نشده') + (g.ambiguous ? ' · ' + fa(g.ambiguous) + ' مورد زمان مبهم' : '') + '</div>').join('') + '</div>' : '<div class="empty">برای گزارش نسخه‌ای، به نسخه رسمی قوانین و معاملات تاریخ‌دار نیاز است.</div>';
    const recent = a.rows.slice().sort((x,y)=>(y.date+y.time).localeCompare(x.date+x.time)).slice(0,10).map(r => '<div class="v9-find-b">' + esc2(r.date) + ' · ' + esc2(r.setup || 'ستاپ نامشخص') + ' · نسخه ' + fa(r.versionN) + ' · ' + (r.ruleCompliance == null ? 'پایبندی ثبت نشده' : 'پایبندی ' + fa(r.ruleCompliance) + '٪') + (r.ambiguous ? ' · زمان مبهم' : '') + '</div>').join('');
    return '<section class="card" style="margin-top:14px"><div class="section-title">ممیزی معاملات در برابر نسخه تاریخی قوانین</div><div class="section-sub">' + fa(a.attributed) + ' از ' + fa(a.total) + ' معامله به نسخه‌ای نسبت داده شد؛ ' + fa(a.unknown.length) + ' مورد به‌دلیل نبود تاریخ/نسخه قابل نسبت‌دهی نیست. این گزارش نقض قانون را حدس نمی‌زند.</div>' + groups + (recent ? '<div class="v9-find"><b>آخرین معاملات قابل نسبت‌دهی</b>' + recent + '</div>' : '') + '<details class="v9-details"><summary>محدودیت‌ها و موارد نامشخص (' + fa(a.unknown.length) + ')</summary>' + a.limitations.map(x => '<div class="v9-find-b">' + esc2(x) + '</div>').join('') + a.unknown.slice(0,15).map(x => '<div class="v9-find-b">معامله ' + esc2(x.tradeId) + ': ' + esc2(x.reason) + '</div>').join('') + '</details></section>';
  }
  function render() {
    const box = document.getElementById('v9KB'); if (!box || !kb) return;
    const cs = K().conflicts(kb), order = { official: 0, proposed: 1, retired: 2, rejected: 3 };
    const rules = kb.rules.slice().sort((a, b) => order[a.status] - order[b.status]);
    const legacy = (state.tradeRules || []).filter(t => !kb.rules.some(r => K().norm(r.text) === K().norm(t))).length;
    box.innerHTML = '<div class="section-title">' + V9T('kb.title') + '</div><div class="section-sub">' + V9T('kb.sub') + '</div>' +
      '<div class="v9-tabs">' + (legacy ? '<button type="button" class="btn ghost" id="kbImport">' + V9T('kb.importLegacy', { n: fa(legacy) }) + '</button>' : '') + '</div>' +
      '<details class="v9-details" id="kbNewBox"><summary>' + V9T('kb.addProposal') + '</summary><div class="form-grid" style="margin-top:8px">' +
      '<div style="grid-column:1/-1"><div class="field-lbl">' + V9T('kb.fText') + '</div><input class="txt-input" id="kbText" maxlength="240"></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fKind') + '</div><select class="txt-input" id="kbKind"><option value="confirmed">' + V9T('kind.confirmed') + '</option><option value="mandatory">' + V9T('kind.mandatory') + '</option><option value="preference">' + V9T('kind.preference') + '</option><option value="hypothesis">' + V9T('kind.hypothesis') + '</option></select></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fStrategy') + '</div><input class="txt-input" id="kbStrategy" maxlength="60"></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fParamKey') + '</div><input class="txt-input" id="kbPKey" maxlength="40" placeholder="' + esc(V9T('kb.eg') + ' min_rr') + '"></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fParamVal') + '</div><input class="txt-input" id="kbPVal" maxlength="40"></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fExample') + '</div><input class="txt-input" id="kbEx" maxlength="240"></div>' +
      '<div><div class="field-lbl">' + V9T('kb.fException') + '</div><input class="txt-input" id="kbExc" maxlength="240"></div></div>' +
      '<div class="modal-actions" style="justify-content:flex-start"><button type="button" class="btn" id="kbAdd">' + V9T('kb.submitProposal') + '</button></div></details>' +
      (cs.length ? '<div class="v9-warn" style="margin-top:10px">' + V9T('kb.conflictsFound', { n: fa(cs.length) }) + '</div>' : '') +
      '<div style="margin-top:10px">' + (rules.length ? rules.map(r => ruleCard(r, cs)).join('') : '<div class="empty">' + V9T('kb.noRules') + '</div>') + '</div>' +
      '<div class="section-title" style="margin-top:16px">' + V9T('kb.evolutionTitle') + '</div>' + evolutionHtml();
    const q = id => box.querySelector(id);
    const imp = q('#kbImport'); if (imp) imp.addEventListener('click', () => { const meta = typeof getArexRuleMeta === 'function' ? getArexRuleMeta() : {}; const r = K().importLegacy(kb, state.tradeRules || [], t => meta[arexRuleKey(t)], nowObj(), newId); commit(r, { k: 'kb.imported', p: { n: r.added } }); });
    q('#kbAdd').addEventListener('click', () => {
      commit(K().propose(kb, { text: q('#kbText').value, kind: q('#kbKind').value, strategy: q('#kbStrategy').value, param: { key: q('#kbPKey').value, value: q('#kbPVal').value }, examples: [q('#kbEx').value], exceptions: [q('#kbExc').value] }, nowObj(), newId), { k: 'kb.proposed' });
    });
    box.querySelectorAll('[data-kb]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id, act = b.dataset.kb, r = kb.rules.find(x => x.id === id); if (!r) return;
      if (act === 'reject') { commit(K().reject(kb, id, nowObj()), { k: 'kb.rejected' }); return; }
      if (act === 'revise') {
        const text = ask(V9T('kb.askNewText'), r.text); if (text === null) return;
        const reason = ask(V9T('kb.askReviseReason')); if (reason === null) return;
        commit(K().revise(kb, id, { text }, reason, nowObj(), newId), { k: 'kb.revised' }); return;
      }
      const reason = ask(act === 'approve' ? V9T('kb.askApproveReason') : V9T('kb.askRetireReason')); if (reason === null) return;
      commit(act === 'approve' ? K().approve(kb, id, reason, nowObj()) : K().retire(kb, id, reason, nowObj()), { k: act === 'approve' ? 'kb.approved' : 'kb.retired' });
    }));
  }
  window.renderArexKB = async function () { const my = ++seq; ensureContainer(); await window.arexLoadKB(); if (my !== seq) return; render(); };
})();
