/* AREX V9.7.9 — resilient Google Drive-only authentication and backup adapter.
 * No Firebase Authentication or Firestore calls are made by this file.
 * OAuth token stays in memory; persistent backups use the Drive appDataFolder API.
 */
const byId = id => document.getElementById(id);
const setError = message => { const el=byId('authError'); if(el) el.textContent=message||''; };
const setStatus = message => { const el=byId('arexAccountStatus'); if(el) el.textContent=message||''; };
const setBusy = busy => { const b=byId('googleSignInBtn'); if(b) b.disabled=!!busy; };

function friendlyError(error){
  const code=String(error?.message||error||'unknown');
  if(code.includes('google_oauth_client_id_missing')) return 'شناسه OAuth گوگل تنظیم نشده است. مقدار GOOGLE_CLIENT_ID را در index.html بررسی کن.';
  if(code.includes('google_identity_services_loading')) return 'سرویس ورود گوگل هنوز بارگذاری نشده؛ چند ثانیه دیگر تلاش کن.';
  if(code.includes('origin_mismatch')||code.includes('origin')) return 'دامنه سایت در Google Cloud → OAuth Client → Authorized JavaScript origins ثبت نشده است.';
  if(code.includes('access_denied')) return 'دسترسی Google Drive لغو شد؛ برای ورود باید مجوز را تأیید کنی.';
  if(code.includes('popup')) return 'پنجره ورود گوگل باز نشد. اجازه Popup را برای سایت فعال کن.';
  if(code.includes('userinfo')) return 'تأیید هویت حساب Google ناموفق بود؛ مجوزهای OAuth و اتصال شبکه را بررسی کن.';
  return 'ورود با Google Drive ناموفق بود: '+code;
}

