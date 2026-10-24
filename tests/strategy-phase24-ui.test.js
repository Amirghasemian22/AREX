const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('Phase 24 adds searchable/filterable strategy rule browser and visible state summary', () => {
  const ui = fs.readFileSync(path.join(root, 'js/ui/strategy.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(ui, /kbRuleSearch/);
  assert.match(ui, /kbRuleStatus/);
  assert.match(ui, /kbRuleKind/);
  assert.match(ui, /applyRuleFilters/);
  assert.match(ui, /قانون رسمی فعال/);
  assert.match(ui, /پیشنهاد در انتظار تصمیم/);
  assert.match(html, /v9-rule-filters/);
  assert.match(html, /v9-kb-summary/);
});

test('Phase 24 export contains only the current strategy knowledge base and is local-download based', () => {
  const ui = fs.readFileSync(path.join(root, 'js/ui/strategy.js'), 'utf8');
  assert.match(ui, /strategy-knowledge-base-export/);
  assert.match(ui, /AREX-strategy-knowledge-base-/);
  assert.match(ui, /URL\.createObjectURL/);
  assert.match(ui, /JSON\.stringify\(payload, null, 2\)/);
});

test('Phase 24 keeps conflict handling human-reviewed and versioned operations reason-gated', () => {
  const core = require(path.join(root, 'js/core/strategykb.js'));
  const kb = core.emptyKB();
  const now = {date:'2026-10-24', time:'12:00', iso:'2026-10-24T12:00:00Z'};
  const proposed = core.propose(kb, {text:'حداقل نسبت ریسک به بازده ۲ باشد', kind:'confirmed'}, now, ()=>'r1');
  assert.equal(proposed.kb.rules[0].status, 'proposed');
  const missingReason = core.approve(proposed.kb, 'r1', '', now);
  assert.match(missingReason.error, /دلیل تغییر الزامی/);
  const approved = core.approve(proposed.kb, 'r1', 'تأیید کاربر برای تست', now);
  assert.equal(approved.kb.versions.length, 1);
  assert.equal(approved.kb.versions[0].approvedByUser, true);
});
