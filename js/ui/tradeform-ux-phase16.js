/* AREX V9.6.4 — Phase 16: safer, clearer trade-form UX. Additive; does not alter stored schema. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const numericFields = ['trEntry', 'trSl', 'trTp', 'trExit', 'trR', 'trUsd', 'trRiskPct', 'trSlOrig'];
  const isBlank = el => !el || String(el.value ?? '').trim() === '';

  function ensureFeedback() {
    let box = byId('trFormFeedback');
    if (!box) {
      box = document.createElement('div');
      box.id = 'trFormFeedback';
      box.className = 'arex-tradeform-feedback';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      const form = byId('addTradeBtn')?.closest('.card');
      if (form) form.insertBefore(box, form.querySelector('.modal-actions'));
    }
    return box;
  }
  function clearFieldError(el) {
    if (!el) return;
    el.removeAttribute('aria-invalid');
    el.classList.remove('arex-field-invalid');
  }
  function fieldError(el, message) {
    if (el) { el.setAttribute('aria-invalid', 'true'); el.classList.add('arex-field-invalid'); el.focus(); }
    const box = ensureFeedback();
    box.textContent = message;
    box.classList.add('is-error');
  }
  function validate() {
    const symbol = byId('trSymbol');
    if (isBlank(symbol)) { fieldError(symbol, 'برای ثبت معامله، نماد را وارد کن.'); return false; }
    for (const id of numericFields) {
      const el = byId(id);
      if (!el || isBlank(el)) continue;
      const n = Number(el.value);
      if (!Number.isFinite(n)) { fieldError(el, 'یکی از مقادیر عددی معتبر نیست؛ لطفاً آن را بررسی کن.'); return false; }
    }
    const risk = byId('trRiskPct');
    if (risk && !isBlank(risk) && (Number(risk.value) <= 0 || Number(risk.value) > 100)) {
      fieldError(risk, 'درصد ریسک باید بیشتر از صفر و حداکثر ۱۰۰ باشد.'); return false;
    }
    const entry = byId('trEntry'), sl = byId('trSl'), tp = byId('trTp'), dir = byId('trDir')?.value;
    if (entry && sl && !isBlank(entry) && !isBlank(sl) && Number(entry.value) === Number(sl.value)) {
      fieldError(sl, 'حد ضرر با نقطه ورود برابر است؛ مقدار را بررسی کن.'); return false;
    }
    if (entry && tp && !isBlank(entry) && !isBlank(tp) && Number(entry.value) === Number(tp.value)) {
      fieldError(tp, 'حد سود با نقطه ورود برابر است؛ مقدار را بررسی کن.'); return false;
    }
    // Directional SL/TP mismatches are warnings, not blockers: some users record partial or unusual trade states.
    const warnings = [];
    if (entry && sl && !isBlank(entry) && !isBlank(sl)) {
      if ((dir === 'buy' && Number(sl.value) > Number(entry.value)) || (dir === 'sell' && Number(sl.value) < Number(entry.value))) warnings.push('حد ضرر در سمت معمول این جهت معامله نیست.');
    }
    if (entry && tp && !isBlank(entry) && !isBlank(tp)) {
      if ((dir === 'buy' && Number(tp.value) < Number(entry.value)) || (dir === 'sell' && Number(tp.value) > Number(entry.value))) warnings.push('حد سود در سمت معمول این جهت معامله نیست.');
    }
    const box = ensureFeedback();
    box.textContent = warnings.length ? 'قبل از ثبت بررسی کن: ' + warnings.join(' ') : '';
    box.classList.toggle('is-warning', warnings.length > 0);
    box.classList.remove('is-error');
    return true;
  }

  function clearFormState() {
    const ids = ['trDate','trTime','trSymbol','trEntry','trSl','trTp','trExit','trR','trUsd','trSetup','trNote','trRiskPct','trSlOrig','trEmoBefore','trEmoAfter','trTags'];
    ids.forEach(id => { const el = byId(id); if (el) { el.value = ''; clearFieldError(el); } });
    if (byId('trDir')) byId('trDir').value = 'buy';
    ['trShotEntryPrev','trShotExitPrev'].forEach(id => { const img = byId(id); if (img) { img.removeAttribute('src'); img.style.display = 'none'; } });
    ['trShotEntry','trShotExit'].forEach(id => { const input = byId(id); if (input) input.value = ''; });
    document.querySelectorAll('#trRulesBox input').forEach(input => { input.checked = false; });
    document.querySelectorAll('#trMistakeChips .chip').forEach(chip => chip.classList.remove('active'));
    if (Array.isArray(window.trSelectedMistakes)) window.trSelectedMistakes = [];
    if (window.pendingShot) window.pendingShot = { entry: null, exit: null };
    const advanced = byId('trAdvanced'); if (advanced) advanced.open = false;
    const feedback = byId('trFormFeedback'); if (feedback) { feedback.textContent = ''; feedback.className = 'arex-tradeform-feedback'; }
  }

  function init() {
    const symbol = byId('trSymbol');
    if (symbol) {
      symbol.required = true;
      symbol.setAttribute('aria-describedby', 'trFormFeedback');
      symbol.addEventListener('input', () => clearFieldError(symbol));
    }
    numericFields.forEach(id => {
      const el = byId(id); if (!el) return;
      el.addEventListener('input', () => clearFieldError(el));
    });
    const save = byId('addTradeBtn');
    if (save && !save.dataset.phase16Validation) {
      save.dataset.phase16Validation = '1';
      // Capture phase blocks only invalid submissions; valid clicks continue through the existing save flow.
      save.addEventListener('click', event => {
        if (!validate()) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);
    }
    const cancel = byId('cancelTradeEditBtn');
    if (cancel && !cancel.dataset.phase16Reset) {
      cancel.dataset.phase16Reset = '1';
      cancel.addEventListener('click', () => {
        // Run after the legacy handler so the full form, including date, direction and image controls, is reset.
        setTimeout(clearFormState, 0);
      });
    }
    document.querySelectorAll('.field-lbl').forEach(label => {
      const input = label.nextElementSibling;
      if (input && input.matches('input,select,textarea') && input.id && !label.id) {
        label.id = input.id + 'Label';
        if (!input.hasAttribute('aria-label')) input.setAttribute('aria-labelledby', label.id);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.arexTradeFormPhase16 = { validate, clearFormState };
})();
