/**
 * AREX Edge Worker: economic calendar proxy, live quotes, Telegram/email alerts.
 * Deploy on Cloudflare Workers. Configure secrets as described in EDGE_WORKER_SETUP_FA.md.
 * Secrets are server-side only: TWELVEDATA_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 * RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM, ALERT_ALLOWED_UID. Set FIREBASE_PROJECT_ID=arex-a1853 as a variable.
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

async function mt5Ingest(request,env){
  const expected=env.MT5_BRIDGE_SECRET;
  if(!expected||!env.MT5_TRADES)return json({error:'mt5_bridge_not_configured',message:'Configure MT5_BRIDGE_SECRET and bind the MT5_TRADES KV namespace.'},503,{'Cache-Control':'no-store'});
  const auth=request.headers.get('Authorization')||'';
  if(auth!=='Bearer '+expected)return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  let trade;try{trade=await request.json()}catch{return json({error:'invalid_json'},400,{'Cache-Control':'no-store'});}
  const ticket=String(trade.ticket||'');if(!/^\d{1,24}$/.test(ticket)||!trade.symbol||!trade.closeTime)return json({error:'invalid_trade_payload'},400,{'Cache-Control':'no-store'});
  const clean={ticket,symbol:String(trade.symbol).slice(0,32),type:String(trade.type||'').slice(0,8),entry:Number(trade.entry)||0,exit:Number(trade.exit)||0,sl:Number(trade.sl)||0,profit:Number(trade.profit)||0,closeTime:String(trade.closeTime).slice(0,32),comment:String(trade.comment||'').slice(0,120),account:String(trade.account||'').slice(0,64),updatedAt:new Date().toISOString()};
  await env.MT5_TRADES.put('trade:'+ticket,JSON.stringify(clean),{expirationTtl:60*60*24*180});
  return json({ok:true,ticket},200,{'Cache-Control':'no-store'});
}
async function mt5List(request,env){
  if(!env.MT5_BRIDGE_SECRET||!env.MT5_TRADES)return json({error:'mt5_bridge_not_configured'},503,{'Cache-Control':'no-store'});
  if((request.headers.get('Authorization')||'')!=='Bearer '+env.MT5_BRIDGE_SECRET)return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  const listed=await env.MT5_TRADES.list({prefix:'trade:',limit:1000});
  const trades=[];for(const key of listed.keys){const raw=await env.MT5_TRADES.get(key.name);if(raw){try{trades.push(JSON.parse(raw))}catch{}}}
  trades.sort((a,b)=>String(b.closeTime).localeCompare(String(a.closeTime)));
  return json({ok:true,source:'MetaTrader 5',trades:trades.slice(0,500)},200,{'Cache-Control':'no-store'});
}

async function sendAlerts(request, env){
  const projectId=env.FIREBASE_PROJECT_ID||'arex-a1853';
  const authorization=request.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer ')) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
  let claims; try{claims=await verifyFirebaseIdToken(authorization.slice(7),projectId);}catch(e){return json({error:'unauthorized',detail:String(e?.message||e)},401,{'Cache-Control':'no-store'});}
  if(!env.ALERT_ALLOWED_UID) return json({error:'alerts_not_enabled',message:'Set ALERT_ALLOWED_UID to the owner Firebase UID before enabling external alerts.'},503,{'Cache-Control':'no-store'});
  if(claims.sub!==env.ALERT_ALLOWED_UID) return json({error:'forbidden'},403,{'Cache-Control':'no-store'});
  let body; try{body=await request.json();}catch{return json({error:'invalid_json'},400,{'Cache-Control':'no-store'});}
  const title=String(body.title||'AREX alert').slice(0,120), message=String(body.body||'').slice(0,900), eventId=String(body.eventId||'').slice(0,160);
  if(!message) return json({error:'message_required'},400,{'Cache-Control':'no-store'});
  const text=`${title}\n${message}\n\nAREX · ${new Date().toISOString()}${eventId?` · ${eventId}`:''}`;
  const results={telegram:'not_configured',email:'not_configured',uid:claims.sub};
  if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID){
    try{const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,disable_web_page_preview:true})});results.telegram=r.ok?'sent':'failed';}catch{results.telegram='failed';}
  }
  if(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM){
    try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.ALERT_EMAIL_FROM,to:[env.ALERT_EMAIL_TO],subject:`AREX · ${title}`,text})});results.email=r.ok?'sent':'failed';}catch{results.email='failed';}
  }
  return json({ok:true,results},200,{'Cache-Control':'no-store'});
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'AREX Edge Worker',routes:['/calendar','/market','/notify','/mt5/ingest','/mt5/trades'],calendarSource:'Forex Factory weekly export',marketSource:env.TWELVEDATA_API_KEY?'Twelve Data configured':'not configured',telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),emailConfigured:!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM)},200,{'Cache-Control':'no-store'});
    if((url.pathname==='/'||url.pathname==='/calendar')&&request.method==='GET'){try{return await fetchCalendar(ctx);}catch(e){return json({error:'calendar_unavailable',message:String(e?.message||e)},502,{'Cache-Control':'no-store'});}}
    if(url.pathname==='/market'&&request.method==='GET')return fetchQuotes(request,env);
    if(url.pathname==='/mt5/ingest'&&request.method==='POST')return mt5Ingest(request,env);
    if(url.pathname==='/mt5/trades'&&request.method==='GET')return mt5List(request,env);
    if(url.pathname==='/notify'&&request.method==='POST')return sendAlerts(request,env);
    return json({error:'not_found'},404,{'Cache-Control':'no-store'});
  }
};
