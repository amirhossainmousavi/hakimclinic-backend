import { FastifyInstance } from 'fastify';
import { InvoicesController } from './invoices.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function invoicesRoutes(app: FastifyInstance) {
  const controller = new InvoicesController();

  app.addHook('onRequest', authenticate);

  app.post('/', controller.create);
  app.post('/pro-forma', controller.proForma);
  app.get('/', controller.list);
  app.get('/:id', controller.getById);
  app.get('/:id/pdf', controller.getPdf);
  app.delete('/:id', controller.delete);
}
