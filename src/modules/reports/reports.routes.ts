import { FastifyInstance } from 'fastify';
import { ReportsController } from './reports.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function reportsRoutes(app: FastifyInstance) {
  const controller = new ReportsController();

  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', requireRole(['manager']));

  app.get('/revenue', controller.revenue);
}
