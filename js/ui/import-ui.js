/* AREX V9.8.0 — ui/import-ui: MT4/MT5 statement + CSV import and automatic EA ingest (Worker /ingest/pending). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.arexEscape, MT = () => AREXCore.mt5;
  let parsed = [], source = 'file';

  async function decode(file) {
    const buf = await file.arrayBuffer(), u = new Uint8Array(buf);
    if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
    if (u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
    let t = new TextDecoder('utf-8').decode(buf); if ((t.match(/\u0000/g) || []).length > t.length / 4) t = new TextDecoder('utf-16le').decode(buf); return t;
  }
  function known(accId) { const v = arexV98(), set = new Set(); (state.trades || []).forEach(t => { if (t.ticket) set.add(MT().key(AREXCore.ledger.accountOf(t, v), { ticket: t.ticket })); }); return set; }
  function modalHtml() {
    const v = arexV98();
    return `<div class="arex-modal-bg" id="arexImpBg"><div class="arex-modal" role="dialog" aria-label="ایمپورت معاملات">
      <div class="arex-modal-head"><b>ورود معاملات از MT4 / MT5</b><button class="icon-btn" id="arexImpClose" type="button" aria-label="بستن">✕</button></div>
      <div class="arex-tabs"><button class="chip active" data-t="file" type="button">فایل گزارش / CSV</button><button class="chip" data-t="ea" type="button">خودکار (EA)</button></div>
      <div class="field-lbl">حساب مقصد</div><select class="txt-input" id="arexImpAcc">${v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)}</option>`).join('')}</select>
      <div id="arexImpFile"><div class="calc-hint" style="margin:8px 0">در MT5: History ← کلیک راست ← Report ← HTML (یا Excel/CSV). در MT4: Account History ← Save as Report. فایل را اینجا انتخاب کن؛ معاملات تکراری (بر اساس شماره تیکت) نادیده گرفته می‌شوند.</div>
        <input type="file" id="arexImpFileInput" accept=".htm,.html,.csv,.txt,text/html,text/csv,text/plain"></div>
      <div id="arexImpEa" style="display:none"><ol class="arex-steps"><li>فایل <a href="tools/AREX_Exporter.mq5" download>AREX_Exporter.mq5</a> را در MT5 (MQL5/Experts) کامپایل و روی یک چارت بگذار.</li><li>در MT5 ← Tools ← Options ← Expert Advisors آدرس Worker را در «Allow WebRequest» اضافه کن.</li><li>در Cloudflare: Secret با نام <code>AREX_INGEST_KEY</code> و KV با نام <code>AREX_INGEST</code> بساز؛ همان کلید را در ورودی EA بگذار.</li></ol>
        <div class="calc-hint">Worker فعلی: <b dir="ltr">${E((window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL()) || 'تنظیم نشده (تنظیمات ← اعلان‌ها)')}</b></div>
        <button class="btn" id="arexImpPull" type="button" style="margin-top:8px">دریافت معاملات جدید از EA</button></div>
      <div id="arexImpPreview" aria-live="polite"></div><div class="arex-modal-foot"><button class="btn" id="arexImpGo" type="button" disabled>ایمپورت</button></div></div></div>`;
  }
  function preview() {
    const acc = $('arexImpAcc').value, kn = known(acc), fresh = parsed.filter(d => !kn.has(MT().key(acc, d)));
    $('arexImpPreview').innerHTML = parsed.length ? `<div class="calc-hint" style="margin:8px 0">${arexFmt.fa(parsed.length)} معامله پیدا شد · <b>${arexFmt.fa(fresh.length)} جدید</b> · ${arexFmt.fa(parsed.length - fresh.length)} تکراری</div><div class="arex-imp-table">${fresh.slice(0, 8).map(d => `<div><b>${E(String(d.symbol).toUpperCase())}</b> ${E(d.dir)} ${E(d.lots)} لات · ${E((d.closedAt || '').slice(0, 16).replace('T', ' '))} · ${arexFmt.money((d.gross || 0) + (d.commission || 0) + (d.swap || 0))}</div>`).join('')}${fresh.length > 8 ? `<div class="muted">… و ${arexFmt.fa(fresh.length - 8)} مورد دیگر</div>` : ''}</div>` : '<div class="calc-hint" style="margin:8px 0">هنوز چیزی خوانده نشده.</div>';
    $('arexImpGo').disabled = !fresh.length; $('arexImpGo').textContent = fresh.length ? `ایمپورت ${arexFmt.fa(fresh.length)} معامله` : 'ایمپورت'; $('arexImpGo').dataset.n = fresh.length;
  }
  function commit(deals, acc, src) {
    const kn = known(acc), list = deals.filter(d => !kn.has(MT().key(acc, d))); let base = Date.now() * 1000;
    list.forEach((d, i) => { const t = MT().toTrade(d, { accountId: acc, id: base + i, source: src }); state.trades.unshift(t); });
    state.trades.sort((a, b) => (String(b.date) + String(b.time || '')).localeCompare(String(a.date) + String(a.time || '')));
    queueSave('trades'); try { renderTrades(); } catch (e) {} if (window.arexRenderAccounts) try { arexRenderAccounts(); } catch (e) {}
    return list.length;
  }
  async function pull(silent) {
    const base = window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL(); if (!base) { if (!silent) toast('آدرس Worker را در تنظیمات اعلان‌ها وارد کن.'); return 0; }
    window.arexAssertTrustedWorker && window.arexAssertTrustedWorker(base);
    const token = await window.arexGetDriveAccessToken(), h = { Authorization: 'Bearer ' + token };
    const r = await fetch(base + '/ingest/pending', { headers: h }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json(), deals = data.deals || []; if (!deals.length) { if (!silent) toast('معامله‌ی جدیدی از EA نیست.'); return 0; }
    const v = arexV98(), map = v.prefs.accountLogins = v.prefs.accountLogins || {}, acc = ($('arexImpAcc') && $('arexImpAcc').value) || v.activeAccountId; let n = 0;
    const byLogin = {}; deals.forEach(d => { (byLogin[d.login || '0'] = byLogin[d.login || '0'] || []).push(d); });
    Object.keys(byLogin).forEach(login => { const target = map[login] || acc; map[login] = target; n += commit(byLogin[login], target, 'mt5-ea'); });
    await fetch(base + '/ingest/pending', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify({ ack: deals.map(d => d._key) }) });
    arexV98Save(); if (n || !silent) toast(arexFmt.fa(n) + ' معامله از EA وارد شد ✓'); return n;
  }
  window.arexPullIngest = pull;
  function open() {
    if ($('arexImpBg')) $('arexImpBg').remove(); document.body.insertAdjacentHTML('beforeend', modalHtml()); parsed = [];
    const close = () => $('arexImpBg') && $('arexImpBg').remove(); $('arexImpClose').onclick = close; $('arexImpBg').addEventListener('click', e => { if (e.target.id === 'arexImpBg') close(); });
    document.querySelectorAll('#arexImpBg .arex-tabs [data-t]').forEach(b => b.addEventListener('click', () => { source = b.dataset.t; document.querySelectorAll('#arexImpBg .arex-tabs .chip').forEach(x => x.classList.toggle('active', x === b)); $('arexImpFile').style.display = source === 'file' ? '' : 'none'; $('arexImpEa').style.display = source === 'ea' ? '' : 'none'; $('arexImpGo').style.display = source === 'file' ? '' : 'none'; }));
    $('arexImpAcc').addEventListener('change', preview);
    $('arexImpFileInput').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { parsed = MT().parse(await decode(f), f.name); if (!parsed.length) toast('معامله‌ای در این فایل شناسایی نشد. گزارش HTML/CSV با ستون‌های Ticket، Symbol، Type، Volume و Profit لازم است.'); } catch (err) { parsed = []; toast('خواندن فایل ناموفق بود: ' + err.message); } preview(); });
    $('arexImpGo').addEventListener('click', () => { const n = commit(parsed, $('arexImpAcc').value, 'mt-import'); toast(arexFmt.fa(n) + ' معامله وارد شد ✓'); close(); });
    $('arexImpPull').addEventListener('click', async () => { try { await pull(false); } catch (err) { toast('دریافت از EA ناموفق: ' + (err.message || err)); } });
    preview();
  }
  function mount() {
    const hist = document.querySelector('#view-trades .arex-trade-history, #view-trades .arex-journal-history'); if (!hist || $('arexImportMtBtn')) return;
    const csv = Array.from(hist.querySelectorAll('button')).find(b => /CSV/i.test(b.textContent));
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'arexImportMtBtn'; btn.className = csv ? csv.className : 'btn ghost'; btn.textContent = '⬇️ ایمپورت MT4/MT5';
    btn.addEventListener('click', open); if (csv && csv.parentNode) csv.parentNode.insertBefore(btn, csv); else hist.insertBefore(btn, hist.firstChild);
    const q = $('driveQuickSyncBtn'); if (q) q.addEventListener('click', () => setTimeout(() => { if (arexV98().prefs.autoIngest && window.AREX_GET_EDGE_WORKER_URL && AREX_GET_EDGE_WORKER_URL()) pull(true).catch(() => {}); }, 7000));
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount(); document.addEventListener('arex:view', e => { if (e.detail.name === 'trades') mount(); });
})();
