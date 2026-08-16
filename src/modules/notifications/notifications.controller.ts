import { FastifyReply, FastifyRequest } from 'fastify';
import { NotificationsRepository } from './notifications.repository';
import { createNotificationSchema } from './notifications.schema';
import { UserPayload } from '../../common/types';

export class NotificationsController {
  private notificationsRepo = new NotificationsRepository();

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const notifications = await this.notificationsRepo.findAll(clinicId, userId);
    return reply.send({ success: true, data: notifications });
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const body = createNotificationSchema.parse(request.body);
    const notification = await this.notificationsRepo.create(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: notification });
  };
}
