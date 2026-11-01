/* AREX V9.8.0 — ui/marketday-ui: wires the market calendar into the app (reminders, banners, streaks) and provides its settings card. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MD = () => window.AREXCore && AREXCore.marketday;
  const prefs = () => { try { const v = arexV98(); v.prefs.market = Object.assign({}, MD().DEFAULTS, v.prefs.market || {}); return v.prefs.market; } catch (e) { return null; } };
  window.arexMarketPrefs = prefs;
  window.arexMarketStatus = d => (MD() && prefs() ? MD().status(d || new Date(), prefs()) : { closed: false });
  window.arexMarketClosed = d => { try { return !!window.arexMarketStatus(d).closed; } catch (e) { return false; } };
  window.arexMarketReopen = () => { try { return MD().reopenText(new Date(), prefs()); } catch (e) { return ''; } };
  // days the trader does not trade also count as rest days for streaks / mascot mood
  function patchActive() { if (typeof window.isActiveDay === 'function' && !window.isActiveDay.__md) { const old = window.isActiveDay; window.isActiveDay = function (d) { return old.apply(this, arguments) && !window.arexMarketClosed(d); }; window.isActiveDay.__md = true; } }
  patchActive(); window.addEventListener('load', patchActive); setTimeout(patchActive, 1500);

  function card() {
    const grid = document.querySelector('#view-settings > .grid'); if (!grid || $('arexMarketCard') || !MD() || !prefs()) return;
    const el = document.createElement('div'); el.className = 'card'; el.id = 'arexMarketCard'; grid.appendChild(el);
    const paint = () => { const p = prefs(), y = new Date().getFullYear(), hs = MD().holidays(y).concat(MD().holidays(y + 1)).filter(h => h.date >= new Date().toISOString().slice(0, 10)).slice(0, 8), names = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'], st = window.arexMarketStatus();
      el.innerHTML = `<div class="section-title">🛑 روزهای تعطیل بازار</div><div class="calc-hint">در این روزها برنامه چیزی از تو نمی‌خواهد: بدون یادآوری، بدون مراحل روزانه، بدون هشدار همگام‌سازی و مرور، و بدون شکستن زنجیره‌ی روزهای فعال. ${st.closed ? '<b>امروز: ' + E(st.name) + '</b>' : ''}</div>
        <div class="field-lbl">روزهای هفته‌ی تعطیل</div><div class="arex-days">${[6, 0, 1, 2, 3, 4, 5].map(d => `<label class="arex-chk"><input type="checkbox" data-wd="${d}" ${p.closedWeekdays.includes(d) ? 'checked' : ''}> ${names[d]}</label>`).join('')}</div>
        <label class="arex-chk"><input type="checkbox" id="mdBuilt" ${p.builtIn !== false ? 'checked' : ''}> تعطیلات رسمی بازار فارکس (۱ ژانویه و ۲۵ دسامبر)</label>
        <label class="arex-chk"><input type="checkbox" id="mdLim" ${p.limited !== false ? 'checked' : ''}> فقط یادداشت برای نیمه‌تعطیلی‌ها (تعطیلات آمریکا / شاخص‌ها، Good Friday، آخر سال)</label>
        <div class="field-lbl" style="margin-top:8px">تعطیلی دلخواه (مثلاً تعطیلی بروکر تو)</div><div class="arex-wl-add"><input class="txt-input" id="mdDate" type="date"><input class="txt-input" id="mdName" placeholder="نام (اختیاری)" maxlength="40"><button class="btn" id="mdAdd" type="button">افزودن</button></div>
        ${Object.keys(p.custom).sort().map(k => `<div class="arex-led-row" style="grid-template-columns:110px 1fr 32px"><span>${E(k)}</span><span class="muted">${E(p.custom[k])}</span><button class="del-x" data-rm="${E(k)}" aria-label="حذف">✕</button></div>`).join('')}
        <div class="field-lbl" style="margin-top:10px">تعطیلی‌های پیش‌رو (تقریبی؛ با تقویم بروکر خودت چک کن)</div><div class="arex-imp-table">${hs.map(h => `<div>${h.level === 'closed' ? '🛑' : '⚠️'} ${E(h.date)} · ${E(h.name)}</div>`).join('')}</div>`;
      el.querySelectorAll('[data-wd]').forEach(c => c.onchange = () => { const s = new Set(p.closedWeekdays); c.checked ? s.add(+c.dataset.wd) : s.delete(+c.dataset.wd); p.closedWeekdays = [...s]; arexV98Save(); window.arexHomeRefresh && arexHomeRefresh(); paint(); });
      $('mdBuilt').onchange = e => { p.builtIn = e.target.checked; arexV98Save(); window.arexHomeRefresh && arexHomeRefresh(); }; $('mdLim').onchange = e => { p.limited = e.target.checked; arexV98Save(); };
      $('mdAdd').onclick = () => { const d = $('mdDate').value; if (!d) { toast('تاریخ را انتخاب کن'); return; } p.custom[d] = $('mdName').value.trim() || 'تعطیلی انتخابی'; arexV98Save(); window.arexHomeRefresh && arexHomeRefresh(); paint(); };
      el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { delete p.custom[b.dataset.rm]; arexV98Save(); window.arexHomeRefresh && arexHomeRefresh(); paint(); }); };
    paint();
  }
  document.addEventListener('arex:view', e => { if (e.detail.name === 'settings') card(); }); setTimeout(card, 2000);
})();
