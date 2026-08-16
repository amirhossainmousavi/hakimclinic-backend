import { FastifyInstance } from 'fastify';
import { AdmissionPlacesController } from './admission-places.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function admissionPlacesRoutes(app: FastifyInstance) {
  const controller = new AdmissionPlacesController();

  app.addHook('onRequest', authenticate);

  // Listing for all roles (secretary only sees their own accessible places)
  app.get('/', controller.list);

  // Mutations are manager-only
  app.post('/', { preHandler: requireRole(['manager']) }, controller.create);
  app.get('/:id', { preHandler: requireRole(['manager']) }, controller.getById);
  app.patch('/:id', { preHandler: requireRole(['manager']) }, controller.update);
  app.delete('/:id', { preHandler: requireRole(['manager']) }, controller.delete);
}
