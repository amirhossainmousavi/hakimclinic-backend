import { FastifyInstance } from 'fastify';
import { AdmissionPlacesController } from './admission-places.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function admissionPlacesRoutes(app: FastifyInstance) {
  const controller = new AdmissionPlacesController();

  app.addHook('onRequest', authenticate);

  // لیست برای همه نقش‌ها (منشی فقط محل‌های دسترس خودش را می‌بیند)
  app.get('/', controller.list);

  // عملیات تغییر فقط برای مدیر
  app.post('/', { preHandler: requireRole(['manager']) }, controller.create);
  app.get('/:id', { preHandler: requireRole(['manager']) }, controller.getById);
  app.patch('/:id', { preHandler: requireRole(['manager']) }, controller.update);
  app.delete('/:id', { preHandler: requireRole(['manager']) }, controller.delete);
}
