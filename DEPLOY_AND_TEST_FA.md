# راه‌اندازی و آزمون AREX V9.8.0

## ۱) تنظیمات Google OAuth
در Google Cloud → OAuth Client (Web): دامنه‌ی `https://amirghasemian22.github.io` را در Authorized JavaScript origins اضافه کن. Scope‌ها: `openid email profile drive.appdata`. ورود و پشتیبان‌گیری با Google Drive انجام می‌شود (دیتابیس محلی هر حساب: `forexBootcampDB__<uid>`).

## ۲) Workerها (Cloudflare)
| Worker | Variable / Secret |
|---|---|
| `arex-ai-worker.js` | `GEMINI_API_KEY` (Secret)، `GOOGLE_CLIENT_ID` (Var)، `AREX_ALLOWED_ORIGIN`، اختیاری: `AREX_ALLOWED_EMAILS`، Rate Limiting binding با نام `AREX_RATE_LIMITER` |
| `arex-edge-worker.js` | `GOOGLE_CLIENT_ID`، `ALERT_ALLOWED_GOOGLE_EMAIL`، `TWELVEDATA_API_KEY` (اختیاری)، KV با نام `NOTIFY_DEDUPE`؛ تلگرام/ایمیل فعلاً غیرفعال |

| `arex-edge-worker.js` (ایمپورت EA) | `AREX_INGEST_KEY` (Secret، کلید دلخواه ≥ ۲۰ نویسه) و KV با نام `AREX_INGEST` |

آدرس AI Worker را در «تنظیمات → دستیار» (با مسیر `/chat`) وارد کن. توکن Google فقط به میزبان‌های `*.workers.dev` یا میزبان‌های تأییدشده فرستاده می‌شود.

## ۳) آزمون‌ها
- خودکار: `node --test tests/*.test.js` و `node scripts/release-gate.js`.
- آزمون‌های دستی روی دامنه منتشرشده: ورود Google، ذخیره/بازیابی Google Drive، جداسازی داده‌ی دو حساب، نصب PWA و حالت آفلاین، چیدمان موبایل روی گوشی واقعی (اندروید و iOS)، ارسال درخواست به Worker.
- نتیجه‌ی آزمون خودکار به معنی تأیید سرویس‌های زنده نیست.

## ۴) ایمپورت خودکار از MT5
1. در Cloudflare: Secret با نام `AREX_INGEST_KEY` و یک KV Namespace با Binding به نام `AREX_INGEST` به Worker لبه اضافه کن و دوباره deploy کن.
2. فایل `tools/AREX_Exporter.mq5` را در MetaEditor کامپایل کن (ابتدا روی حساب دمو)، روی چارت بگذار و `InpWorkerUrl` و `InpKey` را پر کن.
3. در MT5: Tools ← Options ← Expert Advisors ← Allow WebRequest و آدرس Worker را اضافه کن.
4. در AREX: ژورنال ← «ایمپورت MT4/MT5» ← تب «خودکار (EA)» ← «دریافت معاملات جدید». با فعال‌کردن «دریافت خودکار پس از Sync» در تنظیمات، هر Sync معاملات جدید را هم می‌آورد.
- بدون EA هم می‌توانی گزارش HTML/CSV متاتریدر را از همان پنجره ایمپورت کنی؛ تکراری‌ها با شماره تیکت حذف می‌شوند.
- اسکریپت EA قالب است و در این محیط کامپایل/اجرا نشده؛ حتماً اول روی دمو آزمایش کن.

## ۵) ورود و همگام‌سازی
- بعد از اولین ورود، برنامه بدون صفحه‌ی ورود باز می‌شود (داده‌ها محلی‌اند). Google فقط وقتی دکمه‌ی Sync را می‌زنی تماس گرفته می‌شود.
- «ادامه بدون ورود» یک پروفایل محلی می‌سازد؛ با اولین اتصال Google، داده‌ی محلی به همان حساب منتقل می‌شود.
- یادآوری شبانه (پیش‌فرض ساعت ۲۱) اگر آن روز Sync نشده باشد هشدار می‌دهد.

## ۶) دانش‌نامه‌ی خصوصی آرکس (کاربر فایل‌ها را نمی‌بیند)
فایل‌های دانش‌نامه داخل سایت نیست؛ فقط روی Worker (KV) می‌ماند و سایت فقط «پاسخ» می‌گیرد.
1. پوشه‌ی `private-kb/` را **هرگز** روی GitHub نگذار (در `.gitignore` هست). فایل `Forex_Strategy_Knowledge_Base.md` را ویرایش کن و (اختیاری) تصمیم ۱۳ ابهام را در `decisions.json` بنویس.
2. `node scripts/build-kb.js` ← فایل `private-kb/kb-pack.json` ساخته می‌شود.
3. در Cloudflare یک KV Namespace بساز (مثلاً `arex-kb`) و کلید `pack` را با محتوای `kb-pack.json` ذخیره کن (Dashboard ← KV ← Add entry، یا `npx wrangler kv key put --binding=AREX_KB pack --path=private-kb/kb-pack.json --remote`).
4. در Worker لبه: Bindings ← KV با نام متغیر `AREX_KB`؛ فایل جدید `arex-edge-worker.js` را Deploy کن (موتور دانش داخل آن است؛ بعد از تغییر `js/core/kb.js` دستور `node scripts/build-workers.js` را اجرا کن).
5. اختیاری: متغیر `KB_ALLOWED_EMAILS` (ایمیل‌های مجاز، با کاما). هر کاربر Google معتبرِ همین برنامه، تا ۳۰ سؤال در دقیقه.
6. در AREX آدرس Worker را در «تنظیمات ← اعلان‌ها» بگذار. ربات برای سؤال‌های آموزشی/قوانین به آن وصل می‌شود؛ بدون اینترنت یا ورود Google فقط داده‌های ژورنال را جواب می‌دهد.
- محدودیت صادقانه: هر کاربری می‌تواند با پرسیدن سؤال‌های زیاد بخش‌هایی از پاسخ‌ها را ببیند؛ فقط خودِ فایل و ساختارش محافظت می‌شود.

## ۷) همگام‌سازی خودکار هنگام ورود
بعد از ورود، برنامه تلاش می‌کند خودکار با آخرین نسخه‌ی Drive همگام شود و اگر نسخه‌ی جدیدتری باشد **ادغام** می‌کند (نه جایگزینی). مرورگرها اجازه نمی‌دهند پنجره‌ی Google بدون لمس کاربر باز شود؛ پس اولین لمس/کلیک داخل برنامه همگام‌سازی را کامل می‌کند.
