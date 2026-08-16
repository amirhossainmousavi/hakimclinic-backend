import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  app.post('/login', controller.login);
  app.post('/refresh', controller.refreshToken);
  app.post('/logout', { preHandler: [authenticate] }, controller.logout);
}
