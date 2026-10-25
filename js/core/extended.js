(function(global){
  'use strict';
  const finite = n => Number.isFinite(Number(n));
  const num = v => { const n=Number(v); return v!=='' && v!==null && v!==undefined && Number.isFinite(n) ? n : null; };
  const dateOf = t => {
    const d = new Date((t && t.date ? t.date : '') + (t && t.time ? 'T'+t.time : 'T12:00:00'));
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const rOf = t => num(t && t.r);
  const closed = trades => (trades||[]).filter(t=>rOf(t)!==null);
  function drawdown(trades){
    let equity=0, peak=0, max=0;
    const curve=[];
    closed(trades).slice().sort((a,b)=>(dateOf(a)?.getTime()||0)-(dateOf(b)?.getTime()||0)).forEach(t=>{
      equity+=rOf(t); peak=Math.max(peak,equity); max=Math.max(max,peak-equity);
      curve.push({id:t.id,date:t.date,equity,drawdown:peak-equity});
    });
    return {maxDrawdownR:max,curve};
  }
  function performance(trades){
    const rows=closed(trades), wins=rows.filter(t=>rOf(t)>0), losses=rows.filter(t=>rOf(t)<0);
    const sum=rows.reduce((s,t)=>s+rOf(t),0), winSum=wins.reduce((s,t)=>s+rOf(t),0), lossAbs=Math.abs(losses.reduce((s,t)=>s+rOf(t),0));
    return {n:rows.length,excluded:(trades||[]).length-rows.length,winRate:rows.length?wins.length/rows.length*100:null,
      avgR:rows.length?sum/rows.length:null,expectancyR:rows.length?sum/rows.length:null,
      profitFactor:lossAbs>0?winSum/lossAbs:(winSum>0?Infinity:null),netR:sum,...drawdown(rows)};
  }
  function parseNaturalQuery(query, trades){
    const q=String(query||'').toLocaleLowerCase();
    let out=(trades||[]).slice(), filters=[];
    const symTokens=[['طلا','XAU'],['gold','XAU'],['xauusd','XAUUSD'],['داوجونز','US30'],['dow','US30'],['nasdaq','NAS'],['یورو','EUR'],['bitcoin','BTC'],['بیت کوین','BTC']];
    for(const [token,sym] of symTokens){if(q.includes(token)){out=out.filter(t=>String(t.symbol||'').toUpperCase().includes(sym));filters.push({key:'symbol',value:sym});break;}}
    const setupTokens=['smc','supply','demand','news','cop'];
    for(const token of setupTokens){if(q.includes(token)){out=out.filter(t=>(String(t.setup||'')+' '+String(t.tags||'')).toLowerCase().includes(token));filters.push({key:'setup',value:token});}}
    if(/بعد از ضرر|بعد از باخت|after loss|after a loss/.test(q)){
      out=out.filter(t=>{
        const d=dateOf(t); if(!d)return false;
        return (trades||[]).some(p=>p!==t && rOf(p)!==null && rOf(p)<0 && dateOf(p) && dateOf(p)<d && (d-dateOf(p))<48*3600000);
      }); filters.push({key:'afterLoss',value:true});
    }
    if(/سودده|برنده|winning|profitable/.test(q)){out=out.filter(t=>rOf(t)!==null&&rOf(t)>0);filters.push({key:'result',value:'win'});}
    if(/ضررده|بازنده|losing|losses/.test(q)){out=out.filter(t=>rOf(t)!==null&&rOf(t)<0);filters.push({key:'result',value:'loss'});}
    const tagMatch=q.match(/(?:برچسب|tag)\s*[:=]?\s*([\p{L}\p{N}_-]+)/u);
    if(tagMatch){out=out.filter(t=>(Array.isArray(t.tags)?t.tags.join(' '):String(t.tags||'')).toLowerCase().includes(tagMatch[1]));filters.push({key:'tag',value:tagMatch[1]});}
    const setupMatch=q.match(/(?:استراتژی|ستاپ|strategy|setup)\s*[:=]?\s*([\p{L}\p{N}_-]+)/u);
    if(setupMatch){out=out.filter(t=>String(t.setup||'').toLowerCase().includes(setupMatch[1]));filters.push({key:'setup',value:setupMatch[1]});}
    const dates=out.filter(t=>dateOf(t)).sort((a,b)=>dateOf(a)-dateOf(b));
    return {trades:dates,filters,mode:'local-rule-query'};
  }
  // Explainable local semantic-like retrieval: multilingual normalization, aliases, field weighting and relevance ranking.
  // This is intentionally local and deterministic; it is not an embedding/LLM claim.
  const SEARCH_ALIASES = new Map([
    ['طلا',['gold','xauusd','xau']],['gold',['طلا','xauusd','xau']],['xauusd',['طلا','gold','xau']],
    ['داوجونز',['dow','us30','dowjones']],['dow',['داوجونز','us30']],['بیتکوین',['bitcoin','btc']],['bitcoin',['بیتکوین','btc']],
    ['ضرر',['زیان','بازنده','loss','losing']],['زیان',['ضرر','بازنده','loss']],['ترس',['fear','استرس','اضطراب']],
    ['فومو',['fomo','تعقیب قیمت','جا ماندن']],['revenge',['انتقام','انتقامی','revenge trading']],
    ['قوانین',['rule','rules','پایبندی','compliance']],['حدضرر',['sl','stoploss','stop loss']],['سود',['profit','برنده','winning']]
  ]);
  const SEARCH_STOP = new Set('از به با در برای که و یا را این آن یک روی بعد قبل معاملات معامله های ها است بود شد شده می من تو خودم کردم کردم'.split(' '));
  function normalizeSearchText(value){return String(value??'').toLocaleLowerCase().normalize('NFKC').replace(/[\u0640\u064B-\u065F\u0670]/g,'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[^\p{L}\p{N}_%.-]+/gu,' ').trim();}
  function searchTokens(value){return normalizeSearchText(value).split(/\s+/u).filter(t=>t.length>1&&!SEARCH_STOP.has(t));}
  function tradeSearchDocument(t){
    const tags=Array.isArray(t.tags)?t.tags.join(' '):String(t.tags||'');
    const mistakes=Array.isArray(t.mistakes)?t.mistakes.join(' '):String(t.mistakes||'');
    return {symbol:String(t.symbol||''),setup:String(t.setup||''),note:String(t.note||''),tags,mistakes,
      context:[t.reason,t.entryReason,t.exitReason,t.emotionBefore,t.emotionAfter,t.psychology,t.session,t.marketCondition,t.lessons,t.review,t.plan,t.ruleComplianceNotes].filter(Boolean).join(' ')};
  }
  function semanticSearch(query,trades,options={}){
    const original=String(query||'').trim();
    if(!original)return {trades:(trades||[]).slice().sort((a,b)=>(dateOf(b)?.getTime()||0)-(dateOf(a)?.getTime()||0)).slice(0,Number(options.limit)||100),filters:[],mode:'empty-query',explanation:'عبارت جست‌وجو خالی است؛ معاملات اخیر نمایش داده می‌شوند.',scored:false};
    const parsed=parseNaturalQuery(original,trades||[]);
    const queryTokens=searchTokens(original), expanded=new Set(queryTokens);
    for(const token of queryTokens){for(const alias of (SEARCH_ALIASES.get(token)||[])) for(const a of searchTokens(alias)) expanded.add(a);}
    const candidates=parsed.trades;
    const scored=candidates.map(t=>{
      const d=tradeSearchDocument(t), fields={symbol:searchTokens(d.symbol),setup:searchTokens(d.setup),tags:searchTokens(d.tags),note:searchTokens(d.note),mistakes:searchTokens(d.mistakes),context:searchTokens(d.context)};
      const weights={symbol:4,setup:3.5,tags:3,note:2.5,mistakes:3,context:1.5};let score=0;const matched=[];
      for(const token of expanded){let best=0,where='';for(const [field,tokens] of Object.entries(fields)){let value=0;if(tokens.includes(token))value=weights[field];else if(token.length>=4&&tokens.some(x=>x.startsWith(token)||token.startsWith(x)))value=weights[field]*.55;if(value>best){best=value;where=field;}}if(best){score+=best;matched.push({token,field:where,weight:best});}}
      // Explicit rule filters remain authoritative; relevance only orders the filtered records.
      const hasTextualConstraint=queryTokens.length>0&&parsed.filters.length===0;
      return {trade:t,score,matched,eligible:parsed.filters.length>0||!hasTextualConstraint||score>0};
    }).filter(x=>x.eligible);
    scored.sort((a,b)=>b.score-a.score||(dateOf(b.trade)?.getTime()||0)-(dateOf(a.trade)?.getTime()||0));
    const limit=Math.min(500,Math.max(1,Number(options.limit)||100));
    return {trades:scored.slice(0,limit).map(x=>x.trade),filters:parsed.filters,mode:'local-ranked-search',scored:true,
      ranking:scored.slice(0,limit).map(x=>({id:x.trade.id,score:Number(x.score.toFixed(3)),matched:x.matched})),
      explanation:'جست‌وجوی محلیِ رتبه‌بندی‌شده با هم‌معنی‌های فارسی/انگلیسی و وزن‌دهی فیلدها؛ داده‌ای به سرویس بیرونی ارسال نمی‌شود. این روش embedding یا مدل زبانی نیست.',
      totalMatches:scored.length,queryTokens:Array.from(expanded)};
  }

  function walkForward(values, options={}){
    const parsed=(values||[]).map(num);
    if(parsed.length<8 || parsed.some(v=>v===null)) return {ok:false,reason:'حداقل ۸ نتیجه عددی معتبر بر حسب R لازم است؛ مقادیر خالی/نامعتبر پذیرفته نیستند.'};
    const trainPct=Math.min(80,Math.max(50,Number(options.trainPct)||70));
    const cut=Math.floor(parsed.length*trainPct/100);
    if(cut<4 || parsed.length-cut<3) return {ok:false,reason:'برای بخش آموزش و خارج‌ازنمونه نمونه کافی نیست.'};
    const cost=Number(options.costR)||0;
    if(cost<0) return {ok:false,reason:'هزینه بر حسب R نمی‌تواند منفی باشد.'};
    const adjusted=parsed.map(v=>v-cost);
    const summarize=arr=>{const wins=arr.filter(v=>v>0),loss=arr.filter(v=>v<0),sum=arr.reduce((a,b)=>a+b,0),la=Math.abs(loss.reduce((a,b)=>a+b,0));return {n:arr.length,netR:sum,expectancyR:sum/arr.length,winRate:wins.length/arr.length*100,profitFactor:la?wins.reduce((a,b)=>a+b,0)/la:(wins.length?Infinity:null)};};
    return {ok:true,method:'chronological-split',trainCount:cut,testCount:adjusted.length-cut,train:summarize(adjusted.slice(0,cut)),outOfSample:summarize(adjusted.slice(cut)),costR:cost,warning:'این یک تقسیم زمانی ساده است، نه بهینه‌سازی پارامتر یا بک‌تست از قیمت خام. ترتیب داده‌ها باید قدیمی به جدید باشد؛ نتایج پس از تقسیم خارج‌ازنمونه نباید برای تنظیم بخش آموزش استفاده شوند.'};
  }
  function psychologySignals(trades, logs, userRules={}){
    const rows=closed(trades).slice().sort((a,b)=>(dateOf(a)?.getTime()||0)-(dateOf(b)?.getTime()||0));
    const signals=[]; let streak=0;
    for(const t of rows.slice(-20)){if(rOf(t)<0)streak++;else if(rOf(t)>0)streak=0;}
    if(streak>=2) signals.push({level:streak>=3?'high':'medium',code:'loss_streak',evidence:`${streak} معامله زیان‌ده متوالی در آخرین معاملات دارای R`,count:streak});
    const recent=rows.slice(-10), earlier=rows.slice(-30,-10).filter(t=>num(t.riskPct)!==null), recentRisk=recent.map(t=>num(t.riskPct)).filter(v=>v!==null), oldAvg=earlier.length?earlier.reduce((s,t)=>s+Number(t.riskPct),0)/earlier.length:null, newAvg=recentRisk.length?recentRisk.reduce((a,b)=>a+b,0)/recentRisk.length:null;
    if(oldAvg!==null&&newAvg!==null&&newAvg>oldAvg*1.5) signals.push({level:'high',code:'risk_increase',evidence:`میانگین ریسک اخیر ${newAvg.toFixed(2)}٪ در برابر ${oldAvg.toFixed(2)}٪ قبلی`,count:recentRisk.length});
    const adherence=recent.map(t=>num(t.ruleCompliance)).filter(v=>v!==null), prev=rows.slice(-20,-10).map(t=>num(t.ruleCompliance)).filter(v=>v!==null);
    if(adherence.length>=3&&prev.length>=3){const a=adherence.reduce((x,y)=>x+y,0)/adherence.length,b=prev.reduce((x,y)=>x+y,0)/prev.length;if(b-a>=20)signals.push({level:'medium',code:'adherence_drop',evidence:`پایبندی از ${b.toFixed(0)}٪ به ${a.toFixed(0)}٪ کاهش یافته`,count:adherence.length});}
    const daily=Object.values(logs||{}).filter(x=>x&&x.mood).slice(-7);
    if(daily.length>=3){const neg=daily.filter(x=>/stress|fear|angry|anx|ترس|استرس|عصب|خشم|اضطراب/i.test(String(x.mood))).length;if(neg>=3)signals.push({level:'medium',code:'self_reported_stress',evidence:`${neg} مورد از ${daily.length} گزارش اخیر شامل کلیدواژه‌های تنش ثبت‌شده است`,count:neg});}
    return {signals,disclaimer:'این هشدارها الگوهای ثبت‌شده‌اند، تشخیص روان‌شناختی یا توصیه پزشکی نیستند. نمونه کم یا فیلد خالی باعث حذف هشدار می‌شود.'};
  }
  function portfolioRisk(openPositions, correlationPairs=[]){
    const rows=(openPositions||[]).map(p=>({symbol:String(p.symbol||'').toUpperCase(),riskPct:num(p.riskPct)}));
    const valid=rows.filter(p=>p.symbol&&p.riskPct!==null&&p.riskPct>=0);
    const total=valid.reduce((s,p)=>s+p.riskPct,0), by={}; valid.forEach(p=>by[p.symbol]=(by[p.symbol]||0)+p.riskPct);
    const pairs=[]; for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){
      const a=valid[i].symbol,b=valid[j].symbol;
      const pair=correlationPairs.find(c=>(c.a===a&&c.b===b)||(c.a===b&&c.b===a));
      pairs.push({a,b,correlation:pair&&finite(pair.correlation)?Number(pair.correlation):null,riskA:valid[i].riskPct,riskB:valid[j].riskPct});
    }
    return {positionCount:(openPositions||[]).length,validCount:valid.length,missingCount:(openPositions||[]).length-valid.length,totalRiskPct:total,bySymbol:by,pairs,correlationStatus:pairs.length&&pairs.every(p=>p.correlation!==null)?'provided':'unknown',warning:'این محاسبه فقط ریسک درصدی واردشده را جمع می‌کند؛ بدون ریسک معتبر، ارزش قرارداد و هم‌بستگی معتبر، ریسک واقعی/هجینگ را نمی‌توان تأیید کرد.'};
  }
  function weeklyReport(trades, dailyLogs, startDate, endDate){
    const rows=(trades||[]).filter(t=>t.date>=startDate&&t.date<=endDate), p=performance(rows);
    const logs=Object.values(dailyLogs||{}).filter(l=>l&&l.date>=startDate&&l.date<=endDate);
    const errors={}; rows.forEach(t=>(t.mistakes||[]).forEach(m=>errors[m]=(errors[m]||0)+1));
    return {startDate,endDate,performance:p,tradeCount:rows.length,logs:logs.length,completedJournal:logs.filter(l=>l.journalDone).length,topMistakes:Object.entries(errors).sort((a,b)=>b[1]-a[1]).slice(0,5),note:'گزارش فقط از داده‌های ثبت‌شده ساخته شده است؛ نبود معامله یا گزارش به معنی صفر بودن فعالیت واقعی نیست.'};
  }
  global.AREXExtended = {performance,parseNaturalQuery,semanticSearch,walkForward,psychologySignals,portfolioRisk,weeklyReport};
})(window);
