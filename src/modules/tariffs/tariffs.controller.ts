import { FastifyReply, FastifyRequest } from 'fastify';
import { TariffsRepository } from './tariffs.repository';
import { createTariffSchema, getTariffsQuerySchema, updateTariffSchema } from './tariffs.schema';
import { UserPayload } from '../../common/types';
import { NotFoundError } from '../../common/errors/custom.error';

export class TariffsController {
  private tariffsRepo = new TariffsRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createTariffSchema.parse(request.body);
    const tariff = await this.tariffsRepo.create(clinicId, body);
    return reply.status(201).send({ success: true, data: tariff });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getTariffsQuerySchema.parse(request.query);
    const result = await this.tariffsRepo.findAll(clinicId, query);
    return reply.send({
      success: true,
      data: result.items,
      meta: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateTariffSchema.parse(request.body);

    const updated = await this.tariffsRepo.update(clinicId, id, body);
    if (updated.count === 0) throw new NotFoundError('تعرفه مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'تعرفه با موفقیت به‌روزرسانی شد' } });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const deleted = await this.tariffsRepo.delete(clinicId, id);
    if (deleted.count === 0) throw new NotFoundError('تعرفه مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'تعرفه با موفقیت حذف شد' } });
  };
}
