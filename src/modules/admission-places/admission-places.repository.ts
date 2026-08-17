import { prisma } from '../../common/prisma/prisma.client';
import { CreateAdmissionPlaceInput, UpdateAdmissionPlaceInput } from './admission-places.schema';

const includeRelations = {
  insurances: { include: { insurance: true } },
} as const;

/**
 * Keep `phone` and `centerNumbers` in sync: centerNumbers holds the full list
 * and its first element is the primary phone. Explicit centerNumbers (from the
 * form) wins; otherwise a lone phone becomes a single-entry list.
 */
function normalizeCenterNumbers(phone: string | null | undefined, centerNumbers: string[] | undefined): string[] {
  if (Array.isArray(centerNumbers) && centerNumbers.length > 0) {
    return centerNumbers.map((n) => n.trim()).filter(Boolean);
  }
  if (phone) return [phone.trim()];
  return [];
}

export class AdmissionPlacesRepository {
  async create(clinicId: string, data: CreateAdmissionPlaceInput) {
    const { insuranceIds, centerNumbers, phone, ...placeData } = data;
    const numbers = normalizeCenterNumbers(phone, centerNumbers);

    return prisma.$transaction(async (tx) => {
      const place = await tx.admissionPlace.create({
        data: {
          ...placeData,
          clinicId,
          phone: numbers[0] ?? null,
          centerNumbers: numbers,
        },
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
    const { insuranceIds, centerNumbers, phone, ...placeData } = data;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.admissionPlace.findFirst({
        where: { id, clinicId, deletedAt: null },
      });
      if (!existing) return null;

      const phoneProvided = phone !== undefined;
      const numbers = normalizeCenterNumbers(
        phoneProvided ? phone : existing.phone,
        centerNumbers !== undefined ? centerNumbers : existing.centerNumbers
      );

      const place = await tx.admissionPlace.update({
        where: { id },
        data: {
          ...placeData,
          ...(phoneProvided ? { phone: numbers[0] ?? null } : {}),
          centerNumbers: numbers,
        },
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
