/* AREX phase 30: safe, opt-in runtime checks for local persistence and snapshot readiness. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.runtimeVerification=api;}})(typeof self!=='undefined'?self:this,function(root){
  const nowIso=()=>new Date().toISOString();
  async function checkStorageRoundTrip(storage, options={}){
    if(!storage||typeof storage.set!=='function'||typeof storage.get!=='function'||typeof storage.delete!=='function')return{ok:false,code:'storage_adapter_unavailable'};
    const key='__arex_runtime_probe__'+(options.probeId||Math.random().toString(36).slice(2));
    const payload={marker:'AREX_RUNTIME_CHECK',nonce:options.nonce||Math.random().toString(36).slice(2),at:nowIso()};
    let writeAttempted=false;
    try{
      const existing=await storage.get(key);
      if(existing!==null&&existing!==undefined)return{ok:false,code:'probe_key_collision'};
      writeAttempted=true;
      await storage.set(key,JSON.stringify(payload));
      const record=await storage.get(key);
      const raw=record&&Object.prototype.hasOwnProperty.call(record,'value')?record.value:record;
      const value=typeof raw==='string'?JSON.parse(raw):raw;
      if(!value||value.marker!==payload.marker||value.nonce!==payload.nonce)return{ok:false,code:'storage_round_trip_mismatch'};
      return{ok:true,code:'storage_round_trip_ok'};
    }catch(error){return{ok:false,code:'storage_round_trip_failed',detail:String(error&&error.message||error).slice(0,180)};}
    finally{if(writeAttempted){try{await storage.delete(key);}catch(_){/* Report cleanup through a separate verification, never hide the primary result. */}}}
  }
  function assessSaveStatus(status){
    if(!status||typeof status!=='object')return{ok:false,code:'save_status_unavailable'};
    if(status.pendingCount>0||status.inFlight||status.hasError)return{ok:false,code:'local_save_not_idle',pendingCount:Number(status.pendingCount)||0,inFlight:!!status.inFlight,hasError:!!status.hasError};
    return{ok:true,code:'local_save_idle'};
  }
  async function checkStableLocalSnapshot({storage,flush,getStatus,maxAttempts=3,wait}){
    if(!storage||typeof storage.getAllData!=='function')return{ok:false,code:'snapshot_reader_unavailable'};
    try{
      const C=typeof module==='object'&&module.exports?require('./cloud-sync.js'):(root.AREXCore&&root.AREXCore.cloudSync);
      const result=await C.readStableSnapshot({flush,getStatus,readAll:()=>storage.getAllData(),maxAttempts,wait});
      return{ok:true,code:'stable_snapshot_ok',attempts:result.attempts,itemCount:Object.keys(result.data||{}).length};
    }catch(error){return{ok:false,code:String(error&&error.message||error).slice(0,100)};}
  }
  async function run({storage,getSaveStatus,flushSave,includeSnapshot=false,wait}={}){
    const checks=[];
    checks.push({name:'local_storage_round_trip',...(await checkStorageRoundTrip(storage))});
    checks.push({name:'save_queue',...assessSaveStatus(typeof getSaveStatus==='function'?getSaveStatus():null)});
    if(includeSnapshot)checks.push({name:'stable_local_snapshot',...(await checkStableLocalSnapshot({storage,flush:flushSave,getStatus:getSaveStatus,wait}))});
    return{schemaVersion:1,checkedAt:nowIso(),ok:checks.every(c=>c.ok),checks};
  }
  return{checkStorageRoundTrip,assessSaveStatus,checkStableLocalSnapshot,run};
});
