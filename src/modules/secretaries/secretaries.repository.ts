import { prisma } from '../../common/prisma/prisma.client';
import bcrypt from 'bcryptjs';
import {
  CreateSecretaryInput,
  DEFAULT_SECRETARY_PERMISSIONS,
  UpdateSecretaryInput,
} from './secretaries.schema';
import { SecretaryPermissionKey } from '@prisma/client';
import { ConflictError } from '../../common/errors/custom.error';

const includeRelations = {
  secretaryScopes: { include: { place: { select: { id: true, name: true } } } },
  secretaryPermissions: true,
} as const;

export class SecretariesRepository {
  async create(clinicId: string, data: CreateSecretaryInput) {
    const existing = await prisma.user.findFirst({
      where: { clinicId, nationalCode: data.nationalCode },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('این کدملی قبلاً برای کاربر دیگری ثبت شده است', 'DUPLICATE_NATIONAL_CODE');
    }
    const passwordHash = await bcrypt.hash(data.phone, 10); // Initial password is phone
    const permissions = data.permissions ?? DEFAULT_SECRETARY_PERMISSIONS;
    return prisma.user.create({
      data: {
        fullName: data.fullName,
        nationalCode: data.nationalCode,
        phone: data.phone,
        clinicId,
        passwordHash,
        role: 'secretary',
        secretaryScopes: data.workplaceIds?.length
          ? { create: data.workplaceIds.map((placeId) => ({ placeId })) }
          : undefined,
        secretaryPermissions: {
          create: permissions.map((permissionKey) => ({ permissionKey })),
        },
      },
      include: includeRelations,
    });
  }

  async list(clinicId: string) {
    return prisma.user.findMany({
      where: { clinicId, role: 'secretary' },
      include: includeRelations,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, clinicId: string) {
    return prisma.user.findFirst({
      where: { id, clinicId, role: 'secretary' },
      include: includeRelations,
    });
  }

  async update(id: string, data: UpdateSecretaryInput) {
    return prisma.user.update({
      where: { id },
      data,
      include: includeRelations,
    });
  }

  async setActive(id: string, isActive: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      include: includeRelations,
    });
  }

  async updateWorkplaces(id: string, workplaceIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.secretaryWorkplace.deleteMany({ where: { userId: id } });
      if (workplaceIds.length > 0) {
        await tx.secretaryWorkplace.createMany({
          data: workplaceIds.map((placeId) => ({ userId: id, placeId })),
        });
      }
      return tx.user.findUnique({
        where: { id },
        include: {
          secretaryScopes: { include: { place: { select: { id: true, name: true } } } },
          secretaryPermissions: true,
        },
      });
    });
  }

  async updatePermissions(id: string, permissions: SecretaryPermissionKey[]) {
    return prisma.$transaction(async (tx) => {
      await tx.secretaryPermission.deleteMany({ where: { userId: id } });
      if (permissions.length > 0) {
        await tx.secretaryPermission.createMany({
          data: permissions.map((permissionKey) => ({ userId: id, permissionKey })),
        });
      }
      return tx.user.findUnique({
        where: { id },
        include: {
          secretaryScopes: { include: { place: { select: { id: true, name: true } } } },
          secretaryPermissions: true,
        },
      });
    });
  }

  async delete(id: string, clinicId: string) {
    return prisma.user.deleteMany({
      where: { id, clinicId, role: 'secretary' },
    });
  }
}
