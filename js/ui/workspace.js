(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return v!==''&&v!==null&&v!==undefined&&Number.isFinite(n)?n:null;};
function appState(){if(!state.workspaceState)state.workspaceState={dailyPlans:{},behaviorGoals:[],attachments:{},focusMode:false,weeklyReports:[],savedSearches:[],weeklyNotifyEnabled:false,lastWeeklyNoticeWeek:'',memoryNotes:[]};return state.workspaceState;}
function dateKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function trades(){return Array.isArray(state.trades)?state.trades:[];}
function getTrade(id){return trades().find(t=>String(t.id)===String(id));}
function toast(message){if(typeof window.showToast==='function')window.showToast(message);else if(typeof window.toast==='function'&&window.toast!==toast)window.toast(message);else alert(message);}
function save(){queueSave('assistantState');}
function render(){
 const s=appState(), d=dateKey(), p=s.dailyPlans[d]||{session:'',prep:'',events:'',checklist:'',review:'',nextAction:'',updatedAt:null};
 $('arexWDate').textContent=d;
 $('arexWSession').value=p.session||'';
 $('arexWPrep').value=p.prep||'';
 $('arexWEvents').value=p.events||'';
 $('arexWChecklist').value=p.checklist||'';
 $('arexWReview').value=p.review||'';
 $('arexWNext').value=p.nextAction||'';
 $('arexWFocusBtn').setAttribute('aria-pressed',String(!!s.focusMode));
 $('arexWFocusBtn').textContent=s.focusMode?'خروج از حالت تمرکز':'فعال‌کردن حالت تمرکز';
 renderGoals(); renderImageTools(); renderSearch(); renderBacktest(); renderRisk(); renderPsychSignals(); renderWeekly(); renderMemory(); checkWeeklyNotify();
}
function savePlan(){
 const s=appState(),d=dateKey();
 s.dailyPlans[d]={session:$('arexWSession').value,prep:$('arexWPrep').value,events:$('arexWEvents').value,checklist:$('arexWChecklist').value,review:$('arexWReview').value,nextAction:$('arexWNext').value,updatedAt:new Date().toISOString()};
 save(); toast('برنامه روزانه ذخیره شد');
}
function addGoal(){
 const text=$('arexWGoal').value.trim(), target=num($('arexWGoalTarget').value);
 if(!text){toast('عنوان هدف رفتاری را وارد کن');return;}
 if(target===null||target<1||target>100){toast('هدف باید عددی بین ۱ تا ۱۰۰ باشد');return;}
 const s=appState();s.behaviorGoals.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),text,target,createdAt:new Date().toISOString(),active:true,progress:0});
 $('arexWGoal').value='';save();renderGoals();toast('هدف رفتاری ثبت شد');
}

function addMemory(){
 const text=$('arexWMemoryText').value.trim(),kind=$('arexWMemoryKind').value,source=$('arexWMemorySource').value.trim(),confirmed=$('arexWMemoryConfirmed').checked;
 if(!text){toast('متن یادداشت را وارد کن');return;}
 const s=appState();if(!Array.isArray(s.memoryNotes))s.memoryNotes=[];
 s.memoryNotes.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),kind,source,text,confirmed,createdAt:new Date().toISOString(),updatedAt:null});
 $('arexWMemoryText').value='';$('arexWMemorySource').value='';$('arexWMemoryConfirmed').checked=false;save();renderMemory();toast('یادداشت در حافظه کاری ذخیره شد');
}
function renderMemory(){
 const s=appState(),box=$('arexWMemoryList');if(!box)return;
 const notes=Array.isArray(s.memoryNotes)?s.memoryNotes:[];
 if(!notes.length){box.innerHTML='<p class="arex-w-muted">حافظه کاری هنوز یادداشتی ندارد.</p>';return;}
 const labels={goal:'هدف', 'confirmed-rule':'یادداشت قانون تأییدشده',mistake:'اشتباه/الگو',review:'مرور قبلی',preference:'ترجیح'};
 box.innerHTML=notes.map(n=>`<article class="arex-w-result"><div><strong>${esc(labels[n.kind]||n.kind)} · ${n.confirmed?'تأییدشده توسط کاربر':'تأییدنشده'}</strong><small>${esc(n.source||'منبع ذکر نشده')} · ${esc(n.createdAt||'')}</small><p>${esc(n.text)}</p></div><button class="arex-w-btn secondary" data-memory-edit="${esc(n.id)}">ویرایش</button><button class="arex-w-btn danger" data-memory-delete="${esc(n.id)}">حذف</button></article>`).join('');
 box.querySelectorAll('[data-memory-delete]').forEach(b=>b.onclick=()=>{if(!confirm('این یادداشت از حافظه کاری حذف شود؟'))return;s.memoryNotes=s.memoryNotes.filter(n=>n.id!==b.dataset.memoryDelete);save();renderMemory();});
 box.querySelectorAll('[data-memory-edit]').forEach(b=>b.onclick=()=>{const n=s.memoryNotes.find(x=>x.id===b.dataset.memoryEdit);if(!n)return;const text=prompt('ویرایش یادداشت:',n.text);if(text===null)return;if(!text.trim()){toast('یادداشت خالی ذخیره نشد');return;}const source=prompt('منبع / ارجاع:',n.source||'');if(source===null)return;n.text=text.trim().slice(0,2000);n.source=source.trim().slice(0,180);n.updatedAt=new Date().toISOString();save();renderMemory();});
}

