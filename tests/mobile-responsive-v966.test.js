const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
test('V9.6.6 final mobile responsive pass covers narrow widths, safe areas and landscape', () => {
  assert.match(html, /id="arex-mobile-final-pass"/);
  for (const width of ['max-width:860px', 'max-width:560px', 'max-width:390px', 'max-width:340px']) assert.ok(html.includes(width), `missing ${width}`);
  assert.match(html, /var\(--arex-mobile-nav-height\)/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /orientation:\s*landscape/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
});
test('V9.6.6 preserves the existing mobile navigation and horizontal table containers', () => {
  assert.match(html, /class="arex-mobile-nav"/);
  assert.match(html, /overflow-x:auto;overscroll-behavior-inline:contain/);
  assert.match(html, /#arexAuthGate/);
});
