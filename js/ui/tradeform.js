/* AREX V9.6.3 — ui/tradeform: extra trade fields (risk %, original SL, emotions, tags) and shared trade defaults. Texts: V9T.
   Emotions are stored as language-independent codes; labels are translated at display time. */
(function () {
  const EMO = ['calm', 'confident', 'anxious', 'hasty', 'fomo', 'fear', 'tired', 'angry'];
  window.arexEmoLabel = code => { if (!code) return ''; const s = V9T('emo.' + code); return s === 'emo.' + code ? String(code) : s; };
  window.newTradeDefaults = () => ({ riskPct: null, slOriginal: null, strategyId: null, strategyVersion: null, emotionBefore: null, emotionAfter: null, tags: [] });
  window.trParseTags = s => [...new Set(String(s || '').split(/[,،]/).map(x => x.trim()).filter(Boolean))].slice(0, 12).map(x => x.slice(0, 30));
  window.initArexTradeForm = function () {
    ['trEmoBefore', 'trEmoAfter'].forEach(id => {
      const s = document.getElementById(id); if (!s) return; const keep = s.value; s.textContent = '';
      const o = document.createElement('option'); o.value = ''; o.textContent = V9T('emo.none'); s.appendChild(o);
      EMO.forEach(c => { const x = document.createElement('option'); x.value = c; x.textContent = V9T('emo.' + c); s.appendChild(x); });
      s.value = keep;
    });
  };
})();
