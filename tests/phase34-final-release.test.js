'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('phase 34 includes an explicit final release status and honest live-test boundary', () => {
  const report = fs.readFileSync(path.join(root, 'PHASE34_FINAL_RELEASE_STATUS_FA.md'), 'utf8');
  assert.match(report, /آماده برای آزمون پذیرش عملی/);
  assert.match(report, /آزمون زندهٔ OAuth یا Drive محسوب نمی‌شود/);
  assert.match(report, /GitHub یا سرویس‌های زنده/);
});
test('phase 34 provides a manual acceptance checklist for critical user flows', () => {
  const checklist = fs.readFileSync(path.join(root, 'PHASE34_MANUAL_ACCEPTANCE_CHECKLIST_FA.md'), 'utf8');
  for (const phrase of ['ورود Google', 'پشتیبان Google Drive', 'حالت آفلاین', 'RTL فارسی و LTR']) assert.ok(checklist.includes(phrase), `missing checklist item: ${phrase}`);
});
