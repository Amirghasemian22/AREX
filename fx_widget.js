/* ---- forex session converter widget (flags, open/close hours, now-pin, activity curve) ---- */
/* Colors are fixed hex values on purpose: theme variables get reassigned per accent theme. */
const SESSION_DEFS = [
  { id:'wellington', label:'Wellington', cityKey:'city.wellington', flag:'🇳🇿', tz:'Pacific/Auckland',  hours:[8,17], color:'#14B8A6', weight:0.20, major:false, def:false },
  { id:'sydney',     label:'Sydney',     cityKey:'city.sydney',     flag:'🇦🇺', tz:'Australia/Sydney',  hours:[7,16], color:'#3B5FCF', weight:0.35, major:true,  def:true  },
  { id:'tokyo',      label:'Tokyo',      cityKey:'city.tokyo',      flag:'🇯🇵', tz:'Asia/Tokyo',        hours:[9,18], color:'#A0007E', weight:0.55, major:true,  def:true  },
  { id:'hongkong',   label:'Hong Kong',  cityKey:'city.hongkong',   flag:'🇭🇰', tz:'Asia/Hong_Kong',    hours:[9,18], color:'#F97316', weight:0.45, major:false, def:false },
  { id:'frankfurt',  label:'Frankfurt',  cityKey:'city.frankfurt',  flag:'🇩🇪', tz:'Europe/Berlin',     hours:[8,17], color:'#EAB308', weight:0.70, major:false, def:false },
  { id:'london',     label:'London',     cityKey:'city.london',     flag:'🇬🇧', tz:'Europe/London',     hours:[8,17], color:'#3A96F5', weight:1.00, major:true,  def:true  },
  { id:'newyork',    label:'New York',   cityKey:'city.newyork',    flag:'🇺🇸', tz:'America/New_York',  hours:[8,17], color:'#52C41A', weight:0.95, major:true,  def:true  }
];
const FX_TZS = ['local','Asia/Tehran','UTC','Europe/London','Europe/Berlin','Europe/Istanbul','Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Pacific/Auckland','America/New_York','America/Chicago','America/Los_Angeles','America/Sao_Paulo'];
const FX_LOCALE = { fa:'fa-IR', en:'en-US', de:'de-DE' };
const FX_BIS_DAILY_USD = 9.6e12; // BIS Triennial Survey, April 2025: ~$9.6 trillion/day (OTC, net-net)

