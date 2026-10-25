'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('phase 5 exposes an accessible interactive mistake evidence panel', () => {
  assert.match(html, /id="arexDashMistakeAnalysis"/);
  assert.match(html, /data-arex-mistake-select/);
  assert.match(html, /arexDashMistakeEvidenceDetail/);
  assert.match(html, /باز کردن ژورنال معاملات/);
});

test('phase 5 keeps frequency, tagged-trade P/L and prior-period change distinct', () => {
  assert.match(html, /previousCounts/);
  assert.match(html, /جمع P\/L معاملات برچسب‌خورده/);
  assert.match(html, /فراوانی، جمع P\/L معاملات برچسب‌خورده و تغییر تعداد بین دو بازه، معیارهای جداگانه‌اند/);
  assert.match(html, /ثابت نمی‌کند اشتباه علت سود یا زیان بوده است/);
});

test('phase 5 increments the service-worker cache version', () => {
  assert.match(sw, /v9-6-4-drive-only-final-quality-pass-33/);
});
