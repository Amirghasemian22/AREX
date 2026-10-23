/**
 * AREX Edge Worker: economic calendar proxy, live quotes, Telegram/email alerts.
 * Deploy on Cloudflare Workers. Configure secrets as described in EDGE_WORKER_SETUP_FA.md.
 * Secrets are server-side only: TWELVEDATA_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 * RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, ALERT_ALLOWED_UID. Set FIREBASE_PROJECT_ID=arex-a1853 and optionally AREX_ALLOWED_ORIGINS as comma-separated exact origins.
 */
const CALENDAR_UPSTREAM = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CAL_TTL = 900;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': `public, max-age=${CAL_TTL}`
};
const json = (body, status=200, headers={}) => new Response(JSON.stringify(body), {status, headers:{...cors,'Content-Type':'application/json; charset=utf-8',...headers}});
const encoder = new TextEncoder();
// Best-effort per-isolate limiter. For enforceable global limits, attach a Cloudflare
// Rate Limiting binding named AREX_RATE_LIMITER in production.
const rateBuckets = new Map();
async function allowRate(env, key, limit, windowSeconds) {
  try {
    if (env.AREX_RATE_LIMITER && typeof env.AREX_RATE_LIMITER.limit === 'function') {
      const result = await env.AREX_RATE_LIMITER.limit({ key: String(key).slice(0, 180) });
      return !!result.success;
    }
  } catch { return false; }
  const now = Date.now(), windowMs = windowSeconds * 1000;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) bucket = { startedAt: now, count: 0 };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now - v.startedAt >= windowMs) rateBuckets.delete(k);
  }
  return bucket.count <= limit;
}

