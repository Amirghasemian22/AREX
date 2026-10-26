const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('dashboard coach shows evidence, priority and data-grounded motivation', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="arexCoachPriority"/);
  assert.match(html, /id="arexCoachEvidence"/);
  assert.match(html, /id="arexCoachMotivationText"/);
  assert.match(html, /چرا این پیشنهاد؟/);
  assert.match(html, /این فقط توصیف نمونه ثبت‌شده است/);
  assert.match(html, /فراوانی به‌تنهایی ثابت نمی‌کند/);
});

test('service worker cache version reflects dashboard coach update', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
