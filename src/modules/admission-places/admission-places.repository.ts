import { prisma } from '../../common/prisma/prisma.client';
import { CreateAdmissionPlaceInput, UpdateAdmissionPlaceInput } from './admission-places.schema';

const includeRelations = {
  insurances: { include: { insurance: true } },
} as const;

export class AdmissionPlacesRepository {
  async create(clinicId: string, data: CreateAdmissionPlaceInput) {
    const { insuranceIds, ...placeData } = data;

    return prisma.$transaction(async (tx) => {
      const place = await tx.admissionPlace.create({
        data: { ...placeData, clinicId },
      });

      await tx.admissionPlaceInsurance.createMany({
        data: (insuranceIds ?? []).map((insuranceId) => ({ placeId: place.id, insuranceId })),
      });

      return tx.admissionPlace.findUniqueOrThrow({
        where: { id: place.id },
        include: includeRelations,
      });
    });
  }

  async findById(clinicId: string, id: string) {
    return prisma.admissionPlace.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: includeRelations,
    });
  }

  async findAll(clinicId: string, scopes?: string[]) {
    return prisma.admissionPlace.findMany({
      where: {
        clinicId,
        deletedAt: null,
        ...(scopes && scopes.length > 0 ? { id: { in: scopes } } : {}),
      },
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(clinicId: string, id: string, data: UpdateAdmissionPlaceInput) {
    const { insuranceIds, ...placeData } = data;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.admissionPlace.findFirst({
        where: { id, clinicId, deletedAt: null },
      });
      if (!existing) return null;

      const place = await tx.admissionPlace.update({
        where: { id },
        data: placeData,
      });

      if (insuranceIds) {
        await tx.admissionPlaceInsurance.deleteMany({ where: { placeId: id } });
        await tx.admissionPlaceInsurance.createMany({
          data: insuranceIds.map((insuranceId) => ({ placeId: id, insuranceId })),
        });
      }

      return tx.admissionPlace.findUniqueOrThrow({
        where: { id: place.id },
        include: includeRelations,
      });
    });
  }

  async delete(clinicId: string, id: string) {
    const updated = await prisma.admissionPlace.updateMany({
      where: { id, clinicId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return updated.count > 0;
  }
}
