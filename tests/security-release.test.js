'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Firestore rules require authentication and enforce owner UID for all user documents', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /match\s*\/users\/\{userId\}\/\{document=\*\*\}/);
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/);
});

test('browser bundle does not contain obvious server-side credential material', () => {
  const files = ['index.html','auth-client.js','auth-config.js','arex-edge-worker.js','arex-ai-worker.js','calendar-worker.js'];
  const bundle = files.map(read).join('\n');
  assert.doesNotMatch(bundle, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i);
  assert.doesNotMatch(bundle, /sk_live_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(bundle, /re_[A-Za-z0-9_\-]{20,}/);
  assert.doesNotMatch(bundle, /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/);
});

test('notification Worker restricts browser Origin and still checks authenticated owner', () => {
  const worker = read('arex-edge-worker.js');
  assert.match(worker, /function notifyOriginAllowed\(request, env\)/);
  assert.match(worker, /DEFAULT_NOTIFY_ORIGINS/);
  assert.match(worker, /origin_not_allowed/);
  assert.match(worker, /claims\.sub!==env\.ALERT_ALLOWED_UID/);
  assert.match(worker, /verifyFirebaseIdToken/);
});

test('backtest cards escape user-controlled text before HTML insertion', () => {
  const html = read('index.html');
  const start = html.indexOf("const box = document.getElementById('btList')");
  assert.notEqual(start, -1);
  const section = html.slice(start, start + 2200);
  for (const field of ['t.date','t.setup','t.symbol','t.note','t.r','t.id']) {
    assert.match(section, new RegExp('escapeHtml\\(' + field.replace('.', '\\.') + '\\)'));
  }
});

test('release checklist explicitly distinguishes static checks from live security verification', () => {
  const report = read('PHASE18_SECURITY_RELEASE_REPORT_FA.md');
  assert.match(report, /Firebase زنده/);
  assert.match(report, /Secrets/);
  assert.match(report, /آزمون زنده/);
});
