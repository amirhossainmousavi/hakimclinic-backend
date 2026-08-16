import { FastifyReply, FastifyRequest } from 'fastify';
import { InsurancesRepository } from './insurances.repository';
import { createInsuranceSchema, insuranceParamsSchema } from './insurances.schema';
import { UserPayload } from '../../common/types';
import { NotFoundError } from '../../common/errors/custom.error';

export class InsurancesController {
  private insurancesRepo = new InsurancesRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createInsuranceSchema.parse(request.body);
    const insurance = await this.insurancesRepo.create(clinicId, body);
    return reply.status(201).send({ success: true, data: insurance });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const insurances = await this.insurancesRepo.findAll(clinicId);
    return reply.send({ success: true, data: insurances });
  };

  approve = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = insuranceParamsSchema.parse(request.params);

    const approved = await this.insurancesRepo.approve(clinicId, id);
    if (approved.count === 0) throw new NotFoundError('بیمه مورد نظر یافت نشد');

    const insurance = await this.insurancesRepo.findById(clinicId, id);
    return reply.send({ success: true, data: insurance });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = insuranceParamsSchema.parse(request.params);

    const deleted = await this.insurancesRepo.delete(clinicId, id);
    if (deleted.count === 0) throw new NotFoundError('بیمه مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'بیمه با موفقیت حذف شد' } });
  };
}
