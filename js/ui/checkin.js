/* AREX V9.8.0 — ui/checkin: the MORNING check-in (mood, energy, readiness, sleep, focus for today). Stored separately from the end-of-day report,
   so it can be logged before any trade, without answering "did you trade today" or writing notes. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = window.arexEscape, fa = v => arexFmt.fa(v);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const MOODS = [['آرام و منضبط', '😌'], ['مطمئن و متمرکز', '😎'], ['ترس / تردید', '😟'], ['هیجان‌زدگی / FOMO', '🤩'], ['طمع', '🤑'], ['عصبانیت / انتقام‌گیری', '😠'], ['خستگی / بی‌تمرکزی', '😴'], ['ناامیدی', '😞']];
  const GO = [['ready', '✅ آماده‌ام'], ['careful', '⚠️ با احتیاط (حجم کمتر)'], ['rest', '🛑 امروز معامله نمی‌کنم']];
  const store = () => { const v = arexV98(); v.checkins = v.checkins || {}; return v.checkins; };
  const get = date => store()[date || iso(new Date())] || null;
  const SCALE = (k, v, lo, hi) => `<div class="arex-ci-scale" role="radiogroup" data-k="${k}"><span class="muted">${lo}</span>${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${v === n}" class="${v === n ? 'on' : ''}" data-v="${n}">${fa(n)}</button>`).join('')}<span class="muted">${hi}</span></div>`;
  function summary(c) { if (!c) return ''; const m = MOODS.find(x => x[0] === c.mood); return (m ? m[1] + ' ' + c.mood + ' · ' : '') + 'انرژی ' + fa(c.energy || '—') + '/۵ · آمادگی ' + fa(c.readiness || '—') + '/۵' + (c.sleep ? ' · خواب ' + fa(c.sleep) + '/۵' : '') + (c.go === 'rest' ? ' · امروز معامله نمی‌کنم' : c.go === 'careful' ? ' · با احتیاط' : ''); }
  function save(c, date) {
    const d = date || iso(new Date()), g = store(), prev = g[d] || {}; g[d] = Object.assign({}, prev, c, { date: d, at: prev.at || new Date().toISOString(), updatedAt: new Date().toISOString() });
    const keep = iso(new Date(Date.now() - 400 * 86400000)); Object.keys(g).forEach(k => { if (k < keep) delete g[k]; });
    if (c.go === 'rest') { const p = arexV98().prefs; p.guide = p.guide || {}; (p.guide[d] = p.guide[d] || { steps: {} }).noTrade = true; }
    arexV98Save(); window.arexHomeRefresh && arexHomeRefresh(); paintDaily();
  }
  function open() {
    if ($('arexCheckin')) return; const d = iso(new Date()), cur = Object.assign({ mood: '', energy: 0, readiness: 0, sleep: 0, focus: '', go: '' }, get(d) || {});
    const bg = document.createElement('div'); bg.id = 'arexCheckin'; bg.className = 'arex-modal-bg';
    bg.innerHTML = `<div class="arex-modal" role="dialog" aria-label="حال و آمادگی امروز"><div class="arex-modal-head"><b>☀️ حال و آمادگی امروز</b><button class="icon-btn" type="button" id="ciX" aria-label="بستن">✕</button></div>
      <div class="calc-hint">فقط ۱۰ ثانیه؛ نیازی به ثبت معامله یا نکته نیست. گزارش پایان روز جداست.</div>
      <div class="field-lbl">حال غالب الان</div><div class="arex-ci-moods">${MOODS.map(m => `<button type="button" class="chip ${cur.mood === m[0] ? 'active' : ''}" data-mood="${E(m[0])}">${m[1]} ${E(m[0])}</button>`).join('')}</div>
      <div class="field-lbl">انرژی و تمرکز</div>${SCALE('energy', cur.energy, 'کم', 'زیاد')}
      <div class="field-lbl">آمادگی برای رعایت پلن</div>${SCALE('readiness', cur.readiness, 'ضعیف', 'عالی')}
      <div class="field-lbl">کیفیت خواب دیشب (اختیاری)</div>${SCALE('sleep', cur.sleep, 'بد', 'عالی')}
      <div class="field-lbl">تمرکز امروز (اختیاری، یک جمله)</div><input class="txt-input" id="ciFocus" maxlength="120" value="${E(cur.focus)}" placeholder="مثلاً فقط ستاپ A و بعد از دو ضرر توقف">
      <div class="field-lbl">تصمیم امروز</div><div class="arex-ci-go">${GO.map(g => `<button type="button" class="chip ${cur.go === g[0] ? 'active' : ''}" data-go="${g[0]}">${g[1]}</button>`).join('')}</div>
      <div class="arex-modal-foot"><button class="btn ghost" id="ciCancel" type="button">بعداً</button><button class="btn" id="ciSave" type="button">ذخیره</button></div></div>`;
    document.body.appendChild(bg); const close = () => bg.remove(); $('ciX').onclick = close; $('ciCancel').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.querySelectorAll('[data-mood]').forEach(b => b.onclick = () => { cur.mood = b.dataset.mood; bg.querySelectorAll('[data-mood]').forEach(x => x.classList.toggle('active', x === b)); });
    bg.querySelectorAll('.arex-ci-scale').forEach(s => s.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; cur[s.dataset.k] = +b.dataset.v; s.querySelectorAll('[data-v]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); }));
    bg.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { cur.go = cur.go === b.dataset.go ? '' : b.dataset.go; bg.querySelectorAll('[data-go]').forEach(x => x.classList.toggle('active', x.dataset.go === cur.go)); });
    $('ciSave').onclick = () => { if (!cur.mood && !cur.energy && !cur.readiness) { toast('حداقل حال یا یکی از امتیازها را انتخاب کن'); return; } cur.focus = $('ciFocus').value.trim(); save(cur, d); close(); toast('حال امروز ثبت شد ✓'); };
  }
  /* morning summary on top of the end-of-day report (read-only, with a link to edit) */
  function paintDaily() {
    const hero = document.querySelector('#view-daily .daily-review-hero'); if (!hero) return; let box = $('arexMorningSummary');
    if (!box) { box = document.createElement('div'); box.id = 'arexMorningSummary'; box.className = 'card arex-ci-sum'; hero.parentNode.insertBefore(box, hero.nextSibling); }
    const dateEl = $('dailyReviewDate'), d = (dateEl && dateEl.value) || iso(new Date()), c = get(d);
    box.innerHTML = `<div><b>☀️ حال صبح</b> <span class="muted">${E(d)}</span><div class="muted" style="font-size:13px;margin-top:2px">${c ? E(summary(c)) + (c.focus ? ' · «' + E(c.focus) + '»' : '') : 'برای این روز حال صبح ثبت نشده — جداگانه و بدون نیاز به این گزارش قابل ثبت است.'}</div></div><button class="btn ghost" type="button" id="ciOpen">${c ? 'ویرایش' : 'ثبت حال امروز'}</button>`;
    $('ciOpen').onclick = () => { if (d === iso(new Date())) open(); else toast('حال صبح فقط برای امروز قابل ثبت است.'); };
  }
  window.arexCheckin = { get, save, open, summary };
  document.addEventListener('arex:view', e => { if (e.detail.name === 'daily') { paintDaily(); const dd = $('dailyReviewDate'); if (dd && !dd.dataset.ci) { dd.dataset.ci = '1'; dd.addEventListener('change', paintDaily); } } });
  setTimeout(paintDaily, 2000);
})();
