/* AREX actionable alert engine. Pure and evidence-first.
 * Thresholds that turn a pattern into an actionable alert must be explicitly configured by the user.
 * Notification dedupe is based on a stable fingerprint; this module never makes trade recommendations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.alertEngine=api;}})(typeof self!=='undefined'?self:this,function(){
 const DEFAULTS={cooldownHours:24};
 function fingerprint(a){return [a.type||'pattern',a.id||'',(a.tradeIds||[]).map(String).sort().join(',')].join('|');}
 function evaluate(findings, config, history, now){config=config||{};history=history||{};now=Number.isFinite(now)?now:Date.now();const rules=config.rules||{},cooldown=Math.max(0,Number(config.cooldownHours??DEFAULTS.cooldownHours)||0),alerts=[],candidates=[],suppressed=[];
  (findings||[]).forEach(f=>{const rule=rules[f.id];const item={id:f.id,label:f.label||f.id,count:Number(f.count||f.value||0),confidence:f.confidence||'low',evidence:f.evidence||'',tradeIds:Array.isArray(f.tradeIds)?f.tradeIds.slice():[],firstDate:f.firstDate||null,lastDate:f.lastDate||null,avgR:f.avgR??null,lossRate:f.lossRate??null};
   if(!rule||rule.enabled!==true||!Number.isFinite(Number(rule.minCount))||Number(rule.minCount)<1){candidates.push({...item,reason:'threshold_not_confirmed'});return;}
   if(item.count<Number(rule.minCount)){candidates.push({...item,reason:'below_user_threshold',threshold:Number(rule.minCount)});return;}
   const fp=fingerprint(item),prev=history[fp],last=prev&&Number(prev.lastNotifiedAt);if(Number.isFinite(last)&&now-last<cooldown*3600000){suppressed.push({...item,reason:'cooldown',nextEligibleAt:new Date(last+cooldown*3600000).toISOString()});return;}
   alerts.push({...item,fingerprint:fp,threshold:Number(rule.minCount),action:rule.action||'review_journal',actionableText:rule.actionableText||'معاملات مستندکننده را مرور کن و علت را ثبت کن.',generatedAt:new Date(now).toISOString()});
  });
  return {alerts,candidates,suppressed,cooldownHours:cooldown,notice:'هشدارها نشانه‌ای برای مرور هستند، نه توصیه خریدوفروش یا اثبات رابطه علت و معلولی.'};
 }
 function record(history, alert, now){const out=Object.assign({},history||{});if(!alert||!alert.fingerprint)return out;out[alert.fingerprint]={lastNotifiedAt:Number.isFinite(now)?now:Date.now(),id:alert.id,tradeIds:(alert.tradeIds||[]).map(String),count:alert.count};return out;}
 function cleanHistory(history, maxAgeDays, now){now=Number.isFinite(now)?now:Date.now();const cutoff=now-(Math.max(1,Number(maxAgeDays)||90)*86400000),out={};Object.keys(history||{}).forEach(k=>{if(Number(history[k]&&history[k].lastNotifiedAt)>=cutoff)out[k]=history[k];});return out;}
 return {DEFAULTS,fingerprint,evaluate,record,cleanHistory};
});
