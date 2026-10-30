/* AREX V9.8.0 — core/behavior: (1) rule audit of the journal against the knowledge base's machine-checkable rules (every finding cites its section),
   (2) behaviour analysis: stop-loss/TP changes, revenge trades, overtrading, hour x weekday map. Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.behavior = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(String(v).replace(/[\s,]/g, '')); return Number.isFinite(n) ? n : null; };
  const r2 = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const out = t => { const r = num(t.r), u = num(t.usd); return r !== null && r !== 0 ? Math.sign(r) : (u !== null && u !== 0 ? Math.sign(u) : (r === 0 || u === 0 ? 0 : null)); };
  const when = t => { const a = t.openedAt && /T/.test(t.openedAt) ? t.openedAt : (t.date + 'T' + (t.time || '00:00')); return Date.parse(a.length === 16 ? a + ':00' : a); };
  const byTime = a => a.slice().sort((x, y) => (when(x) || 0) - (when(y) || 0));
  const day = t => String(t.date || '').slice(0, 10);

  /** Rules extracted from the knowledge base. `source` is the section the rule lives in; `conflict` is the open ambiguity (if any) that affects it. */
  const RULES = {
    NO_SL: { source: '§10.3', text: 'معامله بدون SL ممنوع است.' },
    SL_WIDENED: { source: '§10.3', text: 'SL نباید جابه‌جا شود.' },
    TP_RAISED: { source: '§10.3', text: 'افزایش‌دادن TP بعد از ورود ممنوع است.' },
    RISK_CAP: { source: '§10.1', conflict: 'K5', text: 'ریسک هر معامله حداکثر ۱٪ (ترجیح ۰٫۵٪).' },
    LOW_RR: { source: '§10.1', text: 'RR کمتر از ۲ نامطلوب است.' },
    DAY_COUNT: { source: '§10.2', conflict: 'K4', text: 'معمولاً ۳ تا ۴ معامله در روز و حداکثر ۵ در شرایط استثنایی.' },
    DAY_LOSS_STOP: { source: '§10.2', conflict: 'K4', text: 'با رسیدن به ۳٪ ضرر روزانه معامله متوقف شود.' },
    LOSS_STREAK_STOP: { source: '§10.2', conflict: 'K4', text: 'پس از ۲ تا ۳ زیان توقف کن.' },
    MON_AM_FRI_PM: { source: '§10.3', text: 'معامله در دوشنبه صبح و جمعه بعدازظهر طبق یادداشت روان‌شناسی ممنوع است.' },
    TAGGED_FOMO: { source: '§10.3', text: 'FOMO و انتقام از بازار ممنوع است.' }
  };
  const mk = (rule, level, t, extra) => Object.assign({ rule, level, tradeId: t && t.id, date: t && day(t), source: RULES[rule].source, conflict: RULES[rule].conflict || null, text: RULES[rule].text }, extra || {});

  /** ctx: {balanceOf(accountId)->number|null, decisions:{K4:{...}}, accountOf(t)->id} */
  function audit(trades, ctx) {
    ctx = ctx || {}; const dec = ctx.decisions || {}, items = [], sorted = byTime(trades.filter(t => when(t)));
    const k4 = !!dec.K4, byDay = {};
    sorted.forEach(t => { (byDay[day(t)] = byDay[day(t)] || []).push(t); });
    sorted.forEach(t => {
      const sl = num(t.sl), slo = num(t.slOriginal), e = num(t.entry), buy = !/sell|short|فروش/i.test(String(t.dir || ''));
      if (sl === null && slo === null) items.push(mk('NO_SL', 'violation', t));
      if (slo !== null && sl !== null && slo !== sl && e !== null) { const widened = buy ? sl < slo : sl > slo; items.push(mk('SL_WIDENED', widened ? 'violation' : 'warning', t, { detail: widened ? 'SL از ' + slo + ' به ' + sl + ' دورتر شد' : 'SL از ' + slo + ' به ' + sl + ' تغییر کرد (نزدیک‌تر)' })); }
      const tp = num(t.tp), tpo = num(t.tpOriginal); if (tp !== null && tpo !== null && (buy ? tp > tpo : tp < tpo)) items.push(mk('TP_RAISED', 'violation', t, { detail: 'TP از ' + tpo + ' به ' + tp }));
      const rp = num(t.riskPct); if (rp !== null && rp > 1) items.push(mk('RISK_CAP', 'violation', t, { detail: 'ریسک ' + rp + '٪' }));
      const rr = num(t.plannedRR); if (rr !== null && rr < 2) items.push(mk('LOW_RR', 'warning', t, { detail: 'RR برنامه‌ریزی‌شده ۱:' + rr }));
      const d = new Date(when(t)), wd = d.getDay(), h = d.getHours();
      if ((wd === 1 && h < 12) || (wd === 5 && h >= 12)) items.push(mk('MON_AM_FRI_PM', 'warning', t, { detail: WD[wd] + (h < 12 ? ' صبح' : ' بعدازظهر') }));
      if ((t.mistakes || []).some(m => /fomo|انتقام|revenge/i.test(m))) items.push(mk('TAGGED_FOMO', 'violation', t, { detail: 'خودت این معامله را FOMO/انتقام برچسب زده‌ای' }));
    });
    Object.keys(byDay).forEach(dk => {
      const L = byDay[dk]; if (L.length > 5) L.slice(5).forEach(t => items.push(mk('DAY_COUNT', 'violation', t, { detail: 'معامله‌ی ' + (L.indexOf(t) + 1) + 'م در یک روز (سقف استثنایی ۵)' })));
      else if (L.length > 4) items.push(mk('DAY_COUNT', 'warning', L[4], { detail: '۵ معامله در یک روز (فقط شرایط استثنایی)' }));
      let loss = 0, streak = 0; const bal = ctx.balanceOf ? ctx.balanceOf(ctx.accountOf ? ctx.accountOf(L[0]) : null) : null;
      L.forEach((t, i) => {
        if (i > 0) { if (bal > 0 && loss <= -0.03 * bal) items.push(mk('DAY_LOSS_STOP', 'violation', t, { detail: 'پس از ' + r2(-loss / bal * 100, 1) + '٪ ضرر روزانه ادامه داده‌ای' })); if (streak >= 3) items.push(mk('LOSS_STREAK_STOP', 'violation', t, { detail: 'پس از ' + streak + ' ضرر پشت‌سرهم ادامه دادی' })); else if (streak === 2) items.push(mk('LOSS_STREAK_STOP', k4 ? 'info' : 'decision', t, { detail: 'پس از ۲ ضرر پشت‌سرهم ادامه دادی؛ دانش‌نامه «۲ تا ۳» می‌گوید و ابهام K4 هنوز ' + (k4 ? 'تصمیم داده شده' : 'باز است') })); }
        const u = num(t.usd), o = out(t); if (u !== null) loss += u; if (o < 0) streak++; else if (o > 0) streak = 0;
      });
    });
    const summary = { violations: items.filter(i => i.level === 'violation').length, warnings: items.filter(i => i.level === 'warning').length, decisions: items.filter(i => i.level === 'decision').length, byRule: {} };
    items.forEach(i => { summary.byRule[i.rule] = (summary.byRule[i.rule] || 0) + 1; });
    return { items, summary, checked: sorted.length, unknown: { risk: sorted.filter(t => num(t.riskPct) === null).length, balance: ctx.balanceOf ? 0 : sorted.length } };
  }

  /** Behaviour patterns that cost money even when each trade "looks fine". */
  function analyze(trades, o) {
    o = o || {}; const T = byTime(trades.filter(t => when(t))), res = { revenge: [], overtradingDays: [], slMoves: 0, tpMoves: 0, widened: 0, heat: {}, insights: [] };
    for (let i = 1; i < T.length; i++) { const p = T[i - 1], c = T[i]; if (out(p) !== -1 || day(p) !== day(c)) continue;
      const gap = (when(c) - (Date.parse(p.closedAt || '') || when(p))) / 60000, lp = num(p.lots), lc = num(c.lots);
      if (gap >= 0 && gap <= (o.revengeMin || 20)) res.revenge.push({ id: c.id, date: day(c), gapMin: Math.round(gap), biggerLot: lp !== null && lc !== null && lc > lp, lossFirst: num(p.usd), result: num(c.usd) }); }
    const per = {}; T.forEach(t => { per[day(t)] = (per[day(t)] || 0) + 1; }); Object.keys(per).forEach(d => { if (per[d] > 5) res.overtradingDays.push({ date: d, n: per[d] }); });
    T.forEach(t => { const sl = num(t.sl), slo = num(t.slOriginal), tp = num(t.tp), tpo = num(t.tpOriginal), buy = !/sell|short|فروش/i.test(String(t.dir || '')); if (slo !== null && sl !== null && slo !== sl) { res.slMoves++; if (buy ? sl < slo : sl > slo) res.widened++; } if (tpo !== null && tp !== null && tpo !== tp) res.tpMoves++; });
    T.forEach(t => { const d = new Date(when(t)), k = d.getDay() + '-' + d.getHours(), r = num(t.r); if (r === null) return; const c = res.heat[k] = res.heat[k] || { n: 0, r: 0, wd: d.getDay(), h: d.getHours() }; c.n++; c.r += r; });
    const cells = Object.values(res.heat).filter(c => c.n >= 4); const worst = cells.slice().sort((a, b) => a.r / a.n - b.r / b.n)[0], best = cells.slice().sort((a, b) => b.r / b.n - a.r / a.n)[0];
    const rv = res.revenge, lossAfter = rv.map(x => x.result).filter(v => v !== null);
    if (rv.length >= 3) res.insights.push('🔁 ' + rv.length + ' بار کمتر از ' + (o.revengeMin || 20) + ' دقیقه بعد از ضرر معامله‌ی بعدی را باز کرده‌ای' + (lossAfter.length ? '؛ مجموع نتیجه‌ی آن معاملات ' + r2(lossAfter.reduce((a, b) => a + b, 0)) + '$ بوده' : '') + '. بین ضرر و معامله‌ی بعد حداقل یک وقفه‌ی مشخص بگذار.');
    if (res.widened) res.insights.push('⚠️ ' + res.widened + ' بار SL را دورتر کرده‌ای؛ این دقیقاً رفتار ممنوعِ ثبت‌شده در دانش‌نامه (§10.3) است.');
    if (res.tpMoves) res.insights.push('⚠️ ' + res.tpMoves + ' بار TP را بعد از ورود تغییر داده‌ای.');
    if (res.overtradingDays.length) res.insights.push('📈 ' + res.overtradingDays.length + ' روز بیش از ۵ معامله داشته‌ای (سقف دانش‌نامه: ۳–۴ معمولی، ۵ استثنایی).');
    if (worst && worst.r / worst.n < 0 && cells.length >= 3) res.insights.push('🕒 ضعیف‌ترین بازه: ' + WD[worst.wd] + ' ساعت ' + worst.h + ' (میانگین ' + r2(worst.r / worst.n) + 'R در ' + worst.n + ' معامله)' + (best && best !== worst ? ' · بهترین: ' + WD[best.wd] + ' ساعت ' + best.h + ' (' + r2(best.r / best.n) + 'R)' : '') + '. ساعت‌ها به وقت ثبت‌شده در معامله‌اند.');
    res.cells = cells; return res;
  }
  return { RULES, audit, analyze, WD };
});
