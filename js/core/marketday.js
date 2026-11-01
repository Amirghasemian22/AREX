/* AREX V9.8.0 — core/marketday: is the market closed on a given day? Weekend days (default Saturday + Sunday), forex-closing holidays
   (1 Jan, 25 Dec), the trader's own custom days, plus "limited" days (US index holidays, Good Friday, early closes) that only get a note.
   Holiday lists vary by broker — everything can be switched off or extended by the trader. Pure. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AREXCore = root.AREXCore || {}; root.AREXCore.marketday = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  const DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const mk = (y, m, d) => new Date(y, m, d, 12);
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return mk(y, mo - 1, da); }
  const goodFriday = y => { const e = easter(y); e.setDate(e.getDate() - 2); return e; };
  const nth = (y, m, wd, n) => { const d = mk(y, m, 1); while (d.getDay() !== wd) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + (n - 1) * 7); return d; };
  const lastMon = (y, m) => { const d = mk(y, m + 1, 0); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); return d; };
  const observed = (d, satToFri) => { const x = new Date(d); if (x.getDay() === 6 && satToFri) x.setDate(x.getDate() - 1); else if (x.getDay() === 0) x.setDate(x.getDate() + 1); return x; };
  /** Official / semi-official days for a year. level: 'closed' (forex closes) | 'limited' (US indices closed or early close; forex trades). */
  function holidays(y) {
    const L = [{ date: mk(y, 0, 1), name: 'سال نو میلادی', level: 'closed' }, { date: mk(y, 11, 25), name: 'کریسمس', level: 'closed' },
      { date: goodFriday(y), name: 'جمعه‌ی خوب (Good Friday) — شاخص‌های آمریکا بسته‌اند', level: 'limited' }, { date: nth(y, 0, 1, 3), name: 'روز مارتین لوتر کینگ — شاخص‌های آمریکا بسته‌اند', level: 'limited' },
      { date: nth(y, 1, 1, 3), name: 'روز رؤسای جمهور — شاخص‌های آمریکا بسته‌اند', level: 'limited' }, { date: lastMon(y, 4), name: 'روز یادبود آمریکا — شاخص‌های آمریکا بسته‌اند', level: 'limited' },
      { date: observed(mk(y, 5, 19), true), name: 'Juneteenth — شاخص‌های آمریکا بسته‌اند', level: 'limited' }, { date: observed(mk(y, 6, 4), true), name: 'روز استقلال آمریکا — شاخص‌های آمریکا بسته‌اند', level: 'limited' },
      { date: nth(y, 8, 1, 1), name: 'روز کارگر آمریکا — شاخص‌های آمریکا بسته‌اند', level: 'limited' }, { date: nth(y, 10, 4, 4), name: 'روز شکرگزاری آمریکا — شاخص‌های آمریکا بسته‌اند', level: 'limited' },
      { date: mk(y, 11, 24), name: 'شب کریسمس — بسته‌شدن زودتر / نقدینگی کم', level: 'limited' }, { date: mk(y, 11, 31), name: 'آخر سال — بسته‌شدن زودتر / نقدینگی کم', level: 'limited' }];
    const ny = observed(mk(y, 0, 1), false); if (ny.getDay() === 1 && mk(y, 0, 1).getDay() === 0) L.push({ date: ny, name: 'سال نو میلادی (جابه‌جا‌شده) — شاخص‌های آمریکا بسته‌اند', level: 'limited' });
    const xmas = observed(mk(y, 11, 25), true); if (iso(xmas) !== iso(mk(y, 11, 25))) L.push({ date: xmas, name: 'کریسمس (جابه‌جا‌شده) — شاخص‌های آمریکا بسته‌اند', level: 'limited' });
    return L.map(h => ({ date: iso(h.date), name: h.name, level: h.level })).sort((a, b) => a.date.localeCompare(b.date));
  }
  const DEFAULTS = { closedWeekdays: [6, 0], builtIn: true, limited: true, custom: {} };
  /** status(date, prefs) -> {closed, kind:'weekend'|'holiday'|'custom'|null, name, limited, limitedName, weekday}. Works on the LOCAL calendar day. */
  function status(date, prefs) {
    const p = Object.assign({}, DEFAULTS, prefs || {}), d = date instanceof Date ? date : new Date(date), key = iso(d), wd = d.getDay(), out = { closed: false, kind: null, name: '', limited: false, limitedName: '', weekday: DAYS[wd], date: key };
    if (p.custom && p.custom[key]) return Object.assign(out, { closed: true, kind: 'custom', name: String(p.custom[key]) || 'تعطیلی انتخابی تو' });
    if ((p.closedWeekdays || []).includes(wd)) return Object.assign(out, { closed: true, kind: 'weekend', name: 'آخر هفته (' + DAYS[wd] + ') — بازار فارکس تعطیل است' });
    if (p.builtIn !== false || p.limited !== false) { const h = holidays(d.getFullYear()).filter(x => x.date === key);
      h.forEach(x => { if (x.level === 'closed' && p.builtIn !== false) Object.assign(out, { closed: true, kind: 'holiday', name: x.name + ' — بازار فارکس تعطیل است' }); else if (x.level === 'limited' && p.limited !== false && !out.limited) Object.assign(out, { limited: true, limitedName: x.name }); }); }
    return out;
  }
  /** Exact forex session test (closes Fri 17:00 New York, reopens Sun 17:00 New York; DST-aware). */
  function forexOpen(d) {
    try { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d), wd = p.find(x => x.type === 'weekday').value, h = Number(p.find(x => x.type === 'hour').value); return !((wd === 'Fri' && h >= 17) || wd === 'Sat' || (wd === 'Sun' && h < 17)); }
    catch (e) { const w = d.getUTCDay(), h = d.getUTCHours(); return !((w === 5 && h >= 21) || w === 6 || (w === 0 && h < 22)); }
  }
  /** First instant (30-min steps, up to 6 days) when the market is open AND the day is not closed by the trader's calendar. */
  function nextOpen(now, prefs) { const start = now instanceof Date ? now.getTime() : Date.parse(now); for (let i = 1; i <= 288; i++) { const t = new Date(start + i * 1800000); if (forexOpen(t) && !status(t, prefs).closed) return t; } return null; }
  function reopenText(now, prefs, locale, tz) { const t = nextOpen(now, prefs); if (!t) return ''; try { return 'بازگشایی: ' + new Intl.DateTimeFormat(locale || 'fa-IR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(t); } catch (e) { return ''; } }
  return { DAYS, DEFAULTS, holidays, goodFriday, easter, status, forexOpen, nextOpen, reopenText };
});
