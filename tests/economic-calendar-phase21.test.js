const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Phase 21 exposes a dedicated calendar date-range filter', () => {
  assert.match(html, /id="fcRangeFilter"/);
  assert.match(html, /value="24h"/);
  assert.match(html, /value="7d"/);
  assert.match(html, /value="30d"/);
  assert.match(html, /fcRangeFilter.*addEventListener\('change'/s);
});

test('calendar normalizes country aliases and unknown impact without guessing low impact', () => {
  assert.match(html, /function fcNormalizeCountry\(/);
  assert.match(html, /'UNITED STATES':'US'/);
  assert.match(html, /'GERMANY':'DE'/);
  assert.match(html, /function fcNormalizeImpact\(/);
  assert.match(html, /return 'unknown'/);
  assert.match(html, /نامشخص/);
});

test('calendar fallback timezone conversion uses Intl timezone rules, not a fixed UTC offset', () => {
  assert.match(html, /function fcZonedDate\(/);
  assert.match(html, /timeZone:tz/);
  assert.doesNotMatch(html, /new Date\(date\+'T'\+local\+':00\+03:30'\)/);
});

test('calendar source links are limited to HTTP(S) and empty results are not reported as no news after failures', () => {
  assert.match(html, /u\.protocol==='https:'\|\|u\.protocol==='http:'/);
  assert.match(html, /این خطا به معنی نبود خبر نیست/);
  assert.match(html, /اتصال موفق بود؛ برای بازه درخواست‌شده رویداد معتبری برنگشت/);
});

test('service worker cache key is bumped for Phase 21', () => {
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
