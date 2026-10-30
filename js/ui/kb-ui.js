/* AREX V9.8.0 — ui/kb-ui: the Knowledge page (ask, browse, resolve conflicts, audit my journal against the rules, manage sources)
   and window.arexKB used by the assistant. All answers are quoted from the trader's own Markdown files. */
(function () {
  'use strict';
  if (!window.arexRegisterView || !window.AREXCore || !AREXCore.kb) return;
  const $ = id => document.getElementById(id), E = window.arexEscape, K = () => AREXCore.kb, fa = arexFmt.fa;
  let IX = null, tab = 'ask';
  const v98 = () => arexV98(), decisions = () => (v98().kbDecisions = v98().kbDecisions || {});

  /* ---------- knowledge pack(s) ---------- */
  function merged() {
    const base = window.AREX_KB_PACK || { chunks: [], images: {} }, chunks = base.chunks.slice(), images = Object.assign({}, base.images);
    (v98().kbExtras || []).forEach((x, n) => { try { const p = K().parse(x.md, { title: x.name }); p.chunks.forEach(c => { c.id = 'x' + n + '_' + c.id; if (c.conflictId) c.conflictId = 'X' + (n + 1) + c.conflictId; c.source = x.name; chunks.push(c); }); Object.assign(images, p.images); } catch (e) {} });
    return { version: 1, title: base.title, chunks, images };
  }
  const ix = () => (IX = IX || K().buildIndex(merged()));
  const reset = () => { IX = null; };
  const byId = id => ix().byId.get(id);

  /* ---------- tiny safe Markdown renderer ---------- */
  function md(s) {
    return E(s).split('\n').map(l => { let t = l;
      const im = /^!\[([^\]]*)\]\(&lt;?Images\/([^&)]+?)&gt;?\)$/.exec(t.trim()); if (im) return `<figure class="arex-kb-fig" data-img="${im[2]}"><figcaption>${im[1] || im[2]}</figcaption></figure>`;
      t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
      if (/^\s*[-*•]\s+/.test(t)) return '<div class="arex-kb-li">• ' + t.replace(/^\s*[-*•]\s+/, '') + '</div>'; if (/^\s*\d+[.)]\s+/.test(t)) return '<div class="arex-kb-li">' + t.trim() + '</div>'; return t.trim() ? '<p>' + t + '</p>' : ''; }).join('');
  }
  function hydrateImages(root) { root.querySelectorAll('[data-img]').forEach(f => { const name = f.dataset.img, img = new Image(); img.alt = name; img.loading = 'lazy'; img.onload = () => f.insertBefore(img, f.firstChild); img.onerror = () => { f.classList.add('missing'); }; img.src = 'data/kb-images/' + encodeURIComponent(name); }); }

  /* ---------- reader ---------- */
  function openReader(id) {
    const c = byId(id); if (!c) return; const all = ix().pack.chunks, i = all.findIndex(x => x.id === id), same = all.filter(x => x.section === c.section && x.path.join() === c.path.join());
    const imgs = (c.images || []).concat(c.image ? [c.image] : []);
    const bg = document.createElement('div'); bg.className = 'arex-modal-bg'; bg.innerHTML = `<div class="arex-modal arex-kb-reader" role="dialog"><div class="arex-modal-head"><b>${E(K().sectionRef(c))}</b><button class="icon-btn" type="button" aria-label="بستن">✕</button></div>
      <div class="arex-kb-meta"><span class="arex-badge ${c.kind === 'conflict' ? 'demo' : c.kind === 'rule' ? 'on' : ''}">${E(K().KIND_FA[c.kind] || c.kind)}</span><span class="muted">${E(c.path.join(' › '))}</span></div>
      <div class="arex-kb-body">${same.map(x => md(x.text)).join('<hr>')}${imgs.map(f => `<figure class="arex-kb-fig" data-img="${E(f)}"><figcaption>${E(ix().pack.images[f] || f)}</figcaption></figure>`).join('')}</div></div>`;
    document.body.appendChild(bg); hydrateImages(bg); const close = () => bg.remove(); bg.querySelector('.icon-btn').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
  }
  const chips = srcs => (srcs || []).map(s => `<button class="chip arex-kb-src" type="button" data-open="${E(s.id)}">${E(s.label)}</button>`).join('');

  /* ---------- views ---------- */
  const HTML = `<div class="arex-rc-tabs" id="arexKbTabs"><button class="chip active" data-tab="ask" type="button">💬 پرسش</button><button class="chip" data-tab="browse" type="button">📖 مرور</button><button class="chip" data-tab="conflicts" type="button">⚠️ ابهام‌ها</button><button class="chip" data-tab="audit" type="button">🔍 ممیزی ژورنال</button><button class="chip" data-tab="manage" type="button">⚙️ منابع</button></div><div id="arexKbBody"></div>`;
  const SUGGEST = ['ریسک هر معامله چقدر باشه؟', 'قوانین استراتژی طلا', 'چک‌لیست قبل از ورود', 'فیلتر خبر داوجونز چیه؟', 'اردربلاک چیه؟', 'تعارض‌ها', 'حد ضرر رو می‌تونم جابه‌جا کنم؟'];
  function renderAsk(b) {
    b.innerHTML = `<div class="card"><div class="section-title">💬 از دانش‌نامه‌ی خودت بپرس</div><div class="arex-wl-add"><input class="txt-input" id="arexKbQ" placeholder="مثلاً: قانون ریسک‌فری چیه؟" maxlength="200" enterkeyhint="search"><button class="btn" id="arexKbGo" type="button">بپرس</button></div>
      <div class="arex-brain-chips" style="margin-top:8px">${SUGGEST.map(s => `<button class="chip" type="button" data-q="${E(s)}">${E(s)}</button>`).join('')}</div><div id="arexKbAns"></div></div>`;
    const run = q => { q = (q || $('arexKbQ').value).trim(); if (!q) return; $('arexKbQ').value = q; const a = arexKB.ask(q); show(a); };
    const show = a => { $('arexKbAns').innerHTML = `<div class="arex-kb-answer"><div class="arex-brain-text">${E(a.text)}</div>${(a.images || []).length ? a.images.map(f => `<figure class="arex-kb-fig" data-img="${E(f)}"><figcaption>${E(ix().pack.images[f] || f)}</figcaption></figure>`).join('') : ''}<div class="arex-kb-srcs">${chips(a.sources)}</div></div>`; hydrateImages($('arexKbAns')); };
    $('arexKbGo').onclick = () => run(); $('arexKbQ').addEventListener('keydown', e => { if (e.key === 'Enter') run(); }); b.querySelectorAll('[data-q]').forEach(x => x.addEventListener('click', () => run(x.dataset.q)));
  }
  function renderBrowse(b) {
    const secs = K().sections(ix()), top = {}; secs.forEach(s => { const k = s.kind === 'archive' ? 'آرشیو یادداشت جلسات' : (s.key.split(' › ')[1] || s.key.split(' › ')[0]); (top[k] = top[k] || []).push(s); });
    b.innerHTML = `<div class="card"><input class="txt-input" id="arexKbF" placeholder="فیلتر عنوان بخش‌ها…"></div>` + Object.keys(top).map(k => `<details class="card arex-kb-sec" ${/^[0-9۰-۹]+\.?\s/.test(k) || top[k].length < 3 ? '' : ''}><summary><b>${E(k)}</b> <small class="muted">(${fa(top[k].reduce((a, s) => a + s.ids.length, 0))} بخش)</small></summary>${top[k].map(s => `<button class="arex-kb-row" type="button" data-open="${E(s.ids[0])}"><span class="arex-badge ${s.kind === 'rule' ? 'on' : s.kind === 'conflict' ? 'demo' : ''}">${E(K().KIND_FA[s.kind] || '')}</span> ${E(s.title)}</button>`).join('')}</details>`).join('');
    $('arexKbF').addEventListener('input', e => { const q = K().norm(e.target.value); b.querySelectorAll('.arex-kb-row').forEach(r => { r.style.display = !q || K().norm(r.textContent).includes(q) ? '' : 'none'; }); b.querySelectorAll('.arex-kb-sec').forEach(d => { if (q) d.open = true; }); });
  }
  function renderConflicts(b) {
    const list = K().conflicts(ix()), d = decisions(); const open = list.filter(c => !d[c.conflictId]).length;
    b.innerHTML = `<div class="card"><div class="section-title">⚠️ ابهام‌ها و تعارض‌ها (${fa(open)} باز از ${fa(list.length)})</div><div class="calc-hint">دانش‌نامه خودش این موارد را «نیازمند تصمیم نویسنده» علامت زده. تصمیم تو در پاسخ‌های ربات اعمال می‌شود و دیگر به‌عنوان ابهام باز نمایش داده نمی‌شود. آرکس هرگز خودش تصمیم نمی‌گیرد.</div></div>` +
      list.map(c => `<div class="card arex-kb-conf ${d[c.conflictId] ? 'done' : ''}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${E(c.conflictId)} · ${E(c.title)}</b><span class="arex-badge ${d[c.conflictId] ? 'on' : 'demo'}">${d[c.conflictId] ? 'تصمیم گرفته شد' : 'باز'}</span></div><div class="arex-brain-text">${E(c.text)}</div>
        <textarea class="txt-input" rows="2" maxlength="300" data-dec="${E(c.conflictId)}" placeholder="تصمیم / قاعده‌ی نهایی من…">${E(d[c.conflictId] ? d[c.conflictId].text : '')}</textarea><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-save="${E(c.conflictId)}" type="button">ذخیره تصمیم</button>${d[c.conflictId] ? `<button class="btn ghost" data-clear="${E(c.conflictId)}" type="button">بازگردانی به «باز»</button>` : ''}<button class="btn ghost" data-open="${E(c.id)}" type="button">متن کامل</button></div></div>`).join('');
    b.onclick = e => { const s = e.target.closest('[data-save]'), c = e.target.closest('[data-clear]'); if (s) { const t = b.querySelector('[data-dec="' + s.dataset.save + '"]').value.trim(); if (t.length < 3) { toast('تصمیم را بنویس'); return; } d[s.dataset.save] = { text: t, at: new Date().toISOString() }; arexV98Save(); toast('تصمیم ذخیره شد ✓'); renderConflicts(b); } if (c) { delete d[c.dataset.clear]; arexV98Save(); renderConflicts(b); } };
  }
  function auditCtx() { const v = v98(), L = AREXCore.ledger, sums = {}; L.all(v, state.trades || []).forEach(a => { sums[a.id] = a.balance; }); return { decisions: decisions(), balanceOf: id => sums[id || v.activeAccountId] || null, accountOf: t => L.accountOf(t, v) }; }
  function renderAudit(b) {
    const v = v98(), sel = b.dataset.acc || '__all', per = b.dataset.per || '30'; let tr = state.trades || []; if (sel !== '__all') tr = AREXCore.ledger.tradesOf(tr, v, sel);
    if (per !== 'all') { const since = new Date(Date.now() - (+per) * 86400000).toISOString().slice(0, 10); tr = tr.filter(t => String(t.date) >= since); }
    const a = AREXCore.behavior.audit(tr, auditCtx()), an = AREXCore.behavior.analyze(tr, {}), R = AREXCore.behavior.RULES, g = {};
    a.items.forEach(i => { (g[i.rule] = g[i.rule] || []).push(i); });
    const order = Object.keys(g).sort((x, y) => (g[y].filter(i => i.level === 'violation').length - g[x].filter(i => i.level === 'violation').length));
    const heat = an.cells.length ? (() => { const days = [6, 0, 1, 2, 3, 4, 5], hrs = [...new Set(an.cells.map(c => c.h))].sort((x, y) => x - y), cell = (wd, h) => an.heat[wd + '-' + h]; return `<div class="arex-heat" style="overflow-x:auto"><table class="arex-table"><thead><tr><th></th>${hrs.map(h => `<th>${fa(h)}</th>`).join('')}</tr></thead><tbody>${days.map(wd => `<tr><th>${AREXCore.behavior.WD[wd]}</th>${hrs.map(h => { const c = cell(wd, h); if (!c) return '<td></td>'; const m = c.r / c.n; return `<td class="${m < 0 ? 'neg' : 'pos'}" title="${c.n} معامله">${fa(Math.round(m * 10) / 10)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`; })() : '<div class="calc-hint">برای نقشه‌ی ساعت × روز حداقل چند معامله‌ی بسته در هر خانه لازم است.</div>';
    b.innerHTML = `<div class="card"><div class="section-title">🔍 ممیزی ژورنال با قوانین دانش‌نامه</div><div class="arex-q-controls"><div><div class="field-lbl">حساب</div><select class="txt-input" id="arexAuAcc"><option value="__all">همه</option>${v.accounts.map(x => `<option value="${E(x.id)}" ${sel === x.id ? 'selected' : ''}>${E(x.name)}</option>`).join('')}</select></div><div><div class="field-lbl">بازه</div><select class="txt-input" id="arexAuPer">${[['7', '۷ روز'], ['30', '۳۰ روز'], ['90', '۹۰ روز'], ['all', 'همه']].map(([k, l]) => `<option value="${k}" ${per === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="arex-kpis"><div class="arex-kpi"><small>معاملات بررسی‌شده</small><b>${fa(a.checked)}</b></div><div class="arex-kpi"><small>نقض صریح</small><b class="${a.summary.violations ? 'neg' : 'pos'}">${fa(a.summary.violations)}</b></div><div class="arex-kpi"><small>هشدار</small><b class="warn">${fa(a.summary.warnings)}</b></div><div class="arex-kpi"><small>نیازمند تصمیم تو</small><b>${fa(a.summary.decisions)}</b></div></div>
      <div class="calc-hint">فقط قوانین «قابل‌اندازه‌گیری» بررسی می‌شوند (SL، RR، ریسک٪، سقف معامله، توقف پس از ضرر و ...). قوانینی مثل «ورود عجولانه» یا «بی‌تمرکزی» را فقط خودت می‌توانی در مرور معامله ارزیابی کنی. ${a.unknown.risk ? `برای ${fa(a.unknown.risk)} معامله «ریسک٪» ثبت نشده و بررسی نشد.` : ''}</div></div>
      ${order.length ? order.map(k => { const items = g[k], vio = items.filter(i => i.level === 'violation').length; return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${E(R[k].text)}</b><span class="muted">${E(R[k].source)} · ${fa(items.length)} مورد${vio ? ' (' + fa(vio) + ' نقض)' : ''}</span></div>${R[k].conflict ? `<div class="calc-hint">⚠️ ابهام ${R[k].conflict} در دانش‌نامه باز است؛ ${decisions()[R[k].conflict] ? 'تصمیم تو: ' + E(decisions()[R[k].conflict].text) : 'قبل از قضاوت قطعی، آن را در «ابهام‌ها» روشن کن.'}</div>` : ''}<div class="arex-imp-table">${items.slice(0, 6).map(i => `<div>${i.level === 'violation' ? '⛔' : i.level === 'warning' ? '⚠️' : i.level === 'decision' ? '❓' : 'ℹ️'} ${E(i.date)} ${E(i.detail || '')}</div>`).join('')}${items.length > 6 ? `<div class="muted">… و ${fa(items.length - 6)} مورد دیگر</div>` : ''}</div></div>`; }).join('') : '<div class="card"><div class="empty">در این بازه موردی خلاف قوانین قابل‌اندازه‌گیری پیدا نشد 👌</div></div>'}
      <div class="card"><div class="section-title">🧠 الگوهای رفتاری</div>${an.insights.length ? an.insights.map(x => `<div class="arex-q-note">${E(x)}</div>`).join('') : '<div class="calc-hint">الگوی رفتاری مشکل‌داری پیدا نشد (یا داده کم است).</div>'}<div class="section-title" style="margin-top:12px">میانگین R در هر روز و ساعت</div>${heat}</div>`;
    $('arexAuAcc').onchange = e => { b.dataset.acc = e.target.value; renderAudit(b); }; $('arexAuPer').onchange = e => { b.dataset.per = e.target.value; renderAudit(b); };
  }
  function renderManage(b) {
    const base = window.AREX_KB_PACK || { chunks: [] }, ex = v98().kbExtras || [], total = ix().pack.chunks.length;
    b.innerHTML = `<div class="card"><div class="section-title">⚙️ منابع دانش</div><div class="arex-kpis"><div class="arex-kpi"><small>بخش‌های ایندکس‌شده</small><b>${fa(total)}</b></div><div class="arex-kpi"><small>ابهام‌های ثبت‌شده</small><b>${fa(K().conflicts(ix()).length)}</b></div><div class="arex-kpi"><small>تصویرهای فهرست‌شده</small><b>${fa(Object.keys(ix().pack.images).length)}</b></div></div>
      <div class="arex-rc-note">📄 فایل اصلی: <b>Forex_Strategy_Knowledge_Base.md</b> (${fa(base.chunks.length)} بخش)</div>
      ${ex.map((x, i) => `<div class="arex-led-row" style="grid-template-columns:1fr auto auto"><span>📎 ${E(x.name)}</span><span class="muted">${fa(Math.round(x.md.length / 1000))}KB</span><button class="del-x" data-rm="${i}" aria-label="حذف">✕</button></div>`).join('')}
      <div class="field-lbl" style="margin-top:10px">افزودن فایل Markdown دیگر (مثلاً آموزش جدید)</div><input type="file" id="arexKbFile" accept=".md,.markdown,.txt,text/markdown,text/plain"><div class="calc-hint">فایل‌ها فقط روی دستگاه و در پشتیبان Drive خودت ذخیره می‌شوند. برای تصاویر، پوشه‌ی <code>data/kb-images/</code> را کنار برنامه بگذار؛ بدون آن فقط توضیح متنی تصویر نمایش داده می‌شود.</div></div>`;
    $('arexKbFile').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 800000) { toast('فایل بزرگ‌تر از ۸۰۰KB است.'); return; } const text = await f.text(); const p = K().parse(text); if (p.chunks.length < 3) { toast('ساختار Markdown (عنوان‌ها) در این فایل پیدا نشد.'); return; } const v = v98(); v.kbExtras = (v.kbExtras || []).concat([{ name: f.name, md: text, at: new Date().toISOString() }]); arexV98Save(); reset(); toast(fa(p.chunks.length) + ' بخش اضافه شد ✓'); renderManage(b); });
    b.querySelectorAll('[data-rm]').forEach(x => x.addEventListener('click', () => { if (!confirm('این منبع حذف شود؟')) return; v98().kbExtras.splice(+x.dataset.rm, 1); arexV98Save(); reset(); renderManage(b); }));
  }
  function render() { const b = $('arexKbBody'); if (!b) return; document.querySelectorAll('#arexKbTabs .chip').forEach(c => c.classList.toggle('active', c.dataset.tab === tab)); const nb = b.cloneNode(false); b.replaceWith(nb); nb.id = 'arexKbBody'; ({ ask: renderAsk, browse: renderBrowse, conflicts: renderConflicts, audit: renderAudit, manage: renderManage }[tab])(nb); }

  /* ---------- API for the assistant ---------- */
  window.arexKB = {
    ready: () => !!(window.AREX_KB_PACK && window.AREX_KB_PACK.chunks.length),
    ask: q => K().answer(ix(), q, { decisions: decisions() }),
    context: (q, n) => K().search(ix(), q, { k: n || 6 }).hits.filter(h => h.chunk.kind !== 'meta').map(h => ({ ref: K().sectionRef(h.chunk), kind: K().KIND_FA[h.chunk.kind], text: h.chunk.text.slice(0, 650) })),
    decisions: () => Object.keys(decisions()).map(k => ({ id: k, decision: decisions()[k].text })),
    open: openReader, audit: () => { const tr = state.trades || []; return { a: AREXCore.behavior.audit(tr, auditCtx()), an: AREXCore.behavior.analyze(tr, {}) }; },
    show: t => { tab = t || 'ask'; goView('knowledge'); }
  };
  function mount() {
    const sec = arexRegisterView({ id: 'knowledge', title: 'دانش‌نامه', sub: 'قوانین و آموزش‌های خودت؛ پاسخ‌ها عین متن، با ارجاع به بخش', html: HTML, icon: '<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M8 7h6M8 11h6"/>', onShow: render }); if (!sec) return;
    sec.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) { openReader(o.dataset.open); return; } const t = e.target.closest('#arexKbTabs [data-tab]'); if (t) { tab = t.dataset.tab; render(); } });
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
})();
