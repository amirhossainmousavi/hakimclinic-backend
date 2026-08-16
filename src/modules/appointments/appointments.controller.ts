import { FastifyReply, FastifyRequest } from 'fastify';
import { AppointmentsRepository } from './appointments.repository';
import { createAppointmentSchema, getAppointmentsQuerySchema, updateAppointmentSchema, updateAppointmentStatusSchema } from './appointments.schema';
import { UserPayload } from '../../common/types';
import { NotFoundError } from '../../common/errors/custom.error';

export class AppointmentsController {
  private appointmentsRepo = new AppointmentsRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId } = request.user as UserPayload;
    const body = createAppointmentSchema.parse(request.body);

    const appointment = await this.appointmentsRepo.create(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: appointment });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const query = getAppointmentsQuerySchema.parse(request.query);

    const result = await this.appointmentsRepo.findAll(clinicId, query);
    return reply.send({ success: true, data: result.items, meta: result.meta });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateAppointmentSchema.parse(request.body);

    const updated = await this.appointmentsRepo.update(clinicId, id, body);
    if (!updated) throw new NotFoundError('نوبت مورد نظر یافت نشد');

    return reply.send({ success: true, data: updated });
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateAppointmentStatusSchema.parse(request.body);

    const updated = await this.appointmentsRepo.updateStatus(clinicId, id, body.status);
    if (updated.count === 0) throw new NotFoundError('نوبت مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'وضعیت نوبت به‌روزرسانی شد' } });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const deleted = await this.appointmentsRepo.delete(clinicId, id);
    if (deleted.count === 0) throw new NotFoundError('نوبت مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'نوبت با موفقیت حذف شد' } });
  };
}
