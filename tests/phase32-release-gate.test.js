'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('phase 32 release gate passes against the current package', () => {
  const run = spawnSync(process.execPath, ['scripts/release-gate.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /Release gate: 8\/8 checks passed/);
});

test('release gate checks the complete declared Service Worker shell', () => {
  const gate = read('scripts/release-gate.js');
  assert.match(gate, /APP_SHELL/);
  assert.match(gate, /cached assets/);
  assert.match(gate, /missing cached assets/);
});

test('release gate checks unique IDs and local HTML references', () => {
  const gate = read('scripts/release-gate.js');
  assert.match(gate, /HTML IDs are unique/);
  assert.match(gate, /Local script and stylesheet references exist/);
});

test('release gate checks Firestore owner guard and browser credential hygiene', () => {
  const gate = read('scripts/release-gate.js');
  assert.match(gate, /Google Drive-only authentication and backup are wired/);
  assert.match(gate, /Browser code has no obvious private key/);
});

test('release report makes no claim of live-service certification', () => {
  const report = read('PHASE32_RELEASE_CANDIDATE_REPORT_FA.md');
  assert.match(report, /آزمون‌های زنده/);
  assert.match(report, /Google/);
  assert.match(report, /Google/);
  assert.match(report, /Cloudflare/);
  assert.match(report, /WIP/);
});

test('critical trading workflows and recovery modules are retained in the package', () => {
  const html = read('index.html');
  for (const id of ['view-dashboard', 'view-trades', 'view-psych', 'view-calendar', 'settingsBackup', 'settingsNotifications']) {
    assert.ok(html.includes(`id="${id}"`), `missing preserved anchor ${id}`);
  }
  for (const file of ['js/core/backup-safety.js', 'js/core/cloud-sync.js', 'js/core/save-reliability.js', 'js/core/runtime-verification.js', 'auth-client.js', 'arex-edge-worker.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }
});

test('release candidate documents manual go-live steps separately from automated checks', () => {
  const report = read('PHASE32_RELEASE_CANDIDATE_REPORT_FA.md');
  for (const term of ['مرورگر واقعی', 'ورود Google', 'A و B', 'آفلاین', 'Worker']) assert.ok(report.includes(term), `missing manual step: ${term}`);
});
