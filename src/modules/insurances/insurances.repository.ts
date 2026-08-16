import { prisma } from '../../common/prisma/prisma.client';
import { CreateInsuranceInput } from './insurances.schema';

export class InsurancesRepository {
  async create(clinicId: string, data: CreateInsuranceInput) {
    return prisma.insurance.create({
      data: { clinicId, name: data.name },
    });
  }

  async findAll(clinicId: string) {
    return prisma.insurance.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(clinicId: string, id: string) {
    return prisma.insurance.findFirst({ where: { id, clinicId } });
  }

  async approve(clinicId: string, id: string) {
    return prisma.insurance.updateMany({
      where: { id, clinicId },
      data: { isApproved: true },
    });
  }

  async delete(clinicId: string, id: string) {
    return prisma.insurance.deleteMany({ where: { id, clinicId } });
  }
}
