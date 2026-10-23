#!/usr/bin/env node
'use strict';
// Reproducible static release gate. This does not replace browser or live-service tests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const results = [];
const check = (name, fn) => {
  try { const detail = fn(); results.push({name, ok: true, detail: detail || 'OK'}); }
  catch (error) { results.push({name, ok: false, detail: error.message}); }
};
const fail = (message) => { throw new Error(message); };

check('Manifest JSON and required PWA fields', () => {
  const manifest = JSON.parse(read('manifest.json'));
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) if (!manifest[key]) fail(`missing ${key}`);
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) fail('icons must be a non-empty array');
  for (const icon of manifest.icons) if (!fs.existsSync(path.join(root, icon.src))) fail(`missing icon ${icon.src}`);
  return `valid; ${manifest.icons.length} icons`;
});

check('Service Worker app-shell assets exist', () => {
  const sw = read('sw.js');
  const match = sw.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (!match) fail('APP_SHELL array not found');
  const assets = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  const missing = assets.filter(asset => !fs.existsSync(path.join(root, asset.replace(/^\.\//, ''))));
  if (missing.length) fail(`missing cached assets: ${missing.join(', ')}`);
  if (!/const CACHE_VERSION\s*=\s*['"][^'"]+['"]/.test(sw)) fail('cache version missing');
  return `${assets.length} cached assets present`;
});

check('HTML IDs are unique', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\bid\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (duplicates.length) fail(`duplicate IDs: ${duplicates.join(', ')}`);
  return `${ids.length} IDs; no duplicates`;
});

check('Local script and stylesheet references exist', () => {
  const html = read('index.html');
  const refs = [];
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    const href = tag.match(/\bhref\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    const ref = src || (href && /stylesheet|manifest|icon/i.test(tag) ? href : null);
    if (!ref || /^(?:https?:|\/\/|data:|javascript:|#|obsidian:)/i.test(ref)) continue;
    refs.push(ref.split(/[?#]/)[0]);
  }
  const missing = [...new Set(refs)].filter(ref => !fs.existsSync(path.join(root, ref.replace(/^\.\//, ''))));
  if (missing.length) fail(`missing local refs: ${missing.join(', ')}`);
  return `${new Set(refs).size} unique local refs present`;
});

check('Firestore rules fail closed for unauthenticated and non-owner access', () => {
  const rules = read('firestore.rules');
  if (!/match\s*\/users\/\{userId\}\/\{document=\*\*\}/.test(rules)) fail('expected per-user document path not found');
  if (!/request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/.test(rules)) fail('owner UID guard not found');
  if (/allow\s+(?:read|write|read,\s*write)\s*:\s*if\s+true\s*;/.test(rules)) fail('unconditional allow found');
  return 'static owner guard present; live rules evaluation still required';
});

check('Browser code has no obvious private key or service-account payload', () => {
  const files = ['index.html', 'auth-client.js', 'auth-config.js', 'fx_widget.js'];
  const patterns = [/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/, /"type"\s*:\s*"service_account"/, /private_key_id\s*:/i];
  for (const file of files) for (const pattern of patterns) if (pattern.test(read(file))) fail(`credential pattern ${pattern} found in ${file}`);
  return 'no obvious private-key/service-account markers';
});

const failed = results.filter(r => !r.ok);
for (const result of results) process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name} | ${result.detail}\n`);
process.stdout.write(`\nRelease gate: ${results.length - failed.length}/${results.length} checks passed\n`);
if (failed.length) process.exitCode = 1;
