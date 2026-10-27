const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('OAuth client ID remains configured and exposed by index.html', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /const GOOGLE_CLIENT_ID\s*=\s*"[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com"/);
  assert.match(html, /window\.AREX_GOOGLE_CLIENT_ID\s*=\s*getArexGoogleClientId\(\)/);
});

test('auth adapter prioritizes configured public OAuth ID over stale false bridge', () => {
  const js = fs.readFileSync(path.join(root, 'auth-client.js'), 'utf8');
  assert.match(js, /if\(String\(window\.AREX_GOOGLE_CLIENT_ID\s*\|\|\s*''\)\.trim\(\)\) return \(\) => true;/);
  assert.ok(js.indexOf("if(String(window.AREX_GOOGLE_CLIENT_ID || '').trim()) return () => true;") < js.indexOf("if(typeof window.arexDriveIsEnabled==='function')"));
});
