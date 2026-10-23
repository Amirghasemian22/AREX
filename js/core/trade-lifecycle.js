/* AREX trade lifecycle helpers: pure and testable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.tradeLifecycle=api;}})(typeof self!=='undefined'?self:this,function(){
  function removeTrade(trades,id){
    const list=Array.isArray(trades)?trades:[];
    const index=list.findIndex(t=>t&&String(t.id)===String(id));
    if(index<0)return{trades:list.slice(),removed:null,index:-1,duplicateId:false};
    const removed=list[index];
    return{trades:list.filter((_,i)=>i!==index),removed,index,duplicateId:list.filter(t=>t&&String(t.id)===String(id)).length>1};
  }
  function assetKeys(id){const key=String(id);return['tradeshot:'+key+':entry','tradeshot:'+key+':exit','voice:'+key];}
  function reconcileDailyLog(log,hasRemainingTrades){
    if(!log||hasRemainingTrades)return log?Object.assign({},log):null;
    const next=Object.assign({},log);
    if(next.status==='yes')next.status='';
    next.journalDone=false;
    return next;
  }
  function assertUniqueTradeIds(trades){
    const seen=new Set(),duplicates=[];
    for(const t of Array.isArray(trades)?trades:[]){if(!t||t.id===undefined||t.id===null)continue;const id=String(t.id);if(seen.has(id)&&!duplicates.includes(id))duplicates.push(id);seen.add(id);}
    return{ok:duplicates.length===0,duplicates};
  }
  return{removeTrade,assetKeys,reconcileDailyLog,assertUniqueTradeIds};
});
