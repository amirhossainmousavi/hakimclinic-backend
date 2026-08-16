import { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/custom.error';
import { UserPayload } from '../types';
import { prisma } from '../prisma/prisma.client';

export async function authenticate(request: FastifyRequest) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new UnauthorizedError('توکن معتبر نیست یا منقضی شده است');
  }

  // Fill scopes for secretaries from the database (manager has no place restrictions)
  const user = request.user as UserPayload;
  if (user.role !== 'manager') {
    const rows = await prisma.secretaryWorkplace.findMany({
      where: { userId: user.userId },
      select: { placeId: true },
    });
    user.scopes = rows.map((r) => r.placeId);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }

    const { role } = request.user as UserPayload;
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError('شما سطح دسترسی لازم برای این عملیات را ندارید');
    }
  };
}

export async function tenantScope(request: FastifyRequest) {
  const user = request.user as unknown as UserPayload | undefined;
  if (!user?.clinicId) {
    throw new UnauthorizedError('شناسه کلینیک یافت نشد');
  }
}
