# سند معماری بک‌اند — پنل مدیریت کلینیک ارتوپدی فنی حکیم

> این سند برای دست‌یابی مستقیم ایجنت کدنویس تهیه شده. تمام تصمیمات معماری قطعی و قابل اجراست؛ جایی که تصمیم باز مانده، صراحتاً علامت‌گذاری شده (`[TODO]`).

---

## ۱. خلاصه معماری

| بخش | تصمیم |
|---|---|
| زبان | TypeScript روی Node.js (LTS) |
| فریم‌ورک HTTP | Fastify |
| دیتابیس | PostgreSQL 16 |
| ORM | Prisma |
| کش/صف | Redis + BullMQ |
| فایل‌استوریج | آبجکت‌استوریج S3-Compatible (آروان یا لیارا) |
| احراز هویت | JWT (access + refresh)، بدون OTP |
| معماری کلی | مونولیت ماژولار، آماده برای Multi-Tenant سطر-محور (Row-Level) |
| نوع API | REST، نسخه‌دار (`/api/v1`) |

**چرا مونولیت ماژولار:** حجم داده فاز اول (~۱۰٬۰۰۰ رکورد) و کاربران هم‌زمان (حداکثر ~۱۵ نفر) توجیه‌کننده میکروسرویس یا سرورلس نیست. کد در قالب ماژول‌های مستقل (`patients`, `invoices`, `services`, ...) نوشته می‌شود تا در آینده در صورت نیاز واقعی، جداسازی سرویس‌ها ساده باشد.

**چرا آماده برای SaaS از روز اول:** طبق تصمیم کارفرما، فاز اول تک‌کلینیکی است ولی هدف نهایی فروش به کلینیک‌های دیگر است. راه‌حل: از همان ابتدا هر جدول اصلی یک ستون `clinic_id` دارد و تمام کوئری‌ها از طریق لایه Repository این فیلتر را اعمال می‌کنند (نه Schema-per-Tenant، نه DB-per-Tenant — چون در این مقیاس داده توجیه فنی/هزینه‌ای ندارد).

---

## ۲. ساختار پوشه‌ها

```
src/
  modules/
    auth/
    dashboard/
    patients/
    appointments/
    secretaries/
    notifications/
    invoices/
    insurances/
    services/
    tariffs/
    reports/
    expenses/
    files/
  common/
    middlewares/       # auth, rbac, error-handler, tenant-scope
    validators/        # Zod schemas
    utils/
    errors/            # کلاس‌های خطای سفارشی
  jobs/                 # BullMQ processors (sms, ...)
  integrations/
    sms/                # آداپتور پیامک
    storage/            # آداپتور آبجکت‌استوریج
  config/
  prisma/
    schema.prisma
    migrations/
  server.ts
```

