/* AREX phase 23: deterministic journal/analytics consistency audit. No inferred trade values. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.tradeAudit=api;}})(typeof self!=='undefined'?self:this,function(){
  const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[\u06f0-\u06f9]/g,d=>String(d.charCodeAt(0)-0x06f0)).replace('٫','.').replace(/٬/g,''));return Number.isFinite(n)?n:null;};
  function auditTrades(trades){
    const rows=Array.isArray(trades)?trades:[], errors=[], warnings=[], seen=new Map();
    rows.forEach((t,index)=>{
      if(!t||typeof t!=='object'||Array.isArray(t)){errors.push({code:'invalid_record',index});return;}
      if(t.id===undefined||t.id===null||String(t.id).trim()==='')errors.push({code:'missing_id',index});
      else {const id=String(t.id);if(seen.has(id))errors.push({code:'duplicate_id',id,index,firstIndex:seen.get(id)});else seen.set(id,index);}
      if(typeof t.date==='string'&&t.date.trim()&&!/^\d{4}-\d{2}-\d{2}$/.test(t.date))warnings.push({code:'non_iso_date',id:t.id,index});
      if(t.date&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)){const d=new Date(t.date+'T00:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==t.date)errors.push({code:'invalid_date',id:t.id,index});}
      if(t.symbol!==undefined&&t.symbol!==null&&!String(t.symbol).trim())warnings.push({code:'empty_symbol',id:t.id,index});
      for(const field of ['r','usd','riskPct','entry','exit','sl','tp'])if(t[field]!==undefined&&t[field]!==null&&String(t[field]).trim()!==''&&num(t[field])===null)warnings.push({code:'invalid_numeric',field,id:t.id,index});
      const r=num(t.r),usd=num(t.usd);if(r!==null&&usd!==null&&r!==0&&usd!==0&&Math.sign(r)!==Math.sign(usd))warnings.push({code:'r_usd_sign_mismatch',id:t.id,index,r,usd});
    });
    return {ok:errors.length===0,total:rows.length,errors,warnings,uniqueIds:seen.size};
  }
  function auditAnalytics(trades,analytics){
    if(!analytics||typeof analytics.summarize!=='function')return{ok:false,errors:[{code:'analytics_unavailable'}]};
    const a=analytics.summarize(Array.isArray(trades)?trades:[]),ids=new Set((Array.isArray(trades)?trades:[]).filter(t=>t&&t.id!==undefined&&t.id!==null).map(t=>String(t.id))),errors=[];
    const numeric=['total','counted','excluded','wins','losses','breakeven'];
    for(const k of numeric)if(!Number.isFinite(a[k]))errors.push({code:'non_finite_metric',field:k});
    if(a.counted+a.excluded!==a.total)errors.push({code:'count_partition_mismatch',total:a.total,counted:a.counted,excluded:a.excluded});
    if(a.wins+a.losses+a.breakeven!==a.counted)errors.push({code:'outcome_partition_mismatch'});
    if(Array.isArray(a.equityCurveR)&&a.equityCurveR.length!==a.rSample)errors.push({code:'r_curve_length_mismatch'});
    const badIds=[];for(const group of analytics.bySymbol(Array.isArray(trades)?trades:[]))for(const id of group.tradeIds||[])if(!ids.has(String(id)))badIds.push(id);
    if(badIds.length)errors.push({code:'orphan_group_trade_ids',ids:badIds});
    return{ok:errors.length===0,errors,summary:{total:a.total,counted:a.counted,excluded:a.excluded,totalR:a.totalR,totalUsd:a.totalUsd,profitFactorBasis:a.profitFactorBasis}};
  }
  function auditEvidence(findings,trades){const ids=new Set((Array.isArray(trades)?trades:[]).filter(Boolean).map(t=>String(t.id))),errors=[];for(const f of Array.isArray(findings)?findings:[])for(const id of Array.isArray(f.tradeIds)?f.tradeIds:[])if(!ids.has(String(id)))errors.push({code:'orphan_finding_trade_id',findingId:f.id,tradeId:id});return{ok:errors.length===0,errors};}
  const CRITICAL=new Set(['invalid_record','missing_id','duplicate_id','invalid_date','analytics_unavailable','non_finite_metric','count_partition_mismatch','outcome_partition_mismatch','r_curve_length_mismatch','orphan_group_trade_ids']);
  const WARNING=new Set(['non_iso_date','empty_symbol','invalid_numeric','r_usd_sign_mismatch','orphan_finding_trade_id']);
  function buildDiagnosticReport(trades,analytics,findings,meta){
    const rows=Array.isArray(trades)?trades:[], t=auditTrades(rows), a=auditAnalytics(rows,analytics), e=auditEvidence(findings,rows);
    const items=[];
    for(const x of t.errors)items.push({severity:'critical',source:'journal',...x});
    for(const x of t.warnings)items.push({severity:WARNING.has(x.code)?'warning':'info',source:'journal',...x});
    for(const x of a.errors)items.push({severity:CRITICAL.has(x.code)?'critical':'warning',source:'analytics',...x});
    for(const x of e.errors)items.push({severity:'warning',source:'evidence',...x});
    const counts={critical:items.filter(x=>x.severity==='critical').length,warning:items.filter(x=>x.severity==='warning').length,info:items.filter(x=>x.severity==='info').length};
    return {schemaVersion:1,generatedAt:new Date().toISOString(),readOnly:true,source:'local-journal',meta:meta&&typeof meta==='object'?{accountScope:meta.accountScope||'current-session'}:{accountScope:'current-session'},summary:{tradeCount:rows.length,uniqueIds:t.uniqueIds,tradeAuditOk:t.ok,analyticsAuditOk:a.ok,evidenceAuditOk:e.ok,...counts,totalIssues:items.length},items};
  }
  return{auditTrades,auditAnalytics,auditEvidence,buildDiagnosticReport};
});
