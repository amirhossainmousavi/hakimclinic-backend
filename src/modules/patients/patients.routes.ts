import { FastifyInstance } from 'fastify';
import { PatientsController } from './patients.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function patientsRoutes(app: FastifyInstance) {
  const controller = new PatientsController();

  app.addHook('onRequest', authenticate);

  app.post('/', controller.create);
  app.get('/', controller.list);
  app.get('/:id', controller.getById);
  app.patch('/:id', controller.update);
  app.patch('/:id/status', controller.updateStatus);
  app.post('/:id/insurance-approval', controller.addInsuranceApproval);
  app.post('/:id/services', controller.attachService);
  app.get('/:id/services', controller.listServices);
  app.delete('/services/:id', controller.removeService);
}