function renderGoals(){
 const s=appState(),box=$('arexWGoals');if(!box)return;
 if(!s.behaviorGoals.length){box.innerHTML='<p class="arex-w-muted">هنوز هدف رفتاری ثبت نشده است.</p>';return;}
 box.innerHTML=s.behaviorGoals.map(g=>`<article class="arex-w-goal"><div><strong>${esc(g.text)}</strong><small>هدف: ${g.target}% · پیشرفت ثبت‌شده: ${g.progress||0}%</small></div><input aria-label="درصد پیشرفت ${esc(g.text)}" type="number" min="0" max="100" value="${Number(g.progress)||0}" data-goal-progress="${esc(g.id)}"><button class="arex-w-btn secondary" data-goal-save="${esc(g.id)}">ذخیره</button><button class="arex-w-btn danger" data-goal-delete="${esc(g.id)}">حذف</button></article>`).join('');
 box.querySelectorAll('[data-goal-save]').forEach(b=>b.onclick=()=>{const g=s.behaviorGoals.find(x=>x.id===b.dataset.goalSave),inp=box.querySelector(`[data-goal-progress="${CSS.escape(b.dataset.goalSave)}"]`),v=num(inp.value);if(!g||v===null||v<0||v>100){toast('درصد باید بین ۰ تا ۱۰۰ باشد');return;}g.progress=v;g.updatedAt=new Date().toISOString();save();renderGoals();});
 box.querySelectorAll('[data-goal-delete]').forEach(b=>b.onclick=()=>{s.behaviorGoals=s.behaviorGoals.filter(x=>x.id!==b.dataset.goalDelete);save();renderGoals();});
}
function renderImageTools(){
 const sel=$('arexWTradeSelect'), list=trades().slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const current=sel.value;
 sel.innerHTML='<option value="">انتخاب معامله…</option>'+list.map(t=>`<option value="${esc(t.id)}">${esc(t.date||'بدون تاریخ')} · ${esc(t.symbol||'بدون نماد')} · ${esc(t.setup||'بدون استراتژی')}</option>`).join('');
 if(list.some(t=>String(t.id)===current))sel.value=current;
 const t=getTrade(sel.value); const s=appState();
 const renderShot=(kind,containerId)=>{
   const box=$(containerId); if(!box)return;
   const key=`tradeshot:${t?.id}:${kind}`;
   storage.get(key).then(row=>{
    if(!box.isConnected || String($('arexWTradeSelect').value)!==String(t?.id))return;
    if(row&&row.value){box.innerHTML=`<img class="arex-w-shot" src="${row.value}" alt="تصویر ${kind==='entry'?'قبل':'بعد'} معامله"><button class="arex-w-btn secondary" data-shot-download="${kind}">دریافت تصویر</button><button class="arex-w-btn danger" data-shot-delete="${kind}">حذف تصویر</button>`;
     box.querySelector('[data-shot-download]').onclick=()=>{const a=document.createElement('a');a.href=row.value;a.download=`arex-${t.id}-${kind}.png`;a.click();};
     box.querySelector('[data-shot-delete]').onclick=async()=>{if(!confirm('تصویر این معامله حذف شود؟'))return;await storage.set(key,'');box.innerHTML='';toast('تصویر حذف شد');};
    }else box.innerHTML='<p class="arex-w-muted">تصویری برای این مرحله ذخیره نشده است.</p>';
   }).catch(()=>{box.innerHTML='<p class="arex-w-muted">خواندن تصویر ناموفق بود.</p>';});
 };
 if(t){renderShot('entry','arexWEntryShot');renderShot('exit','arexWExitShot');$('arexWTradeContext').textContent=`${t.symbol||''} · ${t.date||''} · استراتژی: ${t.setup||'ثبت نشده'} · دلیل/یادداشت: ${t.note||'ثبت نشده'}`;}
 else {$('arexWEntryShot').innerHTML='';$('arexWExitShot').innerHTML='';$('arexWTradeContext').textContent='برای مشاهده ضمیمه‌ها یک معامله انتخاب کن.';}
}
async function attachImage(kind){
 const t=getTrade($('arexWTradeSelect').value),file=$('arexWImageFile').files[0];
 if(!t){toast('ابتدا معامله را انتخاب کن');return;}
 if(!file||!file.type.startsWith('image/')){toast('یک فایل تصویری معتبر انتخاب کن');return;}
 if(file.size>12*1024*1024){toast('حداکثر حجم تصویر ورودی ۱۲ مگابایت است');return;}
 try{
  const data=await new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const max=1600,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.82));};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تصویر قابل خواندن نیست'));};img.src=url;});
  await storage.set(`tradeshot:${t.id}:${kind}`,data);
  if(kind==='entry')t.hasShotEntry=true;else t.hasShotExit=true;
  queueSave('trades');$('arexWImageFile').value='';renderImageTools();toast('تصویر فشرده و به معامله متصل شد');
 }catch(e){toast('ذخیره تصویر ناموفق بود: '+e.message);}
}

