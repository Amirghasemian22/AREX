/* AREX V9.6.3 — core/migrate: versioned, NON-DESTRUCTIVE state migration with backup + rollback. Pure (no storage here).
   Rules: never delete or rewrite existing user data; only add missing fields with neutral defaults; idempotent; re-runnable. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.migrate = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA_VERSION = 2;       // 1 = V5.x state (no schemaVersion field); 2 = V9.6.3
  const APP_VERSION = 'AREX V9.7.13';
  const clone = o => JSON.parse(JSON.stringify(o));

  const steps = {
    // v1 -> v2
    1(state, log) {
      let added = 0;
      for (const t of (state.trades || [])) {
        for (const [k, dflt] of [['riskPct', null], ['slOriginal', null], ['strategyId', null], ['strategyVersion', null], ['emotionBefore', null], ['emotionAfter', null]]) {
          if (!(k in t)) { t[k] = dflt; added++; }
        }
        if (!Array.isArray(t.tags)) { t.tags = []; added++; }
      }
      for (const [k, dflt] of [['strategyKB', () => ({ rules: [], proposals: [], preferences: [] })], ['strategyVersions', () => []], ['workingMemory', () => []], ['notificationPrefs', () => ({})], ['qualityHistory', () => []]]) {
        if (!(k in state)) { state[k] = dflt(); added++; }
      }
      log.push('v1→v2: ' + added + ' فیلد جدید با مقدار خنثی افزوده شد؛ هیچ داده موجودی حذف یا تغییر نکرد');
    }
  };

  /** @returns {{state, from, to, changed, log}} state is a deep copy; input is never mutated. */
  function migrateState(input) {
    const state = clone(input || {});
    const from = Number.isInteger(state.schemaVersion) ? state.schemaVersion : 1;
    const log = [];
    if (from > SCHEMA_VERSION) return { state, from, to: from, changed: false, log: ['نسخه داده (' + from + ') جدیدتر از این برنامه است؛ مهاجرت انجام نشد'], tooNew: true };
    let v = from;
    while (v < SCHEMA_VERSION) { steps[v](state, log); v++; }
    if (v !== from) {
      state.schemaVersion = v;
      state.migrationLog = (state.migrationLog || []).concat([{ from, to: v, app: APP_VERSION, notes: log }]);
    }
    return { state, from, to: v, changed: v !== from, log };
  }
  /** Backup envelope to be written (by the integration layer) BEFORE the migrated state replaces the original. */
  function createBackup(state, nowIso) {
    return { kind: 'arex-pre-migration-backup', app: APP_VERSION, schemaVersion: Number.isInteger(state.schemaVersion) ? state.schemaVersion : 1, createdAt: nowIso || new Date().toISOString(), data: clone(state) };
  }
  /** Returns the exact pre-migration state from a backup envelope (validated). */
  function rollback(backup) {
    if (!backup || backup.kind !== 'arex-pre-migration-backup' || typeof backup.data !== 'object') throw new Error('invalid backup');
    return clone(backup.data);
  }
  return { SCHEMA_VERSION, APP_VERSION, migrateState, createBackup, rollback };
});