هر ماژول شامل: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts` (اعتبارسنجی Zod), `*.routes.ts`.

قانون سخت: **کنترلر هرگز مستقیم به Prisma دسترسی ندارد.** فقط Repository با Prisma کار می‌کند؛ Service منطق بیزینس را پیاده می‌کند؛ Controller فقط ورودی/خروجی HTTP را مدیریت می‌کند.

---

## ۳. مدل داده (Schema)

### قرارداد مشترک همه جداول اصلی
هر جدول دامنه‌ای (نه جداول سراسری مثل `clinics`) این ستون‌ها را دارد:
`id (uuid, PK)`, `clinic_id (uuid, FK → clinics.id, indexed)`, `created_at`, `updated_at`, `deleted_at (nullable — soft delete)`.

### جداول اصلی

**clinics**
`id, name, phone, address, is_active, created_at`

**users** (مدیر + منشی‌ها — نقش با enum مشخص می‌شود)
`id, clinic_id, national_code (unique per clinic), phone, password_hash, full_name, avatar_url, role [manager | secretary_l1 | secretary_l2], is_active, created_at`

**user_patient_scopes** (دسترسی دستی مدیر به دسته بیمار برای هر منشی — طبق سند بخش ۲.۴.۴)
`id, user_id FK, patient_category [hospital_insured | free | clinic]`

**patients**
`id, clinic_id, national_code, full_name, phone, birth_date, file_number, patient_source [hospital | free | clinic], admission_type [free | insured], insurance_id FK nullable, status [pending_insurance_approval | in_production | ready_for_delivery | delivered], suggested_doctor nullable, admitted_by_user_id FK, created_at`
> ایندکس ترکیبی روی `(clinic_id, national_code)` و ایندکس trigram روی `full_name` برای جست‌وجوی فازی.

**patient_status_history** (تاریخچه تغییر وضعیت — برای گزارش‌گیری و ردیابی، الزام سند نیست ولی برای ماژول‌های Dashboard/Reports حیاتی است)
`id, patient_id FK, from_status, to_status, changed_by_user_id FK, changed_at`

**insurance_approvals** (مرحله ۲ فرایند پذیرش بیمارستانی)
`id, patient_id FK, receipt_image_url, approval_file_url nullable, approved_at nullable, approved_by_user_id FK nullable`

**insurances** (بیمه‌های طرف قرارداد)
`id, clinic_id, name, is_approved, created_at`

**appointments**
`id, clinic_id, patient_id FK nullable, full_name, national_code, phone, birth_date, service_type, admission_type, appointment_date, status [scheduled | postponed | cancelled | done], created_by_user_id FK`

**notifications** (اطلاعیه داخلی — نه پیامک)
`id, clinic_id, message, created_by_user_id FK, created_at`

**notification_recipients**
`id, notification_id FK, user_id FK, read_at nullable`

**services** (خدمات)
`id, clinic_id, service_type [orthosis | prosthesis], treatment_process, service_code (unique per clinic), price, description nullable`

**tariffs** (تعرفه قطعات — فقط برای پروتز)
`id, clinic_id, item_code, item_description, price, description nullable`

**invoices**
`id, clinic_id, patient_id FK, invoice_type [final | pro_forma], payment_type [card_to_card | pos], total_amount, discount_total, iban nullable, iban_note nullable, pdf_url nullable, created_by_user_id FK, created_at`

**invoice_items** (جدول واسط چندبه‌چند: فاکتور × خدمت × تعرفه)
`id, invoice_id FK, service_id FK, tariff_id FK nullable, quantity, unit_price, discount_amount, line_total`

**daily_expenses** (هزینه روزمره)
`id, clinic_id, title, amount, expense_date, description nullable, created_by_user_id FK`

**company_invoices** (فاکتور خرید از شرکت‌ها)
`id, clinic_id, title, company_name, amount, invoice_date, part_name, quantity, unit_amount, description nullable, created_by_user_id FK`

**sms_templates** (پترن‌های پیامک — بخش ۴ را ببینید)
`id, clinic_id, event_key (unique per clinic), pattern_code, provider_template_id nullable, is_active, updated_at`

**refresh_tokens**
`id, user_id FK, token_hash, expires_at, revoked_at nullable`

### روابط کلیدی (خلاصه)
- `clinics 1—N users, patients, services, tariffs, invoices, ...` (هر جدول با `clinic_id`)
- `patients 1—N invoices`, `invoices 1—N invoice_items`
- `invoice_items N—1 services`, `invoice_items N—1 tariffs (nullable)`
- `patients N—1 insurances (nullable)`

---

## ۴. سیستم پیامک — پترن قابل تغییر توسط کاربر (نه Hard-code)

طبق درخواست: پترن‌های پیامک (کد قالب سرویس‌دهنده مثل کاوه‌نگار/ملی‌پیامک) **نباید داخل کد هارد-کد شوند**؛ باید قابل تغییر باشند بدون نیاز به دیپلوی مجدد.

**راه‌حل:** جدول `sms_templates` که هر رویداد سیستمی (`event_key`) را به یک کد پترن نگاشت می‌کند:

| event_key | توضیح | نمونه پترن |
|---|---|---|
| `order_ready_for_pickup` | اطلاع آماده‌بودن سفارش (بخش ۲.۲.۳ مرحله ۴) | `[TODO: کد پترن کارفرما]` |
| `appointment_reminder` | یادآوری نوبت فردا (بخش ۲.۳.۴) | `[TODO]` |

- این جدول از طریق یک endpoint مدیریتی (`PATCH /api/v1/settings/sms-templates/:event_key`) توسط مدیر کلینیک قابل ویرایش است — نیازی به تماس با تیم فنی نیست.
- کد فقط `event_key` را می‌شناسد؛ در لحظه ارسال، پترن فعال از دیتابیس خوانده می‌شود (نه از `.env` یا کد).
- **آداپتور Provider-agnostic:** `integrations/sms/sms.adapter.ts` یک اینترفیس ثابت دارد (`send(phone, patternCode, params)`)؛ پیاده‌سازی واقعی (کاوه‌نگار/ملی‌پیامک/فراپیامک) پشت این اینترفیس مخفی می‌ماند و از طریق `.env` انتخاب می‌شود (`SMS_PROVIDER=kavenegar`). `[TODO: کارفرما باید provider نهایی و کدهای پترن واقعی را اعلام کند]`
- ارسال از طریق صف BullMQ انجام می‌شود (نه synchronous)، با ۳ بار retry با backoff نمایی در صورت خطای provider.

---

## ۵. احراز هویت و کنترل دسترسی

- **ورود:** `POST /api/v1/auth/login` با `national_code` + `phone` (طبق سند، بدون OTP). پسورد به‌صورت hash شده (bcrypt) روی `phone` ذخیره نمی‌شود بلکه یک `password_hash` مجزا در `users` نگه داشته می‌شود که مقدار اولیه‌اش هش شماره موبایل است و کاربر می‌تواند از بخش تنظیمات تغییرش دهد.
- **توکن:** access token (عمر کوتاه، ۱۵ دقیقه) + refresh token (عمر بلند، در دیتابیس ذخیره و قابل ابطال).
- **RBAC:** میدلور `requireRole([...])` روی هر route.
- **Patient-Scope Middleware:** جدا از نقش — طبق بخش ۲.۴.۴ سند، مدیر می‌تواند دسته بیماران قابل‌مشاهده هر منشی را دستی تنظیم کند. این یک لایه‌ی permission جداگانه است (`user_patient_scopes`) که هر کوئری لیست بیماران باید آن را نیز اعمال کند، نه فقط نقش کاربر.
- **Tenant Middleware:** بعد از احراز هویت، `clinic_id` از توکن استخراج و در `request context` قرار می‌گیرد؛ لایه Repository به‌صورت خودکار این فیلتر را به هر کوئری اضافه می‌کند (جلوگیری از نشت داده بین کلینیک‌ها در آینده SaaS).

---

## ۶. استاندارد پاسخ خطا (Error Handling)

فرمت یکسان برای همه خطاها:

```json
{
  "success": false,
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "بیمار مورد نظر یافت نشد",
    "details": null
  }
}
```

- کلاس‌های خطای سفارشی در `common/errors/` (`NotFoundError`, `ValidationError`, `ForbiddenError`, `ConflictError`) که به کد HTTP مناسب (404, 400, 403, 409) map می‌شوند.
- میدلور مرکزی `error-handler.ts` تمام خطاها را می‌گیرد؛ خطاهای پیش‌بینی‌نشده با کد `INTERNAL_ERROR` و بدون افشای stack trace به کلاینت لاگ و پاسخ داده می‌شوند.
- اعتبارسنجی ورودی با Zod در لایه `*.schema.ts`؛ خطای validation با کد `VALIDATION_ERROR` و لیست فیلدهای خطادار در `details` برگردانده می‌شود.
- پاسخ موفق یکنواخت:
```json
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42 } }
```

---

## ۷. قراردادهای API (خلاصه Endpoint‌ها بر اساس ماژول‌های سند)

همه مسیرها با پیشوند `/api/v1` و نیازمند `Authorization: Bearer <token>` مگر `auth/login`.

- **auth:** `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- **dashboard:** `GET /dashboard` (نقش‌محور — پاسخ بر اساس role کاربر لاجیک متفاوت دارد)
- **patients:** `GET /patients` (query: `search`, `status`, `category`, `page`, `limit`), `POST /patients`, `GET /patients/:id`, `PATCH /patients/:id/status`, `POST /patients/:id/insurance-approval`
- **appointments:** `GET /appointments`, `POST /appointments`, `PATCH /appointments/:id`, `DELETE /appointments/:id`
- **secretaries:** `GET /secretaries`, `POST /secretaries`, `PATCH /secretaries/:id`, `DELETE /secretaries/:id`, `PUT /secretaries/:id/patient-scope`
- **notifications:** `GET /notifications`, `POST /notifications`
- **invoices:** `POST /invoices`, `POST /invoices/pro-forma`, `GET /invoices/:id/pdf`
- **insurances:** `GET /insurances`, `POST /insurances`, `PATCH /insurances/:id/approve`
- **services:** `GET /services` (pagination ۱۰تایی، فیلتر `code`), `POST /services`, `PATCH /services/:id`, `DELETE /services/:id`
- **tariffs:** همانند services
- **reports/revenue:** `GET /reports/revenue` (فیلتر بازه، نوع پرداخت، حداقل/حداکثر)، `GET /reports/revenue/export`
- **expenses:** `GET /expenses` (فیلتر نوع/نام/بازه)، `POST /expenses/daily`, `POST /expenses/company`, `GET /expenses/monthly-comparison`
- **settings:** `PATCH /settings/profile`, `PATCH /settings/sms-templates/:event_key`

