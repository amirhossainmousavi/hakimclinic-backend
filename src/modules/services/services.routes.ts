import { FastifyInstance } from 'fastify';
import { ServicesController } from './services.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function servicesRoutes(app: FastifyInstance) {
  const controller = new ServicesController();

  app.addHook('onRequest', authenticate);

  app.get('/', controller.list);
  app.post('/', { preHandler: [requireRole(['manager'])] }, controller.create);
  app.patch('/:id', { preHandler: [requireRole(['manager'])] }, controller.update);
  app.delete('/:id', { preHandler: [requireRole(['manager'])] }, controller.delete);
}
