import { FastifyReply, FastifyRequest } from 'fastify';
import { PatientsService } from './patients.service';
import { createPatientSchema, getPatientsQuerySchema, updatePatientSchema, updatePatientStatusSchema, insuranceApprovalSchema, attachPatientServiceSchema, patientServiceIdParamsSchema, AttachPatientServiceInput } from './patients.schema';
import { UserPayload } from '../../common/types';

export class PatientsController {
  private patientsService = new PatientsService();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, clinicId } = request.user as UserPayload;
    const body = createPatientSchema.parse(request.body);

    const patient = await this.patientsService.createPatient(clinicId, userId, body);
    return reply.status(201).send({ success: true, data: patient });
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const patient = await this.patientsService.getPatientById(clinicId, id, role, scopes);
    return reply.send({ success: true, data: patient });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const query = getPatientsQuerySchema.parse(request.query);

    const result = await this.patientsService.listPatients(clinicId, query, role, scopes);
    return reply.send({ success: true, data: result.items, meta: result.meta });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updatePatientSchema.parse(request.body);

    const patient = await this.patientsService.updatePatient(clinicId, id, body, role, scopes);
    return reply.send({ success: true, data: patient });
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId, role, scopes } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updatePatientStatusSchema.parse(request.body);

    const patient = await this.patientsService.updatePatientStatus(clinicId, id, body.status, userId, role, scopes);
    return reply.send({ success: true, data: patient });
  };

  addInsuranceApproval = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, userId, role, scopes } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = insuranceApprovalSchema.parse(request.body);

    const approval = await this.patientsService.addInsuranceApproval(clinicId, id, userId, body, role, scopes);
    return reply.send({ success: true, data: approval });
  };

  attachService = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id: patientId } = request.params as { id: string };
    const body = attachPatientServiceSchema.parse(request.body);

    const attached = await this.patientsService.attachPatientService(clinicId, patientId, body, role, scopes);
    return reply.status(201).send({ success: true, data: attached });
  };

  listServices = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id: patientId } = request.params as { id: string };

    const services = await this.patientsService.listPatientServices(clinicId, patientId, role, scopes);
    return reply.send({ success: true, data: services });
  };

  removeService = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId, role, scopes } = request.user as UserPayload;
    const { id } = patientServiceIdParamsSchema.parse(request.params);

    await this.patientsService.removePatientService(clinicId, id, role, scopes);
    return reply.send({ success: true, data: { message: 'خدمت با موفقیت حذف شد' } });
  };
}
