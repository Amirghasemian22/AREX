const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
test('psychology journal exposes recent-data insight summary without changing storage model', () => {
  assert.match(html, /id="psychMetricCount"/);
  assert.match(html, /id="psychMetricRating"/);
  assert.match(html, /id="psychMetricMood"/);
  assert.match(html, /function renderPsychInsights\(\)/);
  assert.match(html, /renderPsychInsights\(\);/);
  assert.match(html, /state\.psych/);
  assert.match(html, /این فقط شمارش برچسب‌هاست/);
});
test('psychology journal recent-list action and cache version are wired', () => {
  assert.match(html, /id="psychShowRecent"/);
  assert.match(html, /psychShowRecent.*addEventListener/s);
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