---

## ۸. جست‌وجو و کارایی

- جست‌وجوی نام/کدملی: PostgreSQL extension `pg_trgm` + ایندکس GIN. کافی برای ۱۰k رکورد؛ نیازی به Elasticsearch نیست.
- Pagination همه‌جا offset-based با `page` و `limit` (پیش‌فرض بر اساس سند: ۱۰ برای خدمات/تعرفه‌ها).
- باکس‌های آماری dashboard (بروزرسانی زنده): در فاز اول با polling سمت فرانت (هر ۱۰-۱۵ ثانیه)؛ ساختار کد اجازه افزودن بعدی WebSocket/Socket.io را بدون تغییر لایه Service می‌دهد.

---

## ۹. زیرساخت

- **هاست: هم‌روش (Hamravesh) — پلتفرم Darkube.** تمام سرویس‌های زیر روی همین پلتفرم و در یک شبکه داخلی قرار می‌گیرند (کاهش لتنسی بین سرویس‌ها):
  - **اپلیکیشن Node.js:** دیپلوی به‌صورت اپ کانتینری روی Darkube.
  - **PostgreSQL:** دیتابیس منیجدشده هم‌روش.
  - **Redis:** برای BullMQ، دیتابیس منیجدشده هم‌روش (با دیسک فعال تا داده‌ها با ریستارت پاک نشوند).
  - **فایل‌ها (تصویر تاییدیه بیمه، آواتار منشی):** آبجکت‌استوریج S3-Compatible هم‌روش (باکت مجزا برای پروژه)، نه دیسک لوکال سرور — چون اپ باید stateless بماند.
  - **بکاپ:** از سرویس بکاپ داخلی هم‌روش برای PostgreSQL و آبجکت‌استوریج استفاده شود (پیکربندی دوره‌ای، نه دستی).