function b64urlToBytes(s){ const x=s.replace(/-/g,'+').replace(/_/g,'/'); const bin=atob(x+'='.repeat((4-x.length%4)%4)); return Uint8Array.from(bin,c=>c.charCodeAt(0)); }
async function verifyFirebaseIdToken(token, projectId){
  const pieces=String(token||'').split('.'); if(pieces.length!==3) throw new Error('missing_or_invalid_id_token');
  const header=JSON.parse(new TextDecoder().decode(b64urlToBytes(pieces[0])));
  const claims=JSON.parse(new TextDecoder().decode(b64urlToBytes(pieces[1])));
  if(header.alg!=='RS256'||!header.kid) throw new Error('unsupported_token');
  const now=Math.floor(Date.now()/1000);
  if(claims.aud!==projectId||claims.iss!==`https://securetoken.google.com/${projectId}`||!claims.sub||claims.sub.length>128||claims.exp<now||claims.iat>now+60) throw new Error('invalid_token_claims');
  const jwksRes=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',{cf:{cacheTtl:3600}});
  if(!jwksRes.ok) throw new Error('token_verification_unavailable');
  const jwks=await jwksRes.json(), jwk=jwks.keys.find(k=>k.kid===header.kid&&k.alg==='RS256');
  if(!jwk) throw new Error('unknown_signing_key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64urlToBytes(pieces[2]),encoder.encode(`${pieces[0]}.${pieces[1]}`));
  if(!valid) throw new Error('invalid_token_signature');
  return claims;
}
async function fetchCalendar(ctx){
  const cache=caches.default, key=new Request('https://arex-internal-cache.invalid/ff-calendar-v1.json');
  let response=await cache.match(key);
  if(!response){
    const upstream=await fetch(CALENDAR_UPSTREAM,{headers:{Accept:'application/json','User-Agent':'AREX-Economic-Calendar/1.0'},cf:{cacheTtl:CAL_TTL,cacheEverything:true}});
    if(!upstream.ok) throw new Error(`calendar_upstream_http_${upstream.status}`);
    const raw=await upstream.json(); if(!Array.isArray(raw)) throw new Error('calendar_invalid_payload');
    const events=raw.map((e,i)=>({id:String(e.id||e.eventId||`${e.date||''}-${e.title||e.event||i}`),title:String(e.title||e.event||'Economic event'),country:String(e.country||e.currency||''),date:e.date||e.datetime||e.timestamp||null,impact:String(e.impact||e.importance||'Unknown'),forecast:e.forecast||'',previous:e.previous||'',actual:e.actual||''}));
    response=new Response(JSON.stringify({fetchedAt:new Date().toISOString(),source:'Forex Factory weekly calendar export',events}),{headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':`public, max-age=${CAL_TTL}`}});
    ctx.waitUntil(cache.put(key,response.clone()));
  }
  return response;
}
const MARKET_SYMBOLS={ 'EUR/USD':'EUR/USD','GBP/USD':'GBP/USD','USD/JPY':'USD/JPY','XAU/USD':'XAU/USD','DJI':'DJI' };
async function fetchQuotes(request, env){
  if(!env.TWELVEDATA_API_KEY) return json({error:'market_provider_not_configured',message:'Set TWELVEDATA_API_KEY as a Worker secret.'},503,{'Cache-Control':'no-store'});
  const url=new URL(request.url), requested=(url.searchParams.get('symbols')||'EUR/USD,XAU/USD,DJI').split(',').map(s=>s.trim()).filter(Boolean).slice(0,5);
  const symbols=requested.filter(s=>MARKET_SYMBOLS[s]); if(!symbols.length)return json({error:'no_supported_symbols'},400,{'Cache-Control':'no-store'});
  const quotes=await Promise.all(symbols.map(async symbol=>{
    try{
      const endpoint=new URL('https://api.twelvedata.com/price'); endpoint.searchParams.set('symbol',MARKET_SYMBOLS[symbol]); endpoint.searchParams.set('apikey',env.TWELVEDATA_API_KEY);
      const r=await fetch(endpoint,{headers:{Accept:'application/json'},cf:{cacheTtl:30}}); const data=await r.json();
      if(!r.ok||data.status==='error'||data.code||data.price==null) return {symbol,price:null,error:String(data.message||data.code||`HTTP ${r.status}`),source:'Twelve Data'};
      return {symbol,price:Number(data.price),source:'Twelve Data'};
    }catch(e){return {symbol,price:null,error:String(e?.message||e),source:'Twelve Data'};}
  }));
  return json({fetchedAt:new Date().toISOString(),source:'Twelve Data',quotes},200,{'Cache-Control':'no-store'});
}

// Notification delivery is intentionally not retried automatically: a timeout after an
// upstream accepted a message is ambiguous, and retrying could send a duplicate.
const notifyMemory = new Map(); // best-effort fallback only; not shared across isolates
const NOTIFY_DEDUPE_TTL = 60 * 60 * 24 * 7;
const NOTIFY_LOG_TTL = 60 * 60 * 24 * 30;
const DEFAULT_NOTIFY_ORIGINS = ['https://amirghasemian22.github.io'];
function notifyOriginAllowed(request, env) {
  const origin = request.headers.get('Origin');
  // Non-browser callers are still protected by Firebase token verification and UID allowlisting.
  if (!origin) return true;
  let allowed = DEFAULT_NOTIFY_ORIGINS;
  if (env.AREX_ALLOWED_ORIGINS) allowed = String(env.AREX_ALLOWED_ORIGINS).split(',').map(v => v.trim()).filter(Boolean);
  return allowed.includes(origin);
}
function safeEventId(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9._:-]{1,160}$/.test(id) ? id : '';
}
function notifyKey(uid, eventId) {
  // Hash user/event identifiers so KV keys do not expose raw user identifiers.
  return crypto.subtle.digest('SHA-256', encoder.encode(`${uid}:${eventId}`)).then(buf =>
    'notify:v1:' + Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join(''));
}
async function getNotifyRecord(env, key) {
  try { if (env.NOTIFY_DEDUPE && typeof env.NOTIFY_DEDUPE.get === 'function') return await env.NOTIFY_DEDUPE.get(key, 'json'); } catch {}
  const row = notifyMemory.get(key);
  if (!row || row.expiresAt < Date.now()) { notifyMemory.delete(key); return null; }
  return row.value;
}
async function putNotifyRecord(env, key, value, ttl = NOTIFY_DEDUPE_TTL) {
  const record = { ...value, updatedAt: new Date().toISOString() };
  try {
    if (env.NOTIFY_DEDUPE && typeof env.NOTIFY_DEDUPE.put === 'function') {
      await env.NOTIFY_DEDUPE.put(key, JSON.stringify(record), { expirationTtl: ttl });
      return true;
    }
  } catch { /* use isolate-local fallback; response will identify durability */ }
  notifyMemory.set(key, { value: record, expiresAt: Date.now() + ttl * 1000 });
  if (notifyMemory.size > 3000) {
    const now = Date.now(); for (const [k, v] of notifyMemory) if (v.expiresAt < now) notifyMemory.delete(k);
    while (notifyMemory.size > 3000) notifyMemory.delete(notifyMemory.keys().next().value);
  }
  return false;
}
async function sendChannel(url, options, channel) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data = null;
    try { data = await response.json(); } catch {}
    const accepted = response.ok && (channel !== 'telegram' || data?.ok === true) && (channel !== 'email' || !!data?.id);
    return { status: accepted ? 'sent' : 'failed', httpStatus: response.status,
      errorCode: accepted ? null : (response.status >= 500 ? 'upstream_server_error' : 'upstream_rejected') };
  } catch (error) {
    return { status: 'failed', httpStatus: null,
      errorCode: error?.name === 'AbortError' ? 'upstream_timeout' : 'network_error' };
  } finally { clearTimeout(timer); }
}
async function sendAlerts(request, env){
  if (!notifyOriginAllowed(request, env)) return json({error:'origin_not_allowed'},403,{'Cache-Control':'no-store'});
  const projectId=env.FIREBASE_PROJECT_ID||'arex-a1853';
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  let claims; try{claims=await verifyFirebaseIdToken(authorization.slice(7),projectId);}catch(e){return json({error:'unauthorized',detail:String(e?.message||e)},401,{'Cache-Control':'no-store'});}
  if(!env.ALERT_ALLOWED_UID) return json({error:'alerts_not_enabled',message:'Set ALERT_ALLOWED_UID to the owner Firebase UID before enabling external alerts.'},503,{'Cache-Control':'no-store'});
  if(claims.sub!==env.ALERT_ALLOWED_UID) return json({error:'forbidden'},403,{'Cache-Control':'no-store'});
  if(!await allowRate(env,`notify:${claims.sub}`,10,60)) return json({error:'rate_limited',message:'Too many alert requests.'},429,{'Retry-After':'60','Cache-Control':'no-store'});
  const contentLength=Number(request.headers.get('Content-Length')||0);
  if(contentLength>16000) return json({error:'payload_too_large'},413,{'Cache-Control':'no-store'});
  let body; try{body=await request.json();}catch{return json({error:'invalid_json'},400,{'Cache-Control':'no-store'});}
  if(!body || typeof body!=='object' || Array.isArray(body) || JSON.stringify(body).length>16000) return json({error:'invalid_payload'},400,{'Cache-Control':'no-store'});
  const title=String(body.title||'AREX alert').trim().slice(0,120), message=String(body.body||'').trim().slice(0,900);
  const eventId=safeEventId(body.eventId);
  if(!message) return json({error:'message_required'},400,{'Cache-Control':'no-store'});
  if(!eventId) return json({error:'event_id_required',message:'A stable eventId is required for safe duplicate handling.'},400,{'Cache-Control':'no-store'});
  const configured = !!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID) || !!(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM);
  if(!configured) return json({error:'no_delivery_channel_configured'},503,{'Cache-Control':'no-store'});
  const dedupeKey=await notifyKey(claims.sub,eventId);
  const existing=await getNotifyRecord(env,dedupeKey);
  const processingAt=Date.parse(existing?.updatedAt||'');
  const processingFresh=Number.isFinite(processingAt) && Date.now()-processingAt < 2*60*1000;
  if(existing && (existing.status==='sent' || (existing.status==='processing' && processingFresh))) {
    return json({ok:existing.status==='sent',duplicate:true,eventId,status:existing.status,results:existing.results||{},dedupePersistence:env.NOTIFY_DEDUPE?'kv':'isolate_best_effort'},200,{'Cache-Control':'no-store'});
  }
  // A processing record reduces duplicates, but KV is not an atomic lock. Durable Object
  // coordination is required if strict exactly-once semantics are needed across isolates.
  await putNotifyRecord(env,dedupeKey,{status:'processing',eventId,results:{}},NOTIFY_DEDUPE_TTL);
  const text=`${title}\n${message}\n\nAREX · ${new Date().toISOString()} · ${eventId}`;
  const results={};
  if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID){
    results.telegram=await sendChannel(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,disable_web_page_preview:true})},'telegram');
  }
  if(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM){
    results.email=await sendChannel('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.ALERT_EMAIL_FROM,to:[env.ALERT_EMAIL_TO],subject:`AREX · ${title}`,text})},'email');
  }
  const sent=Object.values(results).some(r=>r.status==='sent');
  const failed=Object.values(results).some(r=>r.status==='failed');
  const status=sent?(failed?'partial':'sent'):'failed';
  const persisted=await putNotifyRecord(env,dedupeKey,{status,eventId,results},NOTIFY_LOG_TTL);
  return json({ok:sent,eventId,status,results,dedupePersistence:persisted?'kv':'isolate_best_effort',logged:true},sent?200:502,{'Cache-Control':'no-store'});
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'AREX Edge Worker',routes:['/calendar','/market','/notify'],notificationDedupe:env.NOTIFY_DEDUPE?'kv':'isolate_best_effort',calendarSource:'Forex Factory weekly export',marketSource:env.TWELVEDATA_API_KEY?'Twelve Data configured':'not configured',telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),emailConfigured:!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM)},200,{'Cache-Control':'no-store'});
    if((url.pathname==='/'||url.pathname==='/calendar')&&request.method==='GET'){try{return await fetchCalendar(ctx);}catch(e){return json({error:'calendar_unavailable',message:String(e?.message||e)},502,{'Cache-Control':'no-store'});}}
    if(url.pathname==='/market'&&request.method==='GET'){
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      if(!await allowRate(env,`market:${ip}`,60,60)) return json({error:'rate_limited',message:'Rate limit exceeded; retry later.'},429,{'Retry-After':'60','Cache-Control':'no-store'});
      return fetchQuotes(request,env);
    }
    if(url.pathname==='/notify'&&request.method==='POST')return sendAlerts(request,env);
    return json({error:'not_found'},404,{'Cache-Control':'no-store'});
  }
};
