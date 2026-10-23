/* AREX V9.6.3 — ui/analytics: renders the performance center sections on top of js/core (no business logic here).
   Globals used from the host page: state, storage, escapeHtml, faDigits, goView, toast, V9T (js/i18n/v9.js). All dynamic text goes through escapeHtml. */
(function () {
  const C = () => window.AREXCore;
  const esc = v => escapeHtml(v == null ? '' : String(v));
  const fa = v => (typeof faDigits === 'function') ? faDigits(String(v)) : String(v);
  const pct = x => x === null || x === undefined ? '—' : fa((x * 100).toFixed(1)) + '%';
  const num = (x, d = 2) => x === null || x === undefined ? '—' : fa(Number(x).toFixed(d));
  const WDF = () => [6, 0, 1, 2, 3, 4, 5].map(k => ({ k, l: V9T('wd.' + k) }));
  const view = { tab: 'symbol', heat: 'totalR', cfg: null, drill: null };
  let lastTrades = [], renderSeq = 0;

  async function loadCfg() {
    if (window.__arexGuardCfg) return (view.cfg = window.__arexGuardCfg);   // single shared source for analytics, prop guard and pre-trade gate
    if (view.cfg) return view.cfg;
    try { const r = await storage.get('guardCfg'); view.cfg = r && r.value ? JSON.parse(r.value) : {}; } catch (e) { view.cfg = {}; }
    window.__arexGuardCfg = view.cfg;
    return view.cfg;
  }
  async function saveCfg(cfg) { view.cfg = cfg; window.__arexGuardCfg = cfg; try { await storage.set('guardCfg', JSON.stringify(cfg)); } catch (e) { toast(V9T('a.saveFailed')); } }

  function ensureContainers() {
    const host = document.getElementById('view-analytics'); if (!host || document.getElementById('arexV9Extra')) return;
    const d = document.createElement('div'); d.id = 'arexV9Extra';
    d.innerHTML = '<div class="arex-v9-grid">' +
      '<section class="card" id="v9Heat"></section><section class="card" id="v9Drill" style="display:none"></section>' +
      '<section class="card" id="v9Errors"></section><section class="card" id="v9Alerts"></section><section class="card" id="v9RiskState"></section>' +
      '<section class="card" id="v9Quality"></section><section class="card" id="v9Diagnostics"></section><section class="card" id="v9Cfg"></section></div>';
    host.appendChild(d);
  }
  const badge = c => '<span class="v9-badge v9-' + esc(c) + '">' + V9T('conf.' + c) + '</span>';
  /* Core modules return stable ids/codes + params; text is translated here. */
  const tr = (key, fallback, params) => { const s = V9T(key, params); return s === key ? (fallback || key) : s; };

  /* ---------- KPIs ---------- */
  function renderKpis(s) {
    const el = document.getElementById('arexAnalyticsKpis'); if (!el) return;
    const low = s.lowSample && s.counted ? '<div class="v9-warn">' + V9T('a.lowSample', { n: fa(s.counted), min: fa(s.minSample) }) + '</div>' : '';
    const k = (l, v, sub) => '<div class="arex-kpi"><span class="label">' + l + '</span><strong>' + v + '</strong><small>' + sub + '</small></div>';
    const none = V9T('a.noData');
    el.innerHTML = k(V9T('a.kpiCounted'), fa(s.counted), s.excluded ? V9T('a.excluded', { n: fa(s.excluded) }) : V9T('a.ofTotal', { n: fa(s.total) })) +
      k(V9T('a.kpiWinRate'), s.winRate === null ? none : pct(s.winRate), V9T('a.winLossBE', { w: fa(s.wins), l: fa(s.losses), b: fa(s.breakeven) })) +
      k(V9T('a.kpiExpectancy'), s.expectancyR === null ? none : num(s.expectancyR), V9T('a.expSub', { n: fa(s.rSample) })) +
      k('Profit Factor', s.profitFactor === null ? none : num(s.profitFactor), s.profitFactor === null ? V9T('a.pfUndefined') : V9T('a.basis', { b: esc(s.profitFactorBasis) })) +
      k(V9T('a.kpiDD'), s.drawdownR.max ? num(s.drawdownR.max) + ' R' : (s.drawdownUsd.max ? num(s.drawdownUsd.max) + ' $' : '—'), s.drawdownR.pctOfPeak !== null ? V9T('a.ddPct', { p: pct(s.drawdownR.pctOfPeak) }) : V9T('a.ddCum')) +
      k(V9T('a.kpiTotal'), (s.rSample ? num(s.totalR) + ' R' : '—') + ' / ' + (s.totalUsd !== null && s.excluded < s.total ? num(s.totalUsd) + ' $' : '—'), V9T('a.totalSub')) +
      '<div style="grid-column:1/-1">' + low + '<details class="v9-details"><summary>' + V9T('a.formulasTitle') + '</summary><div>' + V9T('a.formulas') + '</div></details></div>';
  }

  /* ---------- groups ---------- */
  function renderGroups(trades, opts) {
    const box = document.getElementById('arexAnalyticsBreakdown'); if (!box) return;
    const A = C().analytics, wd = WDF();
    const sets = { symbol: A.bySymbol(trades, opts), strategy: A.byStrategy(trades, opts), session: A.bySession(trades, opts),
      weekday: A.byWeekday(trades, opts).map(g => Object.assign({}, g, { key: (wd.find(w => String(w.k) === g.key) || {}).l || g.key })) };
    const tabs = [['symbol', V9T('a.tabSymbol')], ['strategy', V9T('a.tabStrategy')], ['session', V9T('a.tabSession')], ['weekday', V9T('a.tabWeekday')]];
    const rows = sets[view.tab];
    const unk = '(' + V9T('a.unknown') + ')';
    box.innerHTML = '<div class="v9-tabs" role="tablist">' + tabs.map(t => '<button type="button" class="chip' + (view.tab === t[0] ? ' active' : '') + '" data-v9tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      (rows.length ? '<div style="overflow-x:auto"><table class="imp-table"><tr><th>' + V9T('a.colGroup') + '</th><th>' + V9T('a.colCount') + '</th><th>' + V9T('a.kpiWinRate') + '</th><th>' + V9T('a.colExpR') + '</th><th>PF</th><th>' + V9T('a.colTotalR') + '</th><th></th></tr>' +
        rows.slice(0, 30).map((g, i) => '<tr><td>' + esc(g.key === '(نامشخص)' ? unk : g.key) + '</td><td>' + fa(g.counted) + '</td><td>' + pct(g.winRate) + '</td><td>' + num(g.expectancyR) + '</td><td>' + num(g.profitFactor) + '</td><td>' + (g.rSample ? num(g.totalR) : '—') + '</td><td>' +
          (g.lowSample ? '<span class="v9-badge v9-low" title="' + esc(V9T('a.lowSampleTip', { min: fa(g.minSample) })) + '">' + V9T('a.lowSampleBadge') + '</span> ' : '') + '<button type="button" class="chip" data-v9grp="' + i + '">' + V9T('a.trades') + '</button></td></tr>').join('') + '</table></div>'
        : '<div class="empty">' + V9T('a.noGroupData') + '</div>');
    box.querySelectorAll('[data-v9tab]').forEach(b => b.addEventListener('click', () => { view.tab = b.dataset.v9tab; renderGroups(trades, opts); }));
    box.querySelectorAll('[data-v9grp]').forEach(b => b.addEventListener('click', () => { const g = rows[+b.dataset.v9grp]; showDrill(V9T('a.groupTitle', { g: g.key }), g.tradeIds); }));
  }

  /* ---------- heatmap ---------- */
  function renderHeat(trades, opts) {
    const box = document.getElementById('v9Heat'); if (!box) return;
    const h = C().analytics.heatmap(trades, opts), wd = WDF();
    const title = '<div class="section-title">' + V9T('a.heatTitle') + '</div>';
    if (!h.cells.length) { box.innerHTML = title + '<div class="empty">' + V9T('a.heatEmpty') + (h.unplaced ? ' ' + V9T('a.heatUnplacedShort', { n: fa(h.unplaced) }) : '') + '</div>'; return; }
    const hours = h.cells.map(c => c.hour), h0 = Math.min(...hours), h1 = Math.max(...hours);
    const val = c => view.heat === 'winRate' ? c.winRate : view.heat === 'count' ? c.n : c.totalR;
    const maxAbs = Math.max(0.0001, ...h.cells.map(c => Math.abs(val(c) || 0)));
    const map = {}; h.cells.forEach(c => map[c.weekday + '-' + c.hour] = c);
    let head = '<tr><th></th>'; for (let x = h0; x <= h1; x++) head += '<th>' + fa(x) + '</th>'; head += '</tr>';
    let body = wd.map(w => { let r = '<tr><th>' + w.l + '</th>'; for (let x = h0; x <= h1; x++) { const c = map[w.k + '-' + x];
      if (!c) { r += '<td class="v9-hc empty"></td>'; continue; }
      const v = val(c) || 0; let bg;
      if (view.heat === 'winRate') bg = 'rgba(' + (v >= 0.5 ? '40,190,120' : '230,80,80') + ',' + (0.2 + Math.abs(v - 0.5) * 1.4).toFixed(2) + ')';
      else if (view.heat === 'count') bg = 'rgba(120,150,255,' + (0.15 + v / maxAbs * 0.6).toFixed(2) + ')';
      else bg = 'rgba(' + (v > 0 ? '40,190,120' : v < 0 ? '230,80,80' : '140,140,140') + ',' + (0.18 + Math.abs(v) / maxAbs * 0.62).toFixed(2) + ')';
      r += '<td class="v9-hc' + (c.lowSample ? ' low' : '') + '" style="background:' + bg + '" data-cell="' + c.weekday + '-' + c.hour + '" title="' + esc(w.l + ' ' + V9T('a.hourWord') + ' ' + x + ' · n=' + c.n) + '" tabindex="0" role="button">' + fa(c.n) + '</td>'; }
      return r + '</tr>'; }).join('');
    box.innerHTML = title + '<div class="section-sub">' + V9T('a.heatSub') + '</div>' +
      '<div class="v9-tabs"><select class="txt-input" id="v9HeatMetric" aria-label="' + esc(V9T('a.heatMetric')) + '"><option value="totalR"' + (view.heat === 'totalR' ? ' selected' : '') + '>' + V9T('a.heatByTotal') + '</option><option value="winRate"' + (view.heat === 'winRate' ? ' selected' : '') + '>' + V9T('a.heatByWin') + '</option><option value="count"' + (view.heat === 'count' ? ' selected' : '') + '>' + V9T('a.heatByCount') + '</option></select></div>' +
      '<div style="overflow-x:auto"><table class="v9-heat">' + head + body + '</table></div>' + (h.unplaced ? '<div class="imp-note">' + V9T('a.heatUnplaced', { n: fa(h.unplaced) }) + '</div>' : '');
    document.getElementById('v9HeatMetric').addEventListener('change', e => { view.heat = e.target.value; renderHeat(trades, opts); });
    const open = el => { const c = map[el.dataset.cell]; showDrill('Heatmap · ' + (wd.find(w => w.k === c.weekday) || {}).l + ' ' + V9T('a.hourWord') + ' ' + fa(c.hour), c.tradeIds); };
    box.querySelectorAll('[data-cell]').forEach(el => { el.addEventListener('click', () => open(el)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } }); });
  }

  /* ---------- drill-down to real records ---------- */
  function showDrill(title, ids) {
    const box = document.getElementById('v9Drill'); if (!box) return;
    const set = new Set(ids), list = (state.trades || []).filter(t => set.has(t.id));
    view.drill = { title, ids };
    box.style.display = 'block';
    box.innerHTML = '<div class="section-title" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>' + esc(title) + ' · ' + V9T('a.nTrades', { n: fa(list.length) }) + '</span><button type="button" class="chip" id="v9DrillClose">' + V9T('a.close') + '</button></div>' +
      '<div style="overflow-x:auto"><table class="imp-table"><tr><th>' + V9T('a.colDate') + '</th><th>' + V9T('a.tabSymbol') + '</th><th>' + V9T('a.colDir') + '</th><th>R</th><th>' + V9T('a.colUsd') + '</th><th>' + V9T('a.tabStrategy') + '</th><th></th></tr>' +
      list.map(t => '<tr><td>' + esc(t.date) + (t.time ? ' ' + esc(t.time) : '') + '</td><td>' + esc(t.symbol) + '</td><td>' + (t.dir === 'buy' ? V9T('a.buy') : V9T('a.sell')) + '</td><td>' + esc(t.r || '—') + '</td><td>' + esc(t.usd || '—') + '</td><td>' + esc(t.setup || '—') + '</td><td><button type="button" class="chip" data-v9open="' + esc(t.id) + '">' + V9T('a.openInJournal') + '</button></td></tr>').join('') + '</table></div>';
    document.getElementById('v9DrillClose').addEventListener('click', () => { box.style.display = 'none'; });
    box.querySelectorAll('[data-v9open]').forEach(b => b.addEventListener('click', () => openTrade(b.dataset.v9open)));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function openTrade(id) {
    goView('trades');
    setTimeout(() => { const btn = document.querySelector('#tradesList [data-edit-id="' + CSS.escape(String(id)) + '"]'); const card = btn && btn.closest('.entry-card');
      if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('v9-flash'); setTimeout(() => card.classList.remove('v9-flash'), 2200); } else toast(V9T('a.tradeNotInList')); }, 150);
  }

  /* ---------- errors / risk-state / quality ---------- */
  function renderErrors(trades, cfg) {
    const box = document.getElementById('v9Errors'); if (!box) return;
    const d = C().errors.detect(trades, { maxTradesPerDay: cfg.maxTradesPerDay, maxRiskPct: cfg.maxRiskPct });
    const rows = d.findings.map((f, i) => '<div class="v9-find"><div class="v9-find-h"><b>' + esc(tr('e.l.' + f.id, f.label)) + '</b>' + badge(f.confidence) + '</div>' +
      '<div class="v9-find-b">' + V9T('a.findCount', { n: fa(f.count), p: pct(f.frequency), t: fa(d.total) }) + ' · ' + esc(f.firstDate || '') + ' → ' + esc(f.lastDate || '') + '</div>' +
      '<div class="v9-find-b">' + V9T('a.estCost') + ' ' + (f.estCostR !== null && f.estCostR !== 0 ? num(f.estCostR) + ' R' : '—') + (f.estCostUsd !== null && f.estCostUsd !== 0 ? ' · ' + num(f.estCostUsd) + ' $' : '') + '</div>' +
      '<div class="v9-find-b">' + V9T('a.errLossMetrics', { loss: f.lossRate === null ? '—' : pct(f.lossRate), avg: f.avgR === null ? '—' : num(f.avgR) }) + ' · ' + V9T(f.sampleAdequate ? 'a.errSampleAdequate' : 'a.errSampleLimited') + '</div>' +
      '<div class="v9-find-b v9-muted">' + V9T('a.basisLbl') + ' ' + esc(tr('e.ev.' + (f.id.indexOf('tag:') === 0 ? 'tag' : f.id), f.evidence, f.evParams)) + '</div><button type="button" class="chip" data-v9find="' + i + '">' + V9T('a.showTrades') + '</button></div>').join('');
    box.innerHTML = '<div class="section-title">' + V9T('a.errTitle') + '</div><div class="section-sub">' + V9T('a.errSub') + '</div><div class="imp-note">تکراری: ' + fa(d.summary.repeatedFindings) + ' · تک‌موردی: ' + fa(d.summary.singleOccurrenceFindings) + ' · هشدارهای با اطمینان کم: ' + fa(d.summary.lowConfidenceFindings) + '</div>' + (rows || '<div class="empty">' + (d.total ? V9T('a.errNone') : V9T('a.errNoTrades')) + '</div>') +
      '<details class="v9-details"><summary>' + V9T('a.errCannot', { n: fa(d.needsInfo.length) }) + '</summary><ul>' + d.needsInfo.map(n => '<li>' + esc(tr('e.n.' + n.id, n.need, n.p)) + '</li>').join('') + '</ul></details>';
    box.querySelectorAll('[data-v9find]').forEach(b => b.addEventListener('click', () => { const f = d.findings[+b.dataset.v9find]; showDrill(tr('e.l.' + f.id, f.label), f.tradeIds); }));
  }
  function isoDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  async function renderActionableAlerts(trades, cfg) {
    const box=document.getElementById('v9Alerts'); if(!box||!C().alertEngine)return;
    const now=new Date(), today=isoDate(now), weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); const monday=isoDate(weekStart);
    const period=box.dataset.period||'week'; const scoped=period==='day'?trades.filter(t=>String(t.date||'').slice(0,10)===today):period==='week'?trades.filter(t=>String(t.date||'').slice(0,10)>=monday&&String(t.date||'').slice(0,10)<=today):trades;
    const d=C().errors.detect(scoped,{maxTradesPerDay:cfg.maxTradesPerDay,maxRiskPct:cfg.maxRiskPct});
    const risk=C().riskstate.evaluate(scoped); const all=d.findings.concat(risk.alerts.map(a=>({id:'risk:'+a.id,label:a.label,count:a.value,confidence:a.confidence,evidence:a.evidence,tradeIds:a.tradeIds,firstDate:null,lastDate:null})));
    const rules=cfg.alertThresholds||{}; const result=C().alertEngine.evaluate(all,{rules,cooldownHours:cfg.alertCooldownHours}, {}, Date.now());
    const options=[['day','امروز'],['week','این هفته'],['all','همه داده‌ها']].map(([v,l])=>'<option value="'+v+'"'+(period===v?' selected':'')+'>'+l+'</option>').join('');
    const rows=all.map((f,i)=>{const r=rules[f.id]||{};const state=result.alerts.find(a=>a.id===f.id)?'<span class="v9-badge v9-medium">فعال</span>':(r.enabled?'تنظیم شده':'نیازمند تنظیم');return '<div class="v9-find"><div class="v9-find-h"><b>'+esc(f.label||f.id)+'</b>'+state+'</div><div class="v9-find-b">دفعات ثبت‌شده: '+fa(f.count||f.value||0)+' · '+esc(f.evidence||'شواهد ژورنال')+'</div><div class="imp-row"><label class="imp-map-item"><span>آستانه فعال‌سازی (تعیین‌شده توسط تو)</span><input class="txt-input" type="number" min="1" step="1" data-alert-threshold="'+esc(f.id)+'" value="'+esc(r.minCount??'')+'" placeholder="مثلاً ۳"></label><label class="imp-map-item"><span><input type="checkbox" data-alert-enabled="'+esc(f.id)+'" '+(r.enabled===true?'checked':'')+'> فعال</span></label><button type="button" class="chip" data-alert-trades="'+i+'">مشاهده معاملات مستندکننده</button></div></div>';}).join('');
    box.innerHTML='<div class="section-title">هشدارهای قابل‌اقدام AREX</div><div class="section-sub">هشدارها برای مرور و اصلاح فرایندند، نه توصیه خریدوفروش. آستانه شخصی تا زمانی که خودت تعیین و فعال نکنی اعمال نمی‌شود.</div><div class="imp-row"><label class="imp-map-item"><span>دوره مرور</span><select id="v9AlertPeriod" class="txt-input">'+options+'</select></label><label class="imp-map-item"><span>فاصله جلوگیری از تکرار اعلان (ساعت)</span><input id="v9AlertCooldown" class="txt-input" type="number" min="0" max="720" value="'+esc(cfg.alertCooldownHours??24)+'"></label><button class="btn" id="v9AlertSave">ذخیره آستانه‌ها</button><button class="btn ghost" id="v9AlertNotify" '+(result.alerts.length?'':'disabled')+'>اعلان مرورگر برای هشدارهای فعال</button></div><div class="imp-note">هشدار فعال در این بازه: '+fa(result.alerts.length)+' · الگوهای نیازمند تعیین آستانه: '+fa(result.candidates.length)+' · معاملات بررسی‌شده: '+fa(scoped.length)+'</div>'+(rows||'<div class="empty">در این بازه الگویی برای بررسی وجود ندارد.</div>')+'<div class="imp-note">هر هشدار به شواهد و شناسه معاملات متصل است. ارتباط یک الگو با زیان به‌تنهایی علت‌ومعلول را ثابت نمی‌کند.</div>';
    box.querySelector('#v9AlertPeriod').addEventListener('change',e=>{box.dataset.period=e.target.value;renderActionableAlerts(lastTrades,view.cfg||{});});
    box.querySelector('#v9AlertSave').addEventListener('click',async()=>{const next=Object.assign({},view.cfg||{}),nr=Object.assign({},next.alertThresholds||{});let bad=false;box.querySelectorAll('[data-alert-threshold]').forEach(inp=>{const id=inp.dataset.alertThreshold,enabled=Array.from(box.querySelectorAll('[data-alert-enabled]')).find(x=>x.dataset.alertEnabled===id)?.checked===true,val=inp.value.trim();if(val!==''&&(!Number.isInteger(Number(val))||Number(val)<1)){bad=true;return;}if(val===''){delete nr[id];}else nr[id]=Object.assign({},nr[id]||{},{minCount:Number(val),enabled});if(val!==''&&enabled)nr[id].enabled=true;else if(nr[id])nr[id].enabled=false;});const cd=Number(box.querySelector('#v9AlertCooldown').value);if(!Number.isFinite(cd)||cd<0||cd>720)bad=true;if(bad){toast('آستانه باید عدد صحیح مثبت و فاصله اعلان بین صفر تا ۷۲۰ ساعت باشد.');return;}next.alertThresholds=nr;next.alertCooldownHours=cd;await saveCfg(next);toast('آستانه‌های هشدار ذخیره شد');renderActionableAlerts(lastTrades,next);});
    box.querySelectorAll('[data-alert-trades]').forEach(b=>b.addEventListener('click',()=>{const f=all[Number(b.dataset.alertTrades)];showDrill(f.label||f.id,f.tradeIds||[]);}));
    box.querySelector('#v9AlertNotify').addEventListener('click',async()=>{if(!('Notification'in window)){toast('این مرورگر اعلان را پشتیبانی نمی‌کند');return;}let permission=Notification.permission;if(permission!=='granted')permission=await Notification.requestPermission();if(permission!=='granted'){toast('اجازه اعلان داده نشد');return;}let hist={};try{const raw=await storage.get('alertEngineHistory');hist=raw&&raw.value?JSON.parse(raw.value):{};}catch(e){}let sent=0;for(const a of result.alerts){const fp=C().alertEngine.fingerprint(a),prev=hist[fp],last=Number(prev&&prev.lastNotifiedAt),cool=Math.max(0,Number(cfg.alertCooldownHours??24))*3600000;if(Number.isFinite(last)&&Date.now()-last<cool)continue;try{new Notification('AREX · '+a.label,{body:a.actionableText+' · '+a.count+' مورد مستند؛ ژورنال را مرور کن.',tag:'arex-'+fp.slice(0,100)});hist=C().alertEngine.record(hist,a,Date.now());sent++;}catch(e){}}try{await storage.set('alertEngineHistory',JSON.stringify(C().alertEngine.cleanHistory(hist,90)));}catch(e){}toast(sent?'اعلان‌های جدید ارسال شد: '+fa(sent):'اعلان تکراری ارسال نشد؛ بازه جلوگیری از تکرار فعال است.');});
  }
  function renderRiskState(trades) {
    const box = document.getElementById('v9RiskState'); if (!box) return;
    const r = C().riskstate.evaluate(trades);
    box.innerHTML = '<div class="section-title">' + V9T('a.rsTitle') + '</div>' + (r.alerts.length ? r.alerts.map((a, i) => '<div class="v9-find"><div class="v9-find-h"><b>' + esc(tr('rs.l.' + a.id, a.label)) + '</b>' + badge(a.confidence) + '</div><div class="v9-find-b">' + esc(tr('rs.ev.' + a.id, a.evidence, a.params)) + '</div><button type="button" class="chip" data-v9alert="' + i + '">' + V9T('a.showTrades') + '</button></div>').join('') :
      '<div class="empty">' + V9T('a.rsNone') + '</div>') + '<div class="imp-note">' + V9T('a.rsNote') + '</div>';
    box.querySelectorAll('[data-v9alert]').forEach(b => b.addEventListener('click', () => { const a = r.alerts[+b.dataset.v9alert]; showDrill(tr('rs.l.' + a.id, a.label), a.tradeIds); }));
  }
  function renderQuality(trades, cfg) {
    const box = document.getElementById('v9Quality'); if (!box) return;
    const q = C().quality.score(trades, { maxTradesPerDay: cfg.maxTradesPerDay, maxRiskPct: cfg.maxRiskPct });
    box.innerHTML = '<div class="section-title">' + V9T('a.qTitle') + '</div><div class="v9-score">' + (q.overall === null ? '—' : fa(q.overall.toFixed(0)) + '<small>/100</small>') + '</div><div class="section-sub">' + V9T('a.qCoverage', { p: pct(q.coverage) }) + '</div>' +
      Object.keys(q.components).map(k => { const c = q.components[k]; return '<div class="ch-bar-row"><div class="ch-bar-lbl"><span>' + V9T('q.' + k) + ' (' + V9T('a.weight') + ' ' + fa(c.weight) + ')</span><span>' + (c.score === null ? V9T('a.qNoData') : fa(c.score.toFixed(0))) + '</span></div><div class="ch-bar-track"><i style="width:' + (c.score || 0) + '%;background:var(--gold)"></i></div><div class="imp-note">' + esc(c.howKey ? tr('q.how.' + c.howKey, c.how, c.howParams) : V9T('a.qNoData')) + '</div></div>'; }).join('') +
      '<div class="imp-note">' + V9T('a.qNote') + '</div>';
  }
  async function renderRepairHistory(box){
    const host=document.createElement('section');host.className='v9-repair-history';host.innerHTML='<div class="section-title">سابقه اصلاحات ژورنال</div><div class="section-sub">تطبیق رویدادهای نیمه‌تمام فقط وضعیت سابقه را پیشنهاد می‌کند؛ داده معامله خودکار تغییر نمی‌کند.</div><div class="imp-note">در حال بارگذاری سابقه…</div>';
    const anchor=box.querySelector('.v9-repair-history');if(anchor)anchor.remove();box.appendChild(host);
    try{
      if(typeof storage==='undefined'||!window.AREXCore.repairHistory)throw new Error('history unavailable');
      const stored=await storage.get('arexDiagnosticRepairHistory');const raw=stored&&stored.value?JSON.parse(stored.value):null;const api=window.AREXCore.repairHistory,recovery=window.AREXCore.repairRecovery,summary=api.summarize(raw);if(!recovery)throw new Error('recovery unavailable');const recoveryScan=recovery.scan(raw,lastTrades,api);
      const status={applied:'ذخیره‌شده',pending:'در انتظار بررسی',failed:'عدم اعمال تأیید شد'};
      const reconciliation={matches_after:'مقدار فعلی با مقدار اصلاح‌شده برابر است',matches_before:'مقدار فعلی با مقدار قبلی برابر است',trade_missing:'معامله در داده‌های فعلی پیدا نشد',ambiguous_trade_id:'شناسه معامله تکراری است؛ تطبیق امن ممکن نیست',field_unavailable:'فیلد قابل بررسی نیست',conflict:'مقدار فعلی با قبل و بعد سابقه متفاوت است',unavailable:'داده‌های فعلی برای تطبیق در دسترس نیست',not_pending:'این رویداد در انتظار بررسی نیست'};
      const cards=summary.entries.map(e=>{const rec=api.reconcile(e,lastTrades);const actionable=e.status==='pending'&&!!rec.suggestedStatus;const action=actionable?'<button type="button" class="chip" data-repair-reconcile="'+esc(e.eventId)+'" data-repair-status="'+esc(rec.suggestedStatus)+'">تأیید وضعیت پیشنهادی</button>':'';const current=rec.state==='conflict'?'<br>مقدار فعلی: <code>'+esc(rec.current)+'</code>':'';return '<div class="v9-find"><div class="v9-find-h"><b>'+esc(e.tradeId)+' · '+esc(e.field)+'</b><span class="v9-badge v9-'+(e.status==='applied'?'high':e.status==='pending'?'medium':'low')+'">'+esc(status[e.status]||e.status)+'</span></div><div class="v9-find-b"><code>'+esc(e.before)+'</code> → <code>'+esc(e.after)+'</code><br>'+esc(new Date(e.timestamp).toLocaleString())+' · '+esc(e.eventId)+'<br>بررسی: '+esc(reconciliation[rec.state]||rec.state)+current+'</div>'+action+'</div>';}).join('');
      host.innerHTML='<div class="section-title">سابقه اصلاحات ژورنال</div><div class="section-sub">برای رویدادهای نیمه‌تمام، تطبیق فقط بر اساس شناسه یکتا و مقدار همان فیلد انجام می‌شود. هیچ معامله‌ای در این بخش تغییر نمی‌کند.</div><div class="imp-note" data-repair-recovery-summary>در انتظار بررسی: '+fa(recoveryScan.counts.pending)+' · آماده تأیید با شواهد فعلی: '+fa(recoveryScan.counts.ready)+' · تعارض: '+fa(recoveryScan.counts.conflict)+' · معامله مفقود: '+fa(recoveryScan.counts.missing)+' · شناسه مبهم: '+fa(recoveryScan.counts.ambiguous)+' · نیازمند بررسی دیگر: '+fa(recoveryScan.counts.unavailable)+'</div>'+(summary.omittedCount?'<div class="imp-note">به‌دلیل محدودیت نگهداری، '+fa(summary.omittedCount)+' رویداد قدیمی‌تر در این فهرست نیست.</div>':'')+(summary.entries.length?cards:'<div class="imp-note">هنوز اصلاح تأییدشده‌ای ثبت نشده است.</div>');
      host.querySelectorAll('[data-repair-reconcile]').forEach(btn=>btn.addEventListener('click',async()=>{
        const eventId=btn.dataset.repairReconcile,target=btn.dataset.repairStatus;
        if(!['applied','failed'].includes(target))return;
        const freshTrades=typeof state!=='undefined'&&Array.isArray(state.trades)?state.trades:lastTrades;
        let freshHistory;try{const latest=await storage.get('arexDiagnosticRepairHistory');freshHistory=api.normalize(latest&&latest.value?JSON.parse(latest.value):null);}catch(e){toast('خواندن سابقه ناموفق بود؛ هیچ وضعیتی تغییر نکرد.');return;}
        const event=freshHistory.entries.find(x=>x.eventId===eventId);if(!event||event.status!=='pending'){toast('این رویداد دیگر در انتظار بررسی نیست؛ فهرست را دوباره بارگذاری کن.');return;}
        const rec=api.reconcile(event,freshTrades);if(rec.suggestedStatus!==target){toast('داده‌ها از زمان نمایش تغییر کرده‌اند یا نتیجه دیگر قطعی نیست؛ هیچ تغییری انجام نشد.');await renderRepairHistory(box);return;}
        const explanation=target==='applied'?'مقدار فعلی دقیقاً با مقدار بعد از اصلاح برابر است.':'مقدار فعلی دقیقاً با مقدار قبل از اصلاح برابر است.';
        if(!window.confirm('فقط وضعیت سابقه تغییر می‌کند؛ داده معامله دست‌نخورده می‌ماند.\n'+explanation+'\n\nآیا این وضعیت را تأیید می‌کنی؟'))return;
        const recoveryApi=window.AREXCore.repairRecovery;if(!recoveryApi){toast('ماژول بازیابی در دسترس نیست؛ هیچ وضعیتی تغییر نکرد.');return;}
        const guarded=recoveryApi.resolve(freshHistory,eventId,recoveryApi.snapshot(event),freshTrades,target,api);if(!guarded.ok){toast('بازیابی ایمن متوقف شد: '+guarded.code+'؛ فهرست را دوباره بررسی کن.');await renderRepairHistory(box);return;}
        // Re-read immediately before write to detect changes from another UI action/tab when visible.
        try{const check=await storage.get('arexDiagnosticRepairHistory'),latestHistory=api.normalize(check&&check.value?JSON.parse(check.value):null);const latestEvent=latestHistory.entries.find(x=>x.eventId===eventId);if(!latestEvent||recoveryApi.snapshot(latestEvent)!==recoveryApi.snapshot(event)){toast('سابقه هم‌زمان تغییر کرده است؛ برای جلوگیری از بازنویسی، اقدامی انجام نشد.');await renderRepairHistory(box);return;}await storage.set('arexDiagnosticRepairHistory',JSON.stringify(guarded.history));toast(target==='applied'?'سابقه تأیید شد: مقدار اصلاح‌شده در معامله موجود است.':'سابقه تأیید شد: مقدار قبلی هنوز در معامله موجود است.');await renderRepairHistory(box);}catch(e){toast('ذخیره وضعیت سابقه ناموفق بود؛ دوباره بررسی کن.');}
      }));
    }catch(e){host.innerHTML='<div class="section-title">سابقه اصلاحات ژورنال</div><div class="v9-warn">خواندن سابقه ممکن نشد؛ وضعیت را نمی‌توان تأیید کرد.</div>';}
  }
  function renderDiagnostics(trades) {
    const box=document.getElementById('v9Diagnostics'); if(!box) return;
    const run=()=>{
      const findings=[];
      try { const d=C().errors.detect(trades,{ }); (d.findings||[]).forEach(f=>findings.push(f)); } catch(e) { /* report unavailable below */ }
      let report;
      try { report=C().tradeAudit.buildDiagnosticReport(trades,C().analytics,findings,{accountScope:'current-session'}); }
      catch(e) { report={schemaVersion:1,generatedAt:new Date().toISOString(),readOnly:true,summary:{tradeCount:trades.length,critical:1,warning:0,info:0,totalIssues:1},items:[{severity:'critical',source:'diagnostics',code:'diagnostic_engine_failed'}]}; }
      const label={critical:'بحرانی',warning:'نیازمند بررسی',info:'اطلاعاتی'};
      const items=report.items.slice(0,30).map(x=>'<div class="v9-find"><div class="v9-find-h"><b>'+esc(label[x.severity]||x.severity)+' · '+esc(x.code)+'</b><span class="v9-badge v9-'+(x.severity==='critical'?'low':x.severity==='warning'?'medium':'high')+'">'+esc(x.source)+'</span></div><div class="v9-find-b">'+esc(x.id!==undefined?'شناسه معامله: '+x.id:x.field?'فیلد: '+x.field:x.index!==undefined?'ردیف: '+(x.index+1):'برای جزئیات، گزارش JSON را دریافت کن.')+'</div></div>').join('');
      const repairs=C().diagnosticRepair?C().diagnosticRepair.propose(trades):[];
      const repairHtml=repairs.length?'<div class="section-title">پیشنهادهای اصلاح کم‌ریسک</div><div class="section-sub">فقط فاصله اضافی اطراف نماد یا تاریخ ISO معتبر پیشنهاد می‌شود. هیچ مقدار مالی، شناسه یا تاریخ نامشخصی حدس زده نمی‌شود.</div>'+repairs.map((p,i)=>'<div class="v9-find"><div class="v9-find-h"><b>'+esc(p.tradeId)+' · '+esc(p.field)+'</b><span class="v9-badge v9-medium">پیشنهاد، نه اصلاح خودکار</span></div><div class="v9-find-b">مقدار فعلی: <code>'+esc(p.before)+'</code> → مقدار پیشنهادی: <code>'+esc(p.after)+'</code></div><button type="button" class="chip" data-diag-repair="'+i+'">بازبینی و تأیید اصلاح</button></div>').join(''):'<div class="imp-note">در فیلدهای پشتیبانی‌شده، پیشنهاد اصلاح کم‌ریسکی پیدا نشد.</div>';
      box.innerHTML='<div class="section-title">سلامت داده‌های ژورنال</div><div class="section-sub">بررسی فقط‌خواندنی است؛ اصلاح فقط برای موارد کم‌ریسک، پس از نمایش مقدار فعلی و تأیید صریح تو انجام می‌شود. مقادیر ناموجود حدس زده نمی‌شوند.</div><div class="imp-note">معاملات: '+fa(report.summary.tradeCount)+' · بحرانی: '+fa(report.summary.critical)+' · نیازمند بررسی: '+fa(report.summary.warning)+' · اطلاعاتی: '+fa(report.summary.info)+'</div><div class="imp-row"><button type="button" class="btn" id="v9DiagRun">اجرای دوباره بررسی</button><button type="button" class="btn ghost" id="v9DiagExport">دریافت گزارش JSON</button></div>'+(items||'<div class="empty">در این بررسی موردی پیدا نشد. این نتیجه تضمین سلامت کامل همه داده‌ها نیست.</div>')+repairHtml+'<div class="imp-note">زمان اجرا: '+esc(new Date(report.generatedAt).toLocaleString())+' · خروجی فقط شامل کدهای تشخیصی و شناسه‌های لازم است؛ پیش از اشتراک‌گذاری، گزارش را بازبینی کن.</div>';
      renderRepairHistory(box);
      box.querySelector('#v9DiagRun').addEventListener('click',()=>renderDiagnostics(lastTrades));
      box.querySelectorAll('[data-diag-repair]').forEach(btn=>btn.addEventListener('click',async()=>{
        const proposal=repairs[Number(btn.dataset.diagRepair)];if(!proposal||!window.AREXCore.diagnosticRepair)return;
        const accepted=window.confirm('تأیید اصلاح این معامله؟\nشناسه: '+proposal.tradeId+'\nفیلد: '+proposal.field+'\nفعلی: '+proposal.before+'\nپیشنهادی: '+proposal.after+'\n\nاین تغییر همراه با سابقه قبل/بعد ثبت می‌شود.');if(!accepted)return;
        if(typeof state==='undefined'||!Array.isArray(state.trades)||typeof queueSave!=='function'||!window.AREXCore.repairHistory||typeof storage==='undefined'){toast('ذخیره امن یا ثبت سابقه در دسترس نیست؛ هیچ تغییری اعمال نشد.');return;}
        const result=window.AREXCore.diagnosticRepair.apply(state.trades,proposal,{confirmed:true});
        if(!result.ok){toast(result.code==='stale_record'?'این معامله پس از بررسی تغییر کرده؛ گزارش را دوباره اجرا کن.':'اصلاح انجام نشد: '+result.code);renderDiagnostics(lastTrades);return;}
        const audit=window.AREXCore.repairHistory.create({...result,reason:proposal.reason});if(!audit.ok){toast('ساخت سابقه تغییر ناموفق بود؛ اصلاح انجام نشد.');return;}
        let history;try{const stored=await storage.get('arexDiagnosticRepairHistory');history=window.AREXCore.repairHistory.normalize(stored&&stored.value?JSON.parse(stored.value):null);const added=window.AREXCore.repairHistory.append(history,audit.event);if(!added.ok){toast('ثبت سابقه تکراری یا نامعتبر بود؛ اصلاح انجام نشد.');return;}history=added.history;await storage.set('arexDiagnosticRepairHistory',JSON.stringify(history));}catch(e){toast('ثبت سابقه تغییر ناموفق بود؛ برای حفظ قابلیت ممیزی، اصلاح اعمال نشد.');return;}
        state.trades=result.trades;queueSave('trades');let saved=false;try{saved=await flushSave();}catch(e){saved=false;}
        if(saved){const updated=window.AREXCore.repairHistory.updateStatus(history,audit.event.eventId,'applied');if(updated.ok){try{await storage.set('arexDiagnosticRepairHistory',JSON.stringify(updated.history));history=updated.history;}catch(e){/* pending audit event intentionally remains for reconciliation */}}toast('اصلاح ذخیره شد. سابقه قبل/بعد ثبت شده است.');}
        else toast('اصلاح در حافظه اعمال شد اما ذخیره معامله تأیید نشد؛ سابقه با وضعیت «در انتظار بررسی» باقی ماند. صفحه را نبند و وضعیت ذخیره را بررسی کن.');
        lastTrades=state.trades.slice();window.renderArexAnalyticsV9(lastTrades);
      }));
      box.querySelector('#v9DiagExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='arex-diagnostics-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    };
    if(!C().tradeAudit){box.innerHTML='<div class="section-title">سلامت داده‌های ژورنال</div><div class="v9-warn">ماژول ممیزی در دسترس نیست؛ نتیجه‌ای اعلام نمی‌شود.</div>';return;} run();
  }
  function renderCfg(cfg) {
    const box = document.getElementById('v9Cfg'); if (!box) return;
    box.innerHTML = '<div class="section-title">' + V9T('a.cfgTitle') + '</div><div class="section-sub">' + V9T('a.cfgSub') + '</div>' +
      '<div class="imp-row"><label class="imp-map-item"><span>' + V9T('a.cfgMaxTrades') + '</span><input class="txt-input" id="v9MaxTrades" type="number" min="1" step="1" value="' + esc(cfg.maxTradesPerDay ?? '') + '"></label>' +
      '<label class="imp-map-item"><span>' + V9T('a.cfgMaxRisk') + '</span><input class="txt-input" id="v9MaxRisk" type="number" min="0" step="any" value="' + esc(cfg.maxRiskPct ?? '') + '"></label><label class="imp-map-item"><span>' + V9T('a.cfgMinRR') + '</span><input class="txt-input" id="v9MinRR" type="number" min="0" step="any" value="' + esc(cfg.minRR ?? '') + '"></label><button type="button" class="btn" id="v9CfgSave">' + V9T('a.save') + '</button></div>';
    document.getElementById('v9CfgSave').addEventListener('click', async () => {
      const mt = C().util.toNum(document.getElementById('v9MaxTrades').value), mr = C().util.toNum(document.getElementById('v9MaxRisk').value), rr = C().util.toNum(document.getElementById('v9MinRR').value);
      if ((mt !== null && (mt < 1 || !Number.isInteger(mt))) || (mr !== null && mr <= 0) || (rr !== null && rr <= 0)) { toast(V9T('a.invalidValue')); return; }
      const next = Object.assign({}, view.cfg); if (mt === null) delete next.maxTradesPerDay; else next.maxTradesPerDay = mt; if (mr === null) delete next.maxRiskPct; else next.maxRiskPct = mr; if (rr === null) delete next.minRR; else next.minRR = rr;
      await saveCfg(next); toast(V9T('a.saved')); renderArexAnalyticsV9(lastTrades);
    });
  }

  window.renderArexAnalyticsV9 = async function (trades) {
    if (!window.AREXCore || !AREXCore.analytics) return;
    const seq = ++renderSeq; lastTrades = trades || []; ensureContainers();
    const cfg = await loadCfg(), opts = {};
    if (seq !== renderSeq) return;   // a newer render started while config was loading: drop this stale one
    renderKpis(AREXCore.analytics.summarize(lastTrades, opts)); renderGroups(lastTrades, opts); renderHeat(lastTrades, opts);
    renderErrors(lastTrades, cfg); renderActionableAlerts(lastTrades, cfg); renderRiskState(lastTrades); renderQuality(lastTrades, cfg); renderDiagnostics(lastTrades); renderCfg(cfg);
    if (view.drill) { const keep = view.drill; const still = document.getElementById('v9Drill'); if (still && still.style.display !== 'none') showDrill(keep.title, keep.ids); }
  };
})();
