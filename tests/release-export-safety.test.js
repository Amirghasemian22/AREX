'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const workspace = fs.readFileSync('js/ui/workspace.js', 'utf8');
const backupSafety = require('../js/core/backup-safety.js');
const cloudSync = require('../js/core/cloud-sync.js');
const migration = require('../js/core/migrate.js');

function loadCsvCell() {
  const match = workspace.match(/function csvCell\(value\)\s*\{[\s\S]*?\n\}/);
  assert.ok(match, 'CSV safety helper should exist');
  return vm.runInNewContext('(' + match[0].replace(/^function csvCell/, 'function') + ')');
}

test('CSV export neutralizes formula-like text and preserves ordinary negative numbers', () => {
  const cell = loadCsvCell();
  assert.equal(cell('=HYPERLINK("https://bad.example","click")'), '"\'=HYPERLINK(""https://bad.example"",""click"")"');
  assert.equal(cell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
  assert.equal(cell('-12.50'), '"-12.50"');
  assert.equal(cell('normal "text"'), '"normal ""text"""');
});

test('trade CSV and OHLC CSV exports both use formula-safe cell escaping', () => {
  assert.match(workspace, /cols\.map\(csvCell\)\.join\(','\)/);
  assert.match(workspace, /cols\.map\(k=>cell\(t\[k\]\)\)\.join\(','\)/);
  assert.match(workspace, /AREX_V9\.7\.9-trades\.csv/);
});

test('new backup and migration metadata identify the active app version', () => {
  const snapshot = backupSafety.makeRestoreSnapshot({ trades: '[]' }, '2026-10-25T00:00:00Z');
  assert.equal(snapshot.app, 'AREX V9.7.9');
  assert.equal(cloudSync.createManifest({ trades: '[]' }, '2026-10-25T00:00:00Z').appVersion, 'AREX V9.7.9');
  assert.equal(migration.APP_VERSION, 'AREX V9.7.9');
});