function getTzOffsetMinutes(tz, date){
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone:tz, hour12:false, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
  const parts = dtf.formatToParts(date).reduce((acc,p)=>{ acc[p.type]=p.value; return acc; },{});
  const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, +parts.hour===24?0:+parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - Math.floor(date.getTime()/1000)*1000)/60000);
}
function tzParts(tz, date){
  const f = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',weekday:'short'});
  const p = f.formatToParts(date).reduce((a,x)=>{ a[x.type]=x.value; return a; },{});
  const wdMap = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return { h:(+p.hour)%24, m:+p.minute, s:+p.second, wd:wdMap[p.weekday] };
}
function sessCfg(s){
  const c = (state.sessionCfg||{})[s.id] || {};
  return { show: c.show!==undefined ? !!c.show : s.def,
           start: c.start!==undefined ? +c.start : s.hours[0],
           end:   c.end!==undefined   ? +c.end   : s.hours[1] };
}
function sessHours(s){ const c = sessCfg(s); return [c.start, c.end]; }
function viewTz(){ return (state.sessionTz && state.sessionTz!=='local') ? state.sessionTz : Intl.DateTimeFormat().resolvedOptions().timeZone; }
function fmtClock(hFloat, h24){
  const total = Math.round((((hFloat%24)+24)%24)*60) % 1440;
  const hh = Math.floor(total/60), mm = total%60;
  if(h24) return faDigits(String(hh).padStart(2,'0'))+':'+faDigits(String(mm).padStart(2,'0'));
  return faDigits((hh%12)||12)+':'+faDigits(String(mm).padStart(2,'0'))+' '+(hh<12?'AM':'PM');
}
function fmtUtcOffset(min){
  const a = Math.abs(min), hh = Math.floor(a/60), mm = a%60;
  return 'UTC'+(min>=0?'+':'−')+faDigits(hh)+(mm?':'+faDigits(String(mm).padStart(2,'0')):'');
}
function fmtDur(ms){
  const mins = Math.max(0, Math.round(ms/60000)), d = Math.floor(mins/1440), h = Math.floor((mins%1440)/60), m = mins%60;
  const parts = [];
  if(d) parts.push(faDigits(d)+' '+t('fx.d'));
  if(h) parts.push(faDigits(h)+' '+t('fx.h'));
  if(m || !parts.length) parts.push(faDigits(m)+' '+t('fx.m'));
  return parts.join(' ');
}
/* the FX market is closed from Friday 22:00 UTC until Sunday 22:00 UTC */
function isForexWeekend(date){ const d = date.getUTCDay(), h = date.getUTCHours(); return (d===5 && h>=22) || d===6 || (d===0 && h<22); }
function msUntilForexOpen(date){
  const add = (7 - date.getUTCDay()) % 7;
  let ms = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()+add, 22, 0, 0) - date.getTime();
  if(ms < 0) ms += 7*864e5;
  return ms;
}
function smoothstep(a,b,x){ const u = Math.min(1, Math.max(0, (x-a)/(b-a))); return u*u*(3-2*u); }
function sessionBump(t0, s, e){
  if(e <= s) e += 24;
  const f = x => smoothstep(s-0.25, s+1, x) * (1 - smoothstep(e-1, e+0.25, x));
  return Math.max(f(t0), f(t0+24));
}
/* typical activity profile built from the (configurable) session windows — an estimate, not live data */
function buildActivity(tz, now){
  const vOff = getTzOffsetMinutes(tz, now);
  const diffs = {};
  SESSION_DEFS.forEach(s=>{ diffs[s.id] = (vOff - getTzOffsetMinutes(s.tz, now))/60; });
  const at = x => SESSION_DEFS.reduce((sum,s)=>{
    const [a,b] = sessHours(s);
    const local = (((x - diffs[s.id]) % 24) + 24) % 24;
    return sum + s.weight * sessionBump(local, a, b);
  }, 0);
  const samples = []; for(let i=0;i<=96;i++) samples.push(at(i*0.25));
  return { at, samples, max: Math.max(...samples, 0.0001) };
}
function activityLevel(frac){ return frac > 0.66 ? 'high' : frac > 0.33 ? 'med' : 'low'; }
const LEVEL_COLOR = { high:'#52C41A', med:'#F4C20D', low:'#D6336C' };

