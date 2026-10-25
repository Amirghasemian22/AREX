/* AREX save reliability helpers: pure policy helpers shared by UI and tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.saveReliability=api;}})(typeof self!=='undefined'?self:this,function(){
  const MAX_AUTO_RETRIES=3;
  function retryDelay(attempt,baseMs=1000,maxMs=15000){const n=Math.max(0,Number(attempt)||0);return Math.min(maxMs,baseMs*Math.pow(2,Math.min(n,10)));}
  function dirtyKeys(dirty){return Object.keys(dirty||{}).filter(k=>dirty[k]===true);}
  function status(dirty,inFlight,lastError){const pending=dirtyKeys(dirty);return{pendingCount:pending.length,pendingKeys:pending,inFlight:!!inFlight,hasError:!!lastError,message:pending.length?(lastError?'unsaved_error':'unsaved_pending'):(inFlight?'saving':'saved')};}
  function shouldRetry(attempt){return Number(attempt)<MAX_AUTO_RETRIES;}
  async function persistIfUnchanged(dirty,revisions,key,writer){const revision=revisions[key];await writer();if(revisions[key]===revision)dirty[key]=false;return revisions[key]===revision;}
  return{MAX_AUTO_RETRIES,retryDelay,dirtyKeys,status,shouldRetry,persistIfUnchanged};
});
