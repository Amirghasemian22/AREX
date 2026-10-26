const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const jsPath = path.join(root, 'js/ui/tradeform-ux-phase16.js');
const js = fs.readFileSync(jsPath, 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('Phase 16 validation module is loaded by the app', () => {
  assert.match(html, /js\/ui\/tradeform-ux-phase16\.js/);
  assert.match(js, /window\.arexTradeFormPhase16/);
});

test('trade form validates symbol and numeric fields without changing trade schema', () => {
  assert.match(js, /برای ثبت معامله، نماد را وارد کن/);
  assert.match(js, /Number\.isFinite\(n\)/);
  assert.match(js, /درصد ریسک باید بیشتر از صفر و حداکثر ۱۰۰ باشد/);
  assert.match(html, /const trade = Object\.assign\(\{\}, oldTrade\|\|newTradeDefaults\(\)/);
});

test('directional SL/TP checks are advisory and do not reject unusual trade records', () => {
  assert.match(js, /Directional SL\/TP mismatches are warnings, not blockers/);
  assert.match(js, /box\.classList\.toggle\('is-warning'/);
});

test('cancel-edit resets date, direction, screenshots, tags, and pending images', () => {
  assert.match(js, /'trDate','trTime','trSymbol'/);
  assert.match(js, /if \(byId\('trDir'\)\) byId\('trDir'\)\.value = 'buy'/);
  assert.match(html, /trSelectedMistakes=\[\];pendingShot=\{entry:null,exit:null\}/);
});

test('service worker cache version is bumped and includes the new module', () => {
  assert.match(sw, /const CACHE_VERSION\s*=\s*'v9-\d+-\d+-[^']+'/);
  assert.match(sw, /\.\/js\/ui\/tradeform-ux-phase16\.js/);
});
