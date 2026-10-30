/* AREX V9.8.0 — core/kb: the knowledge engine. Parses the trader's own Markdown knowledge base, indexes it (Persian-aware BM25 + synonyms +
   fuzzy matching) and answers FROM THE TEXT ONLY: extractive, cited, never invents rules/numbers, reports conflicts, labels rule/note/untested.
   Pure (no DOM / network) so it runs in the page, in Workers and in tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.kb = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[يى]/g, 'ی').replace(/[كک]/g, 'ک').replace(/[ةۀ]/g, 'ه').replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ی')
    .replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(('از به در که و را با این آن برای است هست باید می نمی هم یا تا بر بی شود شده شد کن کنید کرد کنم کنی کند بود بوده نیست نیز ولی اما اگر چه چی چرا چطور چگونه کدام کجا کی چند یک دو ها های هایی تر ترین خود من تو ما شما او آنها ان انها هر همه بعد قبل بین روی زیر مثل مانند طبق طور چون پس بدون فقط حتی هنوز دیگر باشد باشند بشه میشه میتونم میتونه کنه کرده کردن دارد دارند داره دارم باشه چیه چیست چی چقدر چقدره تونم تونه تونی کنیم میکنه میشود میتوان the a an of to in is are and or for with on at by be it this that what how why can i do does').split(' '));
  const IRR = { قوانین: 'قانون', اصول: 'اصل', سطوح: 'سطح', نواحی: 'ناحیه', شرایط: 'شرط', ارقام: 'رقم', مفاهیم: 'مفهوم', معاملات: 'معامله', اشتباهات: 'اشتباه', تصاویر: 'تصویر', اخبار: 'خبر', اصطلاحات: 'اصطلاح', ساعات: 'ساعت', قواعد: 'قاعده', نمادها: 'نماد' };
  const SUF = ['هایی', 'های', 'ها', 'ترین', 'تر', 'ات'];
  const stem = t => { if (IRR[t]) return IRR[t]; if (/^[a-z0-9]+$/.test(t)) return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t; for (const s of SUF) if (t.length > s.length + 1 && t.endsWith(s)) { t = t.slice(0, -s.length); break; } if (t.length > 3 && t.endsWith('ی')) t = t.slice(0, -1); return t; };
  const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t)).map(stem).filter(t => t.length > 1 || /\d/.test(t));
  const SYN = [['حد ضرر', 'sl', 'stop loss', 'استاپ', 'stoploss', 'استاپ لاس'], ['حد سود', 'tp', 'take profit', 'تیک پروفیت', 'takeprofit'], ['داوجونز', 'داو جونز', 'us30', 'dj30', 'dji', 'dow', 'داو'], ['طلا', 'xauusd', 'gold', 'گلد', 'xau'], ['اردربلاک', 'ob', 'order block', 'اوردر بلاک', 'orderblock'], ['نقدینگی', 'liquidity', 'لیکوییدیتی'], ['پولبک', 'pullback', 'پول بک', 'ریتریس', 'برگشت به سطح'], ['شکست', 'breakout', 'break', 'بریک اوت', 'bos'], ['روند', 'trend', 'ترند'], ['سشن', 'session', 'نشست'], ['لندن', 'london'], ['نیویورک', 'new york', 'ny'], ['توکیو', 'tokyo', 'ژاپن'], ['خبر', 'news', 'اخبار', 'خبری'], ['همبستگی', 'correlation', 'کورلیشن'], ['rsi', 'آر اس آی', 'ار اس ای'], ['کندل', 'candle', 'شمع'], ['انتقام', 'revenge', 'انتقام گیری'], ['فومو', 'fomo'], ['لات', 'lot', 'حجم', 'سایز پوزیشن'], ['ژورنال', 'journal', 'ژورنال نویسی'], ['بک تست', 'backtest', 'بکتست'], ['اسپرد', 'spread'], ['گپ', 'gap'], ['دلار', 'usd', 'dxy', 'شاخص دلار'], ['ریسک', 'risk'], ['استراتژی', 'strategy', 'ستاپ', 'setup'], ['سر و شانه', 'head and shoulders', 'سر وشانه'], ['مثلث', 'triangle'], ['پرچم', 'flag', 'پرچمک'], ['عرضه', 'supply'], ['تقاضا', 'demand'], ['متاتریدر', 'mt5', 'mt4', 'متا تریدر', 'metatrader'], ['استیتمنت', 'statement', 'گزارش حساب'], ['تورم', 'inflation', 'cpi'], ['نرخ بهره', 'interest rate', 'بهره', 'فدرال رزرو', 'fed'], ['اوراق قرضه', 'bond', 'اوراق'], ['بروکر', 'broker', 'کارگزار'], ['جابه جا', 'جابجا', 'جا به جا', 'تغییر حد ضرر', 'دور کردن', 'تغییر دادن'], ['گوشی', 'موبایل', 'تلفن همراه'], ['پایبندی', 'رعایت', 'انضباط'], ['معامله', 'ترید', 'trade', 'تریدینگ']];
  const SYNMAP = {}; SYN.forEach((g, gi) => g.forEach(p => { SYNMAP[norm(p)] = gi; }));
  const STRAT = { gold: ['طلا', 'xauusd', 'gold', 'گلد'], dowjones: ['داوجونز', 'داو جونز', 'us30', 'dji', 'dow', 'داو'], cop: ['cop', 'کاپ'], news: ['ترید خبری', 'خبری', 'nfp', 'cpi', 'adp'], smc: ['smc', 'اردربلاک', 'ob', 'نقدینگی', 'liquidity', 'choch', 'bos', 'ساختار بازار'] };
  const strategyOf = q => { const n = ' ' + norm(q) + ' '; for (const k of ['news', 'cop', 'dowjones', 'gold', 'smc']) if (STRAT[k].some(w => n.includes(' ' + norm(w) + ' '))) return k; return null; };
  const KIND_W = { rule: 1.3, strategy: 1.2, conflict: 1.0, test: 1.0, education: 1.0, note: 1.0, archive: .8, image: .9, meta: .5 };
  const TOP = { 2: ['rule', null], 3: ['note', 'priceaction'], 4: ['note', 'smc'], 5: ['strategy', 'cop'], 6: ['strategy', 'dowjones'], 7: ['strategy', 'gold'], 8: ['strategy', 'news'], 9: ['strategy', 'aux'], 10: ['rule', null], 11: ['education', null], 12: ['conflict', null], 13: ['test', null], 14: ['image', null], 15: ['archive', null] };
  const KIND_FA = { rule: 'قانون صریح', strategy: 'قاعده‌ی استراتژی', note: 'یادداشت آموزشی', education: 'یادداشت آموزشی', conflict: 'ابهام/تعارض', test: 'نیازمند آزمون آماری', archive: 'یادداشت جلسه', image: 'تصویر', meta: 'راهنما' };
  const lat = s => String(s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));

  /* ---------------- parse ---------------- */
  function parse(md, opts) {
    opts = opts || {}; const lines = String(md || '').replace(/\r/g, '').split('\n'), chunks = [], stack = [], images = {}; let buf = [], inArchive = false, n = 0;
    const secNo = () => { for (let i = stack.length - 1; i >= 0; i--) { const m = /^([0-9۰-۹]+(?:[.\u066B][0-9۰-۹]+)*)[.\u066B)]?\s/.exec(stack[i] || ''); if (m) return lat(m[1]).replace(/\u066B/g, '.'); } return ''; };
    const meta = () => { const sec = secNo(), top = parseInt(sec, 10), m = TOP[top] || ['note', null]; const path = stack.filter(Boolean); const ses = /منبع:\s*جلسه\s*([0-9۰-۹]+)\s*[-–]?\s*(.*)/.exec(path.join(' | ')); return { section: sec, kind: inArchive ? 'archive' : (stack[1] && /دستورالعمل استفاده/.test(stack[1]) ? 'meta' : m[0]), strategy: m[1], session: ses ? { no: +lat(ses[1]), title: (ses[2] || '').split('|')[0].trim() } : null, path }; };
    const push = (text, extra) => { text = text.trim(); if (!text) return; const mt = meta(), title = mt.path[mt.path.length - 1] || ''; chunks.push(Object.assign({ id: 'c' + (++n), title, path: mt.path, section: mt.section, kind: mt.kind, strategy: mt.strategy, session: mt.session, text }, extra || {})); };
    const flush = () => {
      const text = buf.join('\n').trim(); buf = []; if (!text) return;
      const mt = meta();
      if (mt.kind === 'conflict') { const re = /^\s*(\d+)\.\s+\*\*(.+?)\*\*:?\s*([\s\S]*?)(?=^\s*\d+\.\s+\*\*|$(?![\s\S]))/gm; let m, any = false; while ((m = re.exec(text))) { any = true; push(m[2].replace(/[:：]\s*$/, '') + ': ' + m[3].trim(), { conflictId: 'K' + m[1], title: m[2].replace(/[:：]\s*$/, '') }); } if (any) return; }
      if (mt.kind === 'image') { text.split('\n').forEach(l => { const m = /^\s*-\s*\*\*`?([^`*]+?)`?\*\*\s*[—–-]\s*(.+)$/.exec(l); if (m) { images[m[1].trim()] = m[2].trim(); push(m[2].trim() + ' (تصویر: ' + m[1].trim() + ')', { image: m[1].trim(), title: m[1].trim() }); } }); return; }
      const parts = []; let cur = []; let size = 0;
      text.split('\n').forEach(l => { const isItem = /^\s*(?:[-*•]|\d+[.)])\s+/.test(l); if (size > 700 && (isItem || l.trim() === '')) { parts.push(cur.join('\n')); cur = []; size = 0; } cur.push(l); size += l.length; });
      if (cur.length) parts.push(cur.join('\n')); parts.forEach((p, i) => { const imgs = []; p.replace(/<?Images\/([^>)\n]+?)>?(?=[)\s]|$)/g, (_, f) => { imgs.push(f.trim()); return ''; }); push(p, imgs.length ? { images: imgs, part: i } : { part: i }); });
    };
    lines.forEach(line => {
      const m = /^(#{1,6})\s+(\S.*?)\s*$/.exec(line);
      if (m) { const level = m[1].length, title = m[2].trim();
        if (inArchive && !/^منبع:/.test(title) && level >= 1) { buf.push(title); return; }                   // archive-internal headings are just text
        flush(); stack.length = level - 1; stack[level - 1] = title; if (level === 2 && /آرشیو کامل یادداشت/.test(title)) inArchive = true; else if (level === 2) inArchive = false;
        if (level === 3 && inArchive) { /* session header */ } return; }
      buf.push(line);
    });
    flush(); return { version: 1, title: (stack[0] || opts.title || 'دانش‌نامه'), chunks, images, builtAt: opts.builtAt || '' };
  }

  /* ---------------- index + search ---------------- */
  function buildIndex(pack) {
    const docs = pack.chunks.map(c => { const body = tokens(c.text), head = tokens((c.path || []).join(' ') + ' ' + c.title); const all = body.concat(head, head, head), tf = new Map(); all.forEach(t => tf.set(t, (tf.get(t) || 0) + 1)); return { c, tf, len: all.length, norm: ' ' + norm(c.text + ' ' + c.title) + ' ' }; });
    const df = new Map(); docs.forEach(d => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    const N = docs.length, avg = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, N), idf = t => Math.log(1 + (N - (df.get(t) || 0) + .5) / ((df.get(t) || 0) + .5));
    return { docs, df, N, avg, idf, vocab: [...df.keys()], byId: new Map(pack.chunks.map(c => [c.id, c])), pack };
  }
  const tri = s => { const x = '  ' + s + ' ', o = new Set(); for (let i = 0; i < x.length - 2; i++) o.add(x.slice(i, i + 3)); return o; };
  const jac = (a, b) => { let i = 0; a.forEach(x => { if (b.has(x)) i++; }); return i / (a.size + b.size - i || 1); };
  function expand(ix, q) {
    const base = tokens(q), n = norm(q), out = new Map(); base.forEach(t => out.set(t, 1));
    Object.keys(SYNMAP).forEach(p => { if ((' ' + n + ' ').includes(' ' + p + ' ')) SYN[SYNMAP[p]].forEach(s => tokens(s).forEach(t => { if (!out.has(t)) out.set(t, .55); })); });
    base.forEach(t => { if (!ix.df.has(t) && t.length > 3) { const tt = tri(t); let best = null, bs = .55; ix.vocab.forEach(v => { if (Math.abs(v.length - t.length) <= 2) { const s = jac(tt, tri(v)); if (s > bs) { bs = s; best = v; } } }); if (best && !out.has(best)) out.set(best, .7); } });
    return { base, weights: out };
  }
  function intentOf(qn) { if (/چک لیست|چکلیست|مراحل|قدم به قدم|گام به گام|روال|فرایند/.test(qn)) return 'checklist'; if (/قانون|قوانین|قاعده|قواعد|استراتژی|ستاپ|چطور کار|توضیح/.test(qn) && strategyOf(qn)) return 'overview'; if (/چیست|چیه|یعنی چی|یعنی چه|تعریف|معنی|what is/.test(qn)) return 'define'; if (/قانون|قوانین|قاعده|قواعد|استراتژی|ستاپ|چطور کار|توضیح/.test(qn)) return 'overview'; if (/میتونم|می تونم|مجازم|ممنوع|اجازه|درسته|میشه|مجاز/.test(qn)) return 'permission'; return 'generic'; }
  function search(ix, q, o) {
    o = o || {}; const k = o.k || 6, ex = expand(ix, q), strat = o.strategy === undefined ? strategyOf(q) : o.strategy, K1 = 1.4, B = .75, phr = []; const bt = ex.base;
    for (let i = 0; i < bt.length - 1; i++) phr.push(bt[i] + ' ' + bt[i + 1]); const qn = ' ' + norm(q) + ' '; const totalIdf = bt.reduce((a, t) => a + ix.idf(t), 0) || 1;
    const res = []; ix.docs.forEach(d => { let s = 0; ex.weights.forEach((w, t) => { const f = d.tf.get(t); if (f) s += w * ix.idf(t) * f * (K1 + 1) / (f + K1 * (1 - B + B * d.len / ix.avg)); });
      if (!s) return; if (qn.length > 6 && d.norm.includes(qn.trim())) s *= 1.4; phr.forEach(p => { if (d.norm.includes(p.split(' ').map(x => x).join(' '))) s += .4; });
      s *= (o.intent === 'define' && (d.c.kind === 'archive' || d.c.kind === 'education') ? 1.45 : o.intent === 'define' && d.c.kind === 'strategy' ? .8 : (KIND_W[d.c.kind] || 1)); if (o.kinds && !o.kinds.includes(d.c.kind)) return;
      if (strat && d.c.strategy && d.c.strategy !== strat && d.c.kind !== 'conflict' && d.c.kind !== 'rule') s *= .35;
      const cov = bt.length ? bt.filter(t => d.tf.has(t)).reduce((a, t) => a + ix.idf(t), 0) / totalIdf : 0; res.push({ chunk: d.c, score: s, coverage: Math.min(1, cov) }); });
    res.sort((a, b) => b.score - a.score); return { hits: res.slice(0, k), strategy: strat, tokens: bt };
  }

  /* ---------------- answer composition ---------------- */
  const UNTESTED = /تأیید\s*نشده|مستند\s*آماری\s*ندارد|بک\s*تست|آزمون\s*آماری|تضمین\s*نیست|قطعی\s*نیست/;
  const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);
  const sectionRef = c => (c.section ? '§' + c.section + ' ' : '') + trim(c.session ? 'جلسه ' + c.session.no + ' — ' + c.session.title : c.title, 60);
  function pickLines(ix, q, hits, max) {
    const qt = new Set(expand(ix, q).weights.keys()), out = [], seen = new Set();
    hits.forEach(h => { const ls = h.chunk.text.split('\n').map(l => l.trim()).filter(Boolean);
      const all = ls.filter(l => !/^!\[/.test(l)).map((l, i) => ({ l, i, s: tokens(l).reduce((a, t) => a + (qt.has(t) ? ix.idf(t) : 0), 0) })), best = Math.max(0, ...all.map(x => x.s));
      const scored = all.filter(x => (x.s > 0 && x.s >= best * .45) || all.length <= 2).sort((a, b) => b.s - a.s).slice(0, h.chunk.kind === 'archive' ? 3 : 4).sort((a, b) => a.i - b.i);
      scored.forEach(x => { const key = norm(x.l).slice(0, 80); if (seen.has(key)) return; seen.add(key); out.push({ line: x.l, chunk: h.chunk }); }); });
    let tot = 0; return out.filter(x => (tot += x.line.length) < max);
  }
  const mark = l => (/ممنوع|نباید|نکن|اجتناب|خودداری/.test(l) ? '⛔ ' : '') + l.replace(/^[-*•]\s*/, '• ').replace(/\*\*/g, '');
  /** answer(ix, question, {decisions}) -> {text, confidence, sources, conflicts, tags, hits, needs} — text is quoted from the KB, never generated. */
  function answer(ix, q, o) {
    o = o || {}; const dec = o.decisions || {}, qn = norm(q), intent = intentOf(qn), r = search(ix, q, { k: 8, intent }), top = r.hits[0], conflictsAll = ix.pack.chunks.filter(c => c.conflictId);
    const STR_FA = { gold: 'طلا', dowjones: 'داوجونز', cop: 'COP', news: 'ترید خبری', smc: 'SMC/ساختار بازار', priceaction: 'پرایس‌اکشن', aux: 'همبستگی/RSI' };
    if (/تعارض|ابهام|مبهم|نیازمند تصمیم|conflict|تصمیم نویسنده/.test(qn)) {
      const open = conflictsAll.filter(c => !dec[c.conflictId]);
      return { text: '⚠️ ' + conflictsAll.length + ' مورد ابهام/تعارض در دانش‌نامه ثبت شده (' + (conflictsAll.length - open.length) + ' مورد را تو تصمیم‌گیری کرده‌ای، ' + open.length + ' مورد باز است):\n' + conflictsAll.map(c => (dec[c.conflictId] ? '✅ ' : '❓ ') + c.conflictId + ') ' + trim(c.text, 150)).join('\n') + '\n\nبرای تصمیم‌گیری: دانش‌نامه ← ابهام‌ها.', confidence: 1, sources: conflictsAll.slice(0, 4).map(ref), tags: ['conflict'], hits: [], conflicts: conflictsAll };
    }
    const contentTokens = r.tokens.filter(t => !['قانون', 'قاعده', 'استراتژی', 'ستاپ', 'توضیح', 'مرحله', 'چک', 'لیست', 'چکلیست', 'بده', 'رو'].includes(t) && !(STRAT[r.strategy] || []).some(w => tokens(w).includes(t)));
    if (r.strategy && (intent === 'checklist' || (intent === 'overview' && contentTokens.length <= 1))) {
      const src = ix.pack.chunks.filter(c => c.strategy === r.strategy && c.kind === 'strategy').slice(0, 5);
      if (src.length) { const ls = src.map(c => c.text).join('\n').split('\n').map(l => l.trim()).filter(l => l && !/^!\[/.test(l) && !/^\[/.test(l)).slice(0, 24), openC = conflictsAll.filter(c => !dec[c.conflictId]);
        return { text: '📚 ' + (intent === 'checklist' ? 'مراحل/چک‌لیست' : 'قوانین ثبت‌شده') + ' استراتژی ' + (STR_FA[r.strategy] || '') + ' (عین متن دانش‌نامه):\n\n' + ls.map(mark).join('\n') + '\n\n⚠️ قوانین استراتژی‌های مختلف را بدون اجازه‌ی خودت با هم ترکیب نکن.' + (openC.length ? ' ' + openC.length + ' ابهام باز در دانش‌نامه هست؛ بگو «تعارض‌ها».' : ''), confidence: .9, sources: src.map(ref), conflicts: [], tags: [], images: [], hits: src.map(c => ({ chunk: c, score: 1, coverage: 1 })), strategy: r.strategy }; }
    }
    if (!r.strategy && intent === 'checklist' && contentTokens.length <= 1) {
      const g = ix.pack.chunks.filter(c => /فرایند عمومی بررسی ستاپ/.test(c.title));
      if (g.length) return { text: '📚 فرایند عمومی بررسی ستاپ (عین متن دانش‌نامه):\n\n' + g.map(c => c.text).join('\n').split('\n').map(l => l.trim()).filter(Boolean).map(mark).join('\n'), confidence: .9, sources: g.map(ref), conflicts: [], tags: [], images: [], hits: g.map(c => ({ chunk: c, score: 1, coverage: 1 })) };
    }
    if (!top || (top.coverage < .34 && top.score < 6)) {
      const near = r.hits.slice(0, 3).filter(h => h.chunk.kind !== 'meta').map(h => '• ' + sectionRef(h.chunk));
      return { text: 'در دانش‌نامه‌ی تو پاسخ مستقیمی برای این سؤال پیدا نکردم و چیزی را حدس نمی‌زنم.' + (near.length ? '\nنزدیک‌ترین بخش‌ها:\n' + near.join('\n') : ''), confidence: 0, sources: r.hits.slice(0, 3).map(h => ref(h.chunk)), tags: ['no-answer'], hits: r.hits, needs: 'ai' };
    }
    const used = r.hits.filter(h => h.score >= top.score * .35 && h.chunk.kind !== 'meta').slice(0, 5), lines = pickLines(ix, q, used, 1500), groups = {};
    lines.forEach(x => { const lab = KIND_FA[x.chunk.kind] || 'یادداشت'; (groups[lab] = groups[lab] || []).push(x); });
    let text = '📚 از دانش‌نامه' + (r.strategy ? ' (استراتژی ' + (STR_FA[r.strategy] || '') + ')' : '') + ':\n';
    Object.keys(groups).forEach(lab => { text += '\n【' + lab + '】\n' + groups[lab].map(x => mark(x.line)).join('\n') + '\n'; });
    const cq = search(ix, q + ' ' + lines.map(x => x.line).join(' ').slice(0, 300), { k: 3, kinds: ['conflict'], strategy: null }).hits.filter(h => h.coverage >= .3 && h.score > 5), shown = [];
    cq.forEach(h => { const c = h.chunk; shown.push(dec[c.conflictId] ? '✅ ' + c.conflictId + ' — تصمیم تو: ' + dec[c.conflictId].text : '⚠️ ابهام ثبت‌شده ' + c.conflictId + ': ' + trim(c.text, 220)); });
    if (shown.length) text += '\n' + shown.join('\n') + '\n';
    const tagUntested = used.some(h => h.chunk.kind === 'test' || UNTESTED.test(h.chunk.text)); if (tagUntested) text += '\n🧪 بخشی از این مطلب در خود دانش‌نامه «تأییدنشده/نیازمند بک‌تست» علامت خورده؛ آن را قطعی فرض نکن.';
    const imgs = [...new Set(used.flatMap(h => (h.chunk.image ? [h.chunk.image] : []).concat(h.chunk.images || [])))].slice(0, 3);
    return { text: text.trim(), confidence: Math.min(1, top.coverage + .15), sources: used.map(h => ref(h.chunk)).filter((x, i, arr) => arr.findIndex(y => y.id === x.id) === i).slice(0, 4), conflicts: cq.map(h => h.chunk), tags: tagUntested ? ['untested'] : [], images: imgs, hits: used, strategy: r.strategy };
  }
  const ref = c => ({ id: c.id, label: sectionRef(c), kind: c.kind, section: c.section });
  /* helpers for UI */
  const sections = ix => { const m = new Map(); ix.pack.chunks.forEach(c => { const k = (c.path || []).slice(0, c.kind === 'archive' ? 3 : 2).join(' › '); if (!m.has(k)) m.set(k, { key: k, title: c.path[Math.min(c.path.length - 1, c.kind === 'archive' ? 2 : 1)] || c.title, kind: c.kind, section: c.section, ids: [] }); m.get(k).ids.push(c.id); }); return [...m.values()]; };
  const conflicts = ix => ix.pack.chunks.filter(c => c.conflictId);
  const checklist = (ix, strategy) => { if (strategy) { const c = ix.pack.chunks.filter(x => x.strategy === strategy && x.kind === 'strategy'); return c.map(x => x.text).join('\n'); } const g = ix.pack.chunks.find(x => /فرایند عمومی بررسی ستاپ/.test(x.title)); return g ? g.text : ''; };
  return { norm, tokens, parse, buildIndex, search, answer, sections, conflicts, checklist, strategyOf, intentOf, KIND_FA, sectionRef };
});
