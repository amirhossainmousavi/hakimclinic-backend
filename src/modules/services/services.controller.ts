import { FastifyReply, FastifyRequest } from 'fastify';
import { ServicesRepository } from './services.repository';
import { createServiceSchema, getServicesQuerySchema, updateServiceSchema } from './services.schema';
import { UserPayload } from '../../common/types';
import { NotFoundError } from '../../common/errors/custom.error';

export class ServicesController {
  private servicesRepo = new ServicesRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createServiceSchema.parse(request.body);
    const service = await this.servicesRepo.create(clinicId, body);
    return reply.status(201).send({ success: true, data: service });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getServicesQuerySchema.parse(request.query);
    const result = await this.servicesRepo.findAll(clinicId, query);
    return reply.send({
      success: true,
      data: result.items,
      meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateServiceSchema.parse(request.body);

    const updated = await this.servicesRepo.update(clinicId, id, body);
    if (updated.count === 0) throw new NotFoundError('خدمت مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'خدمت با موفقیت به‌روزرسانی شد' } });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const deleted = await this.servicesRepo.delete(clinicId, id);
    if (deleted.count === 0) throw new NotFoundError('خدمت مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'خدمت با موفقیت حذف شد' } });
  };
}
