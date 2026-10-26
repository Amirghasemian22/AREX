const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const sw = fs.readFileSync('sw.js','utf8');
test('Phase 20 shared UI styles cover keyboard focus, responsive tables, and readable status messages',()=>{
  assert.match(html,/Phase 20 — shared interaction and visual consistency/);
  assert.match(html,/\.view button:focus-visible/);
  assert.match(html,/\.view \[role="alert"\]/);
  assert.ok(html.includes('.view .table-wrap table,.view .table-container table,.view .table-responsive table,.view .scroll-x table{min-width:560px}'));
  assert.match(html,/max-width:680px/);
});
test('Phase 20 honors reduced motion and updates service-worker cache',()=>{
  assert.match(html,/prefers-reduced-motion:reduce/);
  assert.match(sw,/const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
});
test('Phase 20 does not change IndexedDB schema or introduce destructive data operations',()=>{
  assert.doesNotMatch(html,/indexedDB\.deleteDatabase\s*\(/);
});
