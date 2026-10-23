/* AREX rule audit v1: maps trades to the historically valid confirmed KB version and reports only recorded evidence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.ruleaudit=api;}})(typeof self!=='undefined'?self:this,function(){
 const n=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
 function audit(kb,trades,opts={}){
   const rows=Array.isArray(trades)?trades:[], threshold=n(opts.complianceThreshold)??100, result=[], unknown=[];
   for(const t of rows){
     const d=String(t.date||''); if(!d){unknown.push({tradeId:t.id,reason:'تاریخ معامله ثبت نشده؛ نسخه معتبر قابل تعیین نیست'});continue;}
     const match=kb&&Array.isArray(kb.versions)?kb.versions.reduce((best,v)=>{const vd=String(v.date||''),vt=String(v.time||'00:00'),tt=String(t.time||'');if(vd<d||(vd===d&&((tt&&vt<=tt)||!tt)))return !best||`${vd} ${vt}`>`${best.date} ${best.time||'00:00'}`?v:best;return best;},null):null;
     if(!match){unknown.push({tradeId:t.id,date:d,reason:'در زمان معامله نسخه رسمی ثبت‌شده‌ای وجود ندارد'});continue;}
     const ambiguous=!t.time&&match.date===d;
     const compliance=n(t.ruleCompliance);
     result.push({tradeId:t.id,date:d,time:String(t.time||''),setup:String(t.setup||''),versionId:match.id,versionN:match.n,versionDate:match.date,ambiguous,ruleCompliance:compliance,complianceFlag:compliance===null? 'unknown':compliance<threshold?'below-threshold':'meets-threshold',outcomeR:n(t.r),outcomeUsd:n(t.usd),ruleCount:(match.snapshot||[]).filter(r=>!r.strategy||String(r.strategy).trim().toLowerCase()===String(t.setup||'').trim().toLowerCase()).length});
   }
   const groups={}; for(const r of result){const k=String(r.versionN);groups[k]=groups[k]||{versionId:r.versionId,versionN:r.versionN,count:0,complianceKnown:0,belowThreshold:0,complianceSum:0,withR:0,netR:0,ambiguous:0};const g=groups[k];g.count++;if(r.ambiguous)g.ambiguous++;if(r.ruleCompliance!==null){g.complianceKnown++;g.complianceSum+=r.ruleCompliance;if(r.ruleCompliance<threshold)g.belowThreshold++;}if(r.outcomeR!==null){g.withR++;g.netR+=r.outcomeR;}}
   Object.values(groups).forEach(g=>{g.avgCompliance=g.complianceKnown?g.complianceSum/g.complianceKnown:null;delete g.complianceSum;});
   return {total:rows.length,attributed:result.length,unknown,rows:result,groups:Object.values(groups).sort((a,b)=>a.versionN-b.versionN),threshold,limitations:['این گزارش نسخه تاریخی را براساس تاریخ/ساعت ثبت‌شده نسبت می‌دهد؛ منطقه زمانی جداگانه‌ای ثبت/تبدیل نمی‌شود.','وجود یک قانون در نسخه، به معنی رعایت یا نقض آن در معامله نیست. فقط ruleCompliance ثبت‌شده گزارش می‌شود.','برای ارزیابی هر قانون به‌صورت جداگانه باید وضعیت همان قانون هنگام ثبت معامله ذخیره شده باشد؛ این داده برای معاملات قدیمی حدس زده نمی‌شود.']};
 }
 return {audit};
});
