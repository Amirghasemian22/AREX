/* AREX V9.6.3 — ui/import: CSV / broker-report import modal over js/core/importer.js. CSV content is untrusted -> DOM built with textContent only.
   Globals from the host page (used at call time only): state, storage, toast, queueSave, detectTradeSessions, detectNearNews, newTradeDefaults. Texts: V9T. */
(function () {
  const impS = { text: '', headers: [], map: {}, prev: null };
  const el = id => document.getElementById(id);
  const opt = (sel, value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; sel.appendChild(o); };
  const item = it => { if (!it || !it.code) return ''; const p = Object.assign({}, it.p); if (p.f) p.f = V9T('imp.f.' + p.f); const s = V9T('imp.i.' + it.code, p); return s === 'imp.i.' + it.code ? it.code : s; };

  function renderMap() {
    const box = el('impMap'); box.textContent = '';
    AREXCore.importer.FIELDS.forEach(f => {
      const w = document.createElement('label'); w.className = 'imp-map-item';
      const l = document.createElement('span'); l.textContent = V9T('imp.f.' + f) + ((f === 'date' || f === 'symbol' || f === 'dir') ? ' *' : '');
      const s = document.createElement('select'); s.className = 'txt-input'; s.dataset.field = f;
      opt(s, '', V9T('imp.unmapped')); impS.headers.forEach((h, i) => opt(s, String(i), (String(h).trim() || V9T('imp.column') + ' ' + (i + 1)) + ' [' + (i + 1) + ']'));
      if (f in impS.map) s.value = String(impS.map[f]);
      s.addEventListener('change', () => { if (s.value === '') delete impS.map[f]; else impS.map[f] = +s.value; runPreview(); });
      w.appendChild(l); w.appendChild(s); box.appendChild(w);
    });
  }
  function runPreview() {
    const sum = el('impSummary'), tbl = el('impTable'), btn = el('impCommit'); sum.textContent = ''; tbl.textContent = ''; btn.disabled = true;
    const p = AREXCore.importer.preview(impS.text, impS.map, state.trades, { dateFormat: el('impDateFmt').value || undefined, netOfCosts: el('impNet').checked });
    impS.prev = p;
    p.fileErrors.forEach((e, i) => { const d = document.createElement('div'); d.className = 'imp-err'; const it = p.fileErrorItems && p.fileErrorItems[i]; d.textContent = '⚠ ' + (it ? item(it) : e); sum.appendChild(d); });
    if (!p.rows.length) return;
    const c = p.counts, line = document.createElement('div'); line.className = 'imp-counts';
    line.textContent = V9T('imp.counts', { ok: c.ok, err: c.error, dup: c.duplicate, skip: c.skipped }); sum.appendChild(line);
    const t = document.createElement('table'); t.className = 'imp-table';
    const hr = t.insertRow(); ['imp.h.line', 'imp.h.status', 'a.colDate', 'a.tabSymbol', 'a.colDir', 'R', 'a.colUsd', 'imp.h.issues'].forEach(h => { const th = document.createElement('th'); th.textContent = h === 'R' ? 'R' : V9T(h); hr.appendChild(th); });
    const ST = { ok: '✓ ' + V9T('imp.st.ok'), error: '✗ ' + V9T('imp.st.error'), duplicate: '⧉ ' + V9T('imp.st.duplicate'), skipped: '– ' + V9T('imp.st.skipped') };
    p.rows.slice(0, 200).forEach(r => { const tr = t.insertRow(); tr.className = 'imp-' + r.status; const tt = r.trade || {};
      [r.line, ST[r.status], tt.date ? (tt.date + (tt.time ? ' ' + tt.time : '')) : '', tt.symbol || '', tt.dir || '', tt.r || '', tt.usd || '', (r.issueItems && r.issueItems.length ? r.issueItems.map(item) : r.issues).join(' | ')].forEach(v => { const td = tr.insertCell(); td.textContent = String(v); }); });
    tbl.appendChild(t);
    if (p.rows.length > 200) { const m = document.createElement('div'); m.className = 'imp-note'; m.textContent = V9T('imp.first200'); tbl.appendChild(m); }
    btn.textContent = c.ok ? V9T('imp.addN', { n: c.ok }) : V9T('imp.nothing'); btn.disabled = !c.ok;
  }
  async function open() {
    el('importOverlay').classList.add('open');
    const lb = await storage.get('lastImportBatch').catch(() => null);
    let info = null; try { info = lb && lb.value ? JSON.parse(lb.value) : null; } catch (e) { }
    const u = el('impUndo'); u.style.display = info ? 'inline-flex' : 'none'; if (info) u.textContent = V9T('imp.undoN', { n: info.count });
  }
  function reset() { impS.text = ''; impS.headers = []; impS.map = {}; impS.prev = null; el('impFile').value = ''; el('impOptions').style.display = 'none'; el('impSummary').textContent = ''; el('impTable').textContent = ''; el('impCommit').disabled = true; el('impCommit').textContent = V9T('imp.add'); }
  function close() { el('importOverlay').classList.remove('open'); reset(); }
  function refreshViews() { ['renderTrades', 'renderTradeStats', 'updateRiskWarnBanner', 'renderTradeWeekMap', 'renderDashboardDailyStatus', 'renderAssistantWidget', 'renderTargetProgress', 'updateWeeklyWinrate'].forEach(n => { try { if (typeof window[n] === 'function') window[n](); } catch (e) { console.error(n, e); } }); }

  window.initArexImport = function () {
    if (!el('openImportBtn') || el('openImportBtn').dataset.bound) return; el('openImportBtn').dataset.bound = '1';
    el('openImportBtn').addEventListener('click', open);
    el('impClose').addEventListener('click', close); el('impCancel').addEventListener('click', close);
    el('importOverlay').addEventListener('click', e => { if (e.target === el('importOverlay')) close(); });
    el('impDateFmt').addEventListener('change', runPreview); el('impNet').addEventListener('change', runPreview);
    el('impFile').addEventListener('change', async ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { toast(V9T('imp.tooBig')); reset(); return; }
      try { impS.text = await f.text(); } catch (e) { toast(V9T('imp.readFail')); return; }
      const parsed = AREXCore.importer.parseCSV(impS.text);
      impS.headers = parsed.rows[0] || []; impS.map = AREXCore.importer.suggestMapping(impS.headers);
      el('impOptions').style.display = 'block'; renderMap(); runPreview();
    });
    el('impCommit').addEventListener('click', async () => {
      const p = impS.prev; if (!p || !p.counts.ok) return;
      const batchId = 'imp-' + Date.now(); let seq = Date.now();
      const add = AREXCore.importer.commit(p, batchId, () => ++seq).map(t => Object.assign(newTradeDefaults(), t, { sessions: detectTradeSessions(t.date, t.time), nearNews: detectNearNews(t.date, t.time), hasShotEntry: false, hasShotExit: false, hasVoice: false }));
      add.sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? 1 : -1);   // newest first, like manual entries
      state.trades = add.concat(state.trades);
      queueSave('trades');
      await storage.set('lastImportBatch', JSON.stringify({ id: batchId, count: add.length, at: new Date().toISOString() })).catch(() => { });
      refreshViews(); toast('✓ ' + V9T('imp.imported', { n: add.length })); close();
    });
    el('impUndo').addEventListener('click', async () => {
      const lb = await storage.get('lastImportBatch').catch(() => null); if (!lb || !lb.value) return;
      let info; try { info = JSON.parse(lb.value); } catch (e) { return; }
      if (!confirm(V9T('imp.undoConfirm', { n: info.count }))) return;
      const r = AREXCore.importer.undoImport(state.trades, info.id); state.trades = r.trades; queueSave('trades');
      await storage.delete('lastImportBatch').catch(() => { return storage.set('lastImportBatch', '').catch(() => { }); });
      refreshViews(); toast('↩️ ' + V9T('imp.undone', { n: r.removed })); el('impUndo').style.display = 'none';
    });
  };
})();