const openDb = name => new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
  req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
});
const readDb = async name => {
  let dbx;
  try { dbx=await openDb(name); if(!dbx.objectStoreNames.contains('kv')) return {}; }
  catch (error) { throw error; }
  try { return await new Promise((resolve,reject)=>{ const tx=dbx.transaction('kv','readonly'), st=tx.objectStore('kv'), kr=st.getAllKeys(), vr=st.getAll(); tx.oncomplete=()=>{const out={};kr.result.forEach((k,i)=>out[k]=vr.result[i]);resolve(out);};tx.onerror=()=>reject(tx.error); }); }
  finally { dbx.close(); }
};
const writeDb = async (name,data) => {
  const dbx=await openDb(name);
  try { await new Promise((resolve,reject)=>{const tx=dbx.transaction('kv','readwrite'),st=tx.objectStore('kv');Object.entries(data).forEach(([k,v])=>st.put(v,k));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); }
  finally { dbx.close(); }
};

window.arexPrepareAuthenticatedUser = async uid => {
  const policy=window.AREXAccountStoragePolicy;
  if(!policy) throw new Error('account_storage_policy_missing');
  const target=policy.databaseNameForUid(uid);
  const owner=localStorage.getItem('arex-legacy-owner')||'';
  localStorage.setItem('arex-auth-uid',String(uid));
  if(!owner || owner===String(uid)){
    const current=await readDb(target);
    const priorDoubleScoped=await readDb(target+'__'+policy.sanitizeUid(uid));
    const legacy=await readDb('forexBootcampDB');
    const migration=policy.migrationSource({uid,ownerUid:owner,currentCount:Object.keys(current).length,doubleScopedCount:Object.keys(priorDoubleScoped).length,legacyCount:Object.keys(legacy).length});
    if(migration.allowed) await writeDb(target,migration.source==='double_scoped'?priorDoubleScoped:legacy);
    if(!owner) localStorage.setItem('arex-legacy-owner',String(uid));
  }
  if(window.arexSetDatabaseName) window.arexSetDatabaseName(target);
  return target;
};

let loginInProgress=false;
window.arexDriveLoginFailed = message => {
  loginInProgress=false; setBusy(false); setError(message||'ورود با Google Drive ناموفق بود.');
  window.arexDriveLoginPending=false;
};
window.arexDriveLoginComplete = async () => {
  try{
    const identity=window.arexGetDriveIdentity?window.arexGetDriveIdentity():{};
    if(!identity.id) throw new Error('شناسه پایدار حساب Google دریافت نشد. مجوزهای OAuth را بررسی کن.');
    await window.arexPrepareAuthenticatedUser(identity.id);
    localStorage.setItem('arex-last-auth-uid',identity.id);
    const row=byId('authUserRow'); if(row){row.style.display='block';row.textContent='واردشده با '+(identity.email||'Google Drive');}
    setStatus('متصل به '+(identity.email||'Google Drive')+' · داده‌های محلی این حساب از سایر حساب‌ها جداست.');
    const signout=byId('accountSignOutBtn'); if(signout) signout.style.display='inline-flex';
    setError('');
    if(window.arexEnterApp) window.arexEnterApp(false);
    loginInProgress=false; setBusy(false);
  }catch(error){ console.error('AREX Google Drive account setup failed',error); window.arexDriveLoginFailed(friendlyError(error)); }
};

// Resolve the bridge lazily. Classic-script function declarations from index.html
// are exposed on window in the supported static build, so this also tolerates a
// mixed deployment where the bridge aliases have not yet been assigned.
function resolveDriveEnabled(){
  if(typeof window.arexDriveIsEnabled==='function') return window.arexDriveIsEnabled;
  if(typeof window.driveEnabled==='function') return window.driveEnabled;
  return null;
}
function resolveDriveStartOAuth(){
  if(typeof window.arexDriveStartOAuth==='function') return window.arexDriveStartOAuth;
  if(typeof window.driveConnect==='function') return window.driveConnect;
  return null;
}
window.arexStartGoogleSignIn = async () => {
  if(loginInProgress) return;
  setError('');
  const enabledCheck=resolveDriveEnabled();
  const startOAuth=resolveDriveStartOAuth();
  if(!enabledCheck || !startOAuth) {
    // A short retry handles script/module scheduling and stale deployments without
    // asking users to downgrade index.html or erase their local database.
    await new Promise(resolve=>setTimeout(resolve,250));
    const retryEnabled=resolveDriveEnabled();
    const retryStart=resolveDriveStartOAuth();
    if(!retryEnabled || !retryStart) {
      const missing=[!retryEnabled?'Drive configuration bridge':'OAuth start bridge'].join(' and ');
      setError('ماژول ورود با نسخه صفحه هماهنگ نیست ('+missing+'). صفحه را یک بار تازه‌سازی کن؛ اطلاعات ذخیره‌شده پاک نمی‌شود.');
      console.error('AREX Drive bridge unavailable', {enabledCheck:!!retryEnabled,startOAuth:!!retryStart,href:location.href,script:document.querySelector('script[type="module"][src*="auth-client"]')?.src||'missing'});
      return;
    }
    if(!retryEnabled()) { setError(friendlyError(new Error('google_oauth_client_id_missing'))); return; }
    loginInProgress=true; setBusy(true); window.arexDriveLoginPending=true;
    try { retryStart(); }
    catch(error){ console.error('AREX Google Drive OAuth start failed',error); window.arexDriveLoginFailed(friendlyError(error)); }
    return;
  }
  if(!enabledCheck()) { setError(friendlyError(new Error('google_oauth_client_id_missing'))); return; }
  loginInProgress=true; setBusy(true); window.arexDriveLoginPending=true;
  try { startOAuth(); }
  catch(error){ console.error('AREX Google Drive OAuth start failed',error); window.arexDriveLoginFailed(friendlyError(error)); }
};

// Account-level cloud backup buttons use the same Drive appDataFolder backup system as the existing sync UI.
const saveBtn=byId('cloudSaveBtn');
if(saveBtn){saveBtn.disabled=false;saveBtn.addEventListener('click',async()=>{saveBtn.disabled=true;try{if(!window.arexDriveSaveBackup)throw new Error('drive_backup_not_ready');await window.arexDriveSaveBackup();setStatus('نسخه پشتیبان در Google Drive ذخیره شد.');}catch(error){console.error(error);setStatus('ذخیره در Google Drive ناموفق بود: '+friendlyError(error));}finally{saveBtn.disabled=false;}});}
const loadBtn=byId('cloudLoadBtn');
if(loadBtn){loadBtn.disabled=false;loadBtn.addEventListener('click',async()=>{loadBtn.disabled=true;try{if(!window.arexDriveRestoreLatest)throw new Error('drive_restore_not_ready');await window.arexDriveRestoreLatest();}catch(error){console.error(error);setStatus('بازیابی از Google Drive ناموفق بود: '+friendlyError(error));}finally{loadBtn.disabled=false;}});}
const signout=byId('accountSignOutBtn');
if(signout) signout.addEventListener('click',()=>{if(confirm('از حساب Google Drive خارج شوی؟')){try{if(window.arexDriveSignOut)window.arexDriveSignOut();else location.reload();}catch{location.reload();}}});

// Alerts are authenticated by the Google OAuth access token; the deployed Worker must use the matching Google-token validation update.
window.arexSendExternalAlert = async payload => {
  const base=String((window.AREX_GET_EDGE_WORKER_URL&&window.AREX_GET_EDGE_WORKER_URL())||'').trim().replace(/\/$/,'');
  if(!base) throw new Error('worker_url_not_configured');
  if(!window.arexGetDriveAccessToken) throw new Error('google_drive_not_connected');
  const eventId=String(payload?.eventId||'').trim();
  if(!/^[a-zA-Z0-9._:-]{1,160}$/.test(eventId)) throw new Error('برای جلوگیری از ارسال تکراری، eventId معتبر و ثابت لازم است.');
  const token=await window.arexGetDriveAccessToken();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  let response;
  try { response=await fetch(base+'/notify',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({...payload,eventId}),cache:'no-store',signal:controller.signal}); }
  catch(error){ if(error?.name==='AbortError') throw new Error('پاسخ Worker در زمان مقرر نرسید؛ وضعیت ارسال نامشخص است.'); throw new Error('خطای شبکه هنگام اتصال به Worker.'); }
  finally { clearTimeout(timer); }
  const data=await response.json().catch(()=>({error:'invalid_worker_response'}));
  if(!response.ok) throw new Error(data.message||data.error||('HTTP '+response.status));
  return data;
};

if(byId('authSetupNote')) byId('authSetupNote').textContent='ورود و پشتیبان‌گیری با Google Drive انجام می‌شود؛ Firebase استفاده نمی‌شود.';
if(byId('localPreviewBtn')) byId('localPreviewBtn').style.display='none';
