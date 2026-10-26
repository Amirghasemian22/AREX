/* AREX cloud sync safety policy: stable local snapshots and backup envelope checks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.cloudSync=api;}})(typeof self!=='undefined'?self:this,function(){
  const canonical = value => JSON.stringify(value, (key,val) => val && typeof val==='object' && !Array.isArray(val) ? Object.keys(val).sort().reduce((o,k)=>(o[k]=val[k],o),{}) : val);
  function sameSnapshot(a,b){return canonical(a)===canonical(b);}
  async function readStableSnapshot({flush,getStatus,readAll,maxAttempts=3,wait=()=>Promise.resolve()}){
    if(typeof readAll!=='function')throw new Error('cloud_sync_reader_required');
    for(let attempt=0;attempt<Math.max(1,maxAttempts);attempt++){
      if(typeof flush==='function'){
        const ok=await flush();
        if(ok===false)throw new Error('local_save_pending');
      }
      const status=typeof getStatus==='function'?getStatus():null;
      if(status&&(status.pendingCount>0||status.inFlight||status.hasError))throw new Error('local_save_pending');
      const first=await readAll();
      const statusAfter=typeof getStatus==='function'?getStatus():null;
      if(statusAfter&&(statusAfter.pendingCount>0||statusAfter.inFlight||statusAfter.hasError)){await wait(attempt);continue;}
      const second=await readAll();
      const statusFinal=typeof getStatus==='function'?getStatus():null;
      if(statusFinal&&(statusFinal.pendingCount>0||statusFinal.inFlight||statusFinal.hasError)){await wait(attempt);continue;}
      if(sameSnapshot(first,second))return {data:second,attempts:attempt+1};
      await wait(attempt);
    }
    throw new Error('local_data_changing_during_backup');
  }
  function validateCloudManifest(meta,itemCount){
    const errors=[];
    if(!meta||typeof meta!=='object')return{ok:false,errors:['manifest_missing']};
    if(typeof meta.currentSnapshotId!=='string'||!meta.currentSnapshotId||meta.currentSnapshotId.length>160)errors.push('snapshot_id_invalid');
    if(!Number.isInteger(meta.itemCount)||meta.itemCount<0||meta.itemCount>10000)errors.push('item_count_invalid');
    if(Number.isInteger(meta.itemCount)&&Number.isInteger(itemCount)&&meta.itemCount!==itemCount)errors.push('item_count_mismatch');
    return{ok:errors.length===0,errors};
  }
  function createManifest(data,createdAt){return{schemaVersion:6,createdAt:createdAt||new Date().toISOString(),itemCount:Object.keys(data||{}).length,appVersion:'AREX V9.7.13',complete:false};}
  return{sameSnapshot,readStableSnapshot,validateCloudManifest,createManifest};
});
