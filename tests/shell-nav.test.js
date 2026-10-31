'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('shell navigation model covers every visible view exactly once and has fa+en labels', () => {
  const shell = read('js/ui/shell.js'), html = read('index.html');
  const groups = [...shell.matchAll(/items: \[([^\]]+)\]/g)].flatMap(m => [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]));
  assert.equal(new Set(groups).size, groups.length, 'a view appears in two groups');
  groups.forEach(v => {
    assert.ok(new RegExp('data-view="' + v + '"').test(html) || ['accounts', 'market', 'reviewcenter'].includes(v), 'missing nav button for ' + v);
    assert.ok(new RegExp('\\b' + v + ': \\[\'[^\']+\', \'[^\']+\'\\]').test(shell), 'missing fa/en label for ' + v);
  });
  assert.ok(groups.length >= 16);
});

test('both layouts are wired: shell script, mobile css, SW precache and desktop/phone rules', () => {
  const html = read('index.html'), sw = read('sw.js'), css = read('arex-mobile.css');
  assert.match(html, /<script src="js\/ui\/shell\.js"><\/script>/);
  assert.match(sw, /'\.\/js\/ui\/shell\.js'/);
  assert.match(css, /@media\(min-width:1100px\)[\s\S]*#view-trades/);       // desktop journal workspace
  assert.match(css, /@media\(max-width:760px\)[\s\S]*arex-acc-closed/);     // phone accordions
  assert.match(css, /arex-trade-form\.arex-sheet-open/);                   // phone entry sheet
});
