const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('Phase 25 adds measurable goal inputs while retaining the existing goals state model', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /newGoalTarget/);
  assert.match(html, /newGoalCurrent/);
  assert.match(html, /newGoalAction/);
  assert.match(html, /newGoalDue/);
  assert.match(html, /state\.goals\.push\(\{id:Date\.now\(\),text,done:false,action:/);
  assert.match(html, /queueSave\('goalsrules'\)/);
  assert.match(html, /escapeHtml\(g\.text\)/);
});

test('Phase 25 makes checklist progress explicitly distinct from trading readiness', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /درصد تکمیل این چک‌لیست فقط میزان انجام مراحل را نشان می‌دهد/);
  assert.match(html, /معتبر بودن ستاپ یا مجاز بودن ورود به معامله نیست/);
  assert.match(html, /data-arex-go="daily"/);
});

test('Phase 25 bumps the service-worker cache version', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /goals-plan-phase25-44/);
});
