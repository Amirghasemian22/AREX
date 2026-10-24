const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
test('Phase 22 adds backtest filters and evidence notes while keeping separate journal', () => {
  assert.match(html, /id="btSearch"/);
  assert.match(html, /id="btSetupFilter"/);
  assert.match(html, /id="btOutcomeFilter"/);
  assert.match(html, /id="btEvidenceNotice"/);
  assert.match(html, /آمار بر اساس فیلترهای انتخاب‌شده/);
  assert.match(html, /برای مقایسه توصیفی، حداقل ۵ نتیجه معتبر/);
  assert.match(html, /backtests: \[\]/);
});
test('Phase 22 subtracts recorded costs and orders drawdown chronologically', () => {
  assert.match(html, /return r - costs/);
  assert.match(html, /Drawdown must follow chronological order/);
  assert.match(html, /localeCompare\(String\(b\.trade\.date/);
});
test('Phase 22 keeps backtest data separate from live trade data', () => {
  const block = html.slice(html.indexOf('/* ================= BACKTEST (separate journal) ================= */'), html.indexOf('/* ================= PROP FIRM CHALLENGE TRACKER ================= */'));
  assert.match(block, /state\.backtests/);
  assert.doesNotMatch(block, /state\.trades\s*=|state\.trades\.push/);
  assert.match(block, /queueSave\('backtests'\)/);
});