- متغیرهای محیطی حساس (DB connection, JWT secret, SMS provider keys, آدرس و کلیدهای S3) در `.env` / Secret تعریف‌شده در Darkube و هرگز در Git.
- `[TODO]` تعیین پلن منابع (CPU/RAM) اپلیکیشن و دیتابیس‌ها بر اساس تعرفه فعلی هم‌روش، متناسب با بار فاز اول.

---

## ۱۰. موارد باز که نیاز به تصمیم کارفرما دارد `[TODO]`

1. Provider نهایی پیامک (کاوه‌نگار/ملی‌پیامک/فراپیامک) و کدهای پترن واقعی.
2. فرمت دقیق شماره فاکتور/شماره پرونده (ترتیبی؟ بر اساس تاریخ؟).
3. سیاست دقیق نگهداری Refresh Token (مدت انقضا دقیق، امکان چند دستگاه هم‌زمان یا نه).
4. آیا Soft Delete برای بیمار/فاکتور کافی است یا الزام قانونی/حسابداری خاصی برای عدم حذف داده هست؟

---

## ۱۱. اولویت پیاده‌سازی پیشنهادی برای ایجنت

1. Setup پروژه (TS, Fastify, Prisma, ساختار پوشه) + schema.prisma کامل + migration اولیه
2. auth + RBAC + tenant middleware
3. ماژول patients (شامل فرایند کامل پذیرش و تغییر وضعیت)
4. ماژول services / tariffs
5. ماژول invoices (شامل invoice_items و محاسبه تخفیف)
6. ماژول appointments
7. ماژول expenses + گزارش مقایسه ماهانه
8. ماژول reports/revenue
9. sms integration + BullMQ + sms_templates
10. dashboard (تجمیع همه ماژول‌ها)
11. notifications + secretaries management + settings
