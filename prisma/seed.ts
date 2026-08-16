import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || '' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const clinic = await prisma.clinic.upsert({
    where: { id: 'clinic-main' },
    update: {},
    create: {
      id: 'clinic-main',
      name: 'کلینیک ارتوپدی فنی حکیم',
      phone: '021',
      address: 'تهران',
    },
  });

  // مدیر (mosavi): password_hash اولیه = هش شماره موبایل (طبق معماری، ورود بدون پسورد)
  const nationalCode = '4421100773';
  const phone = '09369007054';
  const passwordHash = await bcrypt.hash(phone, 10);

  await prisma.user.upsert({
    where: { clinicId_nationalCode: { clinicId: clinic.id, nationalCode } },
    update: { isActive: true, phone },
    create: {
      clinicId: clinic.id,
      nationalCode,
      phone,
      passwordHash,
      fullName: 'مدیر کلینیک',
      role: 'manager',
    },
  });

  console.log('Seed done. Clinic:', clinic.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
