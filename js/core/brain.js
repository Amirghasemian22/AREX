/* AREX V9.8.0 — core/brain: local-first trading assistant engine. Pure (no DOM, no network).
   Evidence-first: everything comes from the user's own journal, risk limits, strategy KB and calendar.
   It never produces buy/sell signals, never invents prices/news/rules, and says when data is missing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.brain = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN_SAMPLE = 5, DAY = 86400000;
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = v => String(v).replace(/\d/g, d => FA[d]);
  const norm = s => String(s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\u200c\u200f]/g, ' ').replace(/[?؟!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/٫/g, '.').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const money = v => ltr((v < 0 ? '-' : '') + '$' + fa(Math.abs(r2(v, 2)).toLocaleString('en-US')));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const sum = a => a.reduce((x, y) => x + y, 0);
  // Bidi isolates: keep numbers/signs and Latin names intact inside Persian sentences.
  const ltr = t => '\u2066' + t + '\u2069', N = t => '\u2068' + t + '\u2069';

  /* ---------- trade statistics ---------- */
  function outcome(t) { const r = num(t.r); if (r !== null && r !== 0) return r > 0 ? 'win' : 'loss'; const u = num(t.usd); if (u !== null && u !== 0) return u > 0 ? 'win' : 'loss'; return (r === 0 || u === 0) ? 'be' : null; }
  const isOpen = t => num(t.r) === null && num(t.usd) === null && !String(t.exit || '').trim();
  function stats(trades) {
    const closed = trades.filter(t => outcome(t) !== null);
    const wins = closed.filter(t => outcome(t) === 'win'), losses = closed.filter(t => outcome(t) === 'loss');
    const rs = closed.map(t => num(t.r)).filter(v => v !== null), us = closed.map(t => num(t.usd)).filter(v => v !== null);
    const gw = sum(us.filter(v => v > 0)), gl = Math.abs(sum(us.filter(v => v < 0)));
    let maxL = 0, cur = 0, curType = null, curLen = 0;
    const ordered = closed.slice().sort((a, b) => (String(a.date) + String(a.time || '')).localeCompare(String(b.date) + String(b.time || '')));
    ordered.forEach(t => { const o = outcome(t); if (o === 'loss') { cur++; maxL = Math.max(maxL, cur); } else if (o === 'win') cur = 0; });
    for (let i = ordered.length - 1; i >= 0; i--) { const o = outcome(ordered[i]); if (o === 'be') continue; if (curType === null) { curType = o; curLen = 1; } else if (o === curType) curLen++; else break; }
    return { n: closed.length, wins: wins.length, losses: losses.length, winRate: closed.length ? r2(wins.length / closed.length * 100, 1) : null,
      totalR: rs.length ? r2(sum(rs)) : null, avgR: rs.length ? r2(sum(rs) / rs.length) : null, totalUsd: us.length ? r2(sum(us)) : null,
      profitFactor: gl > 0 ? r2(gw / gl) : null, maxLossStreak: maxL, streak: { type: curType, len: curLen } };
  }
  function groupBy(trades, keyFn) {
    const m = {};
    trades.forEach(t => { if (outcome(t) === null) return; const ks = [].concat(keyFn(t) || []).filter(Boolean); ks.forEach(k => (m[k] = m[k] || []).push(t)); });
    return Object.keys(m).map(k => Object.assign({ key: k }, stats(m[k]))).sort((a, b) => b.n - a.n);
  }
  const bestWorst = g => { const ok = g.filter(x => x.n >= MIN_SAMPLE && x.avgR !== null); if (ok.length < 2) return null; const s = ok.slice().sort((a, b) => b.avgR - a.avgR); return { best: s[0], worst: s[s.length - 1] }; };
  const WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const impactHigh = e => /high|3|red|بالا/i.test(String(e.impact || e._impact || ''));

  /* ---------- snapshot ---------- */
  /** input: {trades, now:Date, guard (propguard-like merged {rules}), cfg:{maxRiskPct,minRR,maxTradesPerDay}, limits:{balance,riskPerTradePct},
              events:[{id,name,country,date,impact}], dailyLog, rulesBy:{[strategy]:[{id,text,kind}]}, strategies:[], isWeekend:boolean} */
  function snapshot(input) {
    input = input || {};
    const now = input.now instanceof Date ? input.now : new Date(), today = iso(now);
    const trades = Array.isArray(input.trades) ? input.trades : [];
    const todayTr = trades.filter(t => t.date === today), wkStart = iso(new Date(now.getTime() - 6 * DAY));
    const weekTr = trades.filter(t => t.date >= wkStart && t.date <= today);
    const cfg = input.cfg || {}, limits = input.limits || {};
    const ev = (input.events || []).map(e => ({ id: e.id, name: e.name, country: e.country, impact: e.impact || e._impact, ms: e.date instanceof Date ? e.date.getTime() : Date.parse(e.date) })).filter(e => Number.isFinite(e.ms));
    const upcoming = ev.filter(e => e.ms >= now.getTime() - 30 * 60000 && e.ms <= now.getTime() + 24 * 3600000).sort((a, b) => a.ms - b.ms);
    const sy = input.sync || {}, syncHour = num(sy.hour) !== null ? num(sy.hour) : 21, lastDay = sy.lastSyncAt ? iso(new Date(sy.lastSyncAt)) : '';
    const syncDue = !!sy.enabled && now.getHours() >= syncHour && lastDay !== today;
    const missing = [];
    if (num(cfg.maxRiskPct) === null && num(limits.riskPerTradePct) === null) missing.push('maxRiskPct');
    if (num(cfg.maxTradesPerDay) === null) missing.push('maxTradesPerDay');
    if (num(limits.balance) === null) missing.push('balance');
    const rulesBy = input.rulesBy || {}, ruleCount = Object.keys(rulesBy).reduce((n, k) => n + (rulesBy[k] || []).length, 0);
    return { today, now, allTrades: trades, hour: now.getHours(), weekday: WD[now.getDay()], hasData: trades.length > 0, total: trades.length, syncDue, kbReady: !!input.kbReady,
      todayStats: stats(todayTr), todayTrades: todayTr, weekStats: stats(weekTr), weekTrades: weekTr, all: stats(trades),
      open: trades.filter(isOpen), openNoSl: trades.filter(t => isOpen(t) && num(t.sl) === null),
      guard: input.guard && input.guard.rules ? input.guard : null, cfg, limits, missing,
      events: { upcoming, high: upcoming.filter(impactHigh), known: ev.length > 0 },
      log: input.dailyLog || null, weekend: !!input.isWeekend, rulesBy, strategies: input.strategies || [], ruleCount,
      groups: { symbol: groupBy(trades, t => t.symbol && String(t.symbol).toUpperCase()), setup: groupBy(trades, t => t.setup), session: groupBy(trades, t => t.sessions), weekday: groupBy(trades, t => t.date && WD[new Date(t.date + 'T12:00:00').getDay()]) },
      mistakes: topMistakes(trades), noSlCount: trades.filter(t => num(t.sl) === null).length };
  }
  function topMistakes(trades) { const m = {}; trades.forEach(t => (t.mistakes || []).forEach(x => { m[x] = (m[x] || 0) + 1; })); return Object.keys(m).map(k => ({ key: k, n: m[k] })).sort((a, b) => b.n - a.n); }

  /* ---------- verdict ("can I trade now?") ---------- */
  function verdict(s) {
    const R = [], add = (level, text, view) => R.push({ level, text, view: view || null });
    const g = s.guard && s.guard.rules;
    if (g) [['dailyLoss', 'سقف ضرر روزانه'], ['totalLoss', 'سقف ضرر کل']].forEach(([k, l]) => { const r = g[k]; if (!r) return; const who = r.account ? ' «' + r.account + '»' : ''; if (r.state === 'breach') add('stop', l + who + ' نقض شده؛ امروز معامله جدید نزن', 'accounts'); else if (r.state === 'warn') add('caution', fa(Math.round(r.usedFrac * 100)) + '٪ از ' + l + who + ' مصرف شده' + (r.remainingUsd !== undefined ? ' (باقی‌مانده ' + money(r.remainingUsd) + ')' : ''), 'propfirm'); });
    const mt = num(s.cfg.maxTradesPerDay); if (mt !== null && s.todayTrades.length >= mt) add('stop', 'سقف تعداد معامله امروز (' + fa(mt) + ') پر شده', 'risk');
    if (s.openNoSl.length) add('stop', fa(s.openNoSl.length) + ' معامله باز بدون حد ضرر داری؛ اول SL را مشخص کن', 'trades');
    const soon = s.events.high.find(e => e.ms - s.now.getTime() <= 3600000 && e.ms - s.now.getTime() >= -1800000);
    if (soon) { const m = Math.round((soon.ms - s.now.getTime()) / 60000); add('caution', 'خبر مهم «' + N(soon.name) + '» (' + (soon.country || '') + ') ' + (m >= 0 ? fa(m) + ' دقیقه دیگر' : 'تازه منتشر شده') + ' است؛ نوسان و اسپرد بالا می‌رود', 'calendar'); }
    const st = s.todayStats; if (st.streak.type === 'loss' && st.streak.len >= 2) add('caution', fa(st.streak.len) + ' ضرر پشت‌سرهم امروز؛ پیشنهاد AREX: ۱۵ دقیقه استراحت و مرور پلن (این قانون تو نیست، توصیه‌ی رفتاری است)', 'psych');
    if (s.log && Number(s.log.discipline) > 0 && Number(s.log.discipline) <= 2) add('caution', 'انضباط امروز را پایین ثبت کرده‌ای؛ حجم را کم نگه دار و فقط ستاپ‌های تأییدشده', 'daily');
    if (s.weekend) add('info', 'بازار فارکس الان بسته است (آخر هفته)', 'sessions');
    if (s.missing.includes('maxRiskPct')) add('info', 'سقف ریسک هر معامله تعریف نشده؛ بررسی ریسک انجام نمی‌شود', 'risk');
    if (s.ruleCount === 0 && !s.kbReady) add('info', 'هنوز قانون رسمی در پایگاه استراتژی نداری؛ قوانین مختص ستاپ بررسی نمی‌شود', 'strategy');
    const level = R.some(r => r.level === 'stop') ? 'stop' : R.some(r => r.level === 'caution') ? 'caution' : 'go';
    const order = { stop: 0, caution: 1, info: 2 };
    return { level, reasons: R.sort((a, b) => order[a.level] - order[b.level]), label: level === 'stop' ? '⛔ توقف' : level === 'caution' ? '⚠️ احتیاط' : '✅ شرایط ثبت‌شده مشکلی ندارد' };
  }

  /* ---------- proactive in-site alerts (deduped by key per day in the UI) ---------- */
  function proactive(s) {
    const A = [], add = (id, level, icon, title, body, view) => A.push({ id, level, icon, title, body, view: view || null });
    const g = s.guard && s.guard.rules;
    if (g) [['dailyLoss', 'ضرر روزانه'], ['totalLoss', 'ضرر کل']].forEach(([k, l]) => { const r = g[k]; if (!r) return; const who = r.account ? ' «' + r.account + '»' : ''; if (r.state === 'breach') add('guard-' + k + '-breach', 'danger', '⛔', 'سقف ' + l + who + ' نقض شد', 'معامله جدید نزن و وضعیت حساب را مرور کن.', 'accounts'); else if (r.state === 'warn') add('guard-' + k + '-warn', 'warn', '⚠️', 'نزدیک سقف ' + l + who, fa(Math.round(r.usedFrac * 100)) + '٪ مصرف شده.', 'accounts'); });
    if (s.syncDue) add('sync-night', 'warn', '☁️', 'وقت همگام‌سازی امشب', 'دکمه‌ی Sync را بزن تا نسخه‌ی Google Drive به‌روز شود.', 'sync');
    const mt = num(s.cfg.maxTradesPerDay); if (mt !== null && s.todayTrades.length >= mt) add('trades-cap', 'warn', '🧱', 'سقف تعداد معامله امروز پر شد', fa(s.todayTrades.length) + ' از ' + fa(mt) + ' معامله.', 'risk');
    if (s.openNoSl.length) add('open-no-sl', 'danger', '🛑', 'معامله باز بدون حد ضرر', fa(s.openNoSl.length) + ' معامله باز SL ندارد.', 'trades');
    s.events.high.forEach(e => { const m = Math.round((e.ms - s.now.getTime()) / 60000); if (m <= 60 && m > 15) add('news-60-' + e.id, 'warn', '📰', 'خبر مهم تا ' + fa(m) + ' دقیقه دیگر', N(e.name) + (e.country ? ' · ' + e.country : ''), 'calendar'); else if (m <= 15 && m >= -5) add('news-15-' + e.id, 'danger', '📰', m > 0 ? 'خبر مهم تا ' + fa(m) + ' دقیقه دیگر' : 'خبر مهم همین حالا منتشر شد', N(e.name) + (e.country ? ' · ' + e.country : '') + ' — برای پوزیشن‌های باز ریسک نوسان را بررسی کن.', 'calendar'); });
    const st = s.todayStats; if (st.streak.type === 'loss' && st.streak.len >= 3) add('loss-streak-' + st.streak.len, 'warn', '🧘', fa(st.streak.len) + ' ضرر پشت‌سرهم', 'استراحت کوتاه و مرور پلن بهتر از ادامه‌ی هیجانی است.', 'psych');
    if (s.hour >= 20 && s.todayTrades.length && !(s.log && s.log.journalDone)) add('journal-evening', 'info', '📝', 'مرور امروز را کامل کن', 'معاملات امروز ثبت شده‌اند؛ مرور و احساسات را هم بنویس.', 'daily');
    if ((s.weekday === 'جمعه' || s.weekday === 'شنبه') && s.weekStats.n >= 3) add('weekly-review', 'info', '📊', 'مرور هفتگی آماده است', 'از ربات بپرس: «مرور هفتگی».', 'assistant');
    return A;
  }

  /* ---------- next best action ---------- */
  function nextAction(s) {
    if (s.openNoSl.length) return { text: 'برای ' + fa(s.openNoSl.length) + ' معامله‌ی باز، حد ضرر را مشخص کن.', view: 'trades' };
    const v = verdict(s); if (v.level === 'stop') return { text: v.reasons[0].text, view: v.reasons[0].view };
    if (s.syncDue) return { text: 'امشب هنوز همگام‌سازی نکرده‌ای؛ دکمه‌ی Sync را بزن.', view: 'sync' };
    if (!s.hasData) return { text: 'اولین معامله (حتی قدیمی) را در ژورنال ثبت کن تا تحلیل‌ها شروع شود.', view: 'trades' };
    if (s.missing.includes('maxRiskPct') || s.missing.includes('balance')) return { text: 'موجودی و سقف ریسک هر معامله را در «مدیریت ریسک» تعریف کن.', view: 'risk' };
    if (s.ruleCount === 0 && !s.kbReady) return { text: 'قوانین ورود/خروج استراتژی‌ات را در «استراتژی و قوانین» ثبت و تأیید کن.', view: 'strategy' };
    if (v.level === 'caution') return { text: v.reasons[0].text, view: v.reasons[0].view };
    if (!s.events.known) return { text: 'تقویم اقتصادی را باز کن تا خبرهای مهم امروز را ببینم.', view: 'calendar' };
    if (s.hour >= 20 && s.todayTrades.length && !(s.log && s.log.journalDone)) return { text: 'مرور روزانه را کامل کن.', view: 'daily' };
    return { text: 'قبل از ورود، Pre-Trade Gate را در فرم معامله اجرا کن و قوانین ستاپ را تیک بزن.', view: 'trades' };
  }

  /* ---------- weekly review ---------- */
  function weeklyReview(trades, now) {
    now = now instanceof Date ? now : new Date();
    const d0 = iso(new Date(now.getTime() - 6 * DAY)), d1 = iso(now), p0 = iso(new Date(now.getTime() - 13 * DAY)), p1 = iso(new Date(now.getTime() - 7 * DAY));
    const cur = trades.filter(t => t.date >= d0 && t.date <= d1), prev = trades.filter(t => t.date >= p0 && t.date <= p1);
    const a = stats(cur), b = stats(prev), L = [], focus = [];
    if (!cur.length) return { empty: true, lines: ['در ۷ روز گذشته معامله‌ای ثبت نشده است.'], focus: ['اگر معامله کرده‌ای، ثبت ژورنال را از امروز شروع کن.'], metrics: a };
    L.push('📊 ۷ روز گذشته: ' + fa(a.n) + ' معامله بسته‌شده' + (a.winRate !== null ? '، وین‌ریت ' + fa(a.winRate) + '٪' : '') + (a.totalR !== null ? '، مجموع ' + ltr(fa(a.totalR) + 'R') + '' : '') + (a.totalUsd !== null ? '، ' + money(a.totalUsd) : '') + '.');
    if (b.n && a.totalR !== null && b.totalR !== null) L.push('نسبت به هفته‌ی قبل: ' + (a.totalR >= b.totalR ? '📈 بهتر' : '📉 ضعیف‌تر') + ' (' + ltr(fa(b.totalR) + 'R') + ' ← ' + ltr(fa(a.totalR) + 'R') + ').');
    const mk = topMistakes(cur); if (mk.length) { L.push('🏷️ پرتکرارترین اشتباه: «' + N(mk[0].key) + '» (' + fa(mk[0].n) + ' بار).'); focus.push('این هفته فقط روی «' + N(mk[0].key) + '» تمرکز کن: قبل از هر ورود یک چک‌لیست ۱۰ ثانیه‌ای.'); }
    const noSl = cur.filter(t => num(t.sl) === null).length; if (noSl) { L.push('⚠️ ' + fa(noSl) + ' معامله بدون حد ضرر ثبت شده.'); focus.push('هیچ معامله‌ای بدون SL ثبت یا اجرا نشود.'); }
    const bw = bestWorst(groupBy(cur, t => t.setup)); if (bw) { L.push('🎯 بهترین ستاپ: «' + N(bw.best.key) + '» (میانگین ' + ltr(fa(bw.best.avgR) + 'R') + ') · ضعیف‌ترین: «' + N(bw.worst.key) + '» (' + ltr(fa(bw.worst.avgR) + 'R') + ').'); if (bw.worst.avgR < 0) focus.push('ستاپ «' + N(bw.worst.key) + '» را مرور کن یا حجمش را کم کن تا نمونه‌ی بیشتری جمع شود.'); }
    if (a.maxLossStreak >= 3) focus.push('رشته‌ی ' + fa(a.maxLossStreak) + ' ضرر پشت‌سرهم داشتی؛ برای آن قانون توقف (مثلاً توقف پس از ۲ ضرر) تعریف کن.');
    const nn = cur.filter(t => t.nearNews); if (nn.length >= 2) { const sn = stats(nn); if (sn.avgR !== null && sn.avgR < 0) focus.push('معاملات نزدیک خبر میانگین ' + ltr(fa(sn.avgR) + 'R') + ' داشتند؛ نزدیک خبر مهم کمتر وارد شو.'); }
    if (a.n < MIN_SAMPLE) L.push('ℹ️ نمونه کمتر از ' + fa(MIN_SAMPLE) + ' معامله است؛ نتیجه‌گیری قطعی نکن.');
    if (!focus.length) focus.push('روند منظم است؛ همین رویه را ادامه بده و پیش از ورود قوانین ستاپ را تیک بزن.');
    return { empty: false, lines: L, focus: focus.slice(0, 3), metrics: a, prev: b };
  }

  /* ---------- Q&A ---------- */
  const NAV = { trades: 'ژورنال معاملات', risk: 'مدیریت ریسک', strategy: 'استراتژی و قوانین', calendar: 'تقویم اقتصادی', propfirm: 'پراپ‌فرم', analytics: 'تحلیل عملکرد', psych: 'روان‌شناسی', daily: 'مرور روزانه', sessions: 'سشن‌های بازار', settings: 'تنظیمات', goals: 'اهداف', backtest: 'بک‌تست', roadmap: 'برنامه روزانه' };
  const btn = v => ({ label: NAV[v] || v, view: v });
  const has = (x, re) => re.test(x);
  function answer(text, s) {
    const q = norm(text), out = (t, o) => Object.assign({ text: t, nav: [], chips: [], confidence: 0.9 }, o || {});
    if (!q) return out('سؤالت را بنویس یا یکی از گزینه‌ها را بزن.', { chips: defaultChips(s), confidence: 0 });
    if (has(q, /^(سلام|درود|hi|hello|hey)(?![\u0600-\u06FFa-z])/) && q.length < 24) return out('سلام! 👋 من آرکس‌ام. وضعیت امروزت، ریسک، اخبار، قوانین استراتژی و مرور عملکرد را از روی داده‌های خودت بررسی می‌کنم.\n\n' + brief(s), { chips: defaultChips(s) });
    if (has(q, /(قدم بعد|بعدش چی|چیکار کنم|چه کار کنم|از کجا شروع|شروع کنم|راهنما|what next|next step|where to start)/)) { const n = nextAction(s); return out('👉 ' + n.text, { nav: n.view ? [btn(n.view)] : [], chips: ['وضعیت امروز', 'مرور هفتگی'] }); }
    if (has(q, /(مرور هفتگی|گزارش هفتگی|هفته گذشته|این هفته|weekly)/)) { const w = weeklyReview(s.allTrades || [], s.now); return out(w.lines.join('\n') + (w.focus.length ? '\n\n🎯 تمرکز هفته‌ی بعد:\n' + w.focus.map((f, i) => fa(i + 1) + '. ' + f).join('\n') : ''), { nav: [btn('analytics')], chips: ['اشتباهات تکراری من', 'بهترین ستاپ'] }); }
    if (has(q, /(می ?تونم|میشه|می ?شه|مجازم|can i|should i).*(معامله|ترید|وارد|ورود|trade|enter)|(وضعیت ریسک|شرایط معامله|امن)/)) { const v = verdict(s); return out(v.label + '\n' + v.reasons.slice(0, 4).map(r => '• ' + r.text).join('\n') + (v.level === 'go' ? '\n\nاین فقط بررسی موارد ثبت‌شده توست؛ سیگنال خرید/فروش یا تضمین سود نیست.' : ''), { nav: v.reasons.length && v.reasons[0].view ? [btn(v.reasons[0].view)] : [btn('trades')], chips: ['قدم بعدی چیه؟', 'اخبار امروز'] }); }
    if (has(q, /(وضعیت|امروز|today|status|خلاصه)/) && !has(q, /خبر|اخبار|تقویم/)) return out(brief(s, true), { nav: [btn('roadmap')], chips: ['میتونم معامله کنم؟', 'اخبار امروز'] });
    if (has(q, /(خبر|اخبار|تقویم|news|calendar|رویداد|nfp|cpi|fomc)/)) {
      if (!s.events.known) return out('هنوز رویدادی از تقویم دریافت نشده. تقویم اقتصادی را باز کن و فید را وصل/تازه‌سازی کن تا بتوانم هشدار خبر بدهم.', { nav: [btn('calendar')], confidence: 0.8 });
      const up = s.events.upcoming.slice(0, 6); if (!up.length) return out('در ۲۴ ساعت آینده رویداد ثبت‌شده‌ای در فید نیست.', { nav: [btn('calendar')] });
      const hm = ms => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
      return out('📰 رویدادهای پیش‌رو (به وقت تهران):\n' + up.map(e => '• ' + fa(hm(e.ms)) + ' ' + (impactHigh(e) ? '🔴' : '⚪') + ' ' + N(e.name) + (e.country ? ' (' + e.country + ')' : '')).join('\n') + '\n\nقبل و بعد از خبر 🔴 اسپرد و نوسان بالا می‌رود.', { nav: [btn('calendar')], chips: ['میتونم معامله کنم؟'] });
    }
    if (has(q, /(قانون|قوانین|استراتژی|ستاپ|rule|strategy|setup)/)) return out(rulesAnswer(q, s), { nav: [btn('strategy')], chips: ['قدم بعدی چیه؟'] });
    if (has(q, /(اشتباه|mistake|fomo|انتقام|خطا)/)) { if (!s.mistakes.length) return out('هنوز اشتباهی روی معاملات تگ نشده. هنگام ثبت معامله «اشتباهات» را علامت بزن تا الگوها را پیدا کنم.', { nav: [btn('trades')] }); const t = s.mistakes.slice(0, 3); return out('🏷️ اشتباهات پرتکرار:\n' + t.map(m => '• ' + N(m.key) + ' — ' + fa(m.n) + ' بار').join('\n') + '\n\nپیشنهاد: برای «' + N(t[0].key) + '» یک قانون شخصی بنویس و قبل از ورود تیک بزن.', { nav: [btn('strategy'), btn('analytics')] }); }
    if (has(q, /(بهترین|ضعیف|بدترین|best|worst|سود ده|زیان ده)/)) return out(bestAnswer(s), { nav: [btn('analytics')] });
    if (has(q, /(وین ?ریت|win ?rate|عملکرد|performance|expectancy|میانگین r|سود|ضرر کل|profit)/)) return out(perfAnswer(s), { nav: [btn('analytics')], chips: ['مرور هفتگی', 'بهترین ستاپ'] });
    if (has(q, /(ریسک|حجم|لات|risk|lot|سایز|position)/)) return out(riskAnswer(q, s), { nav: [btn('risk')], chips: ['میتونم معامله کنم؟'] });
    if (has(q, /(احساس|استرس|ترس|طمع|روان|تیلت|tilt|psych|انضباط)/)) return out('🧠 مهم‌ترین کار پیش از معامله: حال و انضباط را ثبت کن. ' + (s.todayStats.streak.type === 'loss' && s.todayStats.streak.len >= 2 ? 'الان ' + fa(s.todayStats.streak.len) + ' ضرر پشت‌سرهم داری؛ بهتر است استراحت کنی.' : 'اگر عصبی یا هیجانی هستی حجم را کم کن یا امروز معامله نکن.'), { nav: [btn('psych'), btn('daily')] });
    if (has(q, /(بکاپ|پشتیبان|drive|درایو|backup|ذخیره)/)) return out('پشتیبان‌گیری: از دکمه‌ی همگام‌سازی بالای صفحه یا «تنظیمات ← پشتیبان» استفاده کن. دیتای مرورگر جایگزین بکاپ نیست؛ هفته‌ای یک‌بار Drive را ذخیره و بازیابی را آزمایش کن.', { nav: [btn('settings')] });
    if (has(q, /(ثبت معامله|معامله ثبت|(چطور|چگونه|how).*(ثبت|معامله|ژورنال|journal)|کجا.*(ثبت|بخش|صفحه|تنظیم))/)) return out('برای ثبت معامله به «ژورنال معاملات» برو، نماد، جهت، ورود/SL/TP، ستاپ و احساست را پر کن و قبل از ذخیره Pre-Trade Gate را بزن. برای هر بخش دیگر نام آن را بپرس (ریسک، تقویم، پراپ، تحلیل...).', { nav: [btn('trades')], chips: ['قدم بعدی چیه؟'] });
    return out('این سؤال را با داده‌های داخل برنامه نمی‌توانم دقیق جواب بدهم.', { needsAI: true, confidence: 0.2, chips: defaultChips(s) });
  }
  const defaultChips = s => s.hasData ? ['وضعیت امروز', 'میتونم معامله کنم؟', 'اخبار امروز', 'مرور هفتگی'] : ['از کجا شروع کنم؟', 'چطور معامله ثبت کنم؟'];
  function brief(s, long) {
    const v = verdict(s), t = s.todayStats, L = [v.label];
    L.push(s.todayTrades.length ? 'امروز ' + fa(s.todayTrades.length) + ' معامله' + (t.totalUsd !== null ? '، ' + money(t.totalUsd) : '') + (t.totalR !== null ? '، ' + ltr(fa(t.totalR) + 'R') + '' : '') + '.' : 'امروز هنوز معامله‌ای ثبت نشده.');
    const g = s.guard && s.guard.rules && s.guard.rules.dailyLoss; if (g && g.limitUsd !== undefined) L.push('سقف ضرر روزانه: ' + fa(Math.round(g.usedFrac * 100)) + '٪ مصرف شده (باقی‌مانده ' + money(g.remainingUsd) + ').');
    const n = s.events.high[0]; if (n) L.push('📰 خبر مهم بعدی: ' + N(n.name) + ' — ' + fa(Math.max(0, Math.round((n.ms - s.now.getTime()) / 60000))) + ' دقیقه دیگر.');
    if (long) { v.reasons.slice(0, 3).forEach(r => L.push('• ' + r.text)); L.push('👉 ' + nextAction(s).text); }
    return L.join('\n');
  }
  function perfAnswer(s) { const a = s.all; if (!a.n) return 'هنوز معامله‌ی بسته‌شده‌ای با R یا مبلغ ثبت نشده، پس آماری نمی‌سازم.'; const L = ['📈 کل ' + fa(a.n) + ' معامله: وین‌ریت ' + fa(a.winRate) + '٪' + (a.avgR !== null ? '، میانگین ' + ltr(fa(a.avgR) + 'R') + '' : '') + (a.profitFactor !== null ? '، ضریب سود ' + fa(a.profitFactor) : '') + (a.totalUsd !== null ? '، مجموع ' + money(a.totalUsd) : '') + '.']; if (a.maxLossStreak >= 3) L.push('بیشترین ضرر متوالی: ' + fa(a.maxLossStreak) + '.'); if (a.n < 30) L.push('ℹ️ نمونه کوچک است (کمتر از ۳۰)؛ این اعداد هنوز قطعی نیستند.'); return L.join('\n'); }
  function bestAnswer(s) { const L = []; [['setup', 'ستاپ'], ['symbol', 'نماد'], ['session', 'سشن'], ['weekday', 'روز هفته']].forEach(([k, l]) => { const bw = bestWorst(s.groups[k]); if (bw) L.push('• ' + l + ': بهترین «' + N(bw.best.key) + '» (' + ltr(fa(bw.best.avgR) + 'R') + '، ' + fa(bw.best.n) + ' معامله) · ضعیف‌ترین «' + N(bw.worst.key) + '» (' + ltr(fa(bw.worst.avgR) + 'R') + ')'); }); return L.length ? '🎯 مقایسه (حداقل ' + fa(MIN_SAMPLE) + ' معامله در هر گروه):\n' + L.join('\n') : 'برای مقایسه‌ی ستاپ/نماد/سشن حداقل ' + fa(MIN_SAMPLE) + ' معامله‌ی بسته در هر گروه (و دست‌کم دو گروه) لازم است.'; }
  function riskAnswer(q, s) {
    const nums = (q.match(/\d+(?:\.\d+)?/g) || []).map(Number), L = [];
    const pctM = q.match(/(\d+(?:\.\d+)?)\s*(?:%|درصد)/), balM = q.match(/(\d[\d.]*)\s*(?:\$|دلار|usd)/) || q.match(/(?:موجودی|بالانس|balance)\s*(\d[\d.]*)/);
    const bal = balM ? Number(balM[1]) : num(s.limits.balance), pct = pctM ? Number(pctM[1]) : num(s.limits.riskPerTradePct) || num(s.cfg.maxRiskPct);
    if (bal && pct) L.push('با موجودی ' + money(bal) + ' و ریسک ' + fa(pct) + '٪ ← مبلغ ریسک هر معامله ' + money(bal * pct / 100) + '.');
    L.push('حجم دقیق به فاصله‌ی SL، ارزش پیپ و گام لات بروکر بستگی دارد؛ ماشین‌حساب «مدیریت ریسک» لات را به پایین گرد می‌کند تا ریسک از حد مجاز بیشتر نشود.');
    if (s.missing.includes('maxRiskPct')) L.push('⚠️ سقف ریسک هر معامله هنوز تعریف نشده.');
    return L.join('\n');
  }
  function rulesAnswer(q, s) {
    const names = s.strategies.filter(n => n && q.includes(norm(n))), keys = names.length ? names : Object.keys(s.rulesBy).filter(k => (s.rulesBy[k] || []).length);
    if (!keys.length) return 'هنوز قانون رسمی (تأییدشده) ثبت نکرده‌ای. در «استراتژی و قوانین» قانون پیشنهاد بده و تأییدش کن؛ تا آن زمان هیچ قانونی را حدس نمی‌زنم.';
    const K = { mandatory: '🔴 الزامی', confirmed: '🟡 تأییدشده', preference: '⚪ ترجیح' };
    return keys.slice(0, 3).map(k => '📋 ' + (k || 'عمومی') + ':\n' + (s.rulesBy[k] || []).slice(0, 8).map(r => '• ' + (K[r.kind] || '') + ' ' + r.text).join('\n')).join('\n\n');
  }
  function aiContext(s) {
    const slim = t => ({ d: t.date, sym: t.symbol, dir: t.dir, setup: t.setup, r: num(t.r), usd: num(t.usd), mistakes: t.mistakes });
    return { today: s.today, weekday: s.weekday, verdict: verdict(s).label, verdictReasons: verdict(s).reasons.map(r => r.text), todayTrades: s.todayTrades.slice(0, 10).map(slim), stats: s.all, week: s.weekStats,
      guard: s.guard && { overall: s.guard.overall, dailyLoss: s.guard.rules.dailyLoss, totalLoss: s.guard.rules.totalLoss }, limits: { cfg: s.cfg, balance: s.limits.balance, riskPerTradePct: s.limits.riskPerTradePct },
      upcomingEvents: s.events.upcoming.slice(0, 6).map(e => ({ name: e.name, country: e.country, impact: e.impact, inMin: Math.round((e.ms - s.now.getTime()) / 60000) })),
      topMistakes: s.mistakes.slice(0, 5), best: { setup: bestWorst(s.groups.setup), symbol: bestWorst(s.groups.symbol) }, rules: Object.keys(s.rulesBy).slice(0, 5).reduce((o, k) => (o[k || 'general'] = (s.rulesBy[k] || []).slice(0, 8).map(r => r.kind + ': ' + r.text), o), {}),
      lastTrades: (s.allTrades || []).slice(-12).map(slim), missing: s.missing };
  }
  return { MIN_SAMPLE, NAV, norm, fa, stats, outcome, isOpen, snapshot, verdict, proactive, nextAction, weeklyReview, answer, aiContext, defaultChips };
});
