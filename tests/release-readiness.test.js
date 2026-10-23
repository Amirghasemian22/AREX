'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('authenticated IndexedDB uses the canonical single-suffix account database name', () => {
  const html = read('index.html');
  assert.match(html, /savedUid\s*\?\s*'forexBootcampDB__'\+safeUid/);
  assert.doesNotMatch(html, /const scopedName = savedUid \? DB_NAME\+'__'\+savedUid/);
});

test('auth migration recovers old double-scoped data only when canonical database is empty', () => {
  const client = read('auth-client.js');
  assert.match(client, /priorDoubleScoped=await readDb\(target\+'__'\+clean\)/);
  assert.match(client, /accountPolicy\.migrationSource/);
  assert.match(client, /if \(migration\.allowed\) await writeDb/);
  assert.match(client, /AREXAccountStoragePolicy/);
});

test('release readiness checklist distinguishes automated checks from live-service verification', () => {
  const report = read('PHASE21_RELEASE_READINESS_REPORT_FA.md');
  assert.match(report, /Firebase واقعی/);
  assert.match(report, /مرورگر واقعی/);
  assert.match(report, /WIP/);
  assert.match(report, /forexBootcampDB__/);
});

test('critical app screens and preservation-sensitive services remain present', () => {
  const html = read('index.html');
  for (const marker of ['id="view-dashboard"', 'id="view-trades"', 'id="view-psych"', 'id="view-calendar"', 'id="settingsBackup"', 'id="settingsNotifications"']) {
    assert.ok(html.includes(marker), `Missing preserved screen/control anchor: ${marker}`);
  }
  for (const file of ['auth-client.js', 'arex-edge-worker.js', 'firestore.rules', 'js/core/backup-safety.js', 'js/core/cloud-sync.js', 'js/core/save-reliability.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing critical service/file: ${file}`);
  }
});
