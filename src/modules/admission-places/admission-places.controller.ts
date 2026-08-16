import { FastifyReply, FastifyRequest } from 'fastify';
import { AdmissionPlacesService } from './admission-places.service';
import {
  createAdmissionPlaceSchema,
  updateAdmissionPlaceSchema,
  admissionPlaceParamsSchema,
} from './admission-places.schema';
import { UserPayload } from '../../common/types';

export class AdmissionPlacesController {
  private service = new AdmissionPlacesService();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createAdmissionPlaceSchema.parse(request.body);
    const place = await this.service.create(clinicId, body);
    return reply.status(201).send({ success: true, data: place });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = admissionPlaceParamsSchema.parse(request.params);
    const place = await this.service.getById(clinicId, id);
    return reply.send({ success: true, data: place });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const places = await this.service.list(clinicId, role === 'manager' ? undefined : scopes);
    return reply.send({ success: true, data: places });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = admissionPlaceParamsSchema.parse(request.params);
    const body = updateAdmissionPlaceSchema.parse(request.body);
    const place = await this.service.update(clinicId, id, body);
    return reply.send({ success: true, data: place });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = admissionPlaceParamsSchema.parse(request.params);
    await this.service.delete(clinicId, id);
    return reply.send({ success: true, data: { message: 'محل پذیرش با موفقیت حذف شد' } });
  };
}
