/**
 * AREX Economic Calendar proxy for Cloudflare Workers.
 * Upstream: Forex Factory public weekly JSON export.
 * Deploy this file as a Worker, then paste its URL into AREX Settings -> Economic Calendar feed.
 */
const UPSTREAM = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CACHE_TTL = 900;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': `public, max-age=${CACHE_TTL}`
};
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (url.pathname !== '/' && url.pathname !== '/calendar' && url.pathname !== '/health') return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true, service: 'AREX Economic Calendar Proxy', upstream: UPSTREAM }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    try {
      const cache = caches.default;
      const cacheKey = new Request('https://arex-internal-cache.invalid/ff-calendar-thisweek.json');
      let response = await cache.match(cacheKey);
      if (!response) {
        const upstream = await fetch(UPSTREAM, { headers: { 'Accept': 'application/json', 'User-Agent': 'AREX-Economic-Calendar/1.0' }, cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
        if (!upstream.ok) throw new Error(`upstream_http_${upstream.status}`);
        const data = await upstream.json();
        if (!Array.isArray(data)) throw new Error('upstream_invalid_json');
        response = new Response(JSON.stringify({ fetchedAt: new Date().toISOString(), events: data }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'calendar_unavailable', message: String(error?.message || error) }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
  }
};
