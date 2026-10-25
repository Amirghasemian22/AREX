/* AREX V9.6.3 — core/strategykb: versioned strategy knowledge base. Pure, immutable-style (every function returns a NEW kb).
   Principles (from the product spec):
   - A rule is only OFFICIAL after an explicit user approval (approve/revise/retire all require a reason and create an immutable version snapshot).
   - Proposed rules never affect evaluation. Hypotheses can never become official until reclassified by the user.
   - History is never rewritten: snapshots are frozen copies; a trade is evaluated against the version that was valid when it was taken.
   - Conflict detection is evidence-based and never auto-resolves; semantic (negation) matches are flagged low-confidence for human review. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.strategykb = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const KINDS = ['mandatory', 'confirmed', 'preference', 'hypothesis'];
  const clone = o => JSON.parse(JSON.stringify(o));
  // Stable error codes so the UI can translate messages (text stays Persian for tests/back-compat).
  const ERR_CODES = { 'متن قانون خالی است': 'text_empty', 'نوع قانون نامعتبر است': 'kind_invalid', 'قانون یافت نشد': 'not_found', 'فقط قانون پیشنهادی قابل تأیید است': 'only_proposed',
    'فرضیه قانون رسمی نمی‌شود؛ ابتدا نوع آن را به «تأییدشده/الزامی/ترجیح» تغییر بده': 'hypothesis', 'ثبت دلیل تغییر الزامی است': 'reason_required', 'پیشنهادی یافت نشد': 'proposal_not_found',
    'فقط قانون رسمی قابل بازنگری است': 'only_official_revise', 'قانون رسمی نمی‌تواند فرضیه باشد': 'official_not_hypothesis', 'فقط قانون رسمی قابل بازنشستگی است': 'only_official_retire' };
  const E = text => ({ error: text, code: ERR_CODES[text] || 'unknown' });
  const emptyKB = () => ({ schema: 1, rules: [], versions: [] });
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const list = (a, max) => (Array.isArray(a) ? a : []).map(x => str(x, 240)).filter(Boolean).slice(0, max);

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[\u200c\u200f.,؛;:!؟?()«»"'\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function cleanFields(f) {
    const out = { text: str(f.text, 240), kind: f.kind, strategy: str(f.strategy, 60) || null, examples: list(f.examples, 10), exceptions: list(f.exceptions, 10), param: null };
    if (f.param && str(f.param.key, 40) && f.param.value !== '' && f.param.value != null) out.param = { key: str(f.param.key, 40), value: str(f.param.value, 40) };
    return out;
  }
  function check(f) {
    if (!f.text) return 'متن قانون خالی است';
    if (!KINDS.includes(f.kind)) return 'نوع قانون نامعتبر است';
    return null;
  }
  const find = (kb, id) => kb.rules.find(r => r.id === id);
  const official = kb => kb.rules.filter(r => r.status === 'official');
  const snapOf = r => ({ id: r.id, text: r.text, kind: r.kind, strategy: r.strategy, param: r.param, examples: r.examples, exceptions: r.exceptions });

  function pushVersion(kb, now, reason, diff) {
    kb.versions.push({ id: 'v' + (kb.versions.length + 1), n: kb.versions.length + 1, date: now.date, time: now.time || '00:00', at: now.iso, reason: str(reason, 300), approvedByUser: true, diff, snapshot: official(kb).map(snapOf) });
  }
  const needReason = r => (str(r, 300) ? null : 'ثبت دلیل تغییر الزامی است');

  /** now = {date:'YYYY-MM-DD', time:'HH:MM', iso}. Returns {kb} or {error}. */
  function propose(kb0, fields, now, idGen) {
    const f = cleanFields(fields || {}), err = check(f); if (err) return E(err);
    const kb = clone(kb0); const id = idGen();
    kb.rules.push(Object.assign({ id, status: 'proposed', createdAt: now.iso, approvedAt: null, retiredAt: null, supersedes: null }, f));
    return { kb, id };
  }
  function approve(kb0, id, reason, now) {
    const kb = clone(kb0), r = find(kb, id); if (!r) return E('قانون یافت نشد');
    if (r.status !== 'proposed') return E('فقط قانون پیشنهادی قابل تأیید است');
    if (r.kind === 'hypothesis') return E('فرضیه قانون رسمی نمی‌شود؛ ابتدا نوع آن را به «تأییدشده/الزامی/ترجیح» تغییر بده');
    const e = needReason(reason); if (e) return E(e);
    r.status = 'official'; r.approvedAt = now.iso;
    pushVersion(kb, now, reason, { added: [r.id], removed: [], changed: [] });
    return { kb };
  }
  function reject(kb0, id, now) {
    const kb = clone(kb0), r = find(kb, id); if (!r || r.status !== 'proposed') return E('پیشنهادی یافت نشد');
    r.status = 'rejected'; r.retiredAt = now.iso; return { kb };
  }
  /** Change an official rule: old one is retired (kept for history), a new official rule supersedes it. */
  function revise(kb0, id, changes, reason, now, idGen) {
    const kb = clone(kb0), old = find(kb, id); if (!old || old.status !== 'official') return E('فقط قانون رسمی قابل بازنگری است');
    const e = needReason(reason); if (e) return E(e);
    const f = cleanFields(Object.assign({}, snapOf(old), changes || {})), err = check(f); if (err) return E(err);
    if (f.kind === 'hypothesis') return E('قانون رسمی نمی‌تواند فرضیه باشد');
    const nid = idGen();
    old.status = 'retired'; old.retiredAt = now.iso; old.retireReason = str(reason, 300);
    kb.rules.push(Object.assign({ id: nid, status: 'official', createdAt: now.iso, approvedAt: now.iso, retiredAt: null, supersedes: old.id }, f));
    pushVersion(kb, now, reason, { added: [], removed: [], changed: [{ from: old.id, to: nid, fromText: old.text, toText: f.text }] });
    return { kb, id: nid };
  }
  function retire(kb0, id, reason, now) {
    const kb = clone(kb0), r = find(kb, id); if (!r || r.status !== 'official') return E('فقط قانون رسمی قابل بازنشستگی است');
    const e = needReason(reason); if (e) return E(e);
    r.status = 'retired'; r.retiredAt = now.iso; r.retireReason = str(reason, 300);
    pushVersion(kb, now, reason, { added: [], removed: [r.id], changed: [] });
    return { kb };
  }

  /** Version valid when a trade was taken. Same-day ambiguity (trade without time on a version's date) is reported, not hidden. */
  function versionAt(kb, trade) {
    const d = String(trade.date || ''), tm = String(trade.time || '');
    let valid = null, ambiguous = false;
    for (const v of kb.versions) {
      if (v.date < d) valid = v;
      else if (v.date === d) { if (tm) { if (v.time <= tm) valid = v; } else ambiguous = true; }
    }
    return { version: valid, ambiguous };
  }
  function rulesForTrade(kb, trade) {
    const { version, ambiguous } = versionAt(kb, trade), s = norm(trade.setup);
    if (!version) return { version: null, rules: [], ambiguous, note: 'هیچ نسخه تأییدشده‌ای در زمان این معامله وجود نداشت' };
    return { version: { id: version.id, n: version.n, date: version.date }, ambiguous, rules: version.snapshot.filter(r => !r.strategy || norm(r.strategy) === s) };
  }

  const NEG = ['نباید', 'ممنوع', 'نه', 'هرگز', 'not', 'never', 'no'], POS = ['باید', 'مجاز', 'must', 'should', 'always'];
  function stripTokens(text) { const toks = norm(text).split(' ').filter(Boolean); const neg = toks.some(t => NEG.includes(t)); return { neg, core: toks.filter(t => !NEG.includes(t) && !POS.includes(t)) }; }
  function conflicts(kb) {
    const rs = kb.rules.filter(r => r.status === 'official' || r.status === 'proposed'), out = [];
    const scope = (a, b) => !a.strategy || !b.strategy || norm(a.strategy) === norm(b.strategy);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j]; if (!scope(a, b)) continue;
      if (norm(a.text) === norm(b.text)) { out.push({ a: a.id, b: b.id, type: 'duplicate', confidence: 'high', code: 'duplicate', p: {}, why: 'متن دو قانون یکسان است' }); continue; }
      if (a.param && b.param && norm(a.param.key) === norm(b.param.key) && norm(a.param.value) !== norm(b.param.value)) { out.push({ a: a.id, b: b.id, type: 'param_mismatch', confidence: 'high', code: 'param_mismatch', p: { k: a.param.key, a: a.param.value, b: b.param.value }, why: 'پارامتر «' + a.param.key + '» دو مقدار متفاوت دارد: ' + a.param.value + ' و ' + b.param.value }); continue; }
      const sa = stripTokens(a.text), sb = stripTokens(b.text);
      if (sa.neg !== sb.neg && sa.core.length >= 3 && sa.core.join(' ') === sb.core.join(' ')) out.push({ a: a.id, b: b.id, type: 'negation', confidence: 'low', code: 'negation', p: {}, why: 'دو قانون جز نفی/اثبات یکسان‌اند؛ احتمالاً متناقض (نیازمند بازبینی انسانی)' });
    }
    return out;
  }
  /** Evolution timeline: each version with its period [date, nextDate) so the UI can compare real results per period. */
  function evolution(kb) {
    return kb.versions.map((v, i) => ({ id: v.id, n: v.n, date: v.date, time: v.time, reason: v.reason, diff: v.diff, ruleCount: v.snapshot.length, from: v.date, to: kb.versions[i + 1] ? kb.versions[i + 1].date : null }));
  }
  /** Import legacy flat rules (state.tradeRules + meta kinds). Only explicitly confirmed/mandatory become proposals marked for approval; nothing becomes official automatically. */
  function importLegacy(kb0, rules, metaOf, now, idGen) {
    let kb = clone(kb0), added = 0, skipped = 0; const have = new Set(kb.rules.map(r => norm(r.text)));
    for (const text of rules || []) {
      const kind = metaOf(text); const k = ['mandatory', 'confirmed', 'preference', 'hypothesis'].includes(kind) ? kind : 'hypothesis';
      if (have.has(norm(text))) { skipped++; continue; }
      const r = propose(kb, { text, kind: k }, now, idGen); if (r.error) { skipped++; continue; }
      kb = r.kb; have.add(norm(text)); added++;
    }
    return { kb, added, skipped };
  }
  return { KINDS, emptyKB, propose, approve, reject, revise, retire, versionAt, rulesForTrade, conflicts, evolution, importLegacy, norm };
});
