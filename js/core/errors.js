/* AREX V9.6.3 — core/errors: repeated-mistake detection from EVIDENCE ONLY. Pure.
   Each finding: count, frequency (count/total trades), date range, up to 5 sample trade ids, estimated cost and confidence.
   Estimated cost = sum of losing outcomes of the flagged trades (R and USD separately). It is a descriptive sum, not proof of causation.
   What cannot be detected from the stored fields is returned in `needsInfo` instead of being guessed. */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util,
                      typeof require === 'function' ? require('./analytics.js') : root.AREXCore.analytics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.errors = api; }
})(typeof self !== 'undefined' ? self : this, function (U, A) {
  // User-tag keyword -> category. Matches the user's OWN mistake tags (substring, case-insensitive).
  const TAG_CATEGORIES = [
    { id: 'early_entry', label: 'ورود زودهنگام', kw: ['زودهنگام', 'ورود زود', 'early entry'] },
    { id: 'hasty_exit', label: 'خروج عجولانه', kw: ['خروج عجول', 'خروج زود', 'hasty exit', 'early exit'] },
    { id: 'off_plan', label: 'معامله خارج از قوانین', kw: ['خارج از پلن', 'خارج از قوانین', 'off plan', 'off-plan'] },
    { id: 'sl_moved', label: 'جابه‌جایی SL', kw: ['جابه‌جایی sl', 'جابجایی sl', 'حرکت sl', 'moved sl', 'sl moved'] },
    { id: 'over_risk', label: 'ریسک بیش‌ازحد', kw: ['ریسک بیش', 'ریسک زیاد', 'over risk', 'overrisk'] },
    { id: 'revenge', label: 'انتقام‌ترید', kw: ['انتقام', 'revenge'] },
    { id: 'overtrading', label: 'بیش‌معامله‌گری', kw: ['بیش‌معامله', 'بیشمعامله', 'overtrad'] }
  ];
  const matchTag = (tag, cat) => { const x = String(tag).toLowerCase(); return cat.kw.some(k => x.includes(k.toLowerCase())); };

  function build(id, label, flagged, total, confidence, evidence, extra) {
    const dates = flagged.map(t => t.date).filter(Boolean).sort();
    let costR = 0, costUsd = 0, outcomeN = 0, losses = 0, sumR = 0, nR = 0;
    for (const t of flagged) {
      const o = A.outcome(t);
      if (o.v !== null) { outcomeN++; if (o.v < 0) losses++; }
      if (o.r !== null) { sumR += o.r; nR++; }
      // Descriptive loss sum only. Never imply this amount was caused by the behavior.
      if (o.r !== null && o.r < 0) costR += o.r;
      if (o.usd !== null && o.usd < 0) costUsd += o.usd;
    }
    return Object.assign({
      id, label, count: flagged.length, repeated: flagged.length >= 2,
      frequency: total ? U.round(flagged.length / total) : null,
      firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null,
      sampleIds: flagged.slice(0, 5).map(t => t.id), tradeIds: flagged.map(t => t.id),
      estCostR: U.round(costR), estCostUsd: U.round(costUsd, 2), confidence, evidence,
      outcomeCount: outcomeN, lossRate: outcomeN ? U.round(losses / outcomeN) : null,
      avgR: nR ? U.round(sumR / nR) : null,
      sampleAdequate: flagged.length >= 5,
      trend: 'not_calculated', trendNote: flagged.length < 4 ? 'نمونه برای سنجش روند کافی نیست' : 'روند زمانی در این نسخه محاسبه نمی‌شود'
    }, extra || {});
  }

  /** cfg: {maxTradesPerDay, maxRiskPct, revengeWindowMin=30, complianceMin=100} */
  function detect(trades, cfg) {
    cfg = cfg || {}; trades = U.sortTrades(trades || []);
    const total = trades.length, findings = [], needsInfo = [];
    // 1) User-tagged mistakes -> categories (high confidence: the user labelled them).
    for (const cat of TAG_CATEGORIES) {
      const f = trades.filter(t => (t.mistakes || []).some(m => matchTag(m, cat)));
      if (f.length) findings.push(build('tag:' + cat.id, cat.label, f, total, 'high', 'برچسب اشتباه ثبت‌شده توسط خود کاربر'));
    }
    // 1b) Emotion-associated outcomes. This is an association, not a diagnosis or proof of causation.
    const emoFields = ['emotionBefore', 'emotion', 'emoBefore'];
    const emotionOf = t => {
      for (const k of emoFields) { const v = String(t[k] || '').trim(); if (v) return v; }
      return '';
    };
    const emoMap = new Map();
    for (const t of trades) {
      const emo = emotionOf(t); if (!emo) continue;
      const key = emo.toLocaleLowerCase(); if (!emoMap.has(key)) emoMap.set(key, { label: emo, trades: [] });
      emoMap.get(key).trades.push(t);
    }
    for (const [key, group] of emoMap) {
      const resolved = group.trades.filter(t => A.outcome(t).v !== null);
      if (group.trades.length >= 3 && resolved.length >= 3) {
        const lossN = resolved.filter(t => A.outcome(t).v < 0).length;
        const lossRate = lossN / resolved.length;
        if (lossRate >= 0.6) findings.push(build('emotion:' + key.replace(/[^a-z0-9_-]/gi, '_'),
          'نتایج ضعیف‌تر همراه با احساس: ' + group.label, group.trades, total, 'low',
          'حداقل ۳ معامله دارای نتیجه با این احساس ثبت شده و سهم معاملات زیان‌ده حداقل ۶۰٪ است؛ همبستگی است نه علت',
          { emotion: group.label, resolvedCount: resolved.length, observedLossRate: U.round(lossRate), associationOnly: true }));
      }
    }
    // 2) Rule compliance below threshold (ruleCompliance is the % of checklist rules ticked).
    const cmin = U.toNum(cfg.complianceMin) ?? 100;
    const lowC = trades.filter(t => { const c = U.toNum(t.ruleCompliance); return c !== null && c < cmin; });
    if (lowC.length) findings.push(build('rules:low_compliance', 'چک‌لیست قوانین ناقص', lowC, total, 'high', 'درصد رعایت قوانین کمتر از ' + cmin + '٪', { evParams: { c: cmin } }));
    // 3) Revenge-timing pattern: entry soon after a losing trade the same day. Only entry times exist, so confidence is capped at 'low' unless user-tagged.
    const win = U.toNum(cfg.revengeWindowMin) ?? 30, rev = [];
    for (let i = 1; i < trades.length; i++) {
      const p = trades[i - 1], c = trades[i];
      if (p.date !== c.date) continue;
      const po = A.outcome(p).v, pm = U.toMinutes(p.time), cm = U.toMinutes(c.time);
      if (po !== null && po < 0 && pm !== null && cm !== null && cm - pm >= 0 && cm - pm <= win) rev.push(c);
    }
    if (rev.length) findings.push(build('timing:after_loss', 'ورود سریع پس از ضرر', rev, total, 'low',
      'فاصله زمان ورود تا معامله زیان‌ده قبلی ≤ ' + win + ' دقیقه (فقط زمان ورود ثبت شده؛ نشانه است نه اثبات)', { evParams: { w: win } }));
    // 4) Overtrading: needs the user's limit.
    const mt = U.toNum(cfg.maxTradesPerDay);
    if (mt === null) needsInfo.push({ id: 'overtrading', need: 'سقف تعداد معاملات روزانه (maxTradesPerDay) تعریف نشده است' });
    else {
      const byDay = {}; trades.forEach(t => (byDay[t.date] = byDay[t.date] || []).push(t));
      const over = []; Object.values(byDay).forEach(d => { if (d.length > mt) over.push(...d.slice(mt)); });
      if (over.length) findings.push(build('limit:overtrading', 'بیش‌معامله‌گری (فراتر از سقف روزانه)', over, total, 'high', 'تعداد معاملات روز بیش از سقف ' + mt, { evParams: { m: mt } }));
    }
    // 5) Over-risk: needs riskPct on trades and the user's cap.
    const mr = U.toNum(cfg.maxRiskPct), withRisk = trades.filter(t => U.toNum(t.riskPct) !== null);
    if (mr === null) needsInfo.push({ id: 'over_risk', need: 'سقف ریسک هر معامله (maxRiskPct) تعریف نشده است' });
    else if (!withRisk.length) needsInfo.push({ id: 'over_risk', need: 'درصد ریسک (riskPct) در معاملات ثبت نشده است' });
    else {
      const f = withRisk.filter(t => U.toNum(t.riskPct) > mr);
      if (f.length) findings.push(build('limit:over_risk', 'ریسک بیش از سقف مجاز', f, total, 'high', 'riskPct بیش از ' + mr + '٪', { evParams: { m: mr } }));
      if (withRisk.length < total) needsInfo.push({ id: 'over_risk_partial', need: (total - withRisk.length) + ' معامله بدون riskPct بررسی نشد', p: { n: total - withRisk.length } });
    }
    // 6) SL moved: needs the original SL.
    const withOrig = trades.filter(t => U.toNum(t.slOriginal) !== null && U.toNum(t.sl) !== null);
    if (!withOrig.length) needsInfo.push({ id: 'sl_moved', need: 'SL اولیه (slOriginal) ثبت نشده است' });
    else {
      const f = withOrig.filter(t => {
        const o = U.toNum(t.slOriginal), n = U.toNum(t.sl), long = String(t.dir).toLowerCase().startsWith('b') || String(t.dir).toLowerCase().startsWith('l');
        return Math.abs(o - n) > 1e-12 && (long ? n < o : n > o);   // moved further from entry = widened risk
      });
      if (f.length) findings.push(build('data:sl_widened', 'دورکردن SL از ورود', f, total, 'high', 'SL نهایی دورتر از SL اولیه'));
    }
    needsInfo.push({ id: 'early_late', need: 'تشخیص خودکار ورود زودهنگام/خروج عجولانه بدون قوانین تأییدشده استراتژی و داده قیمت ممکن نیست؛ فقط از برچسب‌های کاربر استفاده می‌شود' });
    // Explain limitations rather than silently interpreting absent fields as good behavior.
    if (total && !trades.some(t => emotionOf(t))) needsInfo.push({ id: 'emotion_data', need: 'احساس قبل از معامله در ژورنال ثبت نشده؛ ارتباط احساس و نتیجه قابل ارزیابی نیست' });
    findings.sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
    return { total, findings, needsInfo, summary: {
      repeatedFindings: findings.filter(f => f.repeated).length,
      singleOccurrenceFindings: findings.filter(f => !f.repeated).length,
      lowConfidenceFindings: findings.filter(f => f.confidence === 'low').length,
      note: 'هزینه تخمینی، جمع زیان ثبت‌شده معاملات علامت‌گذاری‌شده است و رابطه علت و معلولی را ثابت نمی‌کند.'
    } };
  }
  return { TAG_CATEGORIES, detect };
});
