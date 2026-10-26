'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const client = fs.readFileSync('auth-client.js', 'utf8');

test('temporary local test entry is opt-in and restricted to local hosts', () => {
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('arex-test'\)==='1'/);
  assert.match(html, /location\.protocol==='file:'\|\|\['localhost','127\.0\.0\.1','::1'\]\.includes/);
  assert.match(html, /window\.AREX_LOCAL_TEST_ENTRY_ENABLED=Boolean\(localHost&&localTestRequested\)/);
  assert.match(html, /id="localPreviewBtn"[^>]*style="display:none"/);
  assert.match(client, /if\(byId\('localPreviewBtn'\)&&!window\.AREX_LOCAL_TEST_ENTRY_ENABLED\) byId\('localPreviewBtn'\)\.style\.display='none'/);
});

test('local preview is visibly labeled and isolated from normal user account storage', () => {
  assert.match(html, /id="arexLocalTestBanner"/);
  assert.match(html, /sessionStorage\.setItem\('arex-local-test-mode','1'\)/);
  assert.match(html, /localStorage\.setItem\('arex-auth-uid','local-test'\)/);
  assert.match(html, /window\.AREX_LOCAL_TEST_MODE=true/);
  assert.match(client, /if\(window\.AREX_LOCAL_TEST_MODE\) throw new Error/);
});
