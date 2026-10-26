/* Account-scoped localStorage for small UI/workflow records; never expose legacy records to another account. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.AREXCore=root.AREXCore||{};root.AREXCore.accountLocalStorage=api;}})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function accountId(storage){
    let uid='';try{uid=String(storage?.getItem('arex-auth-uid')||'');}catch{}
    // Preserve the identity exactly: sanitizing UIDs can make two distinct accounts collide.
    return uid.slice(0,256)||'local';
  }
  function keyFor(base,uid){
    const name=String(base||'').trim();if(!name||name.length>180)throw new Error('invalid_local_storage_key');
    const id=String(uid||'local').slice(0,256)||'local';
    // Keep existing Google subject IDs stable, and encode every other identity injectively.
    const safe=/^[a-zA-Z0-9_-]{1,80}$/.test(id)?id:'x'+encodeURIComponent(id);
    return name+'-'+safe;
  }
  function mayReadLegacy(uid,ownerUid){
    const current=String(uid||'local'),owner=String(ownerUid||'');
    return owner?current===owner:current==='local';
  }
  function read(storage,base,fallback){
    try{
      const uid=accountId(storage), scoped=keyFor(base,uid), saved=storage.getItem(scoped);
      if(saved!==null)return JSON.parse(saved);
      const owner=String(storage.getItem('arex-legacy-owner')||'');
      if(mayReadLegacy(uid,owner)){
        const legacy=storage.getItem(base);
        if(legacy!==null){const value=JSON.parse(legacy);storage.setItem(scoped,JSON.stringify(value));return value;}
      }
    }catch{}
    return fallback;
  }
  function write(storage,base,value){
    const key=keyFor(base,accountId(storage));
    try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
  }
  return{accountId,keyFor,mayReadLegacy,read,write};
});