let fxLastKey = '';
function renderSessionWidget(now, force){
  const body = document.getElementById('fxBody'); if(!body) return;
  const tz = viewTz(), h24 = state.hour24 !== false;
  const key = tz+'|'+h24+'|'+state.language+'|'+JSON.stringify(state.sessionCfg||{})+'|'+Math.floor(now.getTime()/20000);
  if(!force && key === fxLastKey) return;
  fxLastKey = key;

  const vOff = getTzOffsetMinutes(tz, now);
  const vp = tzParts(tz, now);
  const nowH = vp.h + vp.m/60 + vp.s/3600;
  const weekend = isForexWeekend(now);
  const loc = FX_LOCALE[state.language] || 'en-US';
  const small = window.innerWidth < 700, step = small ? 3 : 1;

  let axis = '<div class="fx-axis"><div></div><div class="fx-axis-area">'+
    '<span class="fx-ico" style="left:'+(6/24*100)+'%">☀️</span><span class="fx-ico" style="left:'+(18/24*100)+'%">🌙</span>';
  for(let hr=0; hr<=24; hr+=step){
    const lbl = h24 ? faDigits(hr) : (hr%12===0 ? (hr%24===0 ? faDigits(12)+'a' : faDigits(12)+'p') : faDigits(hr%12));
    axis += '<span class="fx-hr" style="left:'+(hr/24*100)+'%">'+lbl+'</span>';
  }
  axis += '</div></div>';

  let rows = '', anyOpen = false, deltas = [];
  SESSION_DEFS.filter(s=>sessCfg(s).show).forEach(s=>{
    const c = sessCfg(s), sOff = getTzOffsetMinutes(s.tz, now), diff = (vOff - sOff)/60;
    let st = (((c.start + diff) % 24) + 24) % 24, en = (((c.end + diff) % 24) + 24) % 24;
    const segs = (c.end - c.start) >= 24 ? [[0,24]] : (st <= en ? [[st,en]] : [[st,24],[0,en]]);
    const sp = tzParts(s.tz, now), sh = sp.h + sp.m/60;
    const inWin = c.start < c.end ? (sh >= c.start && sh < c.end) : (sh >= c.start || sh < c.end);
    const open = !weekend && sp.wd >= 1 && sp.wd <= 5 && inWin;
    if(open) anyOpen = true;
    [st,en].forEach(x=>{ let d = (x - nowH + 24) % 24; if(d < 0.01) d = 24; deltas.push(d); });
    const bars = segs.map(([a,b])=>'<div class="fx-bar'+(open?'':' closed')+'" style="left:'+(a/24*100)+'%;width:'+((b-a)/24*100)+'%;background:'+s.color+'"></div>').join('');
    const dateTxt = now.toLocaleDateString(loc,{timeZone:s.tz,weekday:'short',month:'short',day:'numeric'})+' · '+fmtUtcOffset(sOff);
    rows += '<div class="fx-row"><div class="fx-info"><span class="fx-flag">'+s.flag+'</span><div class="fx-info-txt">'+
      '<div class="fx-city">'+t(s.cityKey)+'</div>'+
      '<div class="fx-time">'+fmtClock(sh, h24)+'</div>'+
      '<div class="fx-date">'+dateTxt+'</div>'+
      '<div class="fx-hours"><span class="fx-w">'+t('fx.openLbl')+' </span>▲ <b>'+fmtClock(c.start+diff, h24)+'</b> &nbsp;<span class="fx-w">'+t('fx.closeLbl')+' </span>▼ <b>'+fmtClock(c.end+diff, h24)+'</b></div>'+
      '</div></div>'+
      '<div class="fx-track"><div class="fx-lbl" style="color:'+s.color+'">'+t(s.cityKey)+' '+t('fx.session')+' '+(open?t('fx.open'):t('fx.closed'))+'</div>'+bars+'</div></div>';
  });
  if(!rows) rows = '<div class="empty">'+t('fx.noneSelected')+'</div>';

  const prof = buildActivity(tz, now);
  const pts = prof.samples.map((v,i)=>[(i/96*1000).toFixed(1), (92 - (v/prof.max)*76).toFixed(1)]);
  const path = 'M'+pts.map(p=>p.join(',')).join(' L');
  const nowVal = prof.at(nowH), frac = nowVal/prof.max, lvl = activityLevel(frac);
  const nowY = 92 - frac*76;
  const dots = ['high','med','low'].map(k=>'<i style="background:'+(k===lvl?LEVEL_COLOR[k]:'var(--border)')+'"></i>').join('');
  const lvlWord = t('fx.vol_'+lvl);
  const vol = '<div class="fx-vol"><div class="fx-vol-txt">'+t('fx.volIntro')+' <b style="color:'+LEVEL_COLOR[lvl]+'">'+lvlWord+'</b> '+t('fx.volOutro')+
    '<div><span class="fx-pill"><i style="background:'+LEVEL_COLOR[lvl]+'"></i>'+lvlWord+'</span></div></div>'+
    '<div class="fx-vol-chart"><svg viewBox="0 0 1000 100" preserveAspectRatio="none"><defs><linearGradient id="fxGrad" gradientUnits="userSpaceOnUse" x1="0" y1="16" x2="0" y2="92">'+
    '<stop offset="0" stop-color="#52C41A"/><stop offset=".45" stop-color="#F4C20D"/><stop offset=".75" stop-color="#F08A24"/><stop offset="1" stop-color="#D6336C"/></linearGradient></defs>'+
    '<path d="'+path+'" fill="none" stroke="url(#fxGrad)" stroke-width="3.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
    '<div class="fx-light" style="left:'+(nowH/24*100)+'%;top:'+nowY+'%">'+dots+'</div></div></div>';

  const pct = nowH/24*100;
  const dayName = now.toLocaleDateString(loc,{timeZone:tz,weekday:'long'});
  const overlay = '<div class="fx-overlay"><div class="fx-now" style="left:'+pct+'%"></div>'+
    '<div class="fx-pin" style="left:clamp(8%,'+pct+'%,92%)">🕒 '+fmtClock(nowH,h24)+'<small>'+dayName+'</small></div></div>';

  body.innerHTML = axis + rows + vol + overlay;

  const wk = document.getElementById('fxWeekend'), cd = document.getElementById('sessionCountdown');
  if(weekend){
    const dur = fmtDur(msUntilForexOpen(now));
    wk.style.display = 'block'; wk.textContent = '🔒 '+t('fx.weekend')+' — '+t('fx.reopensIn')+' '+dur;
    if(cd) cd.textContent = '🔴 '+t('fx.allClosed')+' — '+t('fx.reopensIn')+' '+dur;
  } else {
    wk.style.display = 'none';
    const next = deltas.length ? Math.min(...deltas) : 0;
    const dur = fmtDur(next*3600000);
    if(cd) cd.textContent = anyOpen ? '🟢 '+t('fx.someOpen')+' — '+t('fx.nextChange')+' '+dur : '🔴 '+t('fx.allClosed')+' — '+t('fx.nextOpen')+' '+dur;
  }
  renderFxVolume(now);
}

