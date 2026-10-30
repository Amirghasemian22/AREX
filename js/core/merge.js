/* AREX V9.8.0 — core/merge: union-merge of two device backups (key -> JSON string maps), so a stale device can never wipe newer data.
   Records are matched by id; the newer `updatedAt`/`at` wins; deletions are honoured through tombstones (workspaceState.v98.deleted). Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.merge = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const parse = s => { if (typeof s !== 'string') return { ok: true, v: s }; try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false, v: s }; } };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const stamp = o => { const t = o && (o.updatedAt || o.at || o.savedAt || o.modifiedAt); const n = t ? Date.parse(t) : NaN; return Number.isFinite(n) ? n : null; };
  const filled = o => (isObj(o) ? Object.keys(o).filter(k => o[k] !== '' && o[k] !== null && o[k] !== undefined && !(Array.isArray(o[k]) && !o[k].length)).length : 0);
  const idOf = o => (isObj(o) ? (o.id !== undefined ? 'id:' + o.id : o.conflictId ? 'k:' + o.conflictId : null) : null);
  /** The better of two versions of the same record: newer timestamp, else the more complete one, else local. */
  function pick(a, b) { const ta = stamp(a), tb = stamp(b); if (ta !== null && tb !== null && ta !== tb) return ta > tb ? a : b; if (ta !== null && tb === null) return a; if (tb !== null && ta === null) return b; const fa = filled(a), fb = filled(b); return fb > fa ? b : a; }
  function mergeArray(l, r, tomb, rep, path) {
    const out = [], seen = new Map(); let added = 0, updated = 0;
    l.forEach(x => { const k = idOf(x); if (k && tomb && tomb[String(x.id)]) { rep.dropped++; return; } if (k) { seen.set(k, out.length); } out.push(x); });
    r.forEach(x => { const k = idOf(x); if (!k) { if (!out.some(y => JSON.stringify(y) === JSON.stringify(x))) { out.push(x); added++; } return; } if (tomb && tomb[String(x.id)]) { rep.dropped++; return; }
      if (seen.has(k)) { const i = seen.get(k), best = pick(out[i], x); if (best !== out[i]) { out[i] = isObj(best) && isObj(out[i]) ? Object.assign({}, out[i], best) : best; updated++; } } else { seen.set(k, out.length); out.push(x); added++; } });
    rep.added += added; rep.updated += updated; if (path) rep.paths[path] = { added, updated }; return out;
  }
  function mergeValue(l, r, ctx, path) {
    if (Array.isArray(l) && Array.isArray(r)) return mergeArray(l, r, path === 'trades' ? ctx.tomb.trades : null, ctx.rep, path);
    if (isObj(l) && isObj(r)) { const o = {}; new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => { if (!(k in r)) o[k] = l[k]; else if (!(k in l)) o[k] = r[k]; else o[k] = mergeValue(l[k], r[k], ctx, path ? path + '.' + k : k); }); return o; }
    if (l === undefined || l === null || l === '') return r;
    return l;                                                    // scalars: this device's value (preferences stay per device)
  }
  const mergeTombs = (a, b) => { const o = {}; [a, b].forEach(t => isObj(t) && Object.keys(t).forEach(k => { o[k] = Object.assign({}, o[k], t[k]); })); return o; };
  const tombsOf = d => { const as = parse(d.assistantState); return (as.ok && isObj(as.v) && as.v.workspaceState && as.v.workspaceState.v98 && as.v.workspaceState.v98.deleted) || {}; };
  /** local / remote: {key: jsonString}. Returns {data, report}. */
  function mergeAll(local, remote) {
    const rep = { added: 0, updated: 0, dropped: 0, paths: {}, keys: 0, kept: 0 }, tomb = mergeTombs(tombsOf(local), tombsOf(remote)), ctx = { rep, tomb }, out = {};
    new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
      if (k.startsWith('backup:') || k === 'driveFileId') { if (k in local) out[k] = local[k]; return; }
      if (!(k in remote)) { out[k] = local[k]; rep.kept++; return; } if (!(k in local)) { out[k] = remote[k]; rep.keys++; return; }
      const a = parse(local[k]), b = parse(remote[k]); if (!a.ok || !b.ok || local[k] === remote[k]) { out[k] = local[k]; return; }
      out[k] = JSON.stringify(mergeValue(a.v, b.v, ctx, k));
    });
    const as = parse(out.assistantState); if (as.ok && isObj(as.v)) { const ws = (as.v.workspaceState = as.v.workspaceState || {}), v = (ws.v98 = ws.v98 || {}); v.deleted = tomb; out.assistantState = JSON.stringify(as.v); }
    return { data: out, report: rep };
  }
  /** Record a deletion so other devices do not resurrect it. */
  function tombstone(v98, collection, id) { v98.deleted = v98.deleted || {}; (v98.deleted[collection] = v98.deleted[collection] || {})[String(id)] = new Date().toISOString(); }
  return { mergeAll, mergeArray, pick, tombstone };
});
