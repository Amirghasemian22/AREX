/* AREX V9.8.0 — ui/lock: PIN (and optional device biometrics via WebAuthn) screen lock. Privacy against casual access to the phone — NOT encryption of the stored data. */
(function () {
  'use strict';
  const K = 'arex-lock-v1', $ = id => document.getElementById(id), enc = new TextEncoder();
  const cfg = () => { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } };
  const save = c => { try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) {} };
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function hash(pin, salt) { const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']); return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, key, 256)); }
  let overlay = null, lastActive = Date.now(), locked = false;
  async function setPin(pin, idleMin) { const salt = crypto.getRandomValues(new Uint8Array(16)); save({ salt: b64(salt), h: await hash(pin, salt), idle: idleMin || 5, bio: null, fails: 0, until: 0 }); }
  async function verify(pin) { const c = cfg(); if (!c) return true; return (await hash(pin, unb64(c.salt))) === c.h; }
  async function bioSetup() { if (!window.PublicKeyCredential) throw new Error('این مرورگر از بیومتریک پشتیبانی نمی‌کند'); const id = crypto.getRandomValues(new Uint8Array(16)), cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'AREX' }, user: { id, name: 'arex', displayName: 'AREX' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000 } }); const c = cfg(); c.bio = b64(cred.rawId); save(c); }
  async function bioUnlock() { const c = cfg(); if (!c || !c.bio) return false; try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(c.bio) }], userVerification: 'required', timeout: 60000 } }); return true; } catch (e) { return false; } }
  function lock() {
    const c = cfg(); if (!c || locked) return; locked = true; document.documentElement.classList.add('arex-locked');
    overlay = document.createElement('div'); overlay.id = 'arexLock'; overlay.className = 'arex-lock'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-label', 'قفل AREX');
    overlay.innerHTML = `<div class="arex-lock-box"><div class="arex-lock-logo">🔒</div><b>AREX قفل است</b><input id="arexLockPin" class="txt-input" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="رمز را وارد کن" aria-label="رمز"><div id="arexLockMsg" class="calc-hint" role="alert"></div><button class="btn" id="arexLockGo" type="button">باز کردن</button>${c.bio ? '<button class="btn ghost" id="arexLockBio" type="button">🫆 بیومتریک</button>' : ''}<button class="btn ghost" id="arexLockForgot" type="button">رمز را فراموش کردم</button></div>`;
    document.body.appendChild(overlay); const pin = $('arexLockPin'), msg = $('arexLockMsg'); setTimeout(() => pin.focus(), 50);
    const unlock = () => { locked = false; lastActive = Date.now(); document.documentElement.classList.remove('arex-locked'); overlay.remove(); overlay = null; const cc = cfg(); if (cc) { cc.fails = 0; save(cc); } };
    const attempt = async () => { const cc = cfg(); if (Date.now() < cc.until) { msg.textContent = 'چند ثانیه صبر کن و دوباره تلاش کن.'; return; } if (await verify(pin.value)) { unlock(); return; } cc.fails = (cc.fails || 0) + 1; if (cc.fails >= 5) { cc.until = Date.now() + Math.min(300000, 15000 * Math.pow(2, cc.fails - 5)); } save(cc); pin.value = ''; msg.textContent = 'رمز اشتباه است' + (cc.fails >= 5 ? ' — چند ثانیه محدودیت.' : '.'); };
    $('arexLockGo').onclick = attempt; pin.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
    if ($('arexLockBio')) { $('arexLockBio').onclick = async () => { if (await bioUnlock()) unlock(); else msg.textContent = 'بیومتریک تأیید نشد.'; }; setTimeout(async () => { if (locked && await bioUnlock()) unlock(); }, 300); }
    $('arexLockForgot').onclick = () => { if (!confirm('قفل برداشته می‌شود و برای ادامه باید دوباره وارد حساب Google شوی (داده‌ی محلی حذف نمی‌شود). ادامه؟')) return; try { localStorage.removeItem(K); localStorage.setItem('arex-force-login', '1'); } catch (e) {} location.reload(); };
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => { const c = cfg(); if (c && !locked && c.idle && Date.now() - lastActive > c.idle * 60000) lock(); }, 15000);
  document.addEventListener('visibilitychange', () => { const c = cfg(); if (!c) return; if (document.hidden) { lastActive = Math.min(lastActive, Date.now() - Math.max(0, (c.idle || 5) * 60000 - 30000)); } else if (Date.now() - lastActive > Math.min(30000, (c.idle || 5) * 60000)) lock(); });
  // settings card
  function card() {
    const grid = document.querySelector('#view-settings > .grid'); if (!grid || $('arexLockCard')) return; const c = cfg(), el = document.createElement('div'); el.className = 'card'; el.id = 'arexLockCard';
    const paint = () => { const cc = cfg(); el.innerHTML = `<div class="section-title">🔒 قفل برنامه (PIN / بیومتریک)</div><div class="calc-hint">${cc ? 'قفل فعال است.' : 'با رمز ۴ تا ۸ رقمی، باز شدن برنامه روی این دستگاه محافظت می‌شود.'} این قفل جلوی دیدن اتفاقی ژورنال را می‌گیرد؛ داده‌ها رمزنگاری نمی‌شوند.</div>
      ${cc ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><select class="txt-input" id="lkIdle" style="max-width:200px">${[[1, '۱ دقیقه'], [5, '۵ دقیقه'], [15, '۱۵ دقیقه'], [60, '۱ ساعت']].map(([m, l]) => `<option value="${m}" ${cc.idle === m ? 'selected' : ''}>قفل پس از ${l} بی‌فعالیتی</option>`).join('')}</select><button class="btn ghost" id="lkBio" type="button">${cc.bio ? 'بیومتریک فعال ✓' : 'فعال‌سازی بیومتریک'}</button><button class="btn ghost" id="lkNow" type="button">همین حالا قفل کن</button><button class="btn ghost" id="lkOff" type="button">برداشتن قفل</button></div>` : `<div class="form-grid"><div><div class="field-lbl">رمز (۴ تا ۸ رقم)</div><input class="txt-input" id="lkPin" type="password" inputmode="numeric" maxlength="8"></div><div><div class="field-lbl">تکرار رمز</div><input class="txt-input" id="lkPin2" type="password" inputmode="numeric" maxlength="8"></div></div><button class="btn" id="lkOn" type="button" style="margin-top:8px">فعال‌سازی قفل</button>`}`;
      if ($('lkOn')) $('lkOn').onclick = async () => { const a = $('lkPin').value, b = $('lkPin2').value; if (!/^\d{4,8}$/.test(a)) { toast('رمز باید ۴ تا ۸ رقم باشد'); return; } if (a !== b) { toast('تکرار رمز یکسان نیست'); return; } await setPin(a, 5); toast('قفل فعال شد ✓'); paint(); };
      if ($('lkIdle')) $('lkIdle').onchange = e => { const x = cfg(); x.idle = +e.target.value; save(x); }; if ($('lkNow')) $('lkNow').onclick = () => lock();
      if ($('lkBio')) $('lkBio').onclick = async () => { try { await bioSetup(); toast('بیومتریک فعال شد ✓'); paint(); } catch (e) { toast('بیومتریک فعال نشد: ' + String(e && e.message || e).slice(0, 70)); } };
      if ($('lkOff')) $('lkOff').onclick = async () => { const p = prompt('برای برداشتن قفل رمز فعلی را وارد کن:'); if (p && await verify(p)) { try { localStorage.removeItem(K); } catch (e) {} paint(); toast('قفل برداشته شد'); } else toast('رمز اشتباه است'); }; };
    grid.appendChild(el); paint();
  }
  document.addEventListener('arex:view', e => { if (e.detail.name === 'settings') card(); }); setTimeout(card, 1800);
  // lock at startup once the app is visible (the PIN screen never shows over the sign-in screen)
  const boot = setInterval(() => { if (typeof state === 'undefined') return; const g = $('arexAuthGate'); if (g && getComputedStyle(g).display !== 'none') return; clearInterval(boot); if (cfg()) lock(); }, 300); setTimeout(() => clearInterval(boot), 20000);
  window.arexLock = { lock, enabled: () => !!cfg() };
})();
