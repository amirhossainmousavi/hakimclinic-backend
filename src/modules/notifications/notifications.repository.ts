import { prisma } from '../../common/prisma/prisma.client';
import { CreateNotificationInput } from './notifications.schema';

export class NotificationsRepository {
  // List notifications for a user — read from their own recipient record
  async findAll(clinicId: string, userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { clinicId },
      include: {
        createdBy: { select: { fullName: true } },
        admissionPlace: { select: { name: true } },
        recipients: {
          where: { userId },
          select: { readAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map(({ createdBy, admissionPlace, recipients, ...rest }) => ({
      ...rest,
      read: (recipients[0]?.readAt ?? null) !== null,
      createdByUserName: createdBy.fullName,
      admissionPlaceName: admissionPlace?.name ?? null,
    }));
  }

  // Create notification + recipient record for all clinic users (atomic)
  async create(clinicId: string, userId: string, data: CreateNotificationInput) {
    const users = await prisma.user.findMany({
      where: { clinicId, isActive: true },
      select: { id: true },
    });

    return prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          clinicId,
          message: data.message,
          createdByUserId: userId,
          admissionPlaceId: data.admissionPlaceId ?? null,
        },
      });

      await tx.notificationRecipient.createMany({
        data: users.map((u) => ({
          notificationId: notification.id,
          userId: u.id,
          // The sender's own copy is assumed read
          readAt: u.id === userId ? new Date() : null,
        })),
      });

      return tx.notification.findUnique({
        where: { id: notification.id },
        include: {
          createdBy: { select: { fullName: true } },
          admissionPlace: { select: { name: true } },
          recipients: {
            where: { userId },
            select: { readAt: true },
          },
        },
      });
    }).then((n) => {
      if (!n) return null;
      const { createdBy, admissionPlace, recipients, ...rest } = n;
      return {
        ...rest,
        read: (recipients[0]?.readAt ?? null) !== null,
        createdByUserName: createdBy.fullName,
        admissionPlaceName: admissionPlace?.name ?? null,
      };
    });
  }
}
