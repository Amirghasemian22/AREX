import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const cfg = window.AREX_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
const byId = id => document.getElementById(id);
const setError = message => { const el=byId('authError'); if(el) el.textContent=message||''; };
const setAccountStatus = message => { const el=byId('arexAccountStatus'); if(el) el.textContent=message; };
const setBusy = busy => { const b=byId('googleSignInBtn'); if(b) b.disabled=busy||!configured; };

if (!configured) {
  if (byId('googleSignInBtn')) byId('googleSignInBtn').disabled = true;
  if (byId('authSetupNote')) byId('authSetupNote').textContent = 'برای فعال شدن ورود واقعی Google، تنظیمات Firebase را در auth-config.js وارد کن. حالت آزمایشی محلی برای توسعه در دسترس است.';
  if (window.AREX_ALLOW_LOCAL_PREVIEW === false && byId('localPreviewBtn')) byId('localPreviewBtn').style.display='none';
} else {
  let app, auth, db;
  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('AREX Firebase initialization failed', error);
    setError('راه‌اندازی سرویس ورود ناموفق بود. تنظیمات Firebase را بررسی کن.');
  }

  const uidSuffix = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  const openDb = name => new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,1);
    req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  const readDb = async name => {
    let dbx;
    try { dbx=await openDb(name); if(!dbx.objectStoreNames.contains('kv')) return {}; }
    catch { return {}; }
    try { return await new Promise((resolve,reject)=>{ const tx=dbx.transaction('kv','readonly'), st=tx.objectStore('kv'), kr=st.getAllKeys(), vr=st.getAll(); tx.oncomplete=()=>{const out={};kr.result.forEach((k,i)=>out[k]=vr.result[i]);resolve(out);};tx.onerror=()=>reject(tx.error); }); }
    finally { dbx.close(); }
  };
  const writeDb = async (name, data) => {
    const dbx=await openDb(name);
    try { await new Promise((resolve,reject)=>{const tx=dbx.transaction('kv','readwrite'),st=tx.objectStore('kv');Object.entries(data).forEach(([k,v])=>st.put(v,k));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); }
    finally { dbx.close(); }
  };
  window.arexPrepareAuthenticatedUser = async uid => {
    const clean=uidSuffix(uid), target='forexBootcampDB__'+clean;
    const owner=localStorage.getItem('arex-legacy-owner')||'';
    localStorage.setItem('arex-auth-uid',uid);
    // Claim/migrate the old unscoped V4.1 database only for the first authenticated account on this origin.
    // Other accounts get their own empty DB, preventing cross-account data leakage.
    if (!owner || owner===uid) {
      const legacy=await readDb('forexBootcampDB');
      const current=await readDb(target);
      if (Object.keys(current).length===0 && Object.keys(legacy).length>0) await writeDb(target,legacy);
      if (!owner) localStorage.setItem('arex-legacy-owner',uid);
    }
    if (window.arexSetDatabaseName) window.arexSetDatabaseName(target);
  };

  const chunkSize=160000; // conservative character limit to stay below Firestore 1 MiB document cap even with multibyte text
  const itemIdFor=key=>encodeURIComponent(key).replace(/%/g,'_');
  async function saveCloudBackup(user) {
    const status=byId('arexAccountStatus');
    if(status) status.textContent='در حال ذخیره نسخه ابری امن…';
    const all=await window.arexStorageBridge.getAllData();
    const snapshotId=String(Date.now());
    const snapRef=doc(db,'users',user.uid,'arexSnapshots',snapshotId);
    await setDoc(snapRef,{schemaVersion:5,createdAt:serverTimestamp(),itemCount:Object.keys(all).length,appVersion:'AREX V5'});
    for (const [key,value] of Object.entries(all)) {
      const serialized=JSON.stringify(value), id=itemIdFor(key), itemRef=doc(db,'users',user.uid,'arexSnapshots',snapshotId,'items',id);
      if(serialized.length<=chunkSize) await setDoc(itemRef,{key,payload:serialized,chunkCount:0});
      else {
        const parts=[]; for(let i=0;i<serialized.length;i+=chunkSize) parts.push(serialized.slice(i,i+chunkSize));
        await setDoc(itemRef,{key,chunkCount:parts.length,chunked:true});
        for(let i=0;i<parts.length;i++) await setDoc(doc(db,'users',user.uid,'arexSnapshots',snapshotId,'items',id,'parts',String(i).padStart(5,'0')),{index:i,payload:parts[i]});
      }
    }
    await setDoc(doc(db,'users',user.uid,'arexMeta','current'),{currentSnapshotId:snapshotId,updatedAt:serverTimestamp(),schemaVersion:5});
    if(status) status.textContent='نسخه ابری ذخیره شد · '+new Date().toLocaleString();
  }
  async function loadCloudBackup(user) {
    if(!confirm('بازیابی نسخه ابری، اطلاعات محلی حساب فعلی را با نسخه ذخیره‌شده جایگزین می‌کند. قبل از ادامه، از اطلاعات محلی خروجی بگیر. ادامه می‌دهی؟')) return;
    const status=byId('arexAccountStatus'); if(status) status.textContent='در حال دریافت نسخه ابری…';
    const meta=await getDoc(doc(db,'users',user.uid,'arexMeta','current'));
    if(!meta.exists()||!meta.data().currentSnapshotId) throw new Error('هنوز نسخه پشتیبان ابری وجود ندارد.');
    const snapshotId=meta.data().currentSnapshotId;
    const items=await getDocs(collection(db,'users',user.uid,'arexSnapshots',snapshotId,'items'));
    const data={};
    for(const item of items.docs){
      const m=item.data(); let serialized=m.payload;
      if(m.chunkCount){const parts=await getDocs(collection(db,'users',user.uid,'arexSnapshots',snapshotId,'items',item.id,'parts'));serialized=parts.docs.map(d=>d.data()).sort((a,b)=>a.index-b.index).map(x=>x.payload).join('');}
      data[m.key]=JSON.parse(serialized);
    }
    await window.arexStorageBridge.putAllData(data);
    if(status) status.textContent='بازیابی انجام شد؛ برنامه در حال بارگذاری مجدد است.';
    window.arexStorageBridge.reload();
  }

  window.arexGetFirebaseIdToken = async () => { if(!auth.currentUser) throw new Error('not_signed_in'); return auth.currentUser.getIdToken(); };
  window.arexSendExternalAlert = async (payload) => {
    if(!auth.currentUser) throw new Error('not_signed_in');
    const base=String((window.AREX_GET_EDGE_WORKER_URL&&window.AREX_GET_EDGE_WORKER_URL())||'').trim().replace(/\/$/,'');
    if(!base) throw new Error('worker_url_not_configured');
    const token=await auth.currentUser.getIdToken();
    const response=await fetch(base+'/notify',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||('HTTP '+response.status));
    return data;
  };
  window.arexStartGoogleSignIn = async () => {
    if(!auth) return setError('سرویس ورود آماده نیست. تنظیمات Firebase را بررسی کن.');
    setBusy(true); setError('');
    try { await signInWithPopup(auth,new GoogleAuthProvider()); }
    catch(error) { console.error('Google sign-in failed',error); setError(error.code==='auth/popup-closed-by-user'?'پنجره ورود بسته شد.':('ورود Google ناموفق بود: '+(error.code||'خطای نامشخص'))); }
    finally { setBusy(false); }
  };
  if(byId('googleSignInBtn')) byId('googleSignInBtn').disabled=false;
  if(byId('authSetupNote')) byId('authSetupNote').textContent='ورود Google فعال است. حساب کاربری از Google Drive مستقل است.';
  if(byId('localPreviewBtn')) byId('localPreviewBtn').style.display='none';
  if(byId('cloudSaveBtn')) {byId('cloudSaveBtn').disabled=false;byId('cloudSaveBtn').addEventListener('click',async()=>{if(!auth.currentUser)return;try{await saveCloudBackup(auth.currentUser);}catch(e){console.error(e);setAccountStatus('ذخیره ابری ناموفق بود: '+(e.message||e));}});}
  if(byId('cloudLoadBtn')) {byId('cloudLoadBtn').disabled=false;byId('cloudLoadBtn').addEventListener('click',async()=>{if(!auth.currentUser)return;try{await loadCloudBackup(auth.currentUser);}catch(e){console.error(e);setAccountStatus('بازیابی ابری ناموفق بود: '+(e.message||e));}});}
  if(byId('accountSignOutBtn')) byId('accountSignOutBtn').addEventListener('click',async()=>{if(confirm('از حساب AREX خارج شوی؟')){try{await signOut(auth);localStorage.removeItem('arex-auth-uid');localStorage.removeItem('arex-last-auth-uid');location.reload();}catch(e){setAccountStatus('خروج ناموفق بود.');}}});
  onAuthStateChanged(auth,async user=>{
    if(!user) { if(window.__arexAppStarted){location.reload();} return; }
    try {
      await window.arexPrepareAuthenticatedUser(user.uid);
      localStorage.setItem('arex-last-auth-uid',user.uid);
      const row=byId('authUserRow'); if(row){row.style.display='block';row.textContent='واردشده با '+(user.email||'Google');}
      setAccountStatus('متصل به حساب '+(user.email||'Google')+' · داده‌های محلی این حساب از سایر حساب‌ها جداست.');
      if(byId('accountSignOutBtn')) byId('accountSignOutBtn').style.display='inline-flex';
      if(window.arexEnterApp) window.arexEnterApp(false);
    } catch(error) { console.error(error); setError('آماده‌سازی فضای امن حساب ناموفق بود.'); }
  });
}
