import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generate an invoice PDF by rendering right-to-left HTML/CSS with Puppeteer.
 * The Vazirmatn font is embedded into the template as base64 (not CDN) so that
 * it renders correctly in the output PDF — even offline.
 */

// --- Vazirmatn font (embed) ---
function loadFontBase64(weight: 400 | 700): string {
  const file = join(
    process.cwd(),
    'node_modules',
    '@fontsource',
    'vazirmatn',
    'files',
    `vazirmatn-arabic-${weight}-normal.woff2`
  );
  return readFileSync(file).toString('base64');
}

const FONT_400 = loadFontBase64(400);
const FONT_700 = loadFontBase64(700);

// --- Solar date (no dependencies) ---
const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a: number, b: number) => Math.floor(a / b);
const mod = (a: number, b: number) => a - Math.floor(a / b) * b;
const DAY_MS = 86400000;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < JALALI_BREAKS.length; i += 1) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  let nn = n;
  if (jump - n < 6) nn = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(nn + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function d2j(dn: number): { jy: number; jm: number; jd: number } {
  const gy = new Date(dn * DAY_MS).getUTCFullYear();
  let jy = gy - 621;
  const r = jalCal(jy);
  const anchor = Date.UTC(r.gy, 2, r.march) / DAY_MS;
  let k = dn - anchor;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function jalaliDate(date: Date): { year: number; month: number; day: number } {
  const r = d2j(Math.floor(date.getTime() / DAY_MS));
  return { year: r.jy, month: r.jm, day: r.jd };
}

export function toJalaliString(date: Date): string {
  const { year, month, day } = jalaliDate(date);
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

export function formatJalaliLong(date: Date): string {
  const { year, month, day } = jalaliDate(date);
  return `${day} ${JALALI_MONTHS[month - 1]} ${year}`;
}

// --- Formatting helpers ---
function formatPrice(n: number): string {
  return Math.round(n).toLocaleString('fa-IR');
}

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- PDF filename (from patient name) ---
export function buildPdfFilename(d: InvoicePdfData): { filename: string; filenameEncoded: string } {
  const safe = d.patientName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'بیمار';
  const filename = `فاکتور-${safe}.pdf`;
  const filenameEncoded = encodeURIComponent(filename);
  return { filename, filenameEncoded };
}

// --- Data required for rendering ---
export interface InvoicePdfItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  fileNumber: string;
  issueDate: string; // solar
  invoiceType: 'final' | 'pro_forma';
  paymentTypeLabel: string;
  patientName: string;
  doctorName: string | null;
  clinicName: string;
  clinicPhone: string;
  items: InvoicePdfItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  finalTotal: number;
  prepaidAmount: number;
  description: string | null;
  iban: string | null;
  ibanNote: string | null;
  notes: string | null;
}

// --- HTML template ---
export function buildInvoiceHtml(d: InvoicePdfData): string {
  const isProForma = d.invoiceType === 'pro_forma';
  const docTitle = isProForma ? 'پیش‌فاکتور' : 'فاکتور فروش';
  const docNoLabel = isProForma ? 'شماره پیش‌فاکتور' : 'شماره فاکتور';
  const docNo = `${docNoLabel}: ${esc(d.invoiceNumber)}`;

  const rows = d.items
    .map(
      (it, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="c code">${esc(it.code)}</td>
        <td class="desc">${esc(it.description)}</td>
        <td class="c">${it.quantity}</td>
        <td class="n">${formatPrice(it.unitPrice)}</td>
        <td class="n">${formatPrice(it.discountAmount)}</td>
        <td class="n strong">${formatPrice(it.lineTotal)}</td>
      </tr>`
    )
    .join('');

  const notesSection = isProForma
    ? `<div class="notes">
        <h3>توضیحات و ترتیبات پرداخت</h3>
        <p class="notes-body">${esc(d.description || d.ibanNote || '')}</p>
        ${d.iban ? `<p class="iban">شماره شبا: <b>${esc(d.iban)}</b></p>` : ''}
      </div>`
    : '';

  // Prepayment: finalTotal already has prepaidAmount subtracted;
  // prepaid rows (x) and remaining amount (y = finalTotal) are for display only.
  const prepaidRows =
    d.prepaidAmount > 0
      ? `<tr class="prepaid"><td class="k">پیش‌پرداخت شده</td><td class="v">${formatPrice(d.prepaidAmount)}</td></tr>
         <tr class="prepaid"><td class="k">هزینه پرداخت‌نشده (قابل پرداخت)</td><td class="v">${formatPrice(d.finalTotal)}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<style>
  @font-face {
    font-family: 'Vazirmatn';
    src: url(data:font/woff2;base64,${FONT_400}) format('woff2');
    font-weight: 400;
    font-display: swap;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url(data:font/woff2;base64,${FONT_700}) format('woff2');
    font-weight: 700;
    font-display: swap;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: 'Vazirmatn', sans-serif;
    font-size: 12px;
    color: #111827;
    direction: rtl;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm 12mm 8mm;
    display: flex;
    flex-direction: column;
  }
  /* ---------- Official: letterhead (logo + double rule) ---------- */
  .letterhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 4mm;
  }
  .clinic { display: flex; align-items: center; gap: 10px; }
  .logo {
    width: 16mm;
    height: 16mm;
    border: 1.5px solid #1e3a8a;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #1e3a8a;
  }
  .clinic .name { font-size: 17px; font-weight: 700; color: #1e3a8a; }
  .clinic .sub { font-size: 10px; color: #4b5563; margin-top: 2px; }
  .doc-title { text-align: center; }
  .doc-title h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #1e3a8a;
    border: 1.5px solid #1e3a8a;
    border-radius: 3px;
    padding: 4px 14px;
    display: inline-block;
  }
  .doc-title .doc-no { margin-top: 4px; font-size: 10px; color: #4b5563; }
  .rule-double { border-bottom: 2.5px solid #1e3a8a; }
  .rule-double::after {
    content: '';
    display: block;
    border-bottom: 1px solid #b45309;
    margin-top: 2px;
  }

  /* ---------- Meta table ---------- */
  table.meta {
    width: 100%;
    border-collapse: collapse;
    margin: 6mm 0;
  }
  table.meta td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    font-size: 11px;
  }
  table.meta .k { color: #4b5563; font-size: 10px; }
  table.meta .v { font-weight: 600; color: #111827; }

  /* ---------- Items table ---------- */
  table.items { width: 100%; border-collapse: collapse; }
  table.items th {
    background: #1e3a8a;
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
    border: 1px solid #1e3a8a;
    padding: 5px 6px;
    text-align: right;
  }
  table.items td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    font-size: 10.5px;
  }
  table.items tbody tr:nth-child(even) { background: #f1f5f9; }
  .c { text-align: center; }
  .n { text-align: left; font-variant-numeric: tabular-nums; }
  .code { color: #4b5563; font-size: 9.5px; }
  .desc { max-width: 62mm; }
  .strong { font-weight: 700; }

  /* ---------- Summary ---------- */
  .summary {
    width: 100%;
    border-collapse: collapse;
    margin-top: 5mm;
  }
  .summary td {
    border: 1px solid #cbd5e1;
    padding: 5px 8px;
    font-size: 11px;
    text-align: right;
  }
  .summary td.k { color: #4b5563; width: 55%; }
  .summary td.v { text-align: left; font-variant-numeric: tabular-nums; }
  .summary tr.final td {
    background: #1e3a8a;
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
  }

  /* ---------- Notes (pro-forma only) ---------- */
  .notes {
    margin-top: 5mm;
    padding: 4mm 5mm;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    background: #f8fafc;
  }
  .notes h3 {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    color: #1e3a8a;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 3px;
  }
  .notes .notes-body { margin: 3px 0; font-size: 10.5px; color: #374151; }
  .notes .iban {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    text-align: right;
    font-size: 11px;
    color: #111827;
  }

  /* ---------- Signatures and seal ---------- */
  .signatures {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 6mm;
    padding-top: 10mm;
  }
  .sign-box {
    flex: 1;
    border-top: 1px dashed #9ca3af;
    padding-top: 3mm;
    text-align: center;
    font-size: 10px;
    color: #4b5563;
  }
  .sign-box b { display: block; margin-bottom: 2mm; font-size: 11px; color: #111827; }

  /* ---------- Footer ---------- */
  .footer {
    margin-top: 4mm;
    padding-top: 2mm;
    border-top: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    font-size: 8.5px;
    color: #9ca3af;
  }
  .count-note { font-size: 9.5px; color: #4b5563; margin-top: 2mm; }
</style>
</head>
<body>
  <div class="page">
    <div class="letterhead">
      <div class="clinic">
        <div class="logo">⧫</div>
        <div>
          <div class="name">${esc(d.clinicName)}</div>
          <div class="sub">مرکز فنی‌ارتوپدی و ارائه خدمات تخصصی</div>
        </div>
      </div>
      <div class="doc-title">
        <h2>${docTitle}</h2>
        <div class="doc-no">${docNo}</div>
      </div>
    </div>
    <div class="rule-double"></div>

    <table class="meta">
      <tr>
        <td><span class="k">شماره فاکتور</span><br><span class="v">${esc(d.invoiceNumber)}</span></td>
        <td><span class="k">شماره پرونده</span><br><span class="v">${esc(d.fileNumber)}</span></td>
        <td><span class="k">تاریخ صدور</span><br><span class="v">${esc(d.issueDate)}</span></td>
      </tr>
      <tr>
        <td><span class="k">نام بیمار</span><br><span class="v">${esc(d.patientName)}</span></td>
        <td>${d.doctorName ? `<span class="k">پزشک معرف</span><br><span class="v">${esc(d.doctorName)}</span>` : ''}</td>
        <td><span class="k">نحوه پرداخت</span><br><span class="v">${esc(d.paymentTypeLabel)}</span></td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width: 8%">ردیف</th>
          <th class="c" style="width: 11%">کد</th>
          <th style="width: 34%">شرح</th>
          <th class="c" style="width: 9%">تعداد</th>
          <th class="n" style="width: 13%">قیمت واحد</th>
          <th class="n" style="width: 12%">تخفیف</th>
          <th class="n" style="width: 13%">مبلغ کل ردیف</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="summary">
      <tr><td class="k">جمع کل (قبل از تخفیف)</td><td class="v">${formatPrice(d.subtotal)}</td></tr>
      <tr><td class="k">جمع تخفیف</td><td class="v">${formatPrice(d.discountTotal)}</td></tr>
      <tr><td class="k">مالیات</td><td class="v">${formatPrice(d.taxTotal)}</td></tr>
      <tr class="final"><td>مبلغ نهایی قابل پرداخت</td><td class="v">${formatPrice(d.finalTotal)}</td></tr>
      ${prepaidRows}
    </table>

    ${notesSection}

    <div class="signatures">
      <div class="sign-box"><b>نام و امضای فروشنده</b></div>
      <div class="sign-box"><b>نام و امضای تحویل‌دهنده</b></div>
      <div class="sign-box"><b>نام و امضای تحویل‌گیرنده</b></div>
    </div>

    <div class="footer">
      <span>این سند صرفاً جنبه اطلاع‌رسانی دارد</span>
      <span>سند تولید شده توسط سیستم پنل کلینیک</span>
    </div>
  </div>
</body>
</html>`;
}

// --- Puppeteer (lazy injection) ---
type PuppeteerLaunch = (opts?: Record<string, unknown>) => Promise<{ close: () => Promise<void>; newPage: () => Promise<any> }>;
let puppeteerLaunch: PuppeteerLaunch | null = null;

const COMMON_EXECUTABLE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/opt/google/chrome/chrome',
];

// Downloading Chromium via the puppeteer package was not supported in this project (403 from the download server);
// so the system browser path (Edge/Chrome) is resolved from env or by searching common paths.
function resolveExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const p of COMMON_EXECUTABLE_PATHS) {
    try {
      if (readFileSync(p)) return p;
    } catch {
      /* Not present */
    }
  }
  return undefined;
}

async function getPuppeteerLaunch(): Promise<PuppeteerLaunch> {
  if (!puppeteerLaunch) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await import('puppeteer');
    puppeteerLaunch = mod.default.launch.bind(mod.default) as PuppeteerLaunch;
  }
  return puppeteerLaunch;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const launch = await getPuppeteerLaunch();
  const executablePath = resolveExecutablePath();
  const browser = await launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}

/**
 * Converts the entire invoice data from the Prisma output into a renderable structure.
 * (The output type is intentionally loose to keep in sync with the Prisma output.)
 */
export function mapInvoiceToPdf(invoice: any): InvoicePdfData {
  const items: InvoicePdfItem[] = (invoice.items ?? []).map((item: any) => {
    const service = item.service ?? {};
    const tariff = item.tariff ?? {};
    const brand = tariff.itemDescription || service.treatmentProcess || '';
    const code = tariff.itemCode || service.serviceCode || '-';
    const description = brand ? `${service.treatmentProcess || ''} — ${brand}` : service.treatmentProcess || '—';
    const unitPrice = Number(item.unitPrice ?? 0);
    const discountAmount = Number(item.discountAmount ?? 0);
    const quantity = Number(item.quantity ?? 1);
    return {
      code,
      description,
      quantity,
      unitPrice,
      discountAmount,
      lineTotal: Number(item.lineTotal ?? (unitPrice * quantity - discountAmount)),
    };
  });

  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const itemDiscounts = items.reduce((s, it) => s + it.discountAmount, 0);
  const invoiceDiscount = Number(invoice.discountTotal ?? 0);
  // Actual total discount = line discounts + header discount
  const discountTotal = itemDiscounts + invoiceDiscount;
  const finalTotal = Number(invoice.totalAmount ?? 0);
  const taxTotal = 0;

  const patient = invoice.patient ?? {};
  const clinic = invoice.clinic ?? {};

  return {
    invoiceNumber: invoice.invoiceNumber ?? invoice.id ?? '-',
    fileNumber: patient.fileNumber ?? '-',
    issueDate: toJalaliString(invoice.createdAt ? new Date(invoice.createdAt) : new Date()),
    invoiceType: invoice.invoiceType ?? 'final',
    paymentTypeLabel:
      invoice.paymentType === 'pos' ? 'POS' : invoice.paymentType === 'bank_transfer' ? 'انتقال به حساب' : 'کارت به کارت',
    patientName: patient.fullName ?? '-',
    doctorName: patient.suggestedDoctor ?? null,
    clinicName: clinic.name ?? 'کلینیک ارتوپدی فنی حکیم',
    clinicPhone: clinic.phone ?? '-',
    items,
    subtotal,
    discountTotal,
    taxTotal,
    finalTotal,
    prepaidAmount: Number(invoice.prepaidAmount ?? 0),
    description: invoice.description ?? null,
    iban: invoice.iban ?? null,
    ibanNote: invoice.ibanNote ?? null,
    notes: invoice.ibanNote ?? null,
  };
}
