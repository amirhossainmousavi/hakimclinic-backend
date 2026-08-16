import { prisma } from '../../common/prisma/prisma.client';

export class AuthRepository {
  async findUserByNationalCodeAndPhone(nationalCode: string, phone: string) {
    return prisma.user.findFirst({
      where: {
        nationalCode,
        phone,
        isActive: true,
      },
      include: {
        secretaryScopes: true,
        secretaryPermissions: true,
      },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        secretaryScopes: true,
        secretaryPermissions: true,
      },
    });
  }

  async saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findRefreshToken(userId: string, tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        userId,
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
