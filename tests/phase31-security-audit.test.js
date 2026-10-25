'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Google OAuth tokens are held in runtime memory and revoked on sign-out', () => {
  const html = read('index.html');
  assert.match(html, /google\.accounts\.oauth2\.initTokenClient/);
  assert.match(html, /gAccessToken\s*=\s*resp\.access_token/);
  assert.match(html, /OAuth access tokens are not persisted/);
  assert.match(html, /google\.accounts\.oauth2\.revoke\(gAccessToken/);
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:access[_-]?token|gAccessToken|refresh[_-]?token)/i);
});

test('Drive backup uses the app-private appDataFolder scope', () => {
  const html = read('index.html');
  assert.match(html, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(html, /parents:\s*\['appDataFolder'\]/);
  assert.match(html, /arexDriveSaveBackup/);
  assert.match(html, /arexDriveLoginComplete/);
});

test('browser-facing project files contain no obvious server private-key payloads', () => {
  const files = ['index.html', 'auth-client.js', 'arex-edge-worker.js', 'arex-ai-worker.js', 'calendar-worker.js'];
  const bundle = files.map(read).join('\n');
  assert.doesNotMatch(bundle, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(bundle, /-----BEGIN PGP PRIVATE KEY BLOCK-----/i);
  assert.doesNotMatch(bundle, /"type"\s*:\s*"service_account"/i);
  assert.doesNotMatch(bundle, /private_key_id\s*:/i);
  assert.doesNotMatch(bundle, /sk_live_[A-Za-z0-9]{16,}/);
});

test('account storage is prepared only after resolving authenticated Google identity', () => {
  const auth = read('auth-client.js');
  assert.match(auth, /AREXAccountStoragePolicy/);
  assert.match(auth, /arexGetDriveIdentity/);
  assert.match(auth, /arexPrepareAuthenticatedUser/);
  assert.match(auth, /arexDriveLoginComplete/);
});

test('notification endpoint restricts origin and verifies Google identity and allowed email', () => {
  const worker = read('arex-edge-worker.js');
  assert.match(worker, /DEFAULT_NOTIFY_ORIGINS\s*=\s*\['https:\/\/amirghasemian22\.github\.io'\]/);
  assert.match(worker, /function notifyOriginAllowed\(request, env\)/);
  assert.match(worker, /verifyGoogleAccessToken/);
  assert.match(worker, /claims\.email!==allowedEmail/);
  assert.match(worker, /origin_not_allowed/);
});

test('all external executable script references use HTTPS and auth client avoids dynamic code execution', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  for (const ref of refs.filter(x => /^http:\/\//i.test(x))) assert.fail(`insecure script reference: ${ref}`);
  assert.doesNotMatch(read('auth-client.js'), /\beval\s*\(|new\s+Function\s*\(/);
});

test('service worker cache includes sensitive workflow modules and does not reference removed Firebase config', () => {
  const sw = read('sw.js');
  for (const file of ['./auth-client.js', './js/core/account-storage-policy.js', './js/core/cloud-sync.js', './js/core/backup-safety.js', './js/core/repair-recovery.js', './js/core/runtime-verification.js']) {
    assert.ok(sw.includes(`'${file}'`), `missing ${file}`);
  }
  assert.doesNotMatch(sw, /auth-config\.js|firebase-auth|firebase-firestore/);
  assert.match(sw, /const CACHE_VERSION\s*=\s*'[^']*security-phase31/);
});
