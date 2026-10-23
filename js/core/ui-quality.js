/* AREX UI quality helpers: locale direction and translation coverage. */
(function(root){
  'use strict';
  const supported = Object.freeze(['fa','en','de']);
  function resolveLanguage(lang, dictionaries){
    const allowed = dictionaries && typeof dictionaries === 'object' ? Object.keys(dictionaries) : supported;
    return typeof lang === 'string' && allowed.includes(lang) ? lang : (allowed.includes('fa') ? 'fa' : (allowed[0] || 'en'));
  }
  function directionForLanguage(lang){ return lang === 'fa' ? 'rtl' : 'ltr'; }
  function auditTranslationKeys(base, dictionaries){
    const required = Object.keys(base || {}), result = {};
    for(const [lang, dict] of Object.entries(dictionaries || {})){
      const missing = required.filter(key => !dict || !Object.prototype.hasOwnProperty.call(dict,key));
      result[lang] = { total: required.length, missing, coverage: required.length ? Math.round((required.length-missing.length)*1000/required.length)/10 : 100 };
    }
    return result;
  }
  const api = {supported, resolveLanguage, directionForLanguage, auditTranslationKeys};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  if(root) root.AREXUIQuality = api;
})(typeof window !== 'undefined' ? window : globalThis);
