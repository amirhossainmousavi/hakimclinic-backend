import { prisma } from '../../common/prisma/prisma.client';
import { CreateServiceInput, GetServicesQuery, UpdateServiceInput } from './services.schema';

export class ServicesRepository {
  async create(clinicId: string, data: CreateServiceInput) {
    return prisma.service.create({
      data: { ...data, clinicId },
    });
  }

  async findById(clinicId: string, id: string) {
    return prisma.service.findFirst({
      where: { id, clinicId },
    });
  }

  async findAll(clinicId: string, query: GetServicesQuery) {
    const { search, serviceType, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { clinicId };
    if (search) {
      where.serviceCode = { contains: search, mode: 'insensitive' };
    }
    if (serviceType) {
      where.serviceType = serviceType;
    }

    const [items, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { serviceCode: 'asc' },
      }),
      prisma.service.count({ where }),
    ]);

    return { items, total };
  }

  async update(clinicId: string, id: string, data: UpdateServiceInput) {
    return prisma.service.updateMany({
      where: { id, clinicId },
      data,
    });
  }

  async delete(clinicId: string, id: string) {
    return prisma.service.deleteMany({
      where: { id, clinicId },
    });
  }
}
