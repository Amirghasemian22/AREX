/* AREX backup safety helpers: validate before writes; never mutate caller input. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AREXCore=root.AREXCore||{};root.AREXCore.backupSafety=api;}})(typeof self!=='undefined'?self:this,function(){
  const MAX_BYTES=50*1024*1024, MAX_KEYS=10000, MAX_KEY_LENGTH=240;
  const forbidden=new Set(['__proto__','prototype','constructor']);
  function validateEnvelope(parsed, serializedLength){
    const errors=[]; if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return{ok:false,errors:['root_not_object']};
    if(Number(serializedLength)>MAX_BYTES)errors.push('backup_too_large');
    const full=parsed.data!==undefined;
    if(full&&(!parsed.data||typeof parsed.data!=='object'||Array.isArray(parsed.data)))errors.push('data_not_object');
    const data=full?parsed.data:parsed;
    if(data&&typeof data==='object'){
      const keys=Object.keys(data);if(keys.length>MAX_KEYS)errors.push('too_many_keys');
      for(const key of keys){if(!key||key.length>MAX_KEY_LENGTH||forbidden.has(key))errors.push('invalid_key');}
    }
    if(parsed.schemaVersion!==undefined&&(!Number.isInteger(Number(parsed.schemaVersion))||Number(parsed.schemaVersion)<0))errors.push('invalid_schema_version');
    if(full&&parsed.app!==undefined&&String(parsed.app).length>80)errors.push('invalid_app');
    return{ok:errors.length===0,errors,kind:full?'full':'legacy',data};
  }
  function makeRestoreSnapshot(data,now){return{kind:'arex-pre-restore-backup',app:'AREX V9.6.3',createdAt:now||new Date().toISOString(),data:JSON.parse(JSON.stringify(data||{}))};}
  function rollbackSnapshot(snapshot){if(!snapshot||snapshot.kind!=='arex-pre-restore-backup'||!snapshot.data||typeof snapshot.data!=='object'||Array.isArray(snapshot.data))throw new Error('invalid_restore_snapshot');return JSON.parse(JSON.stringify(snapshot.data));}
  return{MAX_BYTES,MAX_KEYS,validateEnvelope,makeRestoreSnapshot,rollbackSnapshot};
});
