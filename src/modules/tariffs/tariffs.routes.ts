import { FastifyInstance } from 'fastify';
import { TariffsController } from './tariffs.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function tariffsRoutes(app: FastifyInstance) {
  const controller = new TariffsController();

  app.addHook('onRequest', authenticate);

  app.get('/', controller.list);
  app.post('/', { preHandler: [requireRole(['manager'])] }, controller.create);
  app.patch('/:id', { preHandler: [requireRole(['manager'])] }, controller.update);
  app.delete('/:id', { preHandler: [requireRole(['manager'])] }, controller.delete);
}
