const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
test('mobile login uses safe areas and a bounded, single-column card layout', () => {
  assert.match(html, /id="arex-v9712-mobile-login-polish"/);
  assert.match(html, /#arexAuthGate\.visible\s*\{[^}]*flex-direction:column!important/s);
  assert.match(html, /env\(safe-area-inset-top/);
  assert.match(html, /\.auth-card\s*\{[^}]*max-width:440px!important/s);
  assert.match(html, /@media\(orientation:landscape\) and \(max-height:520px\)/);
});
test('login actions meet minimum touch target sizing and reduced-motion is respected', () => {
  assert.match(html, /\.auth-google,\.auth-local,\.auth-lang\s*\{[^}]*min-height:44px/s);
  assert.match(html, /prefers-reduced-motion:reduce\)\{\.auth-card\{animation:none!important\}/);
});
test('version metadata and PWA cache match V9.7.14', () => {
  assert.equal(manifest.short_name, 'AREX V9.7.14');
  assert.match(sw, /v9-7-14-oauth-id-fallback-cache-refresh-2026-10-26/);
});
