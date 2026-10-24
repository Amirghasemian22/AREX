/* AREX Phase 27 — mistake trend analysis from explicitly tagged trades only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.mistakeTrends=api;}})(typeof self!=='undefined'?self:this,function(){
  function analyze(trades=[], startDate='', endDate=''){
    const rows=(Array.isArray(trades)?trades:[]).filter(t=>t&&(!startDate||String(t.date||'')>=startDate)&&(!endDate||String(t.date||'')<=endDate));
    const map=new Map();
    rows.forEach(t=>{
      const tags=Array.isArray(t.mistakes)?t.mistakes:[t.mistakes];
      const unique=[...new Set(tags.map(x=>String(x==null?'':x).trim()).filter(Boolean))];
      unique.forEach(name=>{
        if(!map.has(name))map.set(name,{name,count:0,tradeIds:[],dates:[],knownUsd:0,usdCount:0,positive:0,negative:0});
        const item=map.get(name);item.count++;if(t.id!=null)item.tradeIds.push(String(t.id));if(t.date)item.dates.push(String(t.date));
        const raw=t.usd; if(raw!==null&&raw!==undefined&&String(raw).trim()!==''&&Number.isFinite(Number(raw))){item.knownUsd+=Number(raw);item.usdCount++;if(Number(raw)>0)item.positive++;if(Number(raw)<0)item.negative++;}
      });
    });
    const items=[...map.values()].map(x=>({...x,firstDate:x.dates.length?x.dates.sort()[0]:null,lastDate:x.dates.length?x.dates.sort()[x.dates.length-1]:null,tradeIds:[...new Set(x.tradeIds)],financialCoverage:x.usdCount===x.count?'complete':x.usdCount?'partial':'unavailable'})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    return {startDate,endDate,tradeCount:rows.length,taggedTradeCount:rows.filter(t=>Array.isArray(t.mistakes)?t.mistakes.some(x=>String(x||'').trim()):String(t.mistakes||'').trim()).length,items,repeated:items.filter(x=>x.count>=2),note:'این گزارش فقط برچسب‌های اشتباه ثبت‌شده را می‌شمارد. ارتباط برچسب با سود/ضرر به‌تنهایی علت را ثابت نمی‌کند؛ اثر مالی فقط از نتیجه USD ثبت‌شده و با اعلام پوشش داده نمایش داده می‌شود.'};
  }
  return {analyze};
});
