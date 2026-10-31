/* AREX V9.8.0 — ui/dashboard-v2: the new Home. A time-aware "day guide" (what to do next, from morning to night), balance & equity charts,
   win-rate donut, daily P&L bars, active accounts (with prop status), latest trades and top mistakes. SVG only; same layout logic for phone and desktop. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.arexEscape, fa = v => arexFmt.fa(v), money = v => arexFmt.money(v);
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  let period = '30', curveMode = 'usd', raf = 0;
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const v98 = () => arexV98(), L = () => AREXCore.ledger;

  /* ---------- data ---------- */
  function data() {
    const v = v98(), all = state.trades || [], today = iso(new Date());
    const since = period === 'all' ? '' : iso(new Date(Date.now() - (+period) * 86400000)), tr = since ? all.filter(t => String(t.date) >= since) : all;
    const closed = tr.filter(t => num(t.usd) !== null || num(t.r) !== null).slice().sort((a, b) => (String(a.date) + String(a.time || '')).localeCompare(String(b.date) + String(b.time || '')));
    const win = t => (num(t.r) !== null && num(t.r) !== 0 ? num(t.r) > 0 : num(t.usd) > 0), loss = t => (num(t.r) !== null && num(t.r) !== 0 ? num(t.r) < 0 : num(t.usd) < 0);
    const wins = closed.filter(win), losses = closed.filter(loss), be = closed.length - wins.length - losses.length;
    const usd = t => num(t.usd) || 0, gw = wins.reduce((a, t) => a + Math.max(0, usd(t)), 0), gl = Math.abs(losses.reduce((a, t) => a + Math.min(0, usd(t)), 0));
    const rs = closed.map(t => num(t.r)).filter(x => x !== null);
    const byDay = {}; closed.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + usd(t); });
    const days14 = []; for (let i = 13; i >= 0; i--) { const d = iso(new Date(Date.now() - i * 86400000)); days14.push({ d, v: byDay[d] || 0, has: d in byDay }); }
    const mist = {}; closed.forEach(t => (t.mistakes || []).forEach(m => { const e = (mist[m] = mist[m] || { n: 0, usd: 0 }); e.n++; e.usd += usd(t); }));
    const sums = L().all(v, all), comb = L().combined(v, all);
    return { v, all, today, tr, closed, wins, losses, be, gw, gl, pf: gl > 0 ? gw / gl : null, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null, wr: closed.length ? wins.length / closed.length * 100 : null, days14, mist: Object.keys(mist).map(k => Object.assign({ k }, mist[k])).sort((a, b) => b.n - a.n).slice(0, 5), sums, comb, todayPnl: closed.filter(t => t.date === today).reduce((a, t) => a + usd(t), 0), open: all.filter(t => num(t.r) === null && num(t.usd) === null && !String(t.exit || '').trim()) };
  }

  /* ---------- tiny SVG charts ---------- */
  const spark = (vals, color, w, h) => { if (vals.length < 2) return '<div class="muted" style="font-size:12px">داده‌ی کافی نیست</div>'; const min = Math.min(...vals), max = Math.max(...vals), sp = (max - min) || 1, x = i => 2 + i * (w - 4) / (vals.length - 1), y = v => 4 + (max - v) * (h - 8) / sp, d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="arex-spark" preserveAspectRatio="none" role="img"><defs><linearGradient id="sg${color.slice(1)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${x(vals.length - 1)} ${h} L2 ${h} Z" fill="url(#sg${color.slice(1)})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/></svg>`; };
  const donut = (w, l, b, label) => { const t = w + l + b || 1, R = 42, C = 2 * Math.PI * R; let off = 0; const seg = (n, col) => { const len = n / t * C, s = `<circle r="${R}" cx="55" cy="55" fill="none" stroke="${col}" stroke-width="12" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 55 55)"/>`; off += len; return s; };
    return `<svg viewBox="0 0 110 110" class="arex-donut" role="img"><circle r="${R}" cx="55" cy="55" fill="none" stroke="var(--border)" stroke-width="12"/>${seg(w, '#33c589')}${seg(l, '#f87171')}${seg(b, '#8b95a7')}<text x="55" y="52" text-anchor="middle" font-size="20" font-weight="800" fill="currentColor">${label}</text><text x="55" y="68" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">وین‌ریت</text></svg>`; };
  const bars = days => { const max = Math.max(1, ...days.map(d => Math.abs(d.v))), W = 280, H = 90, bw = W / days.length; return `<svg viewBox="0 0 ${W} ${H}" class="arex-bars" role="img"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--border)"/>${days.map((d, i) => { const h = Math.abs(d.v) / max * (H / 2 - 6), y = d.v >= 0 ? H / 2 - h : H / 2; return `<rect x="${(i * bw + 3).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(d.has ? 2 : 0, h).toFixed(1)}" rx="3" fill="${d.v >= 0 ? '#33c589' : '#f87171'}" opacity="${d.has ? 1 : .15}"><title>${d.d}: ${money(d.v)}</title></rect>`; }).join('')}</svg>`; };
  function curve(closed) {
    const pts = []; let cum = 0; closed.forEach(t => { cum += curveMode === 'r' ? (num(t.r) || 0) : (num(t.usd) || 0); pts.push(cum); }); if (pts.length < 2) return '<div class="empty" style="padding:24px 0">برای منحنی حداقل ۲ معامله‌ی بسته لازم است.</div>';
    const W = 640, H = 200, all = [0, ...pts], min = Math.min(...all), max = Math.max(...all), sp = (max - min) || 1, x = i => 10 + i * (W - 20) / (pts.length - 1), y = v => 14 + (max - v) * (H - 34) / sp, d = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' '), col = pts[pts.length - 1] >= 0 ? '#33c589' : '#f87171';
    let peak = 0, dd = 0, ddAt = 0; pts.forEach((v, i) => { peak = Math.max(peak, v); if (peak - v > dd) { dd = peak - v; ddAt = i; } });
    return `<svg viewBox="0 0 ${W} ${H}" class="arex-curve" role="img"><defs><linearGradient id="ecg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><line x1="10" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" opacity=".25" stroke-dasharray="4"/><path d="${d} L${x(pts.length - 1)} ${H - 18} L10 ${H - 18} Z" fill="url(#ecg)"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.4"/><circle cx="${x(pts.length - 1)}" cy="${y(pts[pts.length - 1])}" r="4.5" fill="${col}"/>${dd > 0 ? `<circle cx="${x(ddAt)}" cy="${y(pts[ddAt])}" r="4" fill="#f87171" stroke="#fff"><title>بیشترین افت</title></circle>` : ''}<text x="12" y="12" font-size="11" fill="currentColor" opacity=".7">${curveMode === 'r' ? fa(max.toFixed(1)) + 'R' : money(max)}</text><text x="12" y="${H - 4}" font-size="11" fill="currentColor" opacity=".7">${curveMode === 'r' ? fa(min.toFixed(1)) + 'R' : money(min)}</text></svg>`;
  }
  const ago = t => { const ms = Date.now() - Date.parse(String(t.closedAt || t.date + 'T' + (t.time || '00:00'))); const d = ms / 86400000; return d < 1 ? 'امروز' : d < 2 ? 'دیروز' : fa(Math.floor(d)) + ' روز پیش'; };

  /* ---------- day guide ---------- */
  const guideStore = () => { const p = v98().prefs; p.guide = p.guide || {}; const keep = iso(new Date(Date.now() - 14 * 86400000)); Object.keys(p.guide).forEach(k => { if (k < keep) delete p.guide[k]; }); return (p.guide[iso(new Date())] = p.guide[iso(new Date())] || { steps: {} }); };
  function guideSteps(D) {
    const g = guideStore(), s = g.steps, now = new Date(), h = now.getHours(), today = D.today, st = state, log = (st.dailyLogs || {})[today] || null, wd = now.getDay(), wk = window.arexWeekKey ? arexWeekKey() : '';
    const todayTr = D.all.filter(t => t.date === today), noTrade = !!g.noTrade, sync = st.lastSyncAt && iso(new Date(st.lastSyncAt)) === today;
    const connected = !!(st.driveConnected || st.driveWasConnected) && !window.AREX_LOCAL_TEST_MODE, ev = (window.__arexFcEvents || []).filter(e => /high|3|red/i.test(String(e.impact || e._impact || ''))), evToday = ev.filter(e => e.date instanceof Date && iso(e.date) === today);
    const plan = v98().weekPlans[wk], weekly = v98().weeklyReviews[wk];
    const A = (id, ph, t, hint, view, done, auto, extra) => Object.assign({ id, ph, t, hint, view, done: !!(done || s[id]), auto: !!auto }, extra || {});
    const list = [
      connected && A('sync', 0, 'همگام‌سازی با Google Drive', 'آخرین نسخه‌ی داده‌ها را از Drive بگیر', 'sync', sync, true),
      A('mood', 0, 'حال و انضباط امروز را ثبت کن', 'ذهن آرام = تصمیم بهتر', 'daily', !!(log && (log.mood || log.focus || log.discipline)), true),
      A('news', 0, 'اخبار مهم امروز را ببین' + (evToday.length ? ' (' + fa(evToday.length) + ' خبر مهم)' : ''), 'ساعت‌های پرنوسان را علامت بزن', 'calendar', s.newsViewed, true),
      A('plan', 0, 'سقف‌های روز را مرور کن', plan && plan.locked ? 'برنامه‌ی قفل‌شده: حداکثر ' + fa(plan.maxTrades) + ' معامله، ریسک ≤ ' + fa(plan.maxRiskPct) + '٪' : 'حداکثر معامله، ریسک هر معامله و افت روزانه', 'accounts', s.plan, false),
      A('trade', 1, 'معامله‌ها را همان لحظه ثبت کن', todayTr.length ? fa(todayTr.length) + ' معامله‌ی امروز ثبت شده' : 'هنوز معامله‌ای ثبت نشده', 'trades', todayTr.length > 0 || noTrade, true, { skip: 'trade' }),
      A('risk', 1, 'افت روزانه و ریسک باز را کنترل کن', 'پیش از هر ورود جدید', 'accounts', s.risk, false),
      A('open', 2, 'نتیجه‌ی معاملات باز را ثبت کن', D.open.length ? fa(D.open.length) + ' معامله‌ی باز بدون نتیجه' : 'معامله‌ی بازِ بی‌نتیجه نداری', 'trades', !D.open.length, true),
      A('tag', 2, 'اشتباهات و درس امروز را تگ کن', 'هر معامله: چه خوب بود، چه بد', 'trades', noTrade || !todayTr.length || todayTr.every(t => (t.mistakes || []).length || t.review || (t.note || '').length > 8) || s.tag, true),
      A('review', 2, 'مرور روزانه را کامل کن', 'خلاصه‌ی روز و احساسات', 'daily', !!(log && log.journalDone), true),
      (wd === 5 || wd === 6) && A('weekly', 2, 'مرور هفتگی و قفل برنامه‌ی هفته‌ی بعد', 'امتیازدهی + قانون جدید + برنامه', 'reviewcenter:weekly', !!weekly, true),
      connected && A('sync2', 2, 'همگام‌سازی شبانه با Drive', 'نسخه‌ی امروز آپلود شود', 'sync', !!(st.lastSyncAt && Date.parse(st.lastSyncAt) >= new Date().setHours(20, 0, 0, 0)), true),
      A('tomorrow', 2, 'نگاهی به خبرهای فردا', 'برای برنامه‌ی فردا', 'calendar', s.tomorrow, false)
    ].filter(Boolean);
    const phase = h < 12 ? 0 : h < 18 ? 1 : 2; return { list, phase, noTrade, g };
  }
  function renderGuide(D) {
    const { list, phase, noTrade, g } = guideSteps(D), done = list.filter(x => x.done).length, pct = list.length ? done / list.length : 0, PH = ['☀️ صبح · قبل از بازار', '📈 حین بازار', '🌙 عصر و شب · بستن روز'], cur = list.find(x => !x.done && x.ph <= phase) || list.find(x => !x.done);
    const ring = (() => { const R = 26, C = 2 * Math.PI * R; return `<svg viewBox="0 0 64 64" class="arex-ring"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--border)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${pct >= 1 ? '#33c589' : '#1e90ff'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(pct * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${fa(done)}/${fa(list.length)}</text></svg>`; })();
    const rows = [0, 1, 2].map(p => { const items = list.filter(x => x.ph === p); if (!items.length) return ''; return `<div class="arex-gd-phase ${p === phase ? 'now' : ''}"><div class="arex-gd-ph">${PH[p]}${p === phase ? ' <i>الان</i>' : ''}</div>${items.map(x => `<div class="arex-gd-step ${x.done ? 'done' : ''} ${cur && cur.id === x.id ? 'cur' : ''} ${!x.done && x.ph < phase ? 'late' : ''}"><button class="arex-gd-chk" type="button" data-chk="${x.id}" aria-label="انجام شد" ${x.auto && x.done ? 'disabled' : ''}>${x.done ? '✓' : ''}</button><div class="arex-gd-txt"><b>${E(x.t)}</b><small>${E(x.hint)}</small></div>${x.done ? '' : `<button class="btn ghost arex-gd-go" type="button" data-go="${E(x.view)}">برو</button>${x.skip ? `<button class="btn ghost arex-gd-go" type="button" data-skip="1">امروز نمی‌کنم</button>` : ''}`}</div>`).join('')}</div>`; }).join('');
    return `<div class="arex-gd-head">${ring}<div><div class="arex-gd-title">${pct >= 1 ? '🎉 روز امروز کامل شد' : cur ? '👉 الان: ' + E(cur.t) : 'راهنمای امروز'}</div><div class="muted" style="font-size:12px">${pct >= 1 ? 'همه‌ی مراحل امروز انجام شد. استراحت کن و فردا دوباره.' : 'مراحل به‌ترتیب زمان روز؛ هر چه انجام شود تیک می‌خورد.'}${noTrade ? ' · امروز «بدون معامله» علامت خورده' : ''}</div></div></div><div class="arex-gd-list">${rows}</div>`;
  }

  /* ---------- widgets ---------- */
  function widgets(D) {
    const total = D.sums.reduce((a, s) => a + s.balance, 0), pts = D.comb.slice(-40).map(p => p.balance), chg = pts.length > 1 ? pts[pts.length - 1] - pts[0] : 0, wr = D.wr === null ? '—' : fa(Math.round(D.wr)) + '٪';
    const kpi = (l, v, cls) => `<div class="arex-hk"><small>${l}</small><b class="${cls || ''}">${v}</b></div>`;
    const hero = `<div class="arex-hero-top"><div><small class="muted">مجموع موجودی همه حساب‌ها</small><div class="arex-hero-bal">${money(total)}</div><div class="${chg < 0 ? 'neg' : 'pos'}" style="font-size:12px">${chg >= 0 ? '▲' : '▼'} ${money(Math.abs(chg))} در بازه‌ی نمودار · امروز ${money(D.todayPnl)}</div></div><div class="arex-seg" id="arexHomePeriod">${[['7', '۷ر'], ['30', '۳۰ر'], ['all', 'همه']].map(([k, l]) => `<button type="button" class="${period === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('')}</div></div>${spark(pts, chg >= 0 ? '#33c589' : '#f87171', 320, 64)}`;
    const perf = `<div class="arex-perf">${D.closed.length ? donut(D.wins.length, D.losses.length, D.be, wr) : '<div class="muted">بدون داده</div>'}<div class="arex-hks">${kpi('ضریب سود', D.pf === null ? '—' : fa(D.pf.toFixed(2)), D.pf && D.pf >= 1 ? 'pos' : D.pf ? 'neg' : '')}${kpi('میانگین R', D.avgR === null ? '—' : fa(D.avgR.toFixed(2)) + 'R', D.avgR > 0 ? 'pos' : D.avgR < 0 ? 'neg' : '')}${kpi('معاملات', fa(D.closed.length))}${kpi('بیشترین افت', fa(Math.max(0, ...D.sums.map(s => s.maxDDpct))) + '٪')}</div></div>`;
    const lastT = D.all.slice().sort((a, b) => (String(b.date) + String(b.time || '')).localeCompare(String(a.date) + String(a.time || '')))[0], accOf = t => D.v.accounts.find(a => a.id === L().accountOf(t, D.v));
    const accs = `${lastT ? `<div class="arex-lastt"><span>آخرین معامله</span><b>${E(lastT.symbol || '')} ${lastT.dir === 'buy' ? '▲' : '▼'}</b><span class="${(num(lastT.usd) || num(lastT.r) || 0) < 0 ? 'neg' : 'pos'}">${num(lastT.r) !== null ? fa(num(lastT.r)) + 'R' : ''} ${num(lastT.usd) !== null ? money(num(lastT.usd)) : ''}</span><span class="arex-badge ${accOf(lastT) ? accOf(lastT).type : ''}">${E(accOf(lastT) ? accOf(lastT).name : '—')}</span><small class="muted">${ago(lastT)}</small></div>` : ''}
      <div class="arex-accs">${D.sums.map(s => { const a = D.v.accounts.find(x => x.id === s.id), pg = a && a.type === 'prop' && a.propRules ? AREXCore.prop.compute(a, L().tradesOf(D.all, D.v, a.id), D.v.ledger, new Date()) : null, td = L().tradesOf(D.all, D.v, s.id).filter(t => t.date === D.today).reduce((x, t) => x + (num(t.usd) || 0), 0);
        return `<button class="arex-acc-mini" type="button" data-go="accounts"><div class="arex-acc-mini-h"><b>${E(s.name)}</b><span class="arex-badge ${s.type}">${AREXCore.ledger.TYPES[s.type] || s.type}</span>${D.v.activeAccountId === s.id ? '<span class="arex-badge on">فعال</span>' : ''}</div><div class="arex-acc-mini-b">${money(s.balance)}</div><div class="arex-acc-mini-s"><span class="${td < 0 ? 'neg' : 'pos'}">امروز ${money(td)}</span><span class="muted">${fa(s.trades)} معامله</span></div>${pg ? `<div class="arex-bar"><i class="${pg.rules.dailyLoss.state}" style="width:${Math.min(100, Math.round(pg.rules.dailyLoss.usedFrac * 100))}%"></i></div><small class="${pg.overall === 'breach' ? 'neg' : pg.overall === 'warn' ? 'warn' : 'muted'}">افت روزانه: باقی ${money(pg.rules.dailyLoss.remainingUsd)}${pg.readyToPass ? ' · ✅ آماده‌ی عبور' : pg.target.usd ? ' · هدف ' + fa(Math.round((pg.target.progress || 0) * 100)) + '٪' : ''}</small>` : ''}</button>`; }).join('')}</div>`;
    const last6 = D.all.slice().sort((a, b) => (String(b.date) + String(b.time || '')).localeCompare(String(a.date) + String(a.time || ''))).slice(0, 6);
    const latest = last6.length ? last6.map(t => { const a = accOf(t), r = num(t.r), u = num(t.usd); return `<div class="arex-lt-row"><span class="arex-lt-dir ${t.dir === 'buy' ? 'pos' : 'neg'}">${t.dir === 'buy' ? '▲' : '▼'}</span><div class="arex-lt-m"><b>${E(t.symbol || '—')}</b><small class="muted">${ago(t)}${a && D.v.accounts.length > 1 ? ' · ' + E(a.name) : ''}${t.setup ? ' · ' + E(t.setup) : ''}</small></div><div class="arex-lt-r ${(r !== null ? r : u) < 0 ? 'neg' : 'pos'}">${r !== null ? fa(r) + 'R' : ''}<small>${u !== null ? money(u) : ''}</small></div></div>`; }).join('') : '<div class="empty">هنوز معامله‌ای ثبت نشده</div>';
    const maxM = Math.max(1, ...D.mist.map(m => m.n)), mist = D.mist.length ? D.mist.map(m => `<div class="arex-mh"><div class="arex-mh-l"><span>${E(m.k)}</span><b>${fa(m.n)}×${m.usd ? ' · <i class="' + (m.usd < 0 ? 'neg' : 'pos') + '">' + money(m.usd) + '</i>' : ''}</b></div><div class="arex-bar"><i class="breach" style="width:${Math.round(m.n / maxM * 100)}%"></i></div></div>`).join('') : '<div class="empty">اشتباهی تگ نشده؛ در فرم معامله «اشتباهات» را علامت بزن.</div>';
    return { hero, perf, accs, latest, mist, curve: curve(D.closed.slice(-60)), bars: bars(D.days14) };
  }

  /* ---------- mount ---------- */
  const SHELL = `<div class="arex-home-grid">
    <section class="card arex-w arex-w-guide" id="arexHGuide"></section>
    <section class="card arex-w arex-w-hero" id="arexHHero"></section>
    <section class="card arex-w arex-w-perf" id="arexHPerf"></section>
    <section class="card arex-w arex-w-accs" id="arexHAccs"><div class="arex-w-t">🏦 حساب‌های فعال</div><div id="arexHAccsB"></div></section>
    <section class="card arex-w arex-w-curve" id="arexHCurve"><div class="arex-w-h"><div class="arex-w-t">📈 منحنی سرمایه</div><div class="arex-seg" id="arexHCurveMode"><button type="button" data-m="usd" class="on">$</button><button type="button" data-m="r">R</button></div></div><div id="arexHCurveB"></div></section>
    <section class="card arex-w arex-w-latest" id="arexHLatest"><div class="arex-w-h"><div class="arex-w-t">🕘 آخرین معاملات</div><button class="btn ghost" type="button" data-go="trades">همه</button></div><div id="arexHLatestB"></div></section>
    <section class="card arex-w arex-w-bars" id="arexHBars"><div class="arex-w-t">📊 سود/زیان ۱۴ روز اخیر</div><div id="arexHBarsB"></div></section>
    <section class="card arex-w arex-w-mist" id="arexHMist"><div class="arex-w-h"><div class="arex-w-t">⚠️ مهم‌ترین اشتباهات</div><button class="btn ghost" type="button" data-go="reviewcenter:audit">ممیزی</button></div><div id="arexHMistB"></div></section>
    <div class="arex-w-slot arex-w-cal" id="arexHCal"></div><div class="arex-w-slot arex-w-wrap" id="arexHWrap"></div></div>`;
  function navTo(v) { if (v === 'sync') { const b = $('driveQuickSyncBtn'); b && b.click(); return; } if (v.startsWith('reviewcenter:')) { arexOpenReview(v.split(':')[1]); return; } goView(v); }
  function render() {
    const root = $('arexHome'); if (!root || !window.AREXCore || !AREXCore.ledger) return; const D = data(), W = widgets(D);
    $('arexHGuide').innerHTML = renderGuide(D); $('arexHHero').innerHTML = W.hero; $('arexHPerf').innerHTML = '<div class="arex-w-t">🎯 عملکرد</div>' + W.perf; $('arexHAccsB').innerHTML = W.accs;
    $('arexHCurveB').innerHTML = W.curve; $('arexHLatestB').innerHTML = W.latest; $('arexHBarsB').innerHTML = W.bars + '<div class="calc-hint">سبز = روز سودده، قرمز = روز زیان‌ده</div>'; $('arexHMistB').innerHTML = W.mist;
    $('arexHCurveMode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === curveMode));
  }
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { try { render(); } catch (e) { console.error(e); } }); };
  function mount() {
    const dash = $('view-dashboard'); if (!dash || $('arexHome') || typeof state === 'undefined' || !window.AREXCore || !AREXCore.ledger) return;
    const home = document.createElement('div'); home.id = 'arexHome'; home.innerHTML = SHELL; const ref = dash.querySelector('.arex-dash-main') || $('arexDashboardKpis') || dash.firstChild; dash.insertBefore(home, ref);
    // bring the existing calendar + today wrap-up (with their phone accordion headers) up into the Home grid
    [['dashboardTvCalendar', 'arexHCal'], ['dashboardDailyCheck', 'arexHWrap']].forEach(([id, slot]) => { const el = $(id), s = $(slot); if (!el || !s) return; if (el._accHeader) s.appendChild(el._accHeader); s.appendChild(el); });
    // the Home replaces these widgets (their data is shown above in a richer form)
    ['arexDashboardKpis', 'arexDailyRoadmap', 'arexDashboardPerformance', 'arexDashboardInsights', 'arexDashboardWarnings'].forEach(id => { const e = $(id); if (e) { e.classList.add('arex-old-widget'); if (e._accHeader) e._accHeader.style.display = 'none'; } });
    home.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { e.stopPropagation(); navTo(go.dataset.go); return; }
      const sk = e.target.closest('[data-skip]'); if (sk) { guideStore().noTrade = true; arexV98Save(); schedule(); return; }
      const chk = e.target.closest('[data-chk]'); if (chk && !chk.disabled) { const g = guideStore(); g.steps[chk.dataset.chk] = !g.steps[chk.dataset.chk]; arexV98Save(); schedule(); return; }
      const p = e.target.closest('#arexHomePeriod [data-p]'); if (p) { period = p.dataset.p; schedule(); return; }
      const m = e.target.closest('#arexHCurveMode [data-m]'); if (m) { curveMode = m.dataset.m; schedule(); }
    });
    render();
  }
  window.arexHomeRefresh = schedule;
  document.addEventListener('arex:view', e => { const n = e.detail.name; if (n === 'calendar') { const g = guideStore(); g.steps.newsViewed = true; g.steps.tomorrow = g.steps.tomorrow || (new Date().getHours() >= 18); arexV98Save(); } if (n === 'accounts') { const g = guideStore(); g.steps.plan = true; g.steps.risk = new Date().getHours() >= 12 ? true : g.steps.risk; arexV98Save(); } if (n === 'dashboard') { mount(); schedule(); } });
  const boot = setInterval(() => { if (typeof state === 'undefined' || !$('view-dashboard') || !window.AREXCore || !AREXCore.ledger) return; clearInterval(boot); setTimeout(() => { mount(); }, 600); }, 300);
  setInterval(() => { const d = $('view-dashboard'); if (d && d.classList.contains('active') && !document.hidden) schedule(); }, 20000);
  // refresh when data is saved (trade added, account changed ...)
  setTimeout(() => { if (typeof window.queueSave === 'function' && !window.queueSave.__home) { const old = window.queueSave; window.queueSave = function () { const r = old.apply(this, arguments); setTimeout(schedule, 350); return r; }; window.queueSave.__home = true; } }, 1500);
  // reminders (used by the assistant's alert loop)
  window.arexGuideAlerts = function () {
    try { if (typeof state === 'undefined' || !window.AREXCore) return []; const D = data(), { list, phase } = guideSteps(D), h = new Date().getHours(), out = [];
      if (phase === 0 && h >= 7) { const n = list.filter(x => x.ph === 0 && !x.done).length; if (n) out.push({ id: 'guide-morning', level: 'info', icon: '☀️', title: 'شروع روز معاملاتی', body: fa(n) + ' کار صبحگاهی مانده؛ داشبورد را باز کن.', view: 'dashboard' }); }
      if (h >= 20) { const n = list.filter(x => x.ph === 2 && !x.done).length; if (n) out.push({ id: 'guide-night', level: 'warn', icon: '🌙', title: 'بستن روز', body: fa(n) + ' کار شبانه مانده (ثبت نتیجه، مرور روزانه، Sync).', view: 'dashboard' }); }
      return out; } catch (e) { return []; }
  };
})();
