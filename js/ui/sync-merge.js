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
  window.arexSyncAge = function () { const t = typeof state !== 'undefined' && state.lastSyncAt ? Date.parse(state.lastSyncAt) : NaN; if (!Number.isFinite(t)) return null; const h = (Date.now() - t) / 3600000; return h < 1 ? Math.max(1, Math.round(h * 60)) + ' دقیقه' : h < 48 ? Math.round(h) + ' ساعت' : Math.round(h / 24) + ' روز'; };
})();
