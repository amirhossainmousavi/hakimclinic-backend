import { FastifyInstance } from 'fastify';
import { AppointmentsController } from './appointments.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function appointmentsRoutes(app: FastifyInstance) {
  const controller = new AppointmentsController();

  app.addHook('onRequest', authenticate);

  app.post('/', controller.create);
  app.get('/', controller.list);
  app.patch('/:id', controller.update);
  app.patch('/:id/status', controller.updateStatus);
  app.delete('/:id', controller.delete);
}
