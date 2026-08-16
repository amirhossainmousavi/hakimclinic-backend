import 'dotenv/config';
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

  // Manager (mosavi): passwordless login (nationalCode + phone only)
  const nationalCode = '4433699731';
  const phone = '09124841284';

  await prisma.user.upsert({
    where: { clinicId_nationalCode: { clinicId: clinic.id, nationalCode } },
    update: { isActive: true, phone },
    create: {
      clinicId: clinic.id,
      nationalCode,
      phone,
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
