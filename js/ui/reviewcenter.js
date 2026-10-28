/* AREX V9.8.0 — ui/reviewcenter: trade replay + screenshot annotation, locked weekly review/plan, monthly professional report + exports. */
(function () {
  'use strict';
  if (!window.arexRegisterView) return;
  const $ = id => document.getElementById(id), E = window.arexEscape, fa = arexFmt.fa, num = v => AREXCore.tradecalc.num(v);
  const rc = { tab: 'replay', idx: 0, list: [], acc: '__all', onlyNew: false };
  const HTML = `<div class="arex-rc-tabs" role="tablist"><button class="chip active" data-tab="replay" type="button">🎞️ بازپخش و مرور معامله</button><button class="chip" data-tab="weekly" type="button">🗓️ مرور هفتگی</button><button class="chip" data-tab="report" type="button">📑 گزارش و خروجی</button></div>
  <div id="arexRcBody"></div>`;
  const day = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };

  /* ================= replay ================= */
  function tradesList() { const v = arexV98(); let l = (state.trades || []).filter(t => num(t.r) !== null || num(t.usd) !== null); if (rc.acc !== '__all') l = l.filter(t => AREXCore.ledger.accountOf(t, v) === rc.acc); if (rc.onlyNew) l = l.filter(t => !t.review); return l.slice().sort((a, b) => (String(b.date) + String(b.time || '')).localeCompare(String(a.date) + String(a.time || ''))); }
  function ruler(t) {
    const e = num(t.entry), sl = num(t.slOriginal) !== null ? num(t.slOriginal) : num(t.sl), tp = num(t.tp), x = num(t.exit), s = AREXCore.tradecalc.sign(t.dir); if (e === null || sl === null) return '<div class="muted">برای نمایش خط قیمت، ورود و حد ضرر لازم است.</div>';
    const risk = Math.abs(e - sl), pts = [e, sl].concat(tp !== null ? [tp] : [], x !== null ? [x] : []); (t.partials || []).forEach(p => pts.push(+p.price));
    const mae = num(t.mae), mfe = num(t.mfe); if (mfe !== null) pts.push(e + s * mfe * risk); if (mae !== null) pts.push(e - s * mae * risk);
    const lo = Math.min(...pts), hi = Math.max(...pts), span = (hi - lo) || 1, W = 640, X = p => 30 + (p - lo) / span * (W - 60), mk = (p, label, col, y) => `<line x1="${X(p)}" x2="${X(p)}" y1="30" y2="70" stroke="${col}" stroke-width="2"/><text x="${X(p)}" y="${y}" font-size="11" text-anchor="middle" fill="${col}">${label}</text>`;
    let g = ''; if (x !== null) g += `<line x1="${X(e)}" x2="${X(x)}" y1="50" y2="50" stroke="${(x - e) * s >= 0 ? '#33c589' : '#f87171'}" stroke-width="6" stroke-linecap="round" opacity=".7"/>`;
    g += mk(sl, 'SL', '#f87171', 22) + mk(e, 'ورود', '#1e90ff', 22) + (tp !== null ? mk(tp, 'TP', '#33c589', 22) : '') + (x !== null ? mk(x, 'خروج', '#e8c25a', 88) : '');
    (t.partials || []).forEach(p => { g += `<circle cx="${X(+p.price)}" cy="50" r="5" fill="#e8c25a"><title>جزئی ${p.price} × ${p.lots}</title></circle>`; });
    if (mfe !== null) g += `<circle cx="${X(e + s * mfe * risk)}" cy="50" r="4" fill="#33c589" stroke="#fff"><title>MFE ${mfe}R</title></circle>`; if (mae !== null) g += `<circle cx="${X(e - s * mae * risk)}" cy="50" r="4" fill="#f87171" stroke="#fff"><title>MAE ${mae}R</title></circle>`;
    return `<svg viewBox="0 0 ${W} 100" class="arex-curve" role="img" aria-label="price ruler">${g}</svg>`;
  }
  function whatIf(t) {
    const r = num(t.r), rr = num(t.plannedRR) !== null ? num(t.plannedRR) : AREXCore.tradecalc.plannedRR(t), mfe = num(t.mfe), L = []; if (r === null) return '';
    L.push(`واقعی: <b>${fa(r)}R</b>`); if (rr) L.push(`اگر به تارگت (۱:${fa(rr)}) می‌رسید: <b>${fa(rr)}R</b>`); if (mfe !== null) L.push(`اگر در اوج شناور (MFE) خارج می‌شدی: <b>${fa(mfe)}R</b>`); if (r < 0) L.push('اگر روی ۰ (سر‌به‌سر) می‌بستی: <b>۰R</b>'); return L.join(' · ');
  }
  async function shot(t, kind) { try { const r = await storage.get('tradeshot:' + t.id + ':' + kind); return r && r.value ? r.value : null; } catch (e) { return null; } }
  function renderReplay(body) {
    const v = arexV98(); rc.list = tradesList(); if (rc.idx >= rc.list.length) rc.idx = Math.max(0, rc.list.length - 1);
    const t = rc.list[rc.idx], opts = `<option value="__all">همه حساب‌ها</option>` + v.accounts.map(a => `<option value="${E(a.id)}" ${rc.acc === a.id ? 'selected' : ''}>${E(a.name)}</option>`).join('');
    let h = `<div class="card arex-rc-bar"><select class="txt-input" id="arexRcAcc">${opts}</select><label class="arex-chk"><input type="checkbox" id="arexRcNew" ${rc.onlyNew ? 'checked' : ''}> فقط مرورنشده‌ها</label>
      <div class="arex-rc-pager"><button class="btn ghost" id="arexRcPrev" type="button" ${rc.idx >= rc.list.length - 1 ? 'disabled' : ''}>▶ قبلی</button><span>${rc.list.length ? fa(rc.idx + 1) + ' از ' + fa(rc.list.length) : '—'}</span><button class="btn ghost" id="arexRcNext" type="button" ${rc.idx <= 0 ? 'disabled' : ''}>بعدی ◀</button></div></div>`;
    if (!t) { body.innerHTML = h + '<div class="card"><div class="empty">معامله‌ی بسته‌شده‌ای برای مرور نیست. در ژورنال معامله ثبت کن.</div></div>'; bindReplay(); return; }
    const r = num(t.r), a = v.accounts.find(x => x.id === AREXCore.ledger.accountOf(t, v));
    h += `<div class="card"><div class="arex-rc-head"><div><b class="arex-rc-sym">${E(t.symbol)}</b> <span class="arex-badge ${t.dir === 'buy' ? 'live' : 'prop'}">${t.dir === 'buy' ? 'خرید' : 'فروش'}</span> <span class="muted">${E(t.date)} ${E(t.time || '')}${a ? ' · ' + E(a.name) : ''}${t.setup ? ' · ' + E(t.setup) : ''}</span></div><div class="arex-rc-result ${r !== null && r < 0 ? 'neg' : 'pos'}">${r === null ? '' : fa(r) + 'R'} ${t.usd !== '' && t.usd !== undefined ? arexFmt.money(num(t.usd)) : ''}</div></div>${ruler(t)}
      <div class="arex-kpis">${[['RR برنامه', t.plannedRR ? '۱:' + fa(t.plannedRR) : '—'], ['لات', t.lots ? fa(t.lots) : '—'], ['تایم‌فریم', E(t.timeframe || '—')], ['مدت', t.durationMin ? fa(t.durationMin) + ' دقیقه' : '—'], ['MAE', t.mae != null ? fa(t.mae) + 'R' : '—'], ['MFE', t.mfe != null ? fa(t.mfe) + 'R' : '—'], ['کمیسیون+سواپ', arexFmt.money((num(t.commission) || 0) + (num(t.swap) || 0))], ['کیفیت ستاپ', t.quality ? fa(t.quality) + '/۵' : '—']].map(k => `<div class="arex-kpi"><small>${k[0]}</small><b>${k[1]}</b></div>`).join('')}</div>
      <div class="arex-q-note">${whatIf(t)}</div>${(t.mistakes || []).length ? `<div class="arex-rc-tags">${t.mistakes.map(m => `<span class="arex-badge prop">${E(m)}</span>`).join('')}</div>` : ''}${t.note ? `<div class="arex-rc-note">${E(t.note)}</div>` : ''}
      <div class="arex-rc-shots" id="arexRcShots"></div>
      <div class="arex-rc-review"><div class="field-lbl">امتیاز اجرای این معامله (نه نتیجه‌اش)</div><div class="arex-stars" id="arexRcStars">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="chip ${t.review && t.review.grade === i ? 'active' : ''}" data-g="${i}">${fa(i)}</button>`).join('')}</div>
        <div class="field-lbl">درس این معامله</div><textarea class="txt-input" id="arexRcLesson" rows="2" maxlength="400" placeholder="اگر دوباره پیش بیاید چه کار می‌کنم؟">${E(t.review ? t.review.lesson : '')}</textarea><button class="btn" id="arexRcSave" type="button">ذخیره مرور ${t.review ? '✓' : ''}</button></div></div>`;
    body.innerHTML = h; bindReplay(t);
    ['entry', 'exit'].forEach(async k => { const d = await shot(t, k), box = $('arexRcShots'); if (!d || !box) return; const f = document.createElement('figure'); f.innerHTML = `<figcaption>${k === 'entry' ? 'ورود' : 'خروج'} <button class="btn ghost" type="button" data-an="${k}">✏️ حاشیه‌نویسی</button></figcaption><img alt="${k}">`; f.querySelector('img').src = d; box.appendChild(f); f.querySelector('[data-an]').addEventListener('click', () => annotate(t, k, d)); });
  }
  function bindReplay(t) {
    const go = d => { rc.idx = Math.max(0, Math.min(rc.list.length - 1, rc.idx + d)); render(); };
    $('arexRcAcc').onchange = e => { rc.acc = e.target.value; rc.idx = 0; render(); }; $('arexRcNew').onchange = e => { rc.onlyNew = e.target.checked; rc.idx = 0; render(); };
    $('arexRcPrev') && ($('arexRcPrev').onclick = () => go(1)); $('arexRcNext') && ($('arexRcNext').onclick = () => go(-1));
    if (!t) return; let grade = t.review ? t.review.grade : 0;
    $('arexRcStars').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; grade = +b.dataset.g; $('arexRcStars').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b)); });
    $('arexRcSave').onclick = () => { if (!grade) { toast('یک امتیاز اجرا انتخاب کن'); return; } t.review = { grade, lesson: $('arexRcLesson').value.trim(), at: new Date().toISOString() }; queueSave('trades'); toast('مرور ذخیره شد ✓'); if (rc.idx > 0 && !rc.onlyNew) go(-1); else render(); };
  }
  document.addEventListener('keydown', e => { const v = $('view-reviewcenter'); if (!v || !v.classList.contains('active') || rc.tab !== 'replay' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return; if (e.key === 'ArrowRight') { rc.idx = Math.min(rc.list.length - 1, rc.idx + 1); render(); } if (e.key === 'ArrowLeft') { rc.idx = Math.max(0, rc.idx - 1); render(); } });

  /* ================= annotation editor ================= */
  function annotate(t, kind, src) {
    const img = new Image(); img.onload = () => {
      const maxW = 1600, sc = Math.min(1, maxW / img.naturalWidth), W = Math.round(img.naturalWidth * sc), H = Math.round(img.naturalHeight * sc);
      const bg = document.createElement('div'); bg.className = 'arex-annot'; bg.innerHTML = `<div class="arex-annot-bar"><div class="arex-annot-tools"><button class="chip active" data-tool="pen" type="button">✏️ قلم</button><button class="chip" data-tool="arrow" type="button">↗ فلش</button><button class="chip" data-tool="rect" type="button">▭ کادر</button><button class="chip" data-tool="text" type="button">T متن</button></div>
        <div class="arex-annot-colors">${['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff'].map((c, i) => `<button type="button" class="arex-swatch ${i ? '' : 'on'}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
        <div class="arex-annot-actions"><button class="btn ghost" id="anUndo" type="button">↶ برگشت</button><button class="btn ghost" id="anClear" type="button">پاک‌سازی</button><button class="btn ghost" id="anCancel" type="button">انصراف</button><button class="btn" id="anSave" type="button">ذخیره</button></div></div><div class="arex-annot-stage"><canvas id="anCv" width="${W}" height="${H}"></canvas></div>`;
      document.body.appendChild(bg); const cv = $('anCv'), cx = cv.getContext('2d'); let tool = 'pen', color = '#ff3b30', ops = [], cur = null; const lw = Math.max(3, Math.round(W / 220));
      const draw = () => { cx.clearRect(0, 0, W, H); cx.drawImage(img, 0, 0, W, H); [...ops, cur].filter(Boolean).forEach(o => { cx.strokeStyle = o.c; cx.fillStyle = o.c; cx.lineWidth = lw; cx.lineCap = 'round'; cx.lineJoin = 'round';
        if (o.t === 'pen') { cx.beginPath(); o.p.forEach((q, i) => (i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]))); cx.stroke(); }
        else if (o.t === 'rect') cx.strokeRect(o.a[0], o.a[1], o.b[0] - o.a[0], o.b[1] - o.a[1]);
        else if (o.t === 'arrow') { const [x1, y1] = o.a, [x2, y2] = o.b, ang = Math.atan2(y2 - y1, x2 - x1), hl = lw * 5; cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke(); cx.beginPath(); cx.moveTo(x2, y2); cx.lineTo(x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)); cx.lineTo(x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)); cx.closePath(); cx.fill(); }
        else if (o.t === 'text') { cx.font = '700 ' + lw * 7 + 'px sans-serif'; cx.lineWidth = lw * 1.4; cx.strokeStyle = '#000'; cx.strokeText(o.s, o.a[0], o.a[1]); cx.fillText(o.s, o.a[0], o.a[1]); } }); };
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = pos(e); if (tool === 'text') { const s = prompt('متن:'); if (s) { ops.push({ t: 'text', c: color, a: p, s }); draw(); } return; } cv.setPointerCapture(e.pointerId); cur = tool === 'pen' ? { t: 'pen', c: color, p: [p] } : { t, c: color, a: p, b: p }; cur.t = tool; });
      cv.addEventListener('pointermove', e => { if (!cur) return; const p = pos(e); if (cur.t === 'pen') cur.p.push(p); else cur.b = p; draw(); });
      const end = () => { if (cur) { ops.push(cur); cur = null; draw(); } }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      bg.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => { tool = b.dataset.tool; bg.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('active', x === b)); }));
      bg.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { color = b.dataset.c; bg.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); }));
      $('anUndo').onclick = () => { ops.pop(); draw(); }; $('anClear').onclick = () => { ops = []; draw(); }; $('anCancel').onclick = () => bg.remove();
      $('anSave').onclick = async () => { try { await storage.set('tradeshot:' + t.id + ':' + kind, cv.toDataURL('image/jpeg', 0.88)); if (kind === 'entry') t.hasShotEntry = true; else t.hasShotExit = true; queueSave('trades'); toast('تصویر حاشیه‌نویسی‌شده ذخیره شد ✓'); bg.remove(); render(); } catch (err) { toast('ذخیره تصویر ممکن نشد: ' + (err.message || err)); } };
      draw();
    }; img.onerror = () => toast('بارگذاری تصویر ممکن نشد.'); img.src = src;
  }

  /* ================= weekly review + locked plan ================= */
  const nextWeekKey = () => window.arexWeekKey(new Date(Date.now() + 7 * 86400000));
  window.arexPlanCheck = function (trade) {
    try { const v = arexV98(), plan = v.weekPlans[arexWeekKey()]; if (!plan || !plan.locked) return null; const msgs = [];
      const rp = trade.riskPct !== undefined && trade.riskPct !== '' ? num(trade.riskPct) : num(($('trRiskPct') || {}).value); if (plan.maxRiskPct && rp !== null && rp > plan.maxRiskPct) msgs.push('ریسک ' + rp + '٪ از سقف برنامه (' + plan.maxRiskPct + '٪) بیشتر است');
      const n = (state.trades || []).filter(t => t.date === trade.date && t.id !== trade.id).length; if (plan.maxTrades && n >= plan.maxTrades) msgs.push('سقف تعداد معامله‌ی روز (' + plan.maxTrades + ') پر شده');
      const wd = new Date(trade.date + 'T12:00:00').getDay(); if ((plan.noTradeDays || []).includes(wd)) msgs.push('امروز طبق برنامه روز بدون معامله است');
      if (!msgs.length) return null; if (confirm('برنامه‌ی قفل‌شده‌ی این هفته:\n• ' + msgs.join('\n• ') + '\n\nمی‌خواهی با ثبت «نقض برنامه» ادامه بدهی؟')) { trade.planOverride = msgs.join(' | '); return null; } return 'ثبت طبق برنامه‌ی قفل‌شده انجام نشد.'; } catch (e) { return null; }
  };
  function renderWeekly(body) {
    const v = arexV98(), wk = arexWeekKey(), rev = v.weeklyReviews[wk], plan = v.weekPlans[wk], nk = nextWeekKey(), next = v.weekPlans[nk];
    const trades = state.trades || [], w = AREXCore.brain.weeklyReview(trades, new Date()), mist = AREXCore.brain.snapshot({ trades, now: new Date() }).mistakes;
    const sug = mist.slice(0, 3).map(m => `قبل از هر ورود، چک «${m.key}» را انجام می‌دهم`);
    const dayNames = ['یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه', 'شنبه'], cfg = window.__arexGuardCfg || {};
    body.innerHTML = `<div class="card"><div class="section-title">۱) خلاصه‌ی هفته (${E(wk)})</div><div class="arex-brain-text">${E(w.lines.join('\n'))}</div>${w.focus.length ? `<div class="arex-q-note">🎯 ${E(w.focus.join(' · '))}</div>` : ''}</div>
    <div class="card"><div class="section-title">۲) امتیازدهی به فرآیند (نه نتیجه)</div><div class="arex-scores">${[['plan', 'پایبندی به پلن'], ['risk', 'رعایت ریسک'], ['emo', 'کنترل احساسات'], ['journal', 'ثبت و مرور ژورنال']].map(([k, l]) => `<label>${l}<input type="range" min="1" max="5" value="${rev && rev.scores ? rev.scores[k] : 3}" data-s="${k}"><b data-sv="${k}">${fa(rev && rev.scores ? rev.scores[k] : 3)}</b></label>`).join('')}</div>
      <div class="field-lbl">مهم‌ترین درس این هفته</div><textarea class="txt-input" id="arexWkLesson" rows="2" maxlength="400">${E(rev ? rev.lesson : '')}</textarea></div>
    <div class="card"><div class="section-title">۳) تکمیل قوانین</div>${sug.length ? sug.map((s, i) => `<label class="arex-chk"><input type="checkbox" data-rule="${i}" checked> ${E(s)}</label>`).join('') : '<div class="calc-hint">اشتباه تکراری‌ای برای پیشنهاد قانون ثبت نشده.</div>'}<div class="field-lbl">قانون دلخواه</div><input class="txt-input" id="arexWkRule" maxlength="140" placeholder="مثلاً بعد از دو ضرر پشت‌سرهم تا فردا معامله نمی‌کنم"></div>
    <div class="card"><div class="section-title">۴) برنامه‌ی هفته‌ی بعد (${E(nk)}) ${next && next.locked ? '🔒' : ''}</div>
      <div class="form-grid"><div><div class="field-lbl">حداکثر معامله در روز</div><input class="txt-input" id="arexWkMaxT" type="number" min="1" value="${next ? next.maxTrades : (cfg.maxTradesPerDay || 3)}"></div><div><div class="field-lbl">حداکثر ریسک هر معامله (٪)</div><input class="txt-input" id="arexWkMaxR" type="number" step="0.1" min="0.1" value="${next ? next.maxRiskPct : ((state.riskLimits && state.riskLimits.riskPerTradePct) || 1)}"></div></div>
      <div class="field-lbl">روزهای بدون معامله</div><div class="arex-days">${[6, 0, 1, 2, 3, 4, 5].map(d => `<label class="arex-chk"><input type="checkbox" data-nd="${d}" ${next && (next.noTradeDays || []).includes(d) ? 'checked' : ''}> ${['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][d]}</label>`).join('')}</div>
      <div class="field-lbl">تمرکز اصلی هفته</div><input class="txt-input" id="arexWkFocus" maxlength="140" value="${E(next ? next.focus : (w.focus[0] || ''))}">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="arexWkLock" type="button">ذخیره مرور و قفل برنامه 🔒</button></div>
      ${plan && plan.locked ? `<div class="arex-q-note">برنامه‌ی این هفته قفل است (حداکثر ${fa(plan.maxTrades)} معامله در روز، ریسک ≤ ${fa(plan.maxRiskPct)}٪). <button class="btn ghost" id="arexWkUnlock" type="button">باز کردن قفل با ذکر دلیل</button></div>` : ''}</div>`;
    body.querySelectorAll('[data-s]').forEach(r => r.addEventListener('input', () => { body.querySelector('[data-sv="' + r.dataset.s + '"]').textContent = fa(r.value); }));
    $('arexWkLock').onclick = () => {
      const scores = {}; body.querySelectorAll('[data-s]').forEach(r => { scores[r.dataset.s] = +r.value; }); const added = [];
      body.querySelectorAll('[data-rule]:checked').forEach(c => added.push(sug[+c.dataset.rule])); const own = $('arexWkRule').value.trim(); if (own) added.push(own);
      added.forEach(r => { if (!(state.tradeRules || []).includes(r)) state.tradeRules.push(r); }); if (added.length) { queueSave('tradeRules'); try { renderSettingsRules(); renderTradeRulesBox(); } catch (e) {} }
      v.weeklyReviews[wk] = { scores, lesson: $('arexWkLesson').value.trim(), rulesAdded: added, at: new Date().toISOString() };
      const nd = []; body.querySelectorAll('[data-nd]:checked').forEach(c => nd.push(+c.dataset.nd));
      v.weekPlans[nk] = { maxTrades: Math.max(1, +$('arexWkMaxT').value || 3), maxRiskPct: Math.max(0.1, +$('arexWkMaxR').value || 1), noTradeDays: nd, focus: $('arexWkFocus').value.trim(), locked: true, lockedAt: new Date().toISOString(), unlockLog: [] };
      arexV98Save(); toast('مرور ذخیره و برنامه‌ی هفته‌ی بعد قفل شد 🔒'); render();
    };
    if ($('arexWkUnlock')) $('arexWkUnlock').onclick = () => { const why = prompt('دلیل باز کردن قفل برنامه‌ی این هفته؟'); if (!why || why.trim().length < 5) { toast('دلیل باید حداقل ۵ حرف باشد.'); return; } plan.locked = false; (plan.unlockLog = plan.unlockLog || []).push({ at: new Date().toISOString(), why: why.trim() }); arexV98Save(); render(); };
  }

  /* ================= monthly report + exports ================= */
  function renderReport(body) {
    const v = arexV98(), m = new Date(); const cur = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
    body.innerHTML = `<div class="card"><div class="section-title">📑 گزارش ماهانه‌ی حرفه‌ای</div><div class="form-grid"><div><div class="field-lbl">ماه</div><input class="txt-input" id="arexRpMonth" type="month" value="${cur}"></div><div><div class="field-lbl">حساب</div><select class="txt-input" id="arexRpAcc"><option value="__all">همه حساب‌ها</option>${v.accounts.map(a => `<option value="${E(a.id)}">${E(a.name)}</option>`).join('')}</select></div></div>
      <label class="arex-chk"><input type="checkbox" id="arexRpMc" checked> شامل شبیه‌سازی مونت‌کارلو</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="arexRpPrint" type="button">🖨️ پیش‌نمایش / ذخیره PDF</button><button class="btn ghost" id="arexRpHtml" type="button">⬇️ دانلود گزارش (HTML)</button></div></div>
      <div class="card"><div class="section-title">📤 خروجی داده‌ها</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="arexRpCsv" type="button">CSV کامل معاملات</button><button class="btn ghost" id="arexRpJson" type="button">پشتیبان JSON (معاملات + حساب‌ها + دفتر)</button></div><div class="calc-hint">CSV با BOM ذخیره می‌شود و مستقیم در Excel باز می‌شود؛ شامل لات، هزینه‌ها، RR، MAE/MFE و ... .</div></div>`;
    const build = () => { const acc = $('arexRpAcc').value, month = $('arexRpMonth').value, all = state.trades || []; const tr = acc === '__all' ? all : AREXCore.ledger.tradesOf(all, v, acc);
      const inM = tr.filter(t => !month || String(t.date).startsWith(month)), mc = $('arexRpMc').checked ? AREXCore.quant.monteCarlo(inM.length >= 20 ? inM : tr, { riskPct: (state.riskLimits && +state.riskLimits.riskPerTradePct) || 1, trials: 2000 }) : null;
      const sums = AREXCore.ledger.all(v, all).filter(a => acc === '__all' || a.id === acc).map(a => ({ name: a.name, type: AREXCore.ledger.TYPES[a.type] || a.type, balance: a.balance, deposits: a.deposits, withdrawals: a.withdrawals, maxDDpct: a.maxDDpct }));
      return { month, html: AREXCore.report.monthly({ title: 'AREX', month, trades: tr, accounts: sums, quant: AREXCore.quant.ratios(inM, null), mc, generatedAt: new Date().toLocaleString('fa-IR') }) }; };
    $('arexRpPrint').onclick = () => { const r = build(), w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(r.html); w.document.close(); } else { download('AREX-report-' + r.month + '.html', r.html, 'text/html;charset=utf-8'); toast('پنجره باز نشد؛ گزارش دانلود شد (در مرورگر باز و Print کن).'); } };
    $('arexRpHtml').onclick = () => { const r = build(); download('AREX-report-' + (r.month || 'all') + '.html', r.html, 'text/html;charset=utf-8'); };
    $('arexRpCsv').onclick = () => download('AREX-trades-' + day(new Date()) + '.csv', AREXCore.report.tradesToCsv(state.trades || []), 'text/csv;charset=utf-8');
    $('arexRpJson').onclick = () => download('AREX-backup-' + day(new Date()) + '.json', JSON.stringify({ exportedAt: new Date().toISOString(), version: '9.8.0', trades: state.trades || [], accounts: v.accounts, ledger: v.ledger, weeklyReviews: v.weeklyReviews, weekPlans: v.weekPlans }, null, 1), 'application/json');
  }

  function render() { const body = $('arexRcBody'); if (!body) return; document.querySelectorAll('.arex-rc-tabs .chip').forEach(b => b.classList.toggle('active', b.dataset.tab === rc.tab)); (rc.tab === 'replay' ? renderReplay : rc.tab === 'weekly' ? renderWeekly : renderReport)(body); }
  function mount() {
    const sec = arexRegisterView({ id: 'reviewcenter', title: 'مرور و گزارش‌ها', sub: 'بازپخش معامله، مرور هفتگی قفل‌شونده و گزارش ماهانه', html: HTML, icon: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/>', onShow: render }); if (!sec) return;
    sec.querySelector('.arex-rc-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { rc.tab = b.dataset.tab; render(); } });
  }
  document.addEventListener('DOMContentLoaded', mount); if (document.readyState !== 'loading') mount();
  window.arexOpenReview = tab => { rc.tab = tab || 'replay'; goView('reviewcenter'); };
})();
