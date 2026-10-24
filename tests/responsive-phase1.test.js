'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
test('Phase 1 hybrid mobile navigation exposes primary views and the full menu', () => {
  assert.match(html, /class="arex-mobile-nav"/);
  for (const view of ['dashboard', 'trades', 'analytics']) assert.match(html, new RegExp('data-mobile-view="' + view + '"'));
  assert.match(html, /id="arexMobileMore"[\s\S]*?hamburgerBtn/);
  assert.match(html, /querySelectorAll\('\[data-mobile-view\]'\)\.forEach/);
});
test('Phase 1 responsive rules account for safe areas, narrow screens and reduced motion', () => {
  assert.match(html, /arex-responsive-phase1/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /max-width:380px/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /overflow-x:auto/);
});
test('service worker cache version changes when the responsive shell changes', () => {
  assert.match(sw, /v9-6-4-drive-only-final-quality-pass-33/);
});
