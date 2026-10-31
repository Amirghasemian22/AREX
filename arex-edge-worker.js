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

/*KB_ENGINE_START*/
const KB = (() => { const module = { exports: {} };
/* AREX V9.8.0 — core/kb: the knowledge engine. Parses the trader's own Markdown knowledge base, indexes it (Persian-aware BM25 + synonyms +
   fuzzy matching) and answers FROM THE TEXT ONLY: extractive, cited, never invents rules/numbers, reports conflicts, labels rule/note/untested.
   Pure (no DOM / network) so it runs in the page, in Workers and in tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.kb = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[يى]/g, 'ی').replace(/[كک]/g, 'ک').replace(/[ةۀ]/g, 'ه').replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی')
    .replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(('از به در که و را با این آن برای است هست باید می نمی هم یا تا بر بی شود شده شد کن کنید کرد کنم کنی کند بود بوده نیست نیز ولی اما اگر چه چی چرا چطور چگونه کدام کجا کی چند یک دو ها های هایی تر ترین خود من تو ما شما او آنها ان انها هر همه بعد قبل بین روی زیر مثل مانند طبق طور چون پس بدون فقط حتی هنوز دیگر باشد باشند بشه میشه میتونم میتونه کنه کرده کردن دارد دارند داره دارم باشه چیه چیست چی چقدر چقدره تونم تونه تونی کنیم میکنه میشود میتوان the a an of to in is are and or for with on at by be it this that what how why can i do does').split(' '));
  const IRR = { قوانین: 'قانون', اصول: 'اصل', سطوح: 'سطح', نواحی: 'ناحیه', شرایط: 'شرط', ارقام: 'رقم', مفاهیم: 'مفهوم', معاملات: 'معامله', اشتباهات: 'اشتباه', تصاویر: 'تصویر', اخبار: 'خبر', اصطلاحات: 'اصطلاح', ساعات: 'ساعت', قواعد: 'قاعده', نمادها: 'نماد' };
  const SUF = ['هایی', 'های', 'ها', 'ترین', 'تر', 'ات'];
  const stem = t => { if (IRR[t]) return IRR[t]; if (/^[a-z0-9]+$/.test(t)) return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t; for (const s of SUF) if (t.length > s.length + 1 && t.endsWith(s)) { t = t.slice(0, -s.length); break; } if (t.length > 3 && t.endsWith('ی')) t = t.slice(0, -1); return t; };
  const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t)).map(stem).filter(t => t.length > 1 || /\d/.test(t));
  const SYN = [['حد ضرر', 'sl', 'stop loss', 'استاپ', 'stoploss', 'استاپ لاس'], ['حد سود', 'tp', 'take profit', 'تیک پروفیت', 'takeprofit'], ['داوجونز', 'داو جونز', 'us30', 'dj30', 'dji', 'dow', 'داو'], ['طلا', 'xauusd', 'gold', 'گلد', 'xau'], ['اردربلاک', 'ob', 'order block', 'اوردر بلاک', 'orderblock'], ['نقدینگی', 'liquidity', 'لیکوییدیتی'], ['پولبک', 'pullback', 'پول بک', 'ریتریس', 'برگشت به سطح'], ['شکست', 'breakout', 'break', 'بریک اوت', 'bos'], ['روند', 'trend', 'ترند'], ['سشن', 'session', 'نشست'], ['لندن', 'london'], ['نیویورک', 'new york', 'ny'], ['توکیو', 'tokyo', 'ژاپن'], ['خبر', 'news', 'اخبار', 'خبری'], ['همبستگی', 'correlation', 'کورلیشن'], ['rsi', 'آر اس آی', 'ار اس ای'], ['کندل', 'candle', 'شمع'], ['انتقام', 'revenge', 'انتقام گیری'], ['فومو', 'fomo'], ['لات', 'lot', 'حجم', 'سایز پوزیشن'], ['ژورنال', 'journal', 'ژورنال نویسی'], ['بک تست', 'backtest', 'بکتست'], ['اسپرد', 'spread'], ['گپ', 'gap'], ['دلار', 'usd', 'dxy', 'شاخص دلار'], ['ریسک', 'risk'], ['استراتژی', 'strategy', 'ستاپ', 'setup'], ['سر و شانه', 'head and shoulders', 'سر وشانه'], ['مثلث', 'triangle'], ['پرچم', 'flag', 'پرچمک'], ['عرضه', 'supply'], ['تقاضا', 'demand'], ['متاتریدر', 'mt5', 'mt4', 'متا تریدر', 'metatrader'], ['استیتمنت', 'statement', 'گزارش حساب'], ['تورم', 'inflation', 'cpi'], ['نرخ بهره', 'interest rate', 'بهره', 'فدرال رزرو', 'fed'], ['اوراق قرضه', 'bond', 'اوراق'], ['بروکر', 'broker', 'کارگزار'], ['جابه جا', 'جابجا', 'جا به جا', 'تغییر حد ضرر', 'دور کردن', 'تغییر دادن'], ['گوشی', 'موبایل', 'تلفن همراه'], ['پایبندی', 'رعایت', 'انضباط'], ['معامله', 'ترید', 'trade', 'تریدینگ']];
  const SYNMAP = {}; SYN.forEach((g, gi) => g.forEach(p => { SYNMAP[norm(p)] = gi; }));
  const STRAT = { gold: ['طلا', 'xauusd', 'gold', 'گلد'], dowjones: ['داوجونز', 'داو جونز', 'us30', 'dji', 'dow', 'داو'], cop: ['cop', 'کاپ'], news: ['ترید خبری', 'خبری', 'nfp', 'cpi', 'adp'], smc: ['smc', 'اردربلاک', 'ob', 'نقدینگی', 'liquidity', 'choch', 'bos', 'ساختار بازار'] };
  const strategyOf = q => { const n = ' ' + norm(q) + ' '; for (const k of ['news', 'cop', 'dowjones', 'gold', 'smc']) if (STRAT[k].some(w => n.includes(' ' + norm(w) + ' '))) return k; return null; };
  const KIND_W = { rule: 1.3, strategy: 1.2, conflict: 1.0, test: 1.0, education: 1.0, note: 1.0, archive: .8, image: .9, meta: .5 };
  const TOP = { 2: ['rule', null], 3: ['note', 'priceaction'], 4: ['note', 'smc'], 5: ['strategy', 'cop'], 6: ['strategy', 'dowjones'], 7: ['strategy', 'gold'], 8: ['strategy', 'news'], 9: ['strategy', 'aux'], 10: ['rule', null], 11: ['education', null], 12: ['conflict', null], 13: ['test', null], 14: ['image', null], 15: ['archive', null] };
  const KIND_FA = { rule: 'قانون صریح', strategy: 'قاعده‌ی استراتژی', note: 'یادداشت آموزشی', education: 'یادداشت آموزشی', conflict: 'ابهام/تعارض', test: 'نیازمند آزمون آماری', archive: 'یادداشت جلسه', image: 'تصویر', meta: 'راهنما' };
  const lat = s => String(s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));

  /* ---------------- parse ---------------- */
  function parse(md, opts) {
    opts = opts || {}; const lines = String(md || '').replace(/\r/g, '').split('\n'), chunks = [], stack = [], images = {}; let buf = [], inArchive = false, n = 0;
    const secNo = () => { for (let i = stack.length - 1; i >= 0; i--) { const m = /^([0-9۰-۹]+(?:[.\u066B][0-9۰-۹]+)*)[.\u066B)]?\s/.exec(stack[i] || ''); if (m) return lat(m[1]).replace(/\u066B/g, '.'); } return ''; };
    const meta = () => { const sec = secNo(), top = parseInt(sec, 10), m = TOP[top] || ['note', null]; const path = stack.filter(Boolean); const ses = /منبع:\s*جلسه\s*([0-9۰-۹]+)\s*[-–]?\s*(.*)/.exec(path.join(' | ')); return { section: sec, kind: inArchive ? 'archive' : (stack[1] && /دستورالعمل استفاده/.test(stack[1]) ? 'meta' : m[0]), strategy: m[1], session: ses ? { no: +lat(ses[1]), title: (ses[2] || '').split('|')[0].trim() } : null, path }; };
    const push = (text, extra) => { text = text.trim(); if (!text) return; const mt = meta(), title = mt.path[mt.path.length - 1] || ''; chunks.push(Object.assign({ id: 'c' + (++n), title, path: mt.path, section: mt.section, kind: mt.kind, strategy: mt.strategy, session: mt.session, text }, extra || {})); };
    const flush = () => {
      const text = buf.join('\n').trim(); buf = []; if (!text) return;
      const mt = meta();
      if (mt.kind === 'conflict') { const re = /^\s*(\d+)\.\s+\*\*(.+?)\*\*:?\s*([\s\S]*?)(?=^\s*\d+\.\s+\*\*|$(?![\s\S]))/gm; let m, any = false; while ((m = re.exec(text))) { any = true; push(m[2].replace(/[:：]\s*$/, '') + ': ' + m[3].trim(), { conflictId: 'K' + m[1], title: m[2].replace(/[:：]\s*$/, '') }); } if (any) return; }
      if (mt.kind === 'image') { text.split('\n').forEach(l => { const m = /^\s*-\s*\*\*`?([^`*]+?)`?\*\*\s*[—–-]\s*(.+)$/.exec(l); if (m) { images[m[1].trim()] = m[2].trim(); push(m[2].trim() + ' (تصویر: ' + m[1].trim() + ')', { image: m[1].trim(), title: m[1].trim() }); } }); return; }
      const parts = []; let cur = []; let size = 0;
      text.split('\n').forEach(l => { const isItem = /^\s*(?:[-*•]|\d+[.)])\s+/.test(l); if (size > 700 && (isItem || l.trim() === '')) { parts.push(cur.join('\n')); cur = []; size = 0; } cur.push(l); size += l.length; });
      if (cur.length) parts.push(cur.join('\n')); parts.forEach((p, i) => { const imgs = []; p.replace(/<?Images\/([^>)\n]+?)>?(?=[)\s]|$)/g, (_, f) => { imgs.push(f.trim()); return ''; }); push(p, imgs.length ? { images: imgs, part: i } : { part: i }); });
    };
    lines.forEach(line => {
      const m = /^(#{1,6})\s+(\S.*?)\s*$/.exec(line);
      if (m) { const level = m[1].length, title = m[2].trim();
        if (inArchive && !/^منبع:/.test(title) && level >= 1) { buf.push(title); return; }                   // archive-internal headings are just text
        flush(); stack.length = level - 1; stack[level - 1] = title; if (level === 2 && /آرشیو کامل یادداشت/.test(title)) inArchive = true; else if (level === 2) inArchive = false;
        if (level === 3 && inArchive) { /* session header */ } return; }
      buf.push(line);
    });
    flush(); return { version: 1, title: (stack[0] || opts.title || 'دانش‌نامه'), chunks, images, builtAt: opts.builtAt || '' };
  }

  /* ---------------- index + search ---------------- */
  function buildIndex(pack) {
    const docs = pack.chunks.map(c => { const body = tokens(c.text), head = tokens((c.path || []).join(' ') + ' ' + c.title); const all = body.concat(head, head, head), tf = new Map(); all.forEach(t => tf.set(t, (tf.get(t) || 0) + 1)); return { c, tf, len: all.length, norm: ' ' + norm(c.text + ' ' + c.title) + ' ' }; });
    const df = new Map(); docs.forEach(d => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    const N = docs.length, avg = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, N), idf = t => Math.log(1 + (N - (df.get(t) || 0) + .5) / ((df.get(t) || 0) + .5));
    return { docs, df, N, avg, idf, vocab: [...df.keys()], byId: new Map(pack.chunks.map(c => [c.id, c])), pack };
  }
  const tri = s => { const x = '  ' + s + ' ', o = new Set(); for (let i = 0; i < x.length - 2; i++) o.add(x.slice(i, i + 3)); return o; };
  const jac = (a, b) => { let i = 0; a.forEach(x => { if (b.has(x)) i++; }); return i / (a.size + b.size - i || 1); };
  function expand(ix, q) {
    const base = tokens(q), n = norm(q), out = new Map(); base.forEach(t => out.set(t, 1));
    Object.keys(SYNMAP).forEach(p => { if ((' ' + n + ' ').includes(' ' + p + ' ')) SYN[SYNMAP[p]].forEach(s => tokens(s).forEach(t => { if (!out.has(t)) out.set(t, .55); })); });
    base.forEach(t => { if (!ix.df.has(t) && t.length > 3) { const tt = tri(t); let best = null, bs = .55; ix.vocab.forEach(v => { if (Math.abs(v.length - t.length) <= 2) { const s = jac(tt, tri(v)); if (s > bs) { bs = s; best = v; } } }); if (best && !out.has(best)) out.set(best, .7); } });
    return { base, weights: out };
  }
  function intentOf(qn) { if (/چک لیست|چکلیست|مراحل|قدم به قدم|گام به گام|روال|فرایند/.test(qn)) return 'checklist'; if (/قانون|قوانین|قاعده|قواعد|استراتژی|ستاپ|چطور کار|توضیح/.test(qn) && strategyOf(qn)) return 'overview'; if (/چیست|چیه|یعنی چی|یعنی چه|تعریف|معنی|what is/.test(qn)) return 'define'; if (/قانون|قوانین|قاعده|قواعد|استراتژی|ستاپ|چطور کار|توضیح/.test(qn)) return 'overview'; if (/میتونم|می تونم|مجازم|ممنوع|اجازه|درسته|میشه|مجاز/.test(qn)) return 'permission'; return 'generic'; }
  function search(ix, q, o) {
    o = o || {}; const k = o.k || 6, ex = expand(ix, q), strat = o.strategy === undefined ? strategyOf(q) : o.strategy, K1 = 1.4, B = .75, phr = []; const bt = ex.base;
    for (let i = 0; i < bt.length - 1; i++) phr.push(bt[i] + ' ' + bt[i + 1]); const qn = ' ' + norm(q) + ' '; const totalIdf = bt.reduce((a, t) => a + ix.idf(t), 0) || 1;
    const res = []; ix.docs.forEach(d => { let s = 0; ex.weights.forEach((w, t) => { const f = d.tf.get(t); if (f) s += w * ix.idf(t) * f * (K1 + 1) / (f + K1 * (1 - B + B * d.len / ix.avg)); });
      if (!s) return; if (qn.length > 6 && d.norm.includes(qn.trim())) s *= 1.4; phr.forEach(p => { if (d.norm.includes(p.split(' ').map(x => x).join(' '))) s += .4; });
      s *= (o.intent === 'define' && (d.c.kind === 'archive' || d.c.kind === 'education') ? 1.45 : o.intent === 'define' && d.c.kind === 'strategy' ? .8 : (KIND_W[d.c.kind] || 1)); if (o.kinds && !o.kinds.includes(d.c.kind)) return;
      if (strat && d.c.strategy && d.c.strategy !== strat && d.c.kind !== 'conflict' && d.c.kind !== 'rule') s *= .35;
      const cov = bt.length ? bt.filter(t => d.tf.has(t)).reduce((a, t) => a + ix.idf(t), 0) / totalIdf : 0; res.push({ chunk: d.c, score: s, coverage: Math.min(1, cov) }); });
    res.sort((a, b) => b.score - a.score); return { hits: res.slice(0, k), strategy: strat, tokens: bt };
  }

  /* ---------------- answer composition ---------------- */
  const UNTESTED = /تأیید\s*نشده|مستند\s*آماری\s*ندارد|بک\s*تست|آزمون\s*آماری|تضمین\s*نیست|قطعی\s*نیست/;
  const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);
  const sectionRef = c => (c.section ? '§' + c.section + ' ' : '') + trim(c.session ? 'جلسه ' + c.session.no + ' — ' + c.session.title : c.title, 60);
  function pickLines(ix, q, hits, max) {
    const qt = new Set(expand(ix, q).weights.keys()), out = [], seen = new Set();
    hits.forEach(h => { const ls = h.chunk.text.split('\n').map(l => l.trim()).filter(Boolean);
      const all = ls.filter(l => !/^!\[/.test(l)).map((l, i) => ({ l, i, s: tokens(l).reduce((a, t) => a + (qt.has(t) ? ix.idf(t) : 0), 0) })), best = Math.max(0, ...all.map(x => x.s));
      const scored = all.filter(x => (x.s > 0 && x.s >= best * .45) || all.length <= 2).sort((a, b) => b.s - a.s).slice(0, h.chunk.kind === 'archive' ? 3 : 4).sort((a, b) => a.i - b.i);
      scored.forEach(x => { const key = norm(x.l).slice(0, 80); if (seen.has(key)) return; seen.add(key); out.push({ line: x.l, chunk: h.chunk }); }); });
    let tot = 0; return out.filter(x => (tot += x.line.length) < max);
  }
  const mark = l => (/ممنوع|نباید|نکن|اجتناب|خودداری/.test(l) ? '⛔ ' : '') + l.replace(/^[-*•]\s*/, '• ').replace(/\*\*/g, '');
  /** answer(ix, question, {decisions}) -> {text, confidence, sources, conflicts, tags, hits, needs} — text is quoted from the KB, never generated. */
  function answer(ix, q, o) {
    o = o || {}; const dec = o.decisions || {}, qn = norm(q), intent = intentOf(qn), r = search(ix, q, { k: 8, intent }), top = r.hits[0], conflictsAll = ix.pack.chunks.filter(c => c.conflictId);
    const STR_FA = { gold: 'طلا', dowjones: 'داوجونز', cop: 'COP', news: 'ترید خبری', smc: 'SMC/ساختار بازار', priceaction: 'پرایس‌اکشن', aux: 'همبستگی/RSI' };
    if (/تعارض|ابهام|مبهم|نیازمند تصمیم|conflict|تصمیم نویسنده/.test(qn)) {
      const open = conflictsAll.filter(c => !dec[c.conflictId]);
      return { text: '⚠️ ' + conflictsAll.length + ' مورد ابهام/تعارض در دانش‌نامه ثبت شده (' + (conflictsAll.length - open.length) + ' مورد را تو تصمیم‌گیری کرده‌ای، ' + open.length + ' مورد باز است):\n' + conflictsAll.map(c => (dec[c.conflictId] ? '✅ ' : '❓ ') + c.conflictId + ') ' + trim(c.text, 150)).join('\n') + '\n\nبرای تصمیم‌گیری: دانش‌نامه ← ابهام‌ها.', confidence: 1, sources: conflictsAll.slice(0, 4).map(ref), tags: ['conflict'], hits: [], conflicts: conflictsAll };
    }
    const contentTokens = r.tokens.filter(t => !['قانون', 'قاعده', 'استراتژی', 'ستاپ', 'توضیح', 'مرحله', 'چک', 'لیست', 'چکلیست', 'بده', 'رو'].includes(t) && !(STRAT[r.strategy] || []).some(w => tokens(w).includes(t)));
    if (r.strategy && (intent === 'checklist' || (intent === 'overview' && contentTokens.length <= 1))) {
      const src = ix.pack.chunks.filter(c => c.strategy === r.strategy && c.kind === 'strategy').slice(0, 5);
      if (src.length) { const ls = src.map(c => c.text).join('\n').split('\n').map(l => l.trim()).filter(l => l && !/^!\[/.test(l) && !/^\[/.test(l)).slice(0, 24), openC = conflictsAll.filter(c => !dec[c.conflictId]);
        return { text: '📚 ' + (intent === 'checklist' ? 'مراحل/چک‌لیست' : 'قوانین ثبت‌شده') + ' استراتژی ' + (STR_FA[r.strategy] || '') + ' (عین متن دانش‌نامه):\n\n' + ls.map(mark).join('\n') + '\n\n⚠️ قوانین استراتژی‌های مختلف را بدون اجازه‌ی خودت با هم ترکیب نکن.' + (openC.length ? ' ' + openC.length + ' ابهام باز در دانش‌نامه هست؛ بگو «تعارض‌ها».' : ''), confidence: .9, sources: src.map(ref), conflicts: [], tags: [], images: [], hits: src.map(c => ({ chunk: c, score: 1, coverage: 1 })), strategy: r.strategy }; }
    }
    if (!r.strategy && intent === 'checklist' && contentTokens.length <= 1) {
      const g = ix.pack.chunks.filter(c => /فرایند عمومی بررسی ستاپ/.test(c.title));
      if (g.length) return { text: '📚 فرایند عمومی بررسی ستاپ (عین متن دانش‌نامه):\n\n' + g.map(c => c.text).join('\n').split('\n').map(l => l.trim()).filter(Boolean).map(mark).join('\n'), confidence: .9, sources: g.map(ref), conflicts: [], tags: [], images: [], hits: g.map(c => ({ chunk: c, score: 1, coverage: 1 })) };
    }
    if (!top || (top.coverage < .34 && top.score < 6)) {
      const near = r.hits.slice(0, 3).filter(h => h.chunk.kind !== 'meta').map(h => '• ' + sectionRef(h.chunk));
      return { text: 'در دانش‌نامه‌ی تو پاسخ مستقیمی برای این سؤال پیدا نکردم و چیزی را حدس نمی‌زنم.' + (near.length ? '\nنزدیک‌ترین بخش‌ها:\n' + near.join('\n') : ''), confidence: 0, sources: r.hits.slice(0, 3).map(h => ref(h.chunk)), tags: ['no-answer'], hits: r.hits, needs: 'ai' };
    }
    const used = r.hits.filter(h => h.score >= top.score * .35 && h.chunk.kind !== 'meta').slice(0, 5), lines = pickLines(ix, q, used, 1500), groups = {};
    lines.forEach(x => { const lab = KIND_FA[x.chunk.kind] || 'یادداشت'; (groups[lab] = groups[lab] || []).push(x); });
    let text = '📚 از دانش‌نامه' + (r.strategy ? ' (استراتژی ' + (STR_FA[r.strategy] || '') + ')' : '') + ':\n';
    Object.keys(groups).forEach(lab => { text += '\n【' + lab + '】\n' + groups[lab].map(x => mark(x.line)).join('\n') + '\n'; });
    const cq = search(ix, q + ' ' + lines.map(x => x.line).join(' ').slice(0, 300), { k: 3, kinds: ['conflict'], strategy: null }).hits.filter(h => h.coverage >= .3 && h.score > 5), shown = [];
    cq.forEach(h => { const c = h.chunk; shown.push(dec[c.conflictId] ? '✅ ' + c.conflictId + ' — تصمیم تو: ' + dec[c.conflictId].text : '⚠️ ابهام ثبت‌شده ' + c.conflictId + ': ' + trim(c.text, 220)); });
    if (shown.length) text += '\n' + shown.join('\n') + '\n';
    const tagUntested = used.some(h => h.chunk.kind === 'test' || UNTESTED.test(h.chunk.text)); if (tagUntested) text += '\n🧪 بخشی از این مطلب در خود دانش‌نامه «تأییدنشده/نیازمند بک‌تست» علامت خورده؛ آن را قطعی فرض نکن.';
    const imgs = [...new Set(used.flatMap(h => (h.chunk.image ? [h.chunk.image] : []).concat(h.chunk.images || [])))].slice(0, 3);
    return { text: text.trim(), confidence: Math.min(1, top.coverage + .15), sources: used.map(h => ref(h.chunk)).filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 4), conflicts: cq.map(h => h.chunk), tags: tagUntested ? ['untested'] : [], images: imgs, hits: used, strategy: r.strategy };
  }
  const ref = c => ({ id: c.id, label: sectionRef(c), kind: c.kind, section: c.section });
  /* helpers for UI */
  const sections = ix => { const m = new Map(); ix.pack.chunks.forEach(c => { const k = (c.path || []).slice(0, c.kind === 'archive' ? 3 : 2).join(' › '); if (!m.has(k)) m.set(k, { key: k, title: c.path[Math.min(c.path.length - 1, c.kind === 'archive' ? 2 : 1)] || c.title, kind: c.kind, section: c.section, ids: [] }); m.get(k).ids.push(c.id); }); return [...m.values()]; };
  const conflicts = ix => ix.pack.chunks.filter(c => c.conflictId);
  const checklist = (ix, strategy) => { if (strategy) { const c = ix.pack.chunks.filter(x => x.strategy === strategy && x.kind === 'strategy'); return c.map(x => x.text).join('\n'); } const g = ix.pack.chunks.find(x => /فرایند عمومی بررسی ستاپ/.test(x.title)); return g ? g.text : ''; };
  return { norm, tokens, parse, buildIndex, search, answer, sections, conflicts, checklist, strategyOf, intentOf, KIND_FA, sectionRef };
});

return module.exports; })();
/*KB_ENGINE_END*/
/* ---- private knowledge base: the site never receives the files, only answers to questions ---- */
let KB_CACHE = { at: 0, pack: null, ix: null };
const KB_RATE = new Map();
async function loadKb(env){
  if(KB_CACHE.pack && Date.now()-KB_CACHE.at<10*60000) return KB_CACHE;
  if(!env.AREX_KB) return null;
  const pack=await env.AREX_KB.get('pack','json'); if(!pack||!Array.isArray(pack.chunks)) return null;
  KB_CACHE={at:Date.now(),pack,ix:KB.buildIndex(pack)}; return KB_CACHE;
}
function kbAllowed(env, claims){
  const list=String(env.KB_ALLOWED_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  return !list.length||list.includes(claims.email);
}
async function handleKb(request, env, claims){
  if(!kbAllowed(env,claims)) return json({error:'forbidden'},403,{'Cache-Control':'no-store'});
  const now=Date.now(), hits=(KB_RATE.get(claims.sub)||[]).filter(t=>now-t<60000); if(hits.length>=30) return json({error:'rate_limited'},429,{'Cache-Control':'no-store','Retry-After':'30'});
  hits.push(now); KB_RATE.set(claims.sub,hits); if(KB_RATE.size>2000) KB_RATE.clear();
  let body; try{body=await request.json();}catch{return json({error:'invalid_json'},400,{'Cache-Control':'no-store'});}
  const q=String(body&&body.q||'').trim().slice(0,300); if(!q) return json({error:'empty_question'},400,{'Cache-Control':'no-store'});
  const kb=await loadKb(env); if(!kb) return json({error:'kb_not_configured'},503,{'Cache-Control':'no-store'});
  const a=KB.answer(kb.ix,q,{decisions:kb.pack.decisions||{}});
  const context=KB.search(kb.ix,q,{k:5}).hits.filter(h=>h.chunk.kind!=='meta').map(h=>({ref:KB.sectionRef(h.chunk),kind:KB.KIND_FA[h.chunk.kind]||'',text:h.chunk.text.slice(0,600)}));
  return json({text:a.text,confidence:a.confidence,tags:a.tags||[],needs:a.needs||null,conflicts:(a.conflicts||[]).length,sources:(a.sources||[]).map(s=>s.label).slice(0,3),context},200,{'Cache-Control':'no-store'});
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
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'AREX Edge Worker',routes:['/calendar','/market','/notify','/ingest','/ingest/pending','/kb'],notificationDedupe:env.NOTIFY_DEDUPE?'kv':'isolate_best_effort',calendarSource:'Forex Factory weekly export',marketSource:env.TWELVEDATA_API_KEY?'Twelve Data configured':'not configured',telegramConfigured:!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID),emailConfigured:!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_TO&&env.ALERT_EMAIL_FROM)},200,{'Cache-Control':'no-store'});
    if((url.pathname==='/'||url.pathname==='/calendar')&&request.method==='GET'){try{return await fetchCalendar(ctx);}catch(e){return json({error:'calendar_unavailable',message:String(e?.message||e)},502,{'Cache-Control':'no-store'});}}
    if(url.pathname==='/market'&&request.method==='GET'){
      const ip=request.headers.get('CF-Connecting-IP')||'unknown';
      if(!await allowRate(env,`market:${ip}`,60,60)) return json({error:'rate_limited',message:'Rate limit exceeded; retry later.'},429,{'Retry-After':'60','Cache-Control':'no-store'});
      return fetchQuotes(request,env);
    }
    if(url.pathname==='/notify'&&request.method==='POST')return sendAlerts(request,env);
    if(url.pathname==='/ingest'&&request.method==='POST')return handleIngest(request,env);
    if(url.pathname==='/kb'&&request.method==='POST'){
      const authorization=request.headers.get('Authorization')||'';
      if(!authorization.startsWith('Bearer ')) return json({error:'unauthorized'},401,{'Cache-Control':'no-store'});
      let claims; try{claims=await verifyGoogleAccessToken(authorization.slice(7),env);}catch(e){return json({error:String(e&&e.message)==='google_client_id_not_configured'?'auth_not_configured':'unauthorized'},String(e&&e.message)==='google_client_id_not_configured'?503:401,{'Cache-Control':'no-store'});}
      return handleKb(request,env,claims);
    }
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
