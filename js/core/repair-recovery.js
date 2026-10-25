/* AREX phase 28: conservative recovery planning and stale-snapshot protection. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.repairRecovery=api;}})(typeof self!=='undefined'?self:this,function(){
  function snapshot(event){return event&&typeof event==='object'?JSON.stringify({eventId:event.eventId,eventType:event.eventType,tradeId:event.tradeId,field:event.field,before:event.before,after:event.after,reason:event.reason,timestamp:event.timestamp,status:event.status}):'';}
  function scan(history,trades,historyApi){
    const h=historyApi.normalize(history),pending=h.entries.filter(e=>e.status==='pending');
    const items=pending.map(event=>({eventId:event.eventId,tradeId:event.tradeId,field:event.field,snapshot:snapshot(event),...historyApi.reconcile(event,trades)}));
    const counts={pending:pending.length,ready:0,conflict:0,missing:0,ambiguous:0,unavailable:0};
    for(const item of items){if(item.suggestedStatus)counts.ready++;else if(item.state==='conflict')counts.conflict++;else if(item.state==='trade_missing')counts.missing++;else if(item.state==='ambiguous_trade_id')counts.ambiguous++;else counts.unavailable++;}
    return {schemaVersion:1,readOnly:true,counts,items};
  }
  function resolve(history,eventId,expectedSnapshot,trades,targetStatus,historyApi){
    if(!historyApi||!['applied','failed'].includes(targetStatus))return{ok:false,code:'invalid_request'};
    const h=historyApi.normalize(history),matches=h.entries.filter(e=>e.eventId===eventId);
    if(matches.length!==1)return{ok:false,code:matches.length?'duplicate_event_id':'event_not_found'};
    const event=matches[0];if(event.status!=='pending')return{ok:false,code:'not_pending'};
    if(snapshot(event)!==expectedSnapshot)return{ok:false,code:'stale_history'};
    const rec=historyApi.reconcile(event,trades);if(rec.suggestedStatus!==targetStatus)return{ok:false,code:'stale_or_ambiguous_trade'};
    const updated=historyApi.updateStatus(h,eventId,targetStatus);if(!updated.ok)return updated;
    return{ok:true,history:updated.history,eventId,targetStatus,reconciliation:rec.state};
  }
  return{snapshot,scan,resolve};
});
