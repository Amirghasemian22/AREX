'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Phase 32: runtime diagnostic is opt-in and exported', () => {
  const html = read('index.html');
  assert.match(html, /window\.arexRunRuntimeVerification\s*=\s*async\s*function/);
  assert.match(html, /includeSnapshot/);
  // Keep diagnostics user-invoked; no automatic startup invocation should be wired.
  assert.doesNotMatch(html, /(?:DOMContentLoaded|window\.onload)[\s\S]{0,300}arexRunRuntimeVerification\s*\(/);
});

test('Phase 32: Google Drive backup uses appDataFolder and explicit failure propagation', () => {
  const html = read('index.html');
  const client = read('auth-client.js');
  assert.match(html, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(html, /parents:\s*\['appDataFolder'\]/);
  assert.match(html, /arexDriveSaveBackup\s*=\s*async\s*function[\s\S]{0,180}throw new Error/);
  assert.match(client, /await window\.arexDriveSaveBackup\(\)/);
  assert.match(client, /ذخیره در Google Drive ناموفق بود/);
});

test('Phase 32: workflow shortcuts point to existing app sections', () => {
  const html = read('index.html');
  for (const id of ['view-daily', 'view-trades', 'view-review', 'view-analytics', 'view-goals', 'view-psych']) {
    assert.ok(html.includes('id="' + id + '"') || html.includes("id='" + id + "'"), `missing expected section id: ${id}`);
  }
  assert.match(read('tests/workflows-phase29.test.js'), /workflow/i);
});

test('Phase 32: PWA app shell lists core trading modules and local assets exist', () => {
  const sw = read('sw.js');
  const match = sw.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, 'APP_SHELL missing');
  const assets = [...match[1].matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
  for (const asset of ['index.html', 'auth-client.js', 'js/core/analytics.js', 'js/core/daily-learning.js', 'js/core/mistake-trends.js']) {
    assert.ok(assets.includes('./' + asset), `missing core offline asset: ${asset}`);
    assert.ok(fs.existsSync(path.join(root, asset)), `missing local asset: ${asset}`);
  }
});

test('Phase 32: release gate documents its static-only boundary', () => {
  const gate = read('scripts/release-gate.js');
  assert.match(gate, /does not replace browser or live-service tests/i);
  assert.match(gate, /Google Drive-only authentication and backup are wired/);
});
