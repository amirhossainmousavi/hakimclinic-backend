import { FastifyInstance } from 'fastify';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function dashboardRoutes(app: FastifyInstance) {
  const controller = new DashboardController();

  app.addHook('onRequest', authenticate);

  app.get('/summary', controller.summary);
}
