/* AREX V9.8.0 — ui/kb-client: the assistant's private knowledge. The knowledge files live only in YOUR Worker (KV); the page sends a question
   and receives the final answer. There is no page, list or reader for the knowledge files — users cannot browse them. */
(function () {
  'use strict';
  const base = () => (window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL()) || '';
  const cache = new Map();
  const SETUP = { text: 'برای پاسخ به سؤال‌های قوانین و آموزش، آدرس Worker را در «تنظیمات ← اعلان‌ها» وارد کن و با حساب Google وارد باش.', confidence: 0, needs: 'setup', sources: [], context: [], tags: ['setup'] };
  async function remote(q) {
    const b = base(); if (!b) return SETUP;
    const key = q.trim().toLowerCase(), hit = cache.get(key); if (hit && Date.now() - hit.at < 300000) return hit.a;
    window.arexAssertTrustedWorker && window.arexAssertTrustedWorker(b);
    const token = await window.arexGetDriveAccessToken();
    const r = await fetch(b + '/kb', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ q }), signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined });
    if (r.status === 503) return Object.assign({}, SETUP, { text: 'دانش‌نامه روی Worker هنوز بارگذاری نشده (KV با نام AREX_KB و کلید pack).' });
    if (r.status === 429) return { text: 'تعداد سؤال‌ها زیاد بود؛ چند ثانیه بعد دوباره بپرس.', confidence: 0, needs: 'rate', sources: [], context: [], tags: [] };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const a = await r.json(); a.sources = (a.sources || []).map(label => ({ label })); cache.set(key, { at: Date.now(), a }); if (cache.size > 50) cache.delete(cache.keys().next().value); return a;
  }
  window.arexKB = {
    ready: () => true,
    ask: async q => { try { return await remote(q); } catch (e) { return { text: 'اتصال به دانش‌نامه ممکن نشد (' + String(e && e.message || e).slice(0, 60) + '). اینترنت و ورود Google را بررسی کن.', confidence: 0, needs: 'offline', sources: [], context: [], tags: [] }; } },
    // behaviour audit of the user's OWN journal (client-side; shows findings, not the rule library)
    audit: () => { const tr = state.trades || [], v = arexV98(), L = AREXCore.ledger, sums = {}; L.all(v, tr).forEach(a => { sums[a.id] = a.balance; });
      const ctx = { balanceOf: id => sums[id || v.activeAccountId] || null, accountOf: t => L.accountOf(t, v) }; return { a: AREXCore.behavior.audit(tr, ctx), an: AREXCore.behavior.analyze(tr, {}), ctx }; }
  };
})();
