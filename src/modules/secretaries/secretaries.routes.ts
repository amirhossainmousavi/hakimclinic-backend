import { FastifyInstance } from 'fastify';
import { SecretariesController } from './secretaries.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function secretariesRoutes(app: FastifyInstance) {
  const controller = new SecretariesController();

  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireRole(['manager']));

  app.post('/', controller.create);
  app.get('/', controller.list);
  app.patch('/:id', controller.update);
  app.put('/:id/workplaces', controller.updateWorkplaces);
  app.put('/:id/permissions', controller.updatePermissions);
  app.patch('/:id/active', controller.setActive);
  app.delete('/:id', controller.delete);
}
