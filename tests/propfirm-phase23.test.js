const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Phase 23 adds a prop-firm overview and responsive metrics', () => {
  assert.match(html, /id="propFirmOverviewGrid"/);
  assert.match(html, /pf-overview-grid/);
  assert.match(html, /pf-metric-grid/);
  assert.match(html, /@media\(max-width:520px\)/);
});

test('daily loss consumption uses only records dated today and a configured positive limit', () => {
  assert.match(html, /function pfDailyPnl\(c\)/);
  assert.match(html, /t\.date===today/);
  assert.match(html, /dailyLimit>0\?Math\.max\(0,Math\.min\(100,Math\.max\(0,-daily\)\/dailyLimit\*100\)\):null/);
});

test('challenge creation validates required positive limits and nonnegative integer days', () => {
  assert.match(html, /سقف ضرر روزانه/);
  assert.match(html, /سقف ضرر کل/);
  assert.match(html, /!Number\.isInteger\(n\)/);
});

test('prop-firm warnings state local-data limitations and do not auto-pass challenges', () => {
  assert.match(html, /اطلاعات از شرکت پراپ یا حساب زنده دریافت نمی‌شود/);
  assert.match(html, /وضعیت پاس‌شدن را با قوانین رسمی شرکت بررسی کن/);
  assert.match(html, /ثبت دستی/);
});

test('service worker cache version changes for Phase 23', () => {
  assert.match(sw, /propfirm-phase23-42/);
});
