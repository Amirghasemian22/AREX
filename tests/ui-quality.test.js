'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../js/core/ui-quality.js');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('locale resolution only returns configured languages and safely falls back', () => {
  const dictionaries = {fa:{},en:{},de:{}};
  assert.equal(UI.resolveLanguage('de', dictionaries), 'de');
  assert.equal(UI.resolveLanguage('fr', dictionaries), 'fa');
  assert.equal(UI.resolveLanguage(null, dictionaries), 'fa');
});

test('Persian is RTL and English/German are LTR', () => {
  assert.equal(UI.directionForLanguage('fa'), 'rtl');
  assert.equal(UI.directionForLanguage('en'), 'ltr');
  assert.equal(UI.directionForLanguage('de'), 'ltr');
});

test('translation audit reports exact missing keys without mutating dictionaries', () => {
  const base = {a:'A', b:'B'}; const en = {a:'A'};
  const result = UI.auditTranslationKeys(base, {en});
  assert.deepEqual(result.en.missing, ['b']);
  assert.equal(result.en.coverage, 50);
  assert.deepEqual(en, {a:'A'});
});

test('phase 20 translation refresh covers title and accessible labels and translates daily page metadata', () => {
  const html = read('index.html');
  assert.match(html, /data-i18n-title/);
  assert.match(html, /data-i18n-aria-label/);
  assert.match(html, /name==='daily'\?t\('page\.dailyTitle'\)/);
  for (const text of ['Daily Review', 'Tagesrückblick', 'گزارش روزانه']) assert.ok(html.includes(text), `missing ${text}`);
  assert.match(html, /langControl\.setAttribute\('aria-label', t\('ui\.language'\)\)/);
});

test('phase 20 responsive and reduced-motion rules are present', () => {
  const html = read('index.html');
  assert.match(html, /@media\(max-width:560px\)/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /input\[type="url"\].*direction:ltr/);
});

test('UI quality module is loaded by the page and precached for offline use', () => {
  const html = read('index.html'), sw = read('sw.js');
  assert.match(html, /src="js\/core\/ui-quality\.js"/);
  assert.match(sw, /'\.\/js\/core\/ui-quality\.js'/);
  assert.match(sw, /v9-6-4-drive-only-final-quality-pass-33/);
});
