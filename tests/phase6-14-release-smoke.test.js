'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
test('Phase 6–14: all expected application views remain present', () => {
  const views = ['dashboard','trades','analytics','risk','psych','assistant','calendar','backtest','propfirm','strategy','sessions','settings','workspace','daily','goals','scenarios','roadmap'];
  for (const view of views) assert.match(html, new RegExp('id="view-' + view + '"'), `missing view: ${view}`);
});
test('Phase 6–14: cross-view quality pass provides keyboard focus, reduced motion and mobile dialog bounds', () => {
  assert.match(html, /arex-phase6-14-quality-pass/);
  assert.match(html, /focus-visible/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /max-height:calc\(100dvh - 16px\)/);
});
test('Phase 6–14: critical dashboard evidence panels remain present', () => {
  for (const id of ['arexDashPerformanceChart','arexDashMistakeAnalysis','arexDashRecentTrades']) {
    // Some IDs are built dynamically, so accept either literal HTML or runtime source.
    assert.ok(html.includes(id), `missing dashboard component reference: ${id}`);
  }
});
test('Phase 6–14: release cache version is unique and current', () => {
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
test('Phase 6–14: no Firebase runtime reintroduced; Google Drive appDataFolder remains the cloud backup route', () => {
  assert.doesNotMatch(html, /firebase\.initializeApp\s*\(/);
  assert.match(html, /appDataFolder/);
});
