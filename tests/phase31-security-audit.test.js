'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('login and backup use Google Drive OAuth without Firebase runtime SDKs', () => {
  const html=read('index.html'), client=read('auth-client.js');
  assert.match(html,/google\.accounts\.oauth2\.initTokenClient/);
  assert.match(html,/https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(html,/parents:\s*\['appDataFolder'\]/);
  assert.doesNotMatch(client+html,/firebase-auth|firebase-firestore|identitytoolkit\.googleapis\.com/);
  assert.doesNotMatch(html,/auth-config\.js/);
});

test('browser bundle contains no private-key or service-provider secrets', () => {
  const browserFiles = ['index.html','auth-client.js','arex-edge-worker.js','arex-ai-worker.js','calendar-worker.js'];
  const bundle = browserFiles.map(read).join('\n');
  assert.doesNotMatch(bundle, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(bundle, /sk_live_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(bundle, /-----BEGIN PGP PRIVATE KEY BLOCK-----/i);
});

test('account-local data is keyed by Google subject and Drive OAuth completion', () => {
  const auth=read('auth-client.js');
  assert.match(auth,/AREXAccountStoragePolicy/);
  assert.match(auth,/arexGetDriveIdentity/);
  assert.match(auth,/arexPrepareAuthenticatedUser/);
  assert.match(auth,/arexDriveLoginComplete/);
});

test('notification Worker validates Google OAuth identity and restricts owner email', () => {
  const worker=read('arex-edge-worker.js');
  assert.match(worker,/DEFAULT_NOTIFY_ORIGINS\s*=\s*\['https:\/\/amirghasemian22\.github\.io'\]/);
  assert.match(worker,/function notifyOriginAllowed\(request, env\)/);
  assert.match(worker,/verifyGoogleAccessToken/);
  assert.match(worker,/claims\.email!==allowedEmail/);
  assert.match(worker,/origin_not_allowed/);
  assert.doesNotMatch(worker,/verifyFirebaseIdToken|ALERT_ALLOWED_UID/);
});

test('service worker shell includes account and recovery modules but not Firebase config', () => {
  const sw=read('sw.js');
  for(const file of ['./auth-client.js','./js/core/account-storage-policy.js','./js/core/cloud-sync.js','./js/core/backup-safety.js','./js/core/repair-recovery.js','./js/core/runtime-verification.js']) assert.ok(sw.includes(`'${file}'`),`missing ${file}`);
  assert.doesNotMatch(sw,/auth-config\.js/);
  assert.match(sw,/drive-only/);
});

test('external executable script references use HTTPS and auth client does not use eval', () => {
  const html=read('index.html');
  const refs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
  for(const ref of refs.filter(x=>/^https?:\/\//i.test(x))) assert.ok(ref.startsWith('https://'),`non-HTTPS script: ${ref}`);
  assert.doesNotMatch(read('auth-client.js'),/\beval\s*\(|new\s+Function\s*\(/);
});
