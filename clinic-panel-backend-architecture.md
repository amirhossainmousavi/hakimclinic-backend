# سند معماری بک‌اند — پنل مدیریت کلینیک ارتوپدی فنی حکیم

> این سند وضعیت فعلی پیاده‌سازی را توصیف می‌کند و برای ایجنت کدنویس مرجع است. بخش‌های `[TODO]` موارد باز هستند.

---

## ۱. خلاصه معماری

| بخش | تصمیم |
|---|---|
| زبان | TypeScript روی Node.js (LTS) |
| فریم‌ورک HTTP | Fastify 5 |
| دیتابیس | PostgreSQL 16 |
| ORM | Prisma 7 با `@prisma/adapter-pg` |
| کش/صف | Redis + BullMQ |
| فایل‌استوریج | محلی (`local`) یا آبجکت‌استوریج S3-Compatible — از طریق `STORAGE_DRIVER` |
| احراز هویت | JWT (access + refresh)، بدون OTP |
| معماری کلی | مونولیت ماژولار |
| نوع API | REST، نسخه‌دار (`/api/v1`) |

**چرا مونولیت ماژولار:** حجم داده فاز اول و تعداد کاربر هم‌زمان کم، میکروسرویس یا سرورلس را توجیه نمی‌کند. کد در قالب ماژول‌های مستقل نوشته می‌شود تا در صورت نیاز آینده، جداسازی ساده بماند.

**Multi-Tenant آماده:** هر جدول دامنه‌ای ستون `clinic_id` دارد و لایه Repository این فیلتر را به هر کوئری اعمال می‌کند. میدلور `tenantScope` در حین احراز هویت، `clinic_id` را از توکن استخراج می‌کند.

---

## ۲. ساختار پوشه‌ها

```
src/
  modules/
    auth/
    admission-places/
    appointments/
    dashboard/
    expenses/
    files/
    insurances/
    invoices/
    notifications/
    patients/
    reports/
    secretaries/
    services/
    tariffs/
  common/
    errors/            # کلاس‌های خطای سفارشی + error-handler
    prisma/            # prisma.client
    middlewares/       # authenticate, requireRole, tenantScope
  config/
    env.ts             # اعتبارسنجی Zod متغیرهای محیطی
  integrations/
    sms/               # آداپتور پیامک
    storage/           # آداپتور ذخیره‌سازی (local / s3)
  jobs/                # BullMQ processors
  server.ts            # bootstrap برنامه
```

