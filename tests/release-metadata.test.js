'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const readme = fs.readFileSync('README.md', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('release metadata consistently identifies the current AREX V9.8.0 build', () => {
  assert.match(html, /<title>AREX V9\.8\.0<\/title>/);
  assert.equal(manifest.name.split(' — ')[0], 'AREX V9.8.0');
  assert.equal(manifest.short_name, 'AREX');
  assert.match(readme, /^# AREX V9\.8\.0/m);
  assert.match(readme, /version-9\.8\.0-/);
});

test('Google Drive OAuth config and adapter bridges are present in the current page', () => {
  assert.match(html, /const GOOGLE_CLIENT_ID\s*=\s*"[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com"/);
  assert.match(html, /window\.AREX_GOOGLE_CLIENT_ID\s*=\s*getArexGoogleClientId\(\)/);
  assert.match(html, /window\.arexDriveIsEnabled\s*=\s*driveEnabled/);
  assert.match(html, /window\.arexDriveStartOAuth\s*=/);
  assert.match(html, /<script type="module" src="auth-client\.js\?v=9\.8\.0"><\/script>/);
  assert.match(sw, /'\.\/auth-client\.js'/);
  assert.match(sw, /const CACHE_VERSION = 'v9-8-0-brain-mobile-2026-10-29'/);
});
