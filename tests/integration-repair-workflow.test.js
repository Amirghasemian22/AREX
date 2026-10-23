'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const repair = require('../js/core/diagnostic-repair.js');
const history = require('../js/core/repair-history.js');
const recovery = require('../js/core/repair-recovery.js');
const backup = require('../js/core/backup-safety.js');
const lifecycle = require('../js/core/trade-lifecycle.js');
const cloud = require('../js/core/cloud-sync.js');

function trade(overrides = {}) {
  return { id: 'trade-29-1', symbol: '  XAUUSD  ', date: '2026-10-23', r: -1, usd: -25, ...overrides };
}
function applyAndAudit(rows, proposal, at = '2026-10-23T15:00:00.000Z') {
  const result = repair.apply(rows, proposal, { confirmed: true });
  assert.equal(result.ok, true);
  const created = history.create({ ...result, reason: proposal.reason }, at);
  assert.equal(created.ok, true);
  const appended = history.append(null, created.event);
  assert.equal(appended.ok, true);
  return { result, event: created.event, history: appended.history };
}

test('phase 29 E2E: propose, explicitly apply, create audit, reconcile and finalize applied status', () => {
  const original = [trade()];
  const proposals = repair.propose(original);
  const proposal = proposals.find(p => p.field === 'symbol');
  assert.ok(proposal);
  const { result, event, history: audit } = applyAndAudit(original, proposal);
  assert.equal(original[0].symbol, '  XAUUSD  ', 'source records remain immutable');
  assert.equal(result.trades[0].symbol, 'XAUUSD');
  assert.equal(event.status, 'pending');
  const scan = recovery.scan(audit, result.trades, history);
  assert.equal(scan.counts.ready, 1);
  assert.equal(scan.items[0].suggestedStatus, 'applied');
  const finalized = recovery.resolve(audit, event.eventId, recovery.snapshot(event), result.trades, 'applied', history);
  assert.equal(finalized.ok, true);
  assert.equal(finalized.history.entries[0].status, 'applied');
});

test('phase 29 E2E: failed trade persistence remains pending and can be reconciled if data did not change', () => {
  const rows = [trade()];
  const proposal = repair.propose(rows).find(p => p.field === 'symbol');
  const { event, history: audit } = applyAndAudit(rows, proposal);
  const unchanged = [trade()];
  const scan = recovery.scan(audit, unchanged, history);
  assert.equal(scan.counts.ready, 1);
  assert.equal(scan.items[0].suggestedStatus, 'failed');
  const resolved = recovery.resolve(audit, event.eventId, recovery.snapshot(event), unchanged, 'failed', history);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.history.entries[0].status, 'failed');
});

test('phase 29 E2E: post-proposal edit blocks stale repair and creates no audit event', () => {
  const rows = [trade()];
  const proposal = repair.propose(rows).find(p => p.field === 'symbol');
  const edited = [{ ...rows[0], r: 4 }];
  const applied = repair.apply(edited, proposal, { confirmed: true });
  assert.equal(applied.ok, false);
  assert.equal(applied.code, 'stale_record');
  assert.equal(history.create(applied, '2026-10-23T15:00:00.000Z').ok, false);
});

test('phase 29 E2E: conflict and duplicate trade IDs are not automatically resolved', () => {
  const proposal = repair.propose([trade()]).find(p => p.field === 'symbol');
  const { event, history: audit } = applyAndAudit([trade()], proposal);
  const conflict = recovery.scan(audit, [{ ...trade(), symbol: 'EURUSD' }], history);
  assert.equal(conflict.counts.conflict, 1);
  assert.equal(recovery.resolve(audit, event.eventId, recovery.snapshot(event), [{ ...trade(), symbol: 'EURUSD' }], 'applied', history).ok, false);
  const duplicates = recovery.scan(audit, [trade(), trade()], history);
  assert.equal(duplicates.counts.ambiguous, 1);
});

test('phase 29 integration: backup validation and rollback preserve journal records through lifecycle changes', () => {
  const source = { trades: [trade({ symbol: 'XAUUSD' })], dailyLogs: [{ date: '2026-10-23', note: 'review' }] };
  const envelope = { app: 'AREX', schemaVersion: 6, data: source };
  const validation = backup.validateEnvelope(envelope, JSON.stringify(envelope).length);
  assert.equal(validation.ok, true);
  const snapshot = backup.makeRestoreSnapshot(source, '2026-10-23T15:00:00.000Z');
  const restored = backup.rollbackSnapshot(snapshot);
  assert.deepEqual(restored, source);
  assert.equal(lifecycle.assertUniqueTradeIds(restored.trades).ok, true);
});

test('phase 29 integration: stable cloud snapshot retries and returns the stable later journal state', async () => {
  let reads = 0;
  const states = [
    { trades: [{ id: 't', symbol: 'XAUUSD', r: 1 }] },
    { trades: [{ id: 't', symbol: 'XAUUSD', r: 2 }] },
    { trades: [{ id: 't', symbol: 'XAUUSD', r: 2 }] },
    { trades: [{ id: 't', symbol: 'XAUUSD', r: 2 }] }
  ];
  const result = await cloud.readStableSnapshot({
    flush: async () => true,
    getStatus: () => ({ pendingCount: 0, inFlight: false, hasError: false }),
    readAll: async () => states[reads++], maxAttempts: 3, wait: async () => {}
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.data.trades[0].r, 2);
});

test('phase 29 UI integration contract wires repair confirmation, audit persistence, save flush and recovery review', () => {
  const ui = fs.readFileSync('js/ui/analytics.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.match(ui, /window\.confirm\('تأیید اصلاح این معامله/);
  assert.match(ui, /storage\.set\('arexDiagnosticRepairHistory'/);
  assert.match(ui, /await flushSave\(\)/);
  assert.match(ui, /recoveryApi\.resolve/);
  assert.match(html, /js\/core\/diagnostic-repair\.js/);
  assert.match(html, /js\/core\/repair-history\.js/);
  assert.match(html, /js\/core\/repair-recovery\.js/);
  assert.match(sw, /\.\/js\/core\/diagnostic-repair\.js/);
  assert.match(sw, /\.\/js\/core\/repair-history\.js/);
  assert.match(sw, /\.\/js\/core\/repair-recovery\.js/);
});
