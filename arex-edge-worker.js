/**
 * AREX Edge Worker: economic calendar proxy, live quotes, Telegram/email alerts.
 * Deploy on Cloudflare Workers. Configure secrets as described in EDGE_WORKER_SETUP_FA.md.
 * Set GOOGLE_CLIENT_ID (Var) to the AREX OAuth client so tokens are audience-checked. Secrets are server-side only: TWELVEDATA_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 * RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, ALERT_ALLOWED_GOOGLE_EMAIL. Set ALERT_ALLOWED_GOOGLE_EMAIL to the owner Google email and optionally AREX_ALLOWED_ORIGINS as comma-separated exact origins.
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

async function verifyGoogleAccessToken(token, env){
  if(!token || token.length>8192) throw new Error('missing_or_invalid_google_access_token');
  const clientId=String((env&&env.GOOGLE_CLIENT_ID)||'').trim();
  if(!clientId) throw new Error('google_client_id_not_configured');
  const response=await fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(token),{cf:{cacheTtl:0}});
  if(!response.ok) throw new Error('google_access_token_invalid');
  const profile=await response.json();
  if(profile.aud!==clientId && profile.azp!==clientId) throw new Error('google_token_wrong_audience');
  if(!profile.sub || !profile.email || String(profile.email_verified)!=='true') throw new Error('google_identity_unverified');
  return {sub:String(profile.sub),email:String(profile.email).toLowerCase(),email_verified:true};
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
const MARKET_SYMBOLS={ 'EUR/USD':'EUR/USD','GBP/USD':'GBP/USD','USD/JPY':'USD/JPY','USD/CHF':'USD/CHF','USD/CAD':'USD/CAD','AUD/USD':'AUD/USD','NZD/USD':'NZD/USD','EUR/JPY':'EUR/JPY','GBP/JPY':'GBP/JPY','EUR/GBP':'EUR/GBP','XAU/USD':'XAU/USD','XAG/USD':'XAG/USD','DJI':'DJI','SPX':'SPX','NDX':'NDX' };

/* ---- MT4/MT5 auto-import: the EA POSTs closed positions with a shared secret; the app pulls them with the owner's Google token ---- */
function safeEq(a,b){ a=String(a||''); b=String(b||''); if(a.length!==b.length) return false; let d=0; for(let i=0;i<a.length;i++) d|=a.charCodeAt(i)^b.charCodeAt(i); return d===0; }
const INGEST_PREFIX='ing:';
function cleanDeal(d){
  if(!d||typeof d!=='object') return null;
  const ticket=String(d.ticket||'').trim(); if(!/^[0-9A-Za-z._-]{1,40}$/.test(ticket)) return null;
  const dir=String(d.dir||d.type||'').toLowerCase(); if(dir!=='buy'&&dir!=='sell') return null;
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;}, t=v=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(String(v||''))?String(v):'';
  return {ticket,symbol:String(d.symbol||'').toUpperCase().replace(/[^A-Z0-9._#-]/g,'').slice(0,20),dir,lots:n(d.lots),entry:n(d.entry),exit:n(d.exit),sl:n(d.sl),tp:n(d.tp),openedAt:t(d.openedAt),closedAt:t(d.closedAt),commission:n(d.commission)||0,swap:n(d.swap)||0,gross:n(d.gross),login:String(d.login||'').replace(/[^0-9A-Za-z]/g,'').slice(0,20)};
}
async function handleIngest(request, env){
  if(!env.AREX_INGEST_KEY||!env.AREX_INGEST) return json({error:'ingest_not_configured',message:'Set the AREX_INGEST_KEY secret and bind a KV namespace named AREX_INGEST.'},503,{'Cache-Control':'no-store'});
  if(!safeEq(request.headers.get('X-AREX-Key'),env.AREX_INGEST_KEY)) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  if(Number(request.headers.get('Content-Length')||0)>200000) return json({error:'payload_too_large'},413,{'Cache-Control':'no-store'});
  let body; try{body=await request.json();}catch{return json({error:'invalid_json'},400,{'Cache-Control':'no-store'});}
  const list=(Array.isArray(body)?body:body&&Array.isArray(body.deals)?body.deals:[body]).slice(0,100).map(cleanDeal).filter(Boolean);
  await Promise.all(list.map(d=>env.AREX_INGEST.put(INGEST_PREFIX+(d.login||'0')+':'+d.ticket,JSON.stringify(d),{expirationTtl:60*60*24*30})));
  return json({ok:true,accepted:list.length},200,{'Cache-Control':'no-store'});
}
async function handlePending(request, env, claims){
  if(!env.AREX_INGEST) return json({error:'ingest_not_configured'},503,{'Cache-Control':'no-store'});
  const listed=await env.AREX_INGEST.list({prefix:INGEST_PREFIX,limit:200});
  const deals=(await Promise.all(listed.keys.map(async k=>{const v=await env.AREX_INGEST.get(k.name,'json'); return v?Object.assign({_key:k.name},v):null;}))).filter(Boolean);
  if(request.method==='POST'){ let b; try{b=await request.json();}catch{b={};} const ack=(Array.isArray(b.ack)?b.ack:[]).filter(k=>typeof k==='string'&&k.startsWith(INGEST_PREFIX)).slice(0,200); await Promise.all(ack.map(k=>env.AREX_INGEST.delete(k))); return json({ok:true,deleted:ack.length},200,{'Cache-Control':'no-store'}); }
  return json({deals},200,{'Cache-Control':'no-store'});
}
async function fetchQuotes(request, env){
  if(!env.TWELVEDATA_API_KEY) return json({error:'market_provider_not_configured',message:'Set TWELVEDATA_API_KEY as a Worker secret.'},503,{'Cache-Control':'no-store'});
  const url=new URL(request.url), requested=(url.searchParams.get('symbols')||'EUR/USD,XAU/USD,DJI').split(',').map(s=>s.trim()).filter(Boolean).slice(0,8);
  const symbols=requested.filter(s=>MARKET_SYMBOLS[s]); if(!symbols.length)return json({error:'no_supported_symbols'},400,{'Cache-Control':'no-store'});
  const quotes=await Promise.all(symbols.map(async symbol=>{
    try{
      const endpoint=new URL('https://api.twelvedata.com/price'); endpoint.searchParams.set('symbol',MARKET_SYMBOLS[symbol]); endpoint.searchParams.set('apikey',env.TWELVEDATA_API_KEY);
      const r=await fetch(endpoint,{headers:{Accept:'application/json'},cf:{cacheTtl:30}}); const data=await r.json();
      const price=Number(data?.price);
      if(!r.ok||data.status==='error'||data.code||data.price==null||!Number.isFinite(price)||price<=0) return {symbol,price:null,error:String(data.message||data.code||(!Number.isFinite(price)||price<=0?'invalid_price':`HTTP ${r.status}`)),source:'Twelve Data'};
      return {symbol,price,source:'Twelve Data'};
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
  // Non-browser callers are still protected by Google token verification and account allowlisting.
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
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  let claims; try{claims=await verifyGoogleAccessToken(authorization.slice(7),env);}catch(e){if(String(e&&e.message)==='google_client_id_not_configured')return json({error:'auth_not_configured',message:'Set GOOGLE_CLIENT_ID as a Worker variable.'},503,{'Cache-Control':'no-store'});return json({error:'unauthorized',message:'Google access token is missing, expired, or invalid.'},401,{'Cache-Control':'no-store'});}
  const allowedEmail=String(env.ALERT_ALLOWED_GOOGLE_EMAIL||'').trim().toLowerCase();
  if(!allowedEmail) return json({error:'alerts_not_enabled',message:'Set ALERT_ALLOWED_GOOGLE_EMAIL to the owner Google email before enabling external alerts.'},503,{'Cache-Control':'no-store'});
  if(claims.email!==allowedEmail) return json({error:'forbidden'},403,{'Cache-Control':'no-store'});
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
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'AREX Edge Worker',routes:['/calendar','/market','/notify','/ingest','/ingest/pending'],notificationDedupe:env.NOTIFY_DEDUPE?'kv':'isolate_best_effort',calendarSource:'Forex Factory weekly export',marketSource:env.TWELVEDATA_API_KEY?'Twelve Data configured':'not configured',telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),emailConfigured:!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM)},200,{'Cache-Control':'no-store'});
    if((url.pathname==='/'||url.pathname==='/calendar')&&request.method==='GET'){try{return await fetchCalendar(ctx);}catch(e){return json({error:'calendar_unavailable',message:String(e?.message||e)},502,{'Cache-Control':'no-store'});}}
    if(url.pathname==='/market'&&request.method==='GET'){
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      if(!await allowRate(env,`market:${ip}`,60,60)) return json({error:'rate_limited',message:'Rate limit exceeded; retry later.'},429,{'Retry-After':'60','Cache-Control':'no-store'});
      return fetchQuotes(request,env);
    }
    if(url.pathname==='/notify'&&request.method==='POST')return sendAlerts(request,env);
    if(url.pathname==='/ingest'&&request.method==='POST')return handleIngest(request,env);
    if(url.pathname==='/ingest/pending'&&(request.method==='GET'||request.method==='POST')){
      const authorization=request.headers.get('Authorization')||'';
      if(!authorization.startsWith('Bearer ')) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
      let claims; try{claims=await verifyGoogleAccessToken(authorization.slice(7),env);}catch(e){return json({error:String(e&&e.message)==='google_client_id_not_configured'?'auth_not_configured':'unauthorized'},String(e&&e.message)==='google_client_id_not_configured'?503:401,{'Cache-Control':'no-store'});}
      const owner=String(env.ALERT_ALLOWED_GOOGLE_EMAIL||'').trim().toLowerCase();
      if(!owner||claims.email!==owner) return json({error:'forbidden'},403,{'Cache-Control':'no-store'});
      return handlePending(request,env,claims);
    }
    return json({error:'not_found'},404,{'Cache-Control':'no-store'});
  }
};
