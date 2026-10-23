/* AREX V9.6.3 — core/pretrade: Pre-Trade Gate. Pure.
   Verdicts: 'blocked' (غیرمجاز) | 'needs_info' (نیازمند اطلاعات) | 'allowed' (مجاز).
   'allowed' only means: none of the checks the USER defined failed. It is NOT a recommendation and NOT a guarantee of profit.
   Nothing is assumed: limits that the user has not defined produce an informational reason, never a default threshold. */
(function (root, factory) {
  const api = factory(typeof require === 'function' ? require('./util.js') : root.AREXCore.util);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.pretrade = api; }
})(typeof self !== 'undefined' ? self : this, function (U) {
  const DISCLAIMER = 'نتیجه دروازه فقط بررسی همین موارد تعریف‌شده توسط توست؛ توصیه معامله یا تضمین سود نیست.';

  /** input: {trade:{dir,entry,sl,tp,riskPct}, cfg:{maxRiskPct,minRR,maxTradesPerDay}, guard:(propguard.evaluate result|null),
              rules:[{id,text,kind}] (official rules valid now for the strategy), ticked:[ids], tradesToday:number, hasStrategy:boolean} */
  function evaluate(input) {
    const tr = input.trade || {}, cfg = input.cfg || {}, reasons = [];
    const add = (level, text, ref, code, p) => reasons.push({ level, text, ref: ref || null, code: code || null, p: p || {} });
    const dir = String(tr.dir || '').toLowerCase(), isBuy = dir === 'buy' || dir === 'long', isSell = dir === 'sell' || dir === 'short';
    const entry = U.toNum(tr.entry), sl = U.toNum(tr.sl), tp = U.toNum(tr.tp), risk = U.toNum(tr.riskPct);
    if (!isBuy && !isSell) add('missing', 'جهت معامله مشخص نیست', 'dir', 'miss_dir');
    if (entry === null) add('missing', 'نقطه ورود وارد نشده است', 'entry', 'miss_entry');
    if (sl === null) add('missing', 'حد ضرر (SL) وارد نشده است', 'sl', 'miss_sl');
    if (tp === null) add('missing', 'حد سود (TP) وارد نشده است', 'tp', 'miss_tp');
    let rr = null;
    if ((isBuy || isSell) && entry !== null && sl !== null) {
      const riskDist = isBuy ? entry - sl : sl - entry;
      if (riskDist <= 0) add('block', 'SL در سمت نادرست ورود است یا با ورود برابر است', 'sl', 'sl_side');
      else if (tp !== null) {
        const rewardDist = isBuy ? tp - entry : entry - tp;
        if (rewardDist <= 0) add('block', 'TP در سمت نادرست ورود است یا با ورود برابر است', 'tp', 'tp_side');
        else rr = U.round(rewardDist / riskDist, 3);
      }
    }
    const minRR = U.toNum(cfg.minRR);
    if (minRR === null) add('info', 'حداقل نسبت سود به زیان تعریف نشده است؛ بررسی RR انجام نشد', 'minRR', 'minrr_undef');
    else if (rr !== null && rr < minRR) add('block', 'نسبت سود به زیان ' + rr + ' کمتر از حداقل تعریف‌شده (' + minRR + ') است', 'rr', 'rr_low', { rr, m: minRR });
    const maxRisk = U.toNum(cfg.maxRiskPct);
    if (maxRisk === null) add('info', 'سقف ریسک هر معامله تعریف نشده است؛ بررسی ریسک انجام نشد', 'maxRiskPct', 'maxrisk_undef');
    else if (risk === null) add('missing', 'درصد ریسک این معامله وارد نشده است', 'riskPct', 'risk_missing');
    else if (risk > maxRisk) add('block', 'ریسک ' + risk + '٪ بیشتر از سقف تعریف‌شده (' + maxRisk + '٪) است', 'riskPct', 'risk_over', { r: risk, m: maxRisk });
    const g = input.guard;
    if (g && g.rules) {
      for (const [k, label] of [['dailyLoss', 'سقف ضرر روزانه'], ['totalLoss', 'سقف ضرر کل']]) {
        const r = g.rules[k]; if (!r) continue;
        if (r.state === 'breach') add('block', label + ' نقض شده است', k, 'guard_breach', { w: k });
        else if (r.state === 'warn') add('warn', 'نزدیک ' + label + ' هستی (مصرف ' + Math.round(r.usedFrac * 100) + '٪)', k, 'guard_warn', { w: k, p: Math.round(r.usedFrac * 100) });
        else if (r.state === 'needs_info') add('info', label + ' تعریف نشده است', k, 'guard_undef', { w: k });
      }
    }
    const mt = U.toNum(cfg.maxTradesPerDay), today = U.toNum(input.tradesToday) || 0;
    if (mt === null) add('info', 'سقف تعداد معامله روزانه تعریف نشده است', 'maxTradesPerDay', 'trades_undef');
    else if (today >= mt) add('block', 'سقف تعداد معامله امروز (' + mt + ') پر شده است', 'maxTradesPerDay', 'trades_full', { m: mt });
    if (!input.hasStrategy) add('info', 'استراتژی/ستاپ مشخص نشده؛ قوانین مختص استراتژی بررسی نشد', 'strategy', 'no_strategy');
    else if (!(input.rules || []).length) add('info', 'قانون رسمی تأییدشده‌ای برای این استراتژی در پایگاه دانش نیست؛ هیچ قانونی حدس زده نشد', 'rules', 'no_rules');
    const ticked = new Set(input.ticked || []);
    for (const r of input.rules || []) {
      if (ticked.has(r.id)) continue;
      if (r.kind === 'mandatory') add('block', 'قانون الزامی رعایت/تأیید نشده: ' + r.text, r.id, 'rule_mandatory', { t: r.text });
      else if (r.kind === 'confirmed') add('warn', 'قانون تأییدشده تیک نخورده: ' + r.text, r.id, 'rule_confirmed', { t: r.text });
      else add('info', 'ترجیح شخصی تیک نخورده: ' + r.text, r.id, 'rule_pref', { t: r.text });
    }
    const verdict = reasons.some(r => r.level === 'block') ? 'blocked' : reasons.some(r => r.level === 'missing') ? 'needs_info' : 'allowed';
    return { verdict, rr, reasons, disclaimer: DISCLAIMER };
  }
  return { DISCLAIMER, evaluate };
});