function fillTzSelect(){
  const sel = document.getElementById('fxTzSelect'); if(!sel) return;
  const now = new Date();
  sel.innerHTML = FX_TZS.map(z=>{
    if(z==='local'){
      const dz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return '<option value="local">'+t('fx.deviceTz')+' — '+dz.split('/').pop().replace(/_/g,' ')+' ('+fmtUtcOffset(getTzOffsetMinutes(dz, now))+')</option>';
    }
    return '<option value="'+z+'">'+z.split('/').pop().replace(/_/g,' ')+' ('+fmtUtcOffset(getTzOffsetMinutes(z, now))+')</option>';
  }).join('');
  sel.value = state.sessionTz || 'local';
  const lbl = document.getElementById('fxH24Lbl'); if(lbl) lbl.textContent = t('fx.h24');
  const cb = document.getElementById('fxH24'); if(cb) cb.checked = state.hour24 !== false;
}
document.getElementById('fxTzSelect').addEventListener('change', e=>{ state.sessionTz = e.target.value; queueSave('settings'); renderSessionWidget(new Date(), true); });
document.getElementById('fxH24').addEventListener('change', e=>{ state.hour24 = e.target.checked; queueSave('settings'); renderSessionWidget(new Date(), true); renderFxSettings(); });

function renderFxSettings(){
  const box = document.getElementById('fxSettingsList'); if(!box) return;
  box.innerHTML = SESSION_DEFS.map(s=>{
    const c = sessCfg(s);
    return '<div class="fx-set-row"><label class="switch"><input type="checkbox" data-sid="'+s.id+'" data-k="show" '+(c.show?'checked':'')+'><span class="slider"></span></label>'+
      '<span class="fx-set-name">'+s.flag+' '+t(s.cityKey)+'<small>'+s.tz.split("/").pop().replace(/_/g," ")+'</small></span>'+
      '<span class="fx-set-hrs"><span>'+t('fx.openLbl')+'</span><input type="number" min="0" max="24" step="0.5" data-sid="'+s.id+'" data-k="start" value="'+c.start+'">'+
      '<span>'+t('fx.closeLbl')+'</span><input type="number" min="0" max="24" step="0.5" data-sid="'+s.id+'" data-k="end" value="'+c.end+'"></span></div>';
  }).join('');
  box.querySelectorAll('input[data-sid]').forEach(inp=>inp.addEventListener('change', e=>{
    const id = e.target.dataset.sid, k = e.target.dataset.k;
    state.sessionCfg = state.sessionCfg || {};
    state.sessionCfg[id] = Object.assign({}, state.sessionCfg[id]);
    if(k==='show') state.sessionCfg[id].show = e.target.checked;
    else { let v = parseFloat(e.target.value); if(isNaN(v)) v = SESSION_DEFS.find(x=>x.id===id).hours[k==='start'?0:1]; state.sessionCfg[id][k] = Math.min(24, Math.max(0, v)); e.target.value = state.sessionCfg[id][k]; }
    queueSave('settings'); renderSessionWidget(new Date(), true);
  }));
}
document.getElementById('fxResetBtn').addEventListener('click', ()=>{ state.sessionCfg = {}; queueSave('settings'); renderFxSettings(); renderSessionWidget(new Date(), true); });

