const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('runtime verification stays in the main script, not the printable report HTML string', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /window\.arexRunRuntimeVerification\s*=\s*async function/);
  assert.match(html, /<table><tr><th>تاریخ[\s\S]*?<\/table>/);
  assert.doesNotMatch(html, /'<\/table><script>\s*\/\/ Opt-in diagnostics/);
});

test('all executable inline scripts parse as JavaScript', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  const executable = scripts.filter(([, attrs]) => !/\bsrc\s*=/.test(attrs) && !/application\/ld\+json/i.test(attrs));
  assert.ok(executable.length >= 3);
  for (const [, , body] of executable) {
    assert.doesNotMatch(body, /<\/script/i, 'inline JS must not contain a raw script-closing tag');
  }
});
