'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('Phase 33: release gate includes recursive JavaScript syntax validation', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/release-gate.js'), 'utf8');
  assert.match(gate, /All local JavaScript files pass syntax validation/);
  assert.match(gate, /spawnSync\(process\.execPath, \['--check', file\]/);
  assert.match(gate, /if \(entry\.name === '\.git' \|\| entry\.name === 'node_modules'\)/);
});

test('Phase 33: release gate runs successfully and reports JavaScript syntax coverage', () => {
  const run = spawnSync(process.execPath, ['scripts/release-gate.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /All local JavaScript files pass syntax validation \| \d+ JavaScript files passed node --check/);
  assert.match(run.stdout, /Release gate: 7\/7 checks passed/);
});