هر ماژول شامل: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts` (اعتبارسنجی Zod), `*.routes.ts`.

قانون سخت: **کنترلر هرگز مستقیم به Prisma دسترسی ندارد.** فقط Repository با Prisma کار می‌کند؛ Service منطق بیزینس را پیاده می‌کند؛ Controller فقط ورودی/خروجی HTTP را مدیریت می‌کند.

---

## ۳. مدل داده (Schema)

منبع حقیقت: [`prisma/schema.prisma`](prisma/schema.prisma). ستون‌های DB با `@map` به snake_case نگاشت شده‌اند. جداول اصلی:

| مدل | نکته |
|---|---|
| `Clinic` | `id, name, phone, address, is_active` |
| `User` | `national_code (unique per clinic), phone, role [manager | secretary], is_active` |
| `SecretaryWorkplace` | دسترسی هر منشی به محل‌های پذیرش (`user_id + place_id`) — جایگزین `user_patient_scopes` |
| `SecretaryPermission` | دسترسی دستی به ماژول‌ها (`dashboard, patients, appointments, invoices, expenses`) |
| `AdmissionPlace` | محل پذیرش با `admission_type [free_only | insured_only | both]` |
| `AdmissionPlaceInsurance` | رابطه محل×بیمه‌ای که آنجا پذیرش می‌شود |
| `Patient` | `national_code, full_name, phone, birth_date, file_number, admission_type [free | insured], insurance_id?, status, suggested_doctor?, description?, admitted_by_user_id` — ایندکس ترکیبی `(clinic_id, national_code)` و `(clinic_id, admission_place_id)` |
| `PatientStatusHistory` | تاریخچه تغییر وضعیت (`from_status → to_status, changed_by_user_id`) |
| `PatientFile` | فایل‌های پرونده بیمار (`type [image | video], url, mime_type, file_size`) |
| `PatientService` | خدمات ثبت‌شده برای بیمار (`service_id, service_date, unit_price`) |
| `InsuranceApproval` | مرحله تاییدیه بیمه (`receipt_image_url, approval_file_url?, approved_by_user_id?`) |
| `Insurance` | بیمه‌های طرف قرارداد |
| `Appointment` | نوبت‌دهی (`appointment_date, appointment_time?, status [scheduled | postponed | cancelled | done]`) — ایندکس `(clinic_id, appointment_date)` |
| `Notification` | اطلاعیه داخلی + `NotificationRecipient` |
| `Service` | خدمات: `service_type [orthosis | prosthesis], service_name?, region_or_section?, treatment_process?, service_code (unique per clinic), price` |
| `Tariff` | تعرفه قطعات: `item_code (unique per clinic), item_description, price` |
| `Invoice` | `invoice_number, invoice_type [final | pro_forma], payment_type [card_to_card | pos | bank_transfer], total_amount, discount_total, prepaid_amount, iban?, pdf_url?` |
| `InvoiceItem` | سطر فاکتور: `service_id, tariff_id?, quantity, unit_price, discount_amount, line_total` |
| `DailyExpense` / `CompanyInvoice` | هزینه‌ها |
| `SmsTemplate` | پترن پیامک (`event_key (unique per clinic), pattern_code`) |
| `RefreshToken` | `token_hash, expires_at, revoked_at?` |

انوم‌های وضعیت بیمار: `admitted, pending_insurance_approval, in_production, ready_for_delivery, delivered`.

---

## ۴. احراز هویت و کنترل دسترسی

- **ورود:** `POST /api/v1/auth/login` با `national_code` + `phone` — بدون رمز عبور. سیستم فقط روی سرور کلینیک اجرا می‌شود و فقط کارکنان خود کلینیک به آن دسترسی دارند؛ در نتیجه احراز هویت صرفاً با کدملی و شماره موبایل انجام می‌شود (ستون `password_hash` از جدول `users` حذف شده است).
- **توکن:** access token کوتاه‌عمر (پیش‌فرض ۱۵ دقیقه) + refresh token بلندعمر (پیش‌فرض ۷ روز) که هش‌شده در `refresh_tokens` ذخیره و قابل ابطال است. لاگ‌اوت توکن refresh را revoke می‌کند و refresh بعد از لاگ‌اوت با 401 رد می‌شود.
- **RBAC:** میدلور `requireRole([...])` روی route ها؛ نقش‌ها `manager` و `secretary`.
- **Tenant & Scope:** میدلور `authenticate` توکن را verify و `clinic_id` و `role` را به request context اضافه می‌کند. برای منشی‌ها، دسترسی به بیماران از طریق `SecretaryWorkplace` محدود می‌شود — عملیات‌های وضعیت بیمار، تاییدیه بیمه، الصاق/حذف خدمت و آپلود/حذف فایل، scope محل پذیرش را چک می‌کنند.
- **فایل‌های آپلودشده (`/uploads/`):** توسط hook سطح برنامه محافظت می‌شود — چون `<img>/<video>` نمی‌توانند هدر Authorization بفرستند، توکن access کوتاه‌عمر به‌صورت کوئری‌پارام `?token=` ارسال می‌شود. بدون توکن معتبر → 401.

**محیط‌ها (env):** همه متغیرهای حساس از [`config/env.ts`](src/config/env.ts) با Zod اعتبارسنجی می‌شوند. `JWT_ACCESS_SECRET` و `JWT_REFRESH_SECRET` حداقل ۱۶ کاراکتر الزامی دارند؛ در `NODE_ENV=production` مقادیر پیش‌فرض قدیمی رد می‌شوند. CORS از طریق `CORS_ORIGINS` (لیست کاما-جدا) محدود است.

---

## ۵. خطا و پاسخ استاندارد

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

- کلاس‌های خطای سفارشی در `common/errors/` که به کد HTTP مناسب map می‌شوند.
- میدلور مرکزی `error-handler.ts` خطاهای پیش‌بینی‌نشده را با کد `INTERNAL_ERROR` و بدون افشای stack trace لاگ و پاسخ می‌دهد.
- پاسخ موفق:
```json
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 10, "total": 42 } }
```

---

## ۶. Endpoint ها (خلاصه)

همه مسیرها با پیشوند `/api/v1` و نیازمند `Authorization: Bearer <token>` مگر `auth/login`.

| ماژول | مسیرها |
|---|---|
| auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| dashboard | `GET /dashboard` (نقش‌محور) |
| patients | `GET /patients` (query: `search, status, placeId, page, limit`), `POST /patients`, `GET /patients/:id`, `PATCH /patients/:id/status`, `POST /patients/:id/insurance-approval`, `GET /patients/:id/services`, `POST /patients/:id/services`, `DELETE /patients/services/:id` |
| files | `POST /patients/:patientId/files`, `DELETE /patients/:patientId/files/:id` (mount شده زیر `/api/v1`) |
| appointments | `GET/POST /appointments`, `PATCH/DELETE /appointments/:id` |
| secretaries | `GET/POST /secretaries`, `PATCH/DELETE /secretaries/:id`, permission/workplace مدیریت |
| admission-places | `GET/POST /admission-places`, `PATCH/DELETE /admission-places/:id` |
| notifications | `GET/POST /notifications`, `POST /notifications/:id/read` |
| invoices | `POST /invoices`, `POST /invoices/pro-forma`, `GET /invoices/:id/pdf` |
| insurances | `GET/POST /insurances`, `PATCH /insurances/:id/approve` |
| services | `GET /services` (pagination), `POST /services`, `PATCH/DELETE /services/:id` |
| tariffs | همانند services |
| reports | `GET /reports/revenue`, export |
| expenses | `GET /expenses`, `POST /expenses/daily`, `POST /expenses/company`, monthly-comparison |

---

## ۷. جست‌وجو و کارایی

- Pagination همه‌جا offset-based با `page` و `limit`.
- فیلتر و جست‌وجو در لایه Repository با ایندکس‌های تعریف‌شده در schema انجام می‌شود.
- به‌روزرسانی‌های وضعیت بیمار داخل `$transaction` ثبت می‌شوند تا تاریخچه و وضعیت اتمیک بمانند.

---

## ۸. اجرا

```bash
npm install
cp .env.example .env   # سپس مقادیر واقعی را تنظیم کنید
npx prisma generate
npx prisma migrate dev
npm run dev            # tsx watch روی src/server.ts
npm run build && npm start
```

سرویس‌ها (پیش‌فرض‌ها در `.env.example`): پورت سرویس (فعلاً `4000`)، Redis، JWT secrets، CORS، SMS provider، ذخیره‌سازی.

---

## ۹. موارد باز `[TODO]`

1. Provider نهایی پیامک و کدهای پترن واقعی (جدول `sms_templates` فعلاً placeholder است).
2. فرمت دقیق شماره فاکتور/پرونده.
3. سیاست نگهداری refresh token (مدت دقیق، چند دستگاه هم‌زمان).
4. سیاست soft delete در مقابل الزامات قانونی/حسابداری.