function setGauge(arcId, valId, val, color){
  const arc = document.getElementById(arcId), v = document.getElementById(valId);
  if(v) v.textContent = faDigits(val);
  if(arc){ arc.setAttribute('stroke-dasharray', ((val/100)*170)+' 170'); arc.setAttribute('stroke', color); }
}
let fxMoodCache = { t:0, pct:null, asOf:'' };
async function fetchFxMood(force){
  const lbl = document.getElementById('fxmLabel'), note = document.getElementById('fxmNote');
  try{
    if(force || fxMoodCache.pct===null || Date.now()-fxMoodCache.t > 3600e3){
      const end = new Date(), start = new Date(end.getTime() - 18*864e5), iso = d=>d.toISOString().slice(0,10);
      let data = null;
      for(const base of ['https://api.frankfurter.dev/v1','https://api.frankfurter.app']){
        try{ const r = await fetch(base+'/'+iso(start)+'..'+iso(end)+'?base=AUD&symbols=JPY'); if(!r.ok) throw new Error('http'); data = await r.json(); break; }catch(e){}
      }
      if(!data || !data.rates) throw new Error('no data');
      const days = Object.keys(data.rates).sort();
      if(days.length < 4) throw new Error('short');
      const last = data.rates[days[days.length-1]].JPY, prev = data.rates[days[Math.max(0, days.length-6)]].JPY;
      fxMoodCache = { t:Date.now(), pct:(last/prev-1)*100, asOf:days[days.length-1] };
    }
    const pct = fxMoodCache.pct, val = Math.round(Math.max(0, Math.min(100, 50 + pct*(50/3))));
    const k = val<=20?'mood0' : val<=42?'mood1' : val<=58?'mood2' : val<=80?'mood3' : 'mood4';
    setGauge('fxmArc','fxmValue', val, val<=42?'var(--red)':val<=58?'var(--muted)':'var(--green)');
    lbl.textContent = t('ind.'+k);
    note.textContent = 'AUD/JPY '+(pct>=0?'+':'')+pct.toFixed(2)+'% (5d) · ECB '+fxMoodCache.asOf+' — '+t('ind.fxMoodNote');
  }catch(e){
    document.getElementById('fxmValue').textContent = '—'; lbl.textContent = t('tk.failed'); note.textContent = t('tk.failedHint');
  }
}
function fmtBig(n){ return n>=1e12 ? (n/1e12).toFixed(2)+'T' : n>=1e9 ? (n/1e9).toFixed(1)+'B' : n>=1e6 ? (n/1e6).toFixed(1)+'M' : Math.round(n)+''; }
async function fetchCryptoGlobal(){
  const note = document.getElementById('cvNote');
  try{
    const r = await fetch('https://api.coingecko.com/api/v3/global', { cache:'no-store' });
    if(!r.ok) throw new Error('http '+r.status);
    const j = (await r.json()).data;
    const chg = j.market_cap_change_percentage_24h_usd;
    document.getElementById('cvVol').textContent = '$'+fmtBig(j.total_volume.usd);
    document.getElementById('cvCap').textContent = '$'+fmtBig(j.total_market_cap.usd);
    document.getElementById('cvDom').textContent = j.market_cap_percentage.btc.toFixed(1)+'%';
    const c = document.getElementById('cvChg'); c.textContent = (chg>=0?'+':'')+chg.toFixed(2)+'%'; c.style.color = chg>=0 ? 'var(--green)' : 'var(--red)';
    note.textContent = t('ind.updated')+' '+new Date().toLocaleTimeString()+' · CoinGecko';
  }catch(e){ document.getElementById('cvVol').textContent = '—'; note.textContent = t('tk.failed'); }
}
function renderFxVolume(now){
  const el = document.getElementById('fvHour'); if(!el) return;
  const prof = buildActivity('UTC', now), nowH = now.getUTCHours() + now.getUTCMinutes()/60;
  let sum = 0; for(let i=0;i<96;i++) sum += prof.at(i*0.25)*0.25;
  const val = prof.at(nowH), perHour = FX_BIS_DAILY_USD * (val/sum), lvl = activityLevel(val/prof.max);
  el.textContent = '≈ $'+fmtBig(perHour)+' / '+t('ind.hr');
  const lv = document.getElementById('fvLevel'); lv.textContent = t('fx.vol_'+lvl); lv.style.color = LEVEL_COLOR[lvl];
}

