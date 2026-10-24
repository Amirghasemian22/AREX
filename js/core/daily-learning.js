/* AREX Phase 26 — evidence-based daily review helpers. No trade signals or causal claims. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.dailyLearning=api;}})(typeof self!=='undefined'?self:this,function(){
  function summarize(trades=[], log={}) {
    const rows=Array.isArray(trades)?trades:[];
    const withR=rows.filter(t=>t&&t.r!==null&&t.r!==undefined&&String(t.r).trim()!==''&&Number.isFinite(Number(t.r)));
    const noSL=rows.filter(t=>!String(t&&t.sl||'').trim()).length;
    const compliance=rows.filter(t=>t&&t.ruleCompliance!==null&&t.ruleCompliance!==undefined&&String(t.ruleCompliance).trim()!=='');
    const mistakes={}; rows.forEach(t=>(Array.isArray(t&&t.mistakes)?t.mistakes:[]).forEach(m=>{const k=String(m||'').trim();if(k)mistakes[k]=(mistakes[k]||0)+1;}));
    const repeated=Object.entries(mistakes).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]);
    let action=null, reason=null;
    if(log.status==='no' && /ستاپ معتبر|بازار نامناسب|روز استراحت/.test(String(log.reason||''))){action='این تصمیم را با پلن مکتوب مقایسه کن و نمونه‌ای از شرایط بازار را ثبت کن.';reason='دلیل ثبت‌شده برای معامله‌نکردن';}
    else if(noSL){action='پیش از نتیجه‌گیری، فیلد حد ضرر معاملات را تکمیل یا تأیید کن؛ مشخص نیست خالی‌بودن فیلد به معنی نداشتن حد ضرر است.';reason='اطلاعات ناقص ژورنال';}
    else if(compliance.some(t=>Number(t.ruleCompliance)<100)){action='یک معامله با پایبندی ناقص را بازبینی کن و دقیقاً مشخص کن کدام قانون اجرا نشد.';reason='پایبندی ثبت‌شده کمتر از ۱۰۰٪';}
    else if(repeated.length){action='نمونه‌های اشتباه پرتکرار را بازبینی کن و برای هرکدام یک اقدام پیشگیرانه قابل‌اندازه‌گیری تعریف کن.';reason='تکرار در داده‌های ثبت‌شده';}
    else if(rows.length && withR.length<rows.length){action='نتیجه R معاملات فاقد این داده را تکمیل کن تا مرور عملکرد بر داده‌های کامل‌تری تکیه کند.';reason='نتیجه R ناقص';}
    else if(!log.journalDone && rows.length){action='تأیید کن همه معاملات امروز در ژورنال کامل شده‌اند.';reason='تکمیل ژورنال هنوز تأیید نشده';}
    else if(!log.nextAction){action='یک اقدام کوچک برای جلسه بعد بنویس؛ مثلاً مرور یک معامله و بررسی پایبندی به پلن.';reason='اقدام بعدی ثبت نشده';}
    return {tradeCount:rows.length, rCount:withR.length, noSLCount:noSL, complianceCount:compliance.length, repeatedMistakes:repeated.map(([name,count])=>({name,count})), suggestedAction:action, actionReason:reason, hasEvidence:rows.length>0||!!log.status};
  }
  return {summarize};
});
