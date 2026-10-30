const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
test('mobile PWA shell uses a sticky glass header with safe-area-aware bottom navigation', () => {
  assert.match(html, /id="arex-v9711-mobile-app-shell"/);
  assert.match(html, /\.topbar\s*\{[^}]*position:sticky!important;top:0!important/s);
  assert.match(html, /env\(safe-area-inset-top/);
  assert.match(html, /env\(safe-area-inset-bottom/);
  assert.match(html, /\.arex-mobile-nav\s*\{[^}]*position:fixed!important/s);
});
test('replay-training question mark button is no longer injected into the toolbar', () => {
  assert.doesNotMatch(html, /id=['"]arexTourReplay['"]/);
  assert.doesNotMatch(html, /function installReplay\(\)/);
});
test('mobile navigation retains the core views and the all-sections menu', () => {
  for (const key of ['dashboard', 'trades', 'analytics']) assert.match(html, new RegExp(`data-mobile-view="${key}"`));
  assert.match(html, /id="arexMobileMore"/);
  assert.match(html, /more\.dataset\.mobileView='more'/);
  assert.match(html, /id="hamburgerBtn"/);
  assert.match(html, /id="sidebar"/);
});
test('PWA metadata and cache version are bumped for V9.8.0', () => {
  assert.equal(manifest.short_name, 'AREX');
  assert.match(sw, /v9-8-0-brain-mobile-2026-10-29/);
});
