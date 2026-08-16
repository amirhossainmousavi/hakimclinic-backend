import { FastifyInstance } from 'fastify';
import { FilesController } from './files.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

export async function filesRoutes(app: FastifyInstance) {
  const controller = new FilesController();

  app.addHook('onRequest', authenticate);

  app.post('/patients/:patientId/files', controller.upload);
  app.get('/patients/:patientId/files', controller.list);
  app.delete('/files/:id', controller.remove);
}
