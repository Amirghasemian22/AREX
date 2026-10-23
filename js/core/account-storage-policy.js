/* AREX account-scoped local-storage policy. Pure helpers; no data is changed here. */
(function(root){
  'use strict';
  const PREFIX='forexBootcampDB__';
  function sanitizeUid(uid){
    const clean=String(uid==null?'':uid).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
    if(!clean) throw new Error('invalid_account_uid');
    return clean;
  }
  function databaseNameForUid(uid){ return PREFIX+sanitizeUid(uid); }
  function migrationSource({uid, ownerUid='', currentCount=0, doubleScopedCount=0, legacyCount=0}={}){
    const cleanUid=String(uid||'');
    if(!cleanUid) return {allowed:false,source:null,reason:'missing_uid'};
    if(ownerUid && ownerUid!==cleanUid) return {allowed:false,source:null,reason:'owned_by_another_account'};
    if(!Number.isFinite(currentCount)||currentCount<0||!Number.isFinite(doubleScopedCount)||doubleScopedCount<0||!Number.isFinite(legacyCount)||legacyCount<0)
      return {allowed:false,source:null,reason:'invalid_counts'};
    if(currentCount>0) return {allowed:false,source:null,reason:'target_not_empty'};
    if(doubleScopedCount>0) return {allowed:true,source:'double_scoped',reason:'legacy_compatibility'};
    if(legacyCount>0) return {allowed:true,source:'legacy',reason:'first_account_migration'};
    return {allowed:false,source:null,reason:'nothing_to_migrate'};
  }
  const api={sanitizeUid,databaseNameForUid,migrationSource};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(root) root.AREXAccountStoragePolicy=api;
})(typeof window!=='undefined'?window:globalThis);