async function downloadAnnotated(kind){
 const t=getTrade($('arexWTradeSelect').value);if(!t){toast('ابتدا معامله را انتخاب کن');return;}
 try{
  const row=await storage.get(`tradeshot:${t.id}:${kind}`);if(!row||!row.value){toast('برای این مرحله تصویری ثبت نشده است');return;}
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=row.value;});
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
  const lines=[
   `AREX V9.6.3 · ${kind==='entry'?'BEFORE TRADE':'AFTER TRADE'} · ${t.symbol||''} · ${t.date||''}`,
   `Entry: ${$('arexWMarkEntry').value.trim()||'—'}   SL: ${$('arexWMarkSL').value.trim()||'—'}   TP: ${$('arexWMarkTP').value.trim()||'—'}`,
   `Zones / notes: ${$('arexWMarkZones').value.trim()||'—'}`
  ];
  const size=Math.max(14,Math.round(c.width*.022)),pad=Math.round(size*.7),lineH=Math.round(size*1.5),height=pad*2+lineH*lines.length;
  ctx.save();ctx.fillStyle='rgba(8,15,30,.82)';ctx.fillRect(0,0,c.width,height);ctx.font=`600 ${size}px sans-serif`;ctx.textBaseline='top';
  lines.forEach((line,i)=>{ctx.fillStyle=i===0?'#8fe7d6':'#ffffff';ctx.fillText(line.slice(0,240),pad,pad+i*lineH,Math.max(20,c.width-pad*2));});
  ctx.restore();const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`AREX-${t.id}-${kind}-annotated.png`;a.click();
 }catch(e){toast('نشانه‌گذاری تصویر ناموفق بود');}
}

