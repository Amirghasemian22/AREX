'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function loadWorker(fetchImpl = async () => { throw new Error('unexpected upstream request'); }) {
  const source = fs.readFileSync('arex-edge-worker.js', 'utf8').replace('export default {', 'module.exports = {');
  const sandbox = {
    module: { exports: {} }, exports: {}, URL, Request, Response, Headers,
    AbortController, TextEncoder, crypto: webcrypto, fetch: fetchImpl,
    caches: { default: { match: async () => null, put: async () => {} } },
    setTimeout, clearTimeout, Date, Map, String, Number, Object, Array, JSON, Math,
  };
  vm.runInNewContext(source, sandbox, { filename: 'arex-edge-worker.js' });
  return sandbox.module.exports;
}
const ctx = { waitUntil() {} };
const req = (url, init = {}) => new Request('https://worker.example' + url, init);

test('Edge Worker health reports configured state without claiming live connections', async () => {
  const worker = loadWorker();
  const response = await worker.fetch(req('/health'), {}, ctx);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.marketSource, 'not configured');
  assert.equal(data.telegramConfigured, false);
  assert.equal(data.emailConfigured, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('Edge Worker rejects unknown routes and unsupported methods', async () => {
  const worker = loadWorker();
  assert.equal((await worker.fetch(req('/not-a-route'), {}, ctx)).status, 404);
  assert.equal((await worker.fetch(req('/notify', { method: 'GET' }), {}, ctx)).status, 404);
});

test('notification route blocks unapproved browser origins before token verification', async () => {
  let upstreamCalls = 0;
  const worker = loadWorker(async () => { upstreamCalls++; throw new Error('must not be called'); });
  const response = await worker.fetch(req('/notify', {
    method: 'POST', headers: { Origin: 'https://evil.example', Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: 'test-1', body: 'test' }),
  }), { ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com' }, ctx);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'origin_not_allowed');
  assert.equal(upstreamCalls, 0);
});

test('notification route rejects missing bearer token without upstream calls', async () => {
  let upstreamCalls = 0;
  const worker = loadWorker(async () => { upstreamCalls++; throw new Error('must not be called'); });
  const response = await worker.fetch(req('/notify', {
    method: 'POST', headers: { Origin: 'https://amirghasemian22.github.io', 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: 'test-2', body: 'test' }),
  }), { ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com' }, ctx);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'unauthorized');
  assert.equal(upstreamCalls, 0);
});

test('invalid Google token response is generic and does not expose verifier internals', async () => {
  const worker = loadWorker(async () => new Response('invalid', { status: 401 }));
  const response = await worker.fetch(req('/notify', {
    method: 'POST', headers: { Origin: 'https://amirghasemian22.github.io', Authorization: 'Bearer invalid-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: 'test-3', body: 'test' }),
  }), { ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com', GOOGLE_CLIENT_ID: 'arex-client' }, ctx);
  const data = await response.json();
  assert.equal(response.status, 401);
  assert.equal(data.error, 'unauthorized');
  assert.match(data.message, /missing, expired, or invalid/i);
  assert.equal(Object.hasOwn(data, 'detail'), false);
});

test('market route rejects non-numeric and non-positive provider prices instead of returning fake numeric values', async () => {
  for (const value of ['not-a-price', '0', '-12']) {
    const worker = loadWorker(async () => new Response(JSON.stringify({ price: value }), { status: 200 }));
    const response = await worker.fetch(req('/market?symbols=EUR/USD'), { TWELVEDATA_API_KEY: 'test-key' }, ctx);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.quotes[0].price, null);
    assert.ok(data.quotes[0].error);
  }
});

test('market route returns only finite positive prices from the provider', async () => {
  const worker = loadWorker(async () => new Response(JSON.stringify({ price: '1.08321' }), { status: 200 }));
  const response = await worker.fetch(req('/market?symbols=EUR/USD'), { TWELVEDATA_API_KEY: 'test-key' }, ctx);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.quotes[0].price, 1.08321);
  assert.equal(data.quotes[0].error, undefined);
});

test('Google token for another OAuth client is rejected and a missing client id fails closed', async () => {
  const other = loadWorker(async () => new Response(JSON.stringify({ aud: 'someone-elses-app', sub: '1', email: 'owner@example.com', email_verified: 'true' }), { status: 200 }));
  const mk = () => req('/notify', { method: 'POST', headers: { Origin: 'https://amirghasemian22.github.io', Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: 'aud-1', body: 'x' }) });
  assert.equal((await other.fetch(mk(), { ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com', GOOGLE_CLIENT_ID: 'arex-client' }, ctx)).status, 401);
  assert.equal((await other.fetch(mk(), { ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com' }, ctx)).status, 503);
});

function kv() { const m = new Map(); return { m, put: async (k, v) => { m.set(k, v); }, get: async (k, t) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), delete: async k => { m.delete(k); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }) }; }
const deal = (o = {}) => Object.assign({ ticket: '1001', login: '555', symbol: 'EURUSD', dir: 'buy', lots: 0.5, entry: 1.1, exit: 1.105, sl: 1.095, tp: 1.11, openedAt: '2026-10-27T08:15:01', closedAt: '2026-10-27T11:40:30', commission: -3.5, swap: 0, gross: 250 }, o);

test('EA ingest: needs the shared secret, validates deals, and the owner (Google token) pulls then acknowledges', async () => {
  const store = kv(), env = { AREX_INGEST_KEY: 'secret-key-123', AREX_INGEST: store, GOOGLE_CLIENT_ID: 'arex-client', ALERT_ALLOWED_GOOGLE_EMAIL: 'owner@example.com' };
  const worker = loadWorker(async url => new Response(JSON.stringify({ aud: 'arex-client', sub: 'u1', email: String(url).includes('bad') ? 'x@example.com' : 'owner@example.com', email_verified: 'true' }), { status: 200 }));
  const post = (key, body) => req('/ingest', { method: 'POST', headers: { 'X-AREX-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await worker.fetch(post('wrong', [deal()]), env, ctx)).status, 401);
  assert.equal((await worker.fetch(post('secret-key-123', [deal()]), { AREX_INGEST_KEY: 'secret-key-123' }, ctx)).status, 503);
  const ok = await worker.fetch(post('secret-key-123', [deal(), deal({ ticket: 'x y' }), deal({ dir: 'balance', ticket: '2' }), deal({ ticket: '1002', symbol: 'xau<usd>' })]), env, ctx);
  assert.equal((await ok.json()).accepted, 2);                                       // bad ticket + non-trade type are dropped
  assert.equal(store.m.size, 2);
  assert.equal((await worker.fetch(req('/ingest/pending'), env, ctx)).status, 401);   // no Google token
  const pend = await worker.fetch(req('/ingest/pending', { headers: { Authorization: 'Bearer t' } }), env, ctx), data = await pend.json();
  assert.equal(data.deals.length, 2); assert.equal(data.deals.find(d => d.ticket === '1002').symbol, 'XAUUSD');
  const ack = await worker.fetch(req('/ingest/pending', { method: 'POST', headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' }, body: JSON.stringify({ ack: data.deals.map(d => d._key) }) }), env, ctx);
  assert.equal((await ack.json()).deleted, 2); assert.equal(store.m.size, 0);
  const stranger = loadWorker(async () => new Response(JSON.stringify({ aud: 'arex-client', sub: 'u2', email: 'someone@else.com', email_verified: 'true' }), { status: 200 }));
  assert.equal((await stranger.fetch(req('/ingest/pending', { headers: { Authorization: 'Bearer t' } }), env, ctx)).status, 403);
});

test('private KB: answers only (no files), needs a Google token, is rate limited, honours allow-list, and the embedded engine is in sync', { skip: !require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'private-kb', 'Forex_Strategy_Knowledge_Base.md')) && 'private-kb/ not present' }, async () => {
  const kbEngine = require('../js/core/kb.js'), mdText = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'private-kb', 'Forex_Strategy_Knowledge_Base.md'), 'utf8');
  const pack = kbEngine.parse(mdText); pack.decisions = { K1: { text: 'تصمیم مالک' } };
  const store = kv(); store.m.set('pack', JSON.stringify(pack));
  const env = { AREX_KB: store, GOOGLE_CLIENT_ID: 'arex-client' };
  const worker = loadWorker(async url => new Response(JSON.stringify({ aud: 'arex-client', sub: String(url).includes('other') ? 'u2' : 'u1', email: 'user@example.com', email_verified: 'true' }), { status: 200 }));
  const ask = (q, headers = { Authorization: 'Bearer t' }) => req('/kb', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify({ q }) });
  assert.equal((await worker.fetch(ask('ریسک هر معامله', {}), env, ctx)).status, 401);
  assert.equal((await worker.fetch(ask('ریسک هر معامله'), { GOOGLE_CLIENT_ID: 'arex-client' }, ctx)).status, 503);
  const res = await worker.fetch(ask('ریسک هر معامله چقدر باشه'), env, ctx), data = await res.json();
  assert.equal(res.status, 200); assert.ok(data.confidence >= 0.5 && /۱٪/.test(data.text));
  assert.ok(data.context.length <= 5 && data.context.every(c => c.text.length <= 600)); assert.equal(JSON.stringify(data).includes('"chunks"'), false);   // never the pack itself
  const d = await (await worker.fetch(ask('فیلتر خبر داوجونز چیه'), env, ctx)).json(); assert.match(d.text, /تصمیم تو: تصمیم مالک/);
  const empty = await (await worker.fetch(ask('قیمت بیت کوین فردا'), env, ctx)).json(); assert.equal(empty.confidence, 0);
  assert.equal((await worker.fetch(ask('   '), env, ctx)).status, 400);
  assert.equal((await worker.fetch(ask('ریسک', { Authorization: 'Bearer t' }), { ...env, KB_ALLOWED_EMAILS: 'owner@example.com' }, ctx)).status, 403);
  let last; for (let i = 0; i < 31; i++) last = await worker.fetch(ask('اسپرد چیه', { Authorization: 'Bearer other' }), env, ctx); assert.equal(last.status, 429);
  const wsrc = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'arex-edge-worker.js'), 'utf8'); assert.ok(wsrc.includes(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/core/kb.js'), 'utf8')), 'run node scripts/build-workers.js');
});
test('the public site ships no knowledge data and no knowledge page', () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.equal(/kb-pack|Forex_Strategy|js\/core\/kb\.js/.test(html + sw), false); assert.equal(fs.existsSync(path.join(root, 'data')), false);
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /private-kb\//);
});
