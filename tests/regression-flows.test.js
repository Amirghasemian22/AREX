'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../js/core/analytics.js');
const errors = require('../js/core/errors.js');
const alerts = require('../js/core/alert-engine.js');
const lifecycle = require('../js/core/trade-lifecycle.js');
const backup = require('../js/core/backup-safety.js');
const cloud = require('../js/core/cloud-sync.js');

function fixture() {
  return [
    { id: 't-1', date: '2026-10-20', time: '09:00', symbol: 'XAUUSD', setup: 'S1', r: -1, usd: -100, mistakes: ['خارج از پلن'], ruleCompliance: 70 },
    { id: 't-2', date: '2026-10-20', time: '10:00', symbol: 'XAUUSD', setup: 'S1', r: -0.5, usd: -50, mistakes: ['خارج از پلن'], ruleCompliance: 80 },
    { id: 't-3', date: '2026-10-21', time: '11:00', symbol: 'US30', setup: 'S2', r: 2, usd: 200, mistakes: [], ruleCompliance: 100 }
  ];
}

test('regression: journal projection, symbol grouping and mistake evidence share the same source trades', () => {
  const rows = fixture();
  const summary = analytics.summarize(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.totalR, 0.5);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 2);
  const symbols = Object.fromEntries(analytics.bySymbol(rows).map(x => [x.key, x]));
  assert.equal(symbols.XAUUSD.total, 2);
  assert.equal(symbols.US30.totalR, 2);
  const detected = errors.detect(rows, { complianceMin: 100 });
  const tagged = detected.findings.find(x => x.id === 'tag:off_plan');
  assert.ok(tagged);
  assert.deepEqual(tagged.tradeIds.sort(), ['t-1', 't-2']);
  assert.equal(tagged.estCostR, -1.5);
});

test('regression: configured alerts require explicit user threshold and point back to evidence', () => {
  const rows = fixture();
  const finding = errors.detect(rows, { complianceMin: 100 }).findings.find(x => x.id === 'tag:off_plan');
  const pending = alerts.evaluate([finding], {}, {}, Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(pending.alerts.length, 0);
  assert.equal(pending.candidates[0].reason, 'threshold_not_confirmed');
  const active = alerts.evaluate([finding], { rules: { 'tag:off_plan': { enabled: true, minCount: 2 } } }, {}, Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(active.alerts.length, 1);
  assert.deepEqual(active.alerts[0].tradeIds.sort(), ['t-1', 't-2']);
});

test('regression: edit and delete update every derived view without mutating prior records', () => {
  const original = fixture();
  const edited = original.map(t => t.id === 't-2' ? { ...t, r: 1, usd: 100, mistakes: [] } : t);
  assert.equal(analytics.summarize(original).totalR, 0.5);
  assert.equal(analytics.summarize(edited).totalR, 2);
  assert.equal(errors.detect(edited, {}).findings.some(x => x.id === 'tag:off_plan' && x.tradeIds.includes('t-2')), false);
  const removed = lifecycle.removeTrade(edited, 't-1');
  assert.equal(removed.trades.length, 2);
  assert.equal(analytics.summarize(removed.trades).totalR, 3);
  assert.equal(analytics.bySymbol(removed.trades).find(x => x.key === 'XAUUSD').total, 1);
  assert.equal(original.find(t => t.id === 't-2').r, -0.5);
});

test('regression: duplicate trade IDs are rejected as a detectable integrity issue', () => {
  const rows = fixture(); rows.push({ ...rows[0], r: 9 });
  const result = lifecycle.assertUniqueTradeIds(rows);
  assert.equal(result.ok, false);
  assert.deepEqual(result.duplicates, ['t-1']);
});

test('regression: legacy and current backup envelopes remain readable without mutating input', () => {
  const data = { trades: fixture(), dailyLogs: [{ date: '2026-10-20', status: 'yes' }] };
  const legacy = backup.validateEnvelope(data, JSON.stringify(data).length);
  assert.equal(legacy.ok, true);
  assert.equal(legacy.kind, 'legacy');
  const fullInput = { app: 'AREX', schemaVersion: 6, data };
  const full = backup.validateEnvelope(fullInput, JSON.stringify(fullInput).length);
  assert.equal(full.ok, true);
  assert.equal(full.kind, 'full');
  const snap = backup.makeRestoreSnapshot(data, '2026-10-23T00:00:00.000Z');
  const restored = backup.rollbackSnapshot(snap);
  assert.deepEqual(restored, data);
  assert.deepEqual(fullInput.data, data);
});

test('regression: cloud snapshot retries when data changes between reads and then stabilizes', async () => {
  let reads = 0;
  const snapshots = [
    { trades: [{ id: 't-1', r: 1 }] },
    { trades: [{ id: 't-1', r: 2 }] },
    { trades: [{ id: 't-1', r: 2 }] },
    { trades: [{ id: 't-1', r: 2 }] }
  ];
  const result = await cloud.readStableSnapshot({
    flush: async () => true,
    getStatus: () => ({ pendingCount: 0, inFlight: false, hasError: false }),
    readAll: async () => snapshots[reads++],
    maxAttempts: 3,
    wait: async () => {}
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.data.trades[0].r, 2);
});

test('regression: cloud backup refuses a snapshot while local save is pending or failed', async () => {
  await assert.rejects(() => cloud.readStableSnapshot({
    flush: async () => false,
    getStatus: () => ({ pendingCount: 1, inFlight: false, hasError: false }),
    readAll: async () => ({})
  }), /local_save_pending/);
  await assert.rejects(() => cloud.readStableSnapshot({
    flush: async () => true,
    getStatus: () => ({ pendingCount: 0, inFlight: false, hasError: true }),
    readAll: async () => ({})
  }), /local_save_pending/);
});

test('regression: cloud manifest detects partial or mismatched snapshot metadata', () => {
  assert.equal(cloud.validateCloudManifest({ currentSnapshotId: 'snap-1', itemCount: 3 }, 3).ok, true);
  const bad = cloud.validateCloudManifest({ currentSnapshotId: 'snap-1', itemCount: 3 }, 2);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes('item_count_mismatch'));
});
