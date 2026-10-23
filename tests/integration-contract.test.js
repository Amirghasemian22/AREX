'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('all local script and stylesheet references in index.html resolve', () => {
  const html = read('index.html');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
    .map(m => m[1].split(/[?#]/)[0])
    .filter(v => v && !/^(?:https?:|data:|mailto:|#|javascript:|obsidian:)/i.test(v) && !v.startsWith('/'));
  const missing = refs.filter(ref => !fs.existsSync(path.join(root, ref)));
  assert.deepEqual(missing, [], `Missing local assets: ${missing.join(', ')}`);
});

test('every local JavaScript asset referenced by the page is included in the offline shell', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const refs = [...html.matchAll(/<script\b[^>]*?src=["']([^"']+\.js)(?:\?[^"']*)?["'][^>]*>/gi)]
    .map(m => m[1]).filter(v => !/^(?:https?:|\/\/)/i.test(v));
  const missing = refs.filter(ref => !sw.includes(`'./${ref}'`) && !sw.includes(`"./${ref}"`));
  assert.deepEqual(missing, [], `JavaScript files not precached: ${missing.join(', ')}`);
});

test('page IDs are unique', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]);
  const seen = new Set(), duplicates = new Set();
  for (const id of ids) { if (seen.has(id)) duplicates.add(id); seen.add(id); }
  assert.deepEqual([...duplicates], [], `Duplicate IDs: ${[...duplicates].join(', ')}`);
});

test('external notification client and Worker agree on stable event IDs and route contract', () => {
  const client = read('auth-client.js');
  const worker = read('arex-edge-worker.js');
  assert.match(client, /base\s*\+\s*'\/notify'/);
  assert.match(client, /eventId/);
  assert.match(client, /AbortController/);
  assert.match(worker, /url\.pathname==='\/notify'\s*&&\s*request\.method==='POST'/);
  assert.match(worker, /event_id_required/);
  assert.match(worker, /duplicate:true/);
  assert.match(worker, /NOTIFY_DEDUPE/);
  assert.match(worker, /upstream_timeout/);
});

test('new analysis engines are wired into the page and offline cache', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  for (const asset of ['js/core/alert-engine.js', 'js/core/extended.js', 'js/core/ohlc-backtest.js']) {
    assert.ok(html.includes(`src="${asset}"`), `${asset} must be loaded by index.html`);
    assert.ok(sw.includes(`'./${asset}'`), `${asset} must be in the service worker shell`);
    assert.ok(fs.existsSync(path.join(root, asset)), `${asset} must exist`);
  }
});

test('Firebase client contains no embedded service-provider secret literals', () => {
  const client = read('auth-client.js');
  assert.doesNotMatch(client, /TELEGRAM_BOT_TOKEN\s*[:=]\s*["'][0-9]+:[A-Za-z0-9_-]+["']/);
  assert.doesNotMatch(client, /RESEND_API_KEY\s*[:=]\s*["']re_[A-Za-z0-9]+["']/);
  assert.match(client, /getIdToken\(\)/);
});

test('cloud backup waits for a stable local snapshot and publishes only completed snapshots', () => {
  const client = read('auth-client.js');
  const html = read('index.html');
  const sw = read('sw.js');
  assert.ok(fs.existsSync(path.join(root, 'js/core/cloud-sync.js')));
  assert.ok(html.includes('src="js/core/cloud-sync.js"'));
  assert.ok(sw.includes("'./js/core/cloud-sync.js'"));
  assert.match(client, /readStableSnapshot/);
  assert.match(client, /complete:false/);
  assert.match(client, /complete:true/);
  assert.match(client, /currentSnapshotId:snapshotId/);
  assert.match(client, /snapshotMeta\.complete===false/);
});