function renderSearch(){
 const q=$('arexWSearch').value||'',result=window.AREXExtended.semanticSearch(q,trades());
 $('arexWSearchCount').textContent=`${result.totalMatches??result.trades.length} معامله · فیلترها: ${result.filters.length?result.filters.map(f=>f.key+'='+f.value).join('، '):'بدون فیلتر صریح'} · ${result.explanation||''}`;
 $('arexWSearchResults').innerHTML=result.trades.slice(0,100).map(t=>`<article class="arex-w-result"><div><strong>${esc(t.symbol||'—')} · ${esc(t.date||'—')} ${esc(t.time||'')}</strong><small>${esc(t.setup||'بدون استراتژی')} · ${esc(t.note||'بدون یادداشت')}</small></div><span class="arex-w-blind">${$('arexWBlind').checked?'••••':(t.r===''||t.r==null?'R نامشخص':`${esc(t.r)}R`)}</span><button class="arex-w-btn secondary" data-open-trade="${esc(t.id)}">باز کردن معامله</button></article>`).join('')||'<p class="arex-w-muted">معامله‌ای مطابق فیلترهای قابل تشخیص پیدا نشد؛ عبارت را ساده‌تر کن یا فیلترها را حذف کن.</p>';
 $('arexWSearchResults').querySelectorAll('[data-open-trade]').forEach(b=>b.onclick=()=>{if(typeof window.editTrade==='function')window.editTrade(b.dataset.openTrade);else{goView('trades');toast('معامله را از فهرست ژورنال پیدا کن.');}});
}
let lastOhlcResult=null,lastOhlcBars=null;
function parseCsvRows(text){
 const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<4)throw Error('CSV باید حداقل یک سرستون و سه ردیف کندل داشته باشد.');
 const parseLine=line=>{const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){cur+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;};
 const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[ _-]/g,''));const find=names=>headers.findIndex(h=>names.includes(h));
 const ti=find(['time','timestamp','date','datetime','gmttime']);const oi=find(['open']);const hi=find(['high']);const li=find(['low']);const ci=find(['close']);if([oi,hi,li,ci].some(i=>i<0))throw Error('ستون‌های open, high, low, close در CSV پیدا نشدند.');
 return lines.slice(1).map((line,i)=>{const row=parseLine(line);return {time:ti>=0?(row[ti]||String(i)):String(i),open:row[oi],high:row[hi],low:row[li],close:row[ci]};});
}
function ohlcOptions(){return {fastPeriod:num($('arexWOhlcFast').value),slowPeriod:num($('arexWOhlcSlow').value),stopPct:num($('arexWOhlcSL').value),targetPct:num($('arexWOhlcTP').value),feeBps:num($('arexWOhlcFee').value),slippageBps:num($('arexWOhlcSlip').value),side:$('arexWOhlcSide').value};}
async function loadOhlc(){const file=$('arexWOhlcFile').files?.[0];if(!file)throw Error('ابتدا فایل CSV تاریخچه قیمت را انتخاب کن.');if(file.size>20*1024*1024)throw Error('حداکثر اندازه CSV برابر ۲۰ مگابایت است.');const rows=parseCsvRows(await file.text());lastOhlcBars=window.AREXCore.ohlcBacktest.normalizeBars(rows);return lastOhlcBars;}
function fmtNum(v,suffix=''){return v===null||v===undefined?'—':v===Infinity?'∞':Number(v).toFixed(2)+suffix;}
function renderOhlcResult(result,title){const box=$('arexWOhlcResults');if(result.metrics){const m=result.metrics;box.innerHTML=`<h4>${esc(title)}</h4><div class="arex-w-grid three"><div class="arex-w-stat"><span>تعداد معاملات</span><b>${m.count}</b></div><div class="arex-w-stat"><span>Win rate</span><b>${fmtNum(m.winRate,'%')}</b></div><div class="arex-w-stat"><span>Expectancy خالص</span><b>${fmtNum(m.expectancyR,'R')}</b></div><div class="arex-w-stat"><span>Net R</span><b>${fmtNum(m.netR,'R')}</b></div><div class="arex-w-stat"><span>Profit Factor</span><b>${fmtNum(m.profitFactor)}</b></div><div class="arex-w-stat"><span>بیشترین افت سرمایه</span><b>${fmtNum(m.maxDrawdownR,'R')}</b></div></div><p class="arex-w-muted">${result.bars} کندل بررسی شد. پارامترها: ${esc(JSON.stringify(result.parameters))}</p><ul class="arex-w-muted">${(result.limitations||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;}else{box.innerHTML=`<h4>${esc(title)}</h4>`+(result.folds||[]).map(f=>`<article class="arex-w-result"><div><strong>بخش ${f.fold} · ${esc(f.testStart)} تا ${esc(f.testEnd)}</strong><small>کندل‌های آزمون: ${f.testBars} · معاملات: ${f.tradeCount}</small><p>Net R: ${fmtNum(f.metrics.netR,'R')} · Expectancy: ${fmtNum(f.metrics.expectancyR,'R')} · Win rate: ${fmtNum(f.metrics.winRate,'%')} · Max DD: ${fmtNum(f.metrics.maxDrawdownR,'R')}</p></div></article>`).join('')+`<ul class="arex-w-muted">${(result.limitations||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;}}
async function runOhlc(walkForward=false){try{const bars=await loadOhlc(),opts=ohlcOptions(),engine=window.AREXCore.ohlcBacktest;let result;if(walkForward){result=engine.walkForward(bars, Object.assign({},opts,{folds:num($('arexWOhlcFolds').value)}));lastOhlcResult=null;$('arexWOhlcExport').disabled=true;renderOhlcResult(result,'Walk-Forward با پنجره آموزش گسترش‌یابنده');}else{result=engine.run(bars,opts);lastOhlcResult=result;$('arexWOhlcExport').disabled=!result.trades.length;renderOhlcResult(result,'نتیجه بک‌تست قیمت تاریخی');}}catch(e){$('arexWOhlcResults').innerHTML=`<p class="arex-w-error">${esc(e.message||'اجرای بک‌تست ناموفق بود.')}</p>`;}}
function exportOhlcTrades(){if(!lastOhlcResult)return;const cols=['entryTime','exitTime','side','entry','exit','reason','grossR','netR','entryIndex','exitIndex'];const cell=value=>{const raw=String(value??''),numeric=/^-?\d+(?:\.\d+)?$/.test(raw.trim()),safe=/^[\t\r\n ]*[=+\-@]/.test(raw)&&!numeric?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};const csv=[cols.map(cell).join(','),...lastOhlcResult.trades.map(t=>cols.map(k=>cell(t[k])).join(','))].join('\r\n');download('AREX-OHLC-backtest-trades.csv','\ufeff'+csv,'text/csv;charset=utf-8');}

function renderBacktest(){
 const box=$('arexWBacktestResults'); if(!box)return;
 box.innerHTML='<p class="arex-w-muted">نتایج آزمون با ترتیب زمانی داده‌ای که خودت وارد می‌کنی محاسبه می‌شوند؛ این ابزار داده قیمت یا معامله ساختگی تولید نمی‌کند.</p>';
}
function runBacktest(){
 const values=$('arexWRValues').value.split(/[\s,;\n\r]+/).map(x=>x.trim()).filter(Boolean).map(Number),cost=num($('arexWCostR').value)||0,pct=num($('arexWTrainPct').value)||70;
 const res=window.AREXExtended.walkForward(values,{costR:cost,trainPct:pct});
 const box=$('arexWBacktestResults');
 if(!res.ok){box.innerHTML=`<p class="arex-w-error">${esc(res.reason)}</p>`;return;}
 const fmt=x=>x===null?'—':x===Infinity?'∞':Number(x).toFixed(2);
 box.innerHTML=`<div class="arex-w-grid two"><div class="arex-w-stat"><span>نمونه آموزش</span><b>${res.train.n}</b><small>Expectancy ${fmt(res.train.expectancyR)}R · Win rate ${fmt(res.train.winRate)}%</small></div><div class="arex-w-stat"><span>خارج از نمونه</span><b>${res.outOfSample.n}</b><small>Expectancy ${fmt(res.outOfSample.expectancyR)}R · Win rate ${fmt(res.outOfSample.winRate)}%</small></div><div class="arex-w-stat"><span>Net R آموزش</span><b>${fmt(res.train.netR)}R</b></div><div class="arex-w-stat"><span>Net R خارج نمونه</span><b>${fmt(res.outOfSample.netR)}R</b></div></div><p class="arex-w-warn">${esc(res.warning)}</p>`;
}
function renderRisk(){
 const open=trades().filter(t=>t.status==='open'||t.closed===false||t.isOpen===true);
 const risk=window.AREXExtended.portfolioRisk(open);
 $('arexWRiskSummary').innerHTML=`<div class="arex-w-grid three"><div class="arex-w-stat"><span>معاملات باز تشخیص‌داده‌شده</span><b>${risk.positionCount}</b></div><div class="arex-w-stat"><span>ریسک قابل محاسبه</span><b>${risk.validCount?risk.totalRiskPct.toFixed(2)+'%':'نامشخص'}</b></div><div class="arex-w-stat"><span>ریسک ناقص</span><b>${risk.missingCount}</b></div></div><p class="arex-w-warn">${esc(risk.warning)}</p><p class="arex-w-muted">${risk.correlationStatus==='provided'?'هم‌بستگی از داده ورودی تأمین شده است.':'هم‌بستگی معتبر برای این موقعیت‌ها ثبت نشده؛ از جمع ریسک به‌عنوان ریسک نهایی سبد استفاده نکن.'}</p>`;
}
function renderPsych(){
 const out=window.AREXExtended.psychologySignals(trades(),state.dailyLogs||{});
 $('arexWPsych').innerHTML=(out.signals.length?out.signals.map(s=>`<article class="arex-w-signal ${esc(s.level)}"><strong>${esc(s.code.replaceAll('_',' '))}</strong><p>${esc(s.evidence)}</p><small>سطح هشدار: ${esc(s.level)} · شواهد: ${s.count}</small></article>`).join(''):'<p class="arex-w-muted">با داده‌های فعلی الگوی پرخطر کافی برای هشدار پیدا نشد. این به‌معنای نبود ریسک نیست؛ فقط شواهد ثبت‌شده کافی نیست.</p>')+`<p class="arex-w-muted">${esc(out.disclaimer)}</p>`;
}
function range(){
 const now=new Date(),end=now.toISOString().slice(0,10),start=new Date(now.getTime()-6*86400000).toISOString().slice(0,10);return {start,end};
}
function renderWeekly(){
 const r=range(),report=window.AREXExtended.weeklyReport(trades(),state.dailyLogs||{},r.start,r.end);
 $('arexWWeekly').innerHTML=`<div class="arex-w-grid three"><div class="arex-w-stat"><span>معاملات ۷ روز اخیر</span><b>${report.tradeCount}</b></div><div class="arex-w-stat"><span>گزارش روزانه تکمیل‌شده</span><b>${report.completedJournal}/${report.logs}</b></div><div class="arex-w-stat"><span>Expectancy</span><b>${report.performance.expectancyR===null?'—':report.performance.expectancyR.toFixed(2)+'R'}</b></div></div><p class="arex-w-muted">${esc(report.note)}</p><button class="arex-w-btn" id="arexWExportWeekly">خروجی گزارش هفتگی (JSON)</button>`;
 $('arexWExportWeekly').onclick=()=>download('arex-weekly-report.json',JSON.stringify(report,null,2),'application/json');
}
function download(name,data,type){
 const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Spreadsheet applications may evaluate CSV cells beginning with formula markers.
// Preserve ordinary numeric values (including negative P/L), but neutralize formula-like text.
function csvCell(value){
 const raw=String(value??'');
 const numeric=/^-?\d+(?:\.\d+)?$/.test(raw.trim());
 const safe=/^[\t\r\n ]*[=+\-@]/.test(raw)&&!numeric?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
async function exportData(kind){
 const s=appState(),payload={app:'AREX',version:'V9.7.9',exportedAt:new Date().toISOString(),kind,workspace:s,trades:trades(),dailyLogs:state.dailyLogs||{}};
 if(kind==='json'){payload.tradeImages={};for(const t of trades()){for(const k of ['entry','exit']){try{const row=await storage.get(`tradeshot:${t.id}:${k}`);if(row&&row.value)payload.tradeImages[`${t.id}:${k}`]=row.value;}catch(e){}}}download('AREX_V9.7.9-data-export.json',JSON.stringify(payload,null,2),'application/json');return;}
 const rows=trades(),cols=['id','date','time','symbol','dir','entry','sl','slOriginal','tp','exit','r','usd','riskPct','setup','ruleCompliance','emotionBefore','emotionAfter','note'];
 const csv=[cols.map(csvCell).join(','),...rows.map(t=>cols.map(c=>csvCell(Array.isArray(t[c])?t[c].join('|'):(t[c]??''))).join(','))].join('\r\n');
 download('AREX_V9.7.9-trades.csv','\ufeff'+csv,'text/csv;charset=utf-8');
}
function printReport(){window.print();}
function focusToggle(){
 const s=appState();s.focusMode=!s.focusMode;document.body.classList.toggle('arex-w-focus',s.focusMode);save();render();toast(s.focusMode?'حالت تمرکز فعال شد':'حالت تمرکز خاموش شد');
}

function isoWeekKey(d=new Date()){
 const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
 const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));return `${x.getUTCFullYear()}-W${String(Math.ceil((((x-yearStart)/86400000)+1)/7)).padStart(2,'0')}`;
}
async function enableWeeklyNotify(){
 if(!('Notification' in window)){toast('این مرورگر اعلان را پشتیبانی نمی‌کند');return;}
 try{const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted'){toast('اجازه اعلان داده نشد');return;}
 const s=appState();s.weeklyNotifyEnabled=true;save();toast('یادآوری گزارش هفتگی فعال شد؛ فقط هنگام باز بودن AREX بررسی می‌شود.');checkWeeklyNotify();
 }catch(e){toast('فعال‌سازی اعلان ناموفق بود');}
}
function checkWeeklyNotify(){
 const s=appState();if(!s.weeklyNotifyEnabled||!('Notification' in window)||Notification.permission!=='granted')return;
 const now=new Date();if(now.getDay()!==1)return;const key=isoWeekKey(now);if(s.lastWeeklyNoticeWeek===key)return;
 const r=range(),report=window.AREXExtended.weeklyReport(trades(),state.dailyLogs||{},r.start,r.end);
 if(!report.tradeCount&&!report.logs)return;
 try{new Notification('AREX · مرور هفتگی',{body:`${report.tradeCount} معامله ثبت‌شده؛ ${report.completedJournal}/${report.logs} مرور روزانه تکمیل شده. گزارش را در AREX باز کن.`});s.lastWeeklyNoticeWeek=key;save();}catch(e){}
}

function bind(){
 $('arexWSavePlan').onclick=savePlan;$('arexWAddGoal').onclick=addGoal;$('arexWMemoryAdd').onclick=addMemory;
 $('arexWTradeSelect').onchange=renderImageTools;
 $('arexWAttachEntry').onclick=()=>attachImage('entry');$('arexWAttachExit').onclick=()=>attachImage('exit');$('arexWMarkEntryShot').onclick=()=>downloadAnnotated('entry');$('arexWMarkExitShot').onclick=()=>downloadAnnotated('exit');
 $('arexWOhlcRun').onclick=()=>runOhlc(false);$('arexWOhlcWF').onclick=()=>runOhlc(true);$('arexWOhlcExport').onclick=exportOhlcTrades;
 $('arexWSearchBtn').onclick=renderSearch;$('arexWSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();renderSearch();}});
 $('arexWBlind').onchange=renderSearch;$('arexWRunBacktest').onclick=runBacktest;
 $('arexWFocusBtn').onclick=focusToggle;$('arexWWeeklyNotify').onclick=enableWeeklyNotify;$('arexWExportJson').onclick=()=>exportData('json');$('arexWExportCsv').onclick=()=>exportData('csv');$('arexWPrint').onclick=printReport;
 $('arexWRefresh').onclick=render;
}
window.AREXWorkspace={render,bind,savePlan};
document.addEventListener('DOMContentLoaded',()=>{try{bind();}catch(e){console.error('AREX workspace init failed',e);}});
})();
