import { FastifyInstance } from 'fastify';
import { ExpensesController } from './expenses.controller';
import { authenticate, requireRole } from '../../common/middlewares/auth.middleware';

export async function expensesRoutes(app: FastifyInstance) {
  const controller = new ExpensesController();

  app.addHook('onRequest', authenticate);

  app.post('/daily', controller.createDaily);
  app.post('/company', controller.createCompany);
  app.get('/daily', controller.listDaily);
  app.get('/company', controller.listCompany);

  // لیست یکپارچه و مقایسه ماهانه
  app.get('/monthly-comparison', { preHandler: requireRole(['manager']) }, controller.monthlyComparison);
  app.get('/monthly-chart', { preHandler: requireRole(['manager']) }, controller.monthlyChart);
  app.get('/', controller.listUnified);
}
