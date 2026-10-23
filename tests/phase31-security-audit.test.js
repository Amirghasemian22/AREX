'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Firestore access is authenticated and scoped to the matching user UID', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /rules_version\s*=\s*'2'/);
  assert.match(rules, /match\s*\/users\/\{userId\}\/\{document=\*\*\}/);
  assert.match(rules, /request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/);
});

test('production configuration does not enable local preview and exposes no private-key formats', () => {
  const config = read('auth-config.js');
  assert.match(config, /AREX_ALLOW_LOCAL_PREVIEW\s*=\s*false/);
  const browserFiles = ['index.html','auth-client.js','auth-config.js','arex-edge-worker.js','arex-ai-worker.js','calendar-worker.js'];
  const bundle = browserFiles.map(read).join('\n');
  assert.doesNotMatch(bundle, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(bundle, /sk_live_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(bundle, /-----BEGIN PGP PRIVATE KEY BLOCK-----/i);
  // Firebase web config/API key is a public client identifier, not a server credential.
});

test('Google sign-in uses Firebase Auth and user data path is constructed from authenticated UID', () => {
  const auth = read('auth-client.js');
  assert.match(auth, /signInWithPopup\(auth\s*,\s*new GoogleAuthProvider\(\)\)/);
  assert.match(auth, /onAuthStateChanged/);
  assert.match(auth, /doc\(db\s*,\s*['"]users['"]\s*,\s*user\.uid/);
});

test('notification endpoint uses an exact origin allowlist and verifies Firebase token and owner', () => {
  const worker = read('arex-edge-worker.js');
  assert.match(worker, /DEFAULT_NOTIFY_ORIGINS\s*=\s*\['https:\/\/amirghasemian22\.github\.io'\]/);
  assert.match(worker, /function notifyOriginAllowed\(request, env\)/);
  assert.match(worker, /verifyFirebaseIdToken/);
  assert.match(worker, /claims\.sub\s*!==\s*env\.ALERT_ALLOWED_UID/);
  assert.match(worker, /origin_not_allowed/);
});

test('service worker shell includes security-sensitive account and recovery modules', () => {
  const sw = read('sw.js');
  for (const file of ['./auth-config.js','./auth-client.js','./js/core/account-storage-policy.js','./js/core/cloud-sync.js','./js/core/backup-safety.js','./js/core/repair-recovery.js','./js/core/runtime-verification.js']) {
    assert.ok(sw.includes(`'${file}'`), `missing ${file} from app shell`);
  }
  assert.match(sw, /security-release-audit-23/);
});

test('external executable script references use HTTPS and no eval is present in auth client', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  for (const ref of refs.filter(x => /^https?:\/\//i.test(x))) assert.ok(ref.startsWith('https://'), `non-HTTPS script: ${ref}`);
  assert.doesNotMatch(read('auth-client.js'), /\beval\s*\(|new\s+Function\s*\(/);
});
