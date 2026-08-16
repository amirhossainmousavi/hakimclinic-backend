import { prisma } from '../../common/prisma/prisma.client';
import { CreateTariffInput, GetTariffsQuery, UpdateTariffInput } from './tariffs.schema';

export class TariffsRepository {
  async create(clinicId: string, data: CreateTariffInput) {
    return prisma.tariff.create({
      data: { ...data, clinicId },
    });
  }

  async findById(clinicId: string, id: string) {
    return prisma.tariff.findFirst({
      where: { id, clinicId },
    });
  }

  async findAll(clinicId: string, query: GetTariffsQuery) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { clinicId };
    if (search) {
      where.itemCode = { contains: search };
    }

    const [items, total] = await Promise.all([
      prisma.tariff.findMany({
        where,
        skip,
        take: limit,
        orderBy: { itemCode: 'asc' },
      }),
      prisma.tariff.count({ where }),
    ]);

    return { items, total };
  }

  async update(clinicId: string, id: string, data: UpdateTariffInput) {
    return prisma.tariff.updateMany({
      where: { id, clinicId },
      data,
    });
  }

  async delete(clinicId: string, id: string) {
    return prisma.tariff.deleteMany({
      where: { id, clinicId },
    });
  }
}
