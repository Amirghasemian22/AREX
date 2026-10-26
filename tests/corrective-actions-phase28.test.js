const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('Phase 28 adds a follow-up history panel to daily review', () => {
  assert.match(html, /id="correctiveActionHistory"/);
  assert.match(html, /تاریخچه اقدامات اصلاحی/);
  assert.match(html, /ثبت اقدام به معنی انجام‌شدن آن نیست/);
});

test('Phase 28 persists action history in the existing assistantState record and restores it safely', () => {
  assert.match(html, /correctiveActionHistory:state\.correctiveActionHistory\|\|\[\]/);
  assert.match(html, /Array\.isArray\(ax\.correctiveActionHistory\)\?ax\.correctiveActionHistory:\[\]/);
  assert.match(html, /syncCorrectiveAction\(date,log\.nextAction\)/);
});

test('Phase 28 provides explicit completion, reopening and outcome-note actions', () => {
  assert.match(html, /data-phase28-done/);
  assert.match(html, /data-phase28-reopen/);
  assert.match(html, /data-phase28-note/);
  assert.match(html, /function updateCorrectiveAction\(/);
});

test('Phase 28 cache key is updated for clients to receive the new UI', () => {
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
