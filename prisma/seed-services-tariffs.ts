/**
 * اسکریپت وارد کردن داده‌های services.json و tariffs.json به دیتابیس از طریق Prisma.
 *
 * اجرا (با tsx):
 *   npx tsx prisma/seed-services-tariffs.ts <CLINIC_ID> [DATA_DIR]
 *
 * DATA_DIR اختیاری است؛ اگر داده نشود، همین پوشه (prisma/) انتظار می‌رود
 * services.json و tariffs.json کنار اسکریپت باشند. نصب‌کننده لوکال پوشه
 * data جداگانه را پاس می‌دهد.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'node:fs';
import path from 'node:path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || '' });
const prisma = new PrismaClient({ adapter });

type ServiceRow = {
  service_type: 'orthosis' | 'prosthesis';
  service_code: string;
  service_name?: string | null;
  region_or_section?: string | null;
  treatment_process?: string | null;
  price: number;
  description?: string | null;
};

type TariffRow = {
  item_code: string;
  item_description: string;
  price: number;
  description?: string | null;
};

async function main() {
  const clinicId = process.argv[2];
  if (!clinicId) {
    console.error('لطفاً شناسه کلینیک (clinic_id) را به‌عنوان آرگومان بدهید.');
    process.exit(1);
  }

  const dataDir = process.argv[3] || __dirname;
  const servicesPath = path.join(dataDir, 'services.json');
  const tariffsPath = path.join(dataDir, 'tariffs.json');

  if (!fs.existsSync(servicesPath) || !fs.existsSync(tariffsPath)) {
    console.error(`فایل‌های داده پیدا نشد: ${servicesPath} یا ${tariffsPath}`);
    process.exit(1);
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) {
    console.error(`کلینیکی با شناسه ${clinicId} پیدا نشد. اول رکورد clinic را بسازید (prisma:seed).`);
    process.exit(1);
  }

  const services: ServiceRow[] = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));
  const tariffs: TariffRow[] = JSON.parse(fs.readFileSync(tariffsPath, 'utf-8'));

  console.log(`در حال وارد کردن ${services.length} خدمت برای کلینیک ${clinic.name}...`);

  let serviceCount = 0;
  for (const s of services) {
    await prisma.service.upsert({
      where: {
        clinic_id_service_code: { clinic_id: clinicId, service_code: s.service_code },
      },
      update: {
        service_type: s.service_type,
        service_name: s.service_name ?? null,
        region_or_section: s.region_or_section ?? null,
        treatment_process: s.treatment_process ?? null,
        price: s.price,
        description: s.description ?? null,
      },
      create: {
        clinic_id: clinicId,
        service_type: s.service_type,
        service_code: s.service_code,
        service_name: s.service_name ?? null,
        region_or_section: s.region_or_section ?? null,
        treatment_process: s.treatment_process ?? null,
        price: s.price,
        description: s.description ?? null,
      },
    });
    serviceCount++;
    if (serviceCount % 50 === 0) console.log(`  ${serviceCount}/${services.length}`);
  }

  console.log(`در حال وارد کردن ${tariffs.length} تعرفه برای کلینیک ${clinic.name}...`);

  let tariffCount = 0;
  for (const t of tariffs) {
    await prisma.tariff.upsert({
      where: {
        clinic_id_item_code: { clinic_id: clinicId, item_code: t.item_code },
      },
      update: {
        item_description: t.item_description,
        price: t.price,
        description: t.description ?? null,
      },
      create: {
        clinic_id: clinicId,
        item_code: t.item_code,
        item_description: t.item_description,
        price: t.price,
        description: t.description ?? null,
      },
    });
    tariffCount++;
    if (tariffCount % 200 === 0) console.log(`  ${tariffCount}/${tariffs.length}`);
  }

  console.log(`تمام شد. ${serviceCount} خدمت و ${tariffCount} تعرفه وارد شد.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
