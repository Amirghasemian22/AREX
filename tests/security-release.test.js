'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('login and backup no longer call Firebase and use Google Drive appDataFolder', () => {
  const html=read('index.html'), client=read('auth-client.js');
  assert.match(html,/google\.accounts\.oauth2\.initTokenClient/);
  assert.match(html,/parents:\s*\['appDataFolder'\]/);
  assert.match(client,/arexDriveLoginComplete/);
  assert.match(client,/arexDriveSaveBackup/);
  assert.doesNotMatch(client+html,/firebase-auth|firebase-firestore|identitytoolkit\.googleapis\.com/);
});

test('browser bundle does not contain obvious server-side credential material', () => {
  const files = ['index.html','auth-client.js','arex-edge-worker.js','arex-ai-worker.js','calendar-worker.js'];
  const bundle = files.map(read).join('\n');
  assert.doesNotMatch(bundle, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(bundle, /sk_live_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(bundle, /re_[A-Za-z0-9_\-]{20,}/);
  assert.doesNotMatch(bundle, /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/);
});

test('notification Worker restricts browser Origin and validates Google account email', () => {
  const worker=read('arex-edge-worker.js');
  assert.match(worker,/function notifyOriginAllowed\(request, env\)/);
  assert.match(worker,/DEFAULT_NOTIFY_ORIGINS/);
  assert.match(worker,/origin_not_allowed/);
  assert.match(worker,/claims\.email!==allowedEmail/);
  assert.match(worker,/verifyGoogleAccessToken/);
});

test('backtest cards escape user-controlled text before HTML insertion', () => {
  const html=read('index.html');
  const start=html.indexOf("const box = document.getElementById('btList')");
  assert.notEqual(start,-1);
  const section=html.slice(start,start+2200);
  for(const field of ['t.date','t.setup','t.symbol','t.note','t.r','t.id']) assert.match(section,new RegExp('escapeHtml\\('+field.replace('.','\\.')+'\\)'));
});

test('release checklist distinguishes static checks from live-service verification', () => {
  const report=read('DEPLOY_AND_TEST_FA.md');
  assert.match(report,/Google OAuth/);
  assert.match(report,/آزمون/);
});
