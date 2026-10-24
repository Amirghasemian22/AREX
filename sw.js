const CACHE_VERSION = 'v9-6-4-drive-only-27';
const CACHE_NAME = 'fx-bootcamp-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './arex-reference-ui.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './arex-glass-wallpaper.jpg',
  './auth-client.js',
  './fx_widget.js',
  './js/core/util.js',
  './js/core/ui-quality.js',
  './js/core/account-storage-policy.js',
  './js/core/analytics.js',
  './js/core/trade-lifecycle.js',
  './js/core/trade-audit.js',
  './js/core/diagnostic-repair.js',
  './js/core/repair-history.js',
  './js/core/repair-recovery.js',
  './js/core/save-reliability.js',
  './js/core/propguard.js',
  './js/core/errors.js',
  './js/core/alert-engine.js',
  './js/core/quality.js',
  './js/core/migrate.js',
  './js/core/backup-safety.js',
  './js/core/cloud-sync.js',
  './js/core/runtime-verification.js',
  './js/core/importer.js',
  './js/core/riskstate.js',
  './js/core/strategykb.js',
  './js/core/ruleaudit.js',
  './js/core/pretrade.js',
  './js/ui/analytics.js',
  './js/i18n/v9.js',
  './js/ui/propguard.js',
  './js/ui/import.js',
  './js/ui/tradeform.js',
  './js/ui/strategy.js',
  './js/ui/pretrade.js',
  './js/core/extended.js',
  './js/core/ohlc-backtest.js',
  './js/ui/workspace.js',
  './js/ui/workspace.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    // NOTE: no self.skipWaiting() here — we let the page decide when to
    // activate the new version, so an update never yanks the UI out from
    // under the user mid-edit. See the 'SKIP_WAITING' message handler below.
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin (fonts, Drive API, price API...)

  const isNavigation = event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-review-check') {
    event.waitUntil(checkReviewsAndNotify());
  }
});

async function checkReviewsAndNotify() {
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('forexBootcampDB', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const sessions = await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('sessions');
      req.onsuccess = () => resolve(req.result ? JSON.parse(req.result) : {});
      req.onerror = () => reject(req.error);
    });
    const today = new Date().toISOString().slice(0, 10);
    let due = 0;
    Object.values(sessions).forEach((s) => {
      (s.reviews || []).forEach((r) => { if (!r.done && r.date <= today) due++; });
    });
    if (due > 0) {
      await self.registration.showNotification('یادآور بهبود عملکرد معاملاتی', {
        body: due + ' مرور عملکرد برای امروز دارید.',
        icon: 'icon-192.png'
      });
    }
  } catch (e) {
    // silent — best-effort only
  }
}
