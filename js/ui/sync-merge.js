/* AREX V9.8.0 — ui/sync-merge: smart merge of two devices' data (never overwrites newer data), deletion tombstones, persistent-storage request,
   and a visible "last backup" age. */
(function () {
  'use strict';
  window.arexTombstone = (col, id) => { try { AREXCore.merge.tombstone(arexV98(), col, id); arexV98Save(); } catch (e) {} };
  window.driveResolveConflictMerge = async function () {
    if (typeof drivePendingConflict === 'undefined' || !drivePendingConflict) { toast('نسخه‌ی متعارضی برای ادغام نیست.'); return; }
    try {
      toast('در حال ادغام داده‌های دو دستگاه…'); await ensureFreshToken();
      const remote = await driveDownloadBackup(drivePendingConflict.id), checked = AREXCore.backupSafety.validateEnvelope(remote, new Blob([JSON.stringify(remote)]).size);
      if (!checked.ok) throw new Error('drive_backup_validation_failed:' + checked.errors.join(','));
      if (window.arexStorageBridge && window.arexStorageBridge.flush) { const ok = await window.arexStorageBridge.flush(); if (ok === false) throw new Error('local_save_pending'); }
      const local = await storage.getAllData(); Object.keys(local).forEach(k => { if (k.startsWith('backup:pre-')) delete local[k]; });
      const remoteData = Object.assign({}, checked.data); delete remoteData.driveFileId; Object.keys(remoteData).forEach(k => { if (k.startsWith('backup:pre-')) delete remoteData[k]; });
      const { data, report } = AREXCore.merge.mergeAll(local, remoteData);
      data['backup:pre-merge:' + Date.now()] = JSON.stringify(AREXCore.backupSafety.makeRestoreSnapshot(local));     // rollback point
      await storage.replaceAllData(data); await loadAll();
      state.lastSyncAt = new Date().toISOString(); queueSave('settings'); if (window.arexStorageBridge && window.arexStorageBridge.flush) await window.arexStorageBridge.flush();
      drivePendingConflict = null; await driveBackupNow({ forceOverride: true, silent: true });
      toast('ادغام شد ✓ ' + report.added + ' مورد جدید، ' + report.updated + ' مورد به‌روز، ' + report.dropped + ' مورد حذف‌شده نادیده گرفته شد.'); setTimeout(() => location.reload(), 1400);
    } catch (e) { console.error(e); toast('ادغام ناموفق بود و چیزی تغییر نکرد: ' + String(e && e.message || e).slice(0, 80)); }
  };
  function mount() {
    const box = document.getElementById('driveConflict'); if (box && !document.getElementById('driveMergeBtn')) {
      const holder = box.querySelector('span:last-child') || box, b = document.createElement('button'); b.id = 'driveMergeBtn'; b.type = 'button'; b.textContent = '🔀 ادغام هوشمند (پیشنهادی)'; b.style.fontWeight = '800'; b.onclick = () => window.driveResolveConflictMerge(); holder.insertBefore(b, holder.firstChild);
      const note = box.querySelector('span:first-child'); if (note) note.textContent = 'روی دستگاه دیگر داده‌ی جدیدتری ذخیره شده. «ادغام» معاملات هر دو را نگه می‌دارد.';
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(ok => { window.arexPersisted = !!ok; }); } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount(); setTimeout(mount, 1500);

  /* ---------- automatic sync on entry ----------
     1) try to get a Google token silently (works when the Google session/consent is still valid);
     2) if the browser blocks that without a user gesture, the first tap anywhere in the app completes it;
     3) a newer Drive copy is MERGED automatically (never overwritten). Runs at most once per session, and not if synced in the last 10 minutes. */
  let autoDone = false, autoArmed = false;
  const canAuto = () => typeof state !== 'undefined' && state.driveConnected !== undefined && (state.driveConnected || state.driveWasConnected) && !window.AREX_LOCAL_TEST_MODE && navigator.onLine && localStorage.getItem('arex-last-auth-uid') !== 'local-device' && (!state.lastSyncAt || Date.now() - Date.parse(state.lastSyncAt) > 10 * 60000);
  async function runAuto(viaGesture) {
    if (autoDone) return; autoDone = true; const mark = t => { const b = document.getElementById('driveQuickSyncBtn'); if (b) b.title = t; };
    try {
      toast('☁️ در حال همگام‌سازی با آخرین نسخه‌ی Drive…'); state.driveConnected = true;
      const ok = await Promise.race([driveBackupNow({ silent: true, auto: true }), new Promise(r => setTimeout(() => r('timeout'), 25000))]);
      if (typeof drivePendingConflict !== 'undefined' && drivePendingConflict) { await window.driveResolveConflictMerge(); return; }
      if (ok === true) { toast('☁️ همگام‌سازی کامل شد ✓'); mark('همگام‌سازی شد'); if (window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL() && arexV98().prefs.autoIngest && window.arexPullIngest) window.arexPullIngest(true).catch(() => {}); }
      else if (!viaGesture) { autoDone = false; armGesture(); }
      else toast('همگام‌سازی کامل نشد؛ با دکمه‌ی Sync دوباره امتحان کن.');
    } catch (e) { console.warn('auto-sync failed', e); if (!viaGesture) { autoDone = false; armGesture(); } }
  }
  function armGesture() {
    if (autoArmed) return; autoArmed = true;
    const once = () => { document.removeEventListener('pointerup', once, true); autoArmed = false; if (canAuto()) runAuto(true); };
    document.addEventListener('pointerup', once, true);
  }
  function startAuto() {
    const t = setInterval(() => { if (typeof state === 'undefined') return; const g = document.getElementById('arexAuthGate'); if (g && getComputedStyle(g).display !== 'none') return; clearInterval(t);
      if (!canAuto()) return; setTimeout(() => { if (!canAuto()) return; if (typeof gAccessToken !== 'undefined' && gAccessToken) runAuto(false); else { armGesture(); } }, 2500); }, 500);
    setTimeout(() => clearInterval(t), 30000);
  }
  startAuto(); window.arexAutoSyncNow = () => { autoDone = false; return runAuto(true); };
  window.arexSyncAge = function () { const t = typeof state !== 'undefined' && state.lastSyncAt ? Date.parse(state.lastSyncAt) : NaN; if (!Number.isFinite(t)) return null; const h = (Date.now() - t) / 3600000; return h < 1 ? Math.max(1, Math.round(h * 60)) + ' دقیقه' : h < 48 ? Math.round(h) + ' ساعت' : Math.round(h / 24) + ' روز'; };
})();
