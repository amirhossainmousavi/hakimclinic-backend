import { FastifyInstance } from 'fastify';
import { InsurancesController } from './insurances.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function insurancesRoutes(app: FastifyInstance) {
  const controller = new InsurancesController();

  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireRole(['manager']));

  app.post('/', controller.create);
  app.get('/', controller.list);
  app.patch('/:id/approve', controller.approve);
  app.delete('/:id', controller.delete);
}
