import { FastifyInstance } from 'fastify';
import { NotificationsController } from './notifications.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function notificationsRoutes(app: FastifyInstance) {
  const controller = new NotificationsController();

  app.addHook('onRequest', authenticate);

  // همه اعضا می‌توانند اطلاعیه‌ها را ببینند؛ فقط مدیر می‌تواند بسازد
  app.get('/', controller.list);
  app.post('/', { preHandler: requireRole(['manager']) }, controller.create);
}
