import { FastifyReply, FastifyRequest } from 'fastify';
import { SecretariesRepository } from './secretaries.repository';
import {
  createSecretarySchema,
  setSecretaryActiveSchema,
  updateSecretaryPermissionsSchema,
  updateSecretarySchema,
  updateSecretaryWorkplacesSchema,
} from './secretaries.schema';
import { UserPayload } from '../../common/types';
import { NotFoundError, ValidationError } from '../../common/errors/custom.error';

export class SecretariesController {
  private secretariesRepo = new SecretariesRepository();

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const body = createSecretarySchema.parse(request.body);

    const secretary = await this.secretariesRepo.create(clinicId, body);
    return reply.status(201).send({ success: true, data: secretary });
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const secretaries = await this.secretariesRepo.list(clinicId);
    return reply.send({ success: true, data: secretaries });
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateSecretarySchema.parse(request.body);

    const existing = await this.secretariesRepo.findById(id, clinicId);
    if (!existing) throw new NotFoundError('منشی مورد نظر یافت نشد');

    const updated = await this.secretariesRepo.update(id, body);
    return reply.send({ success: true, data: updated });
  };

  updateWorkplaces = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateSecretaryWorkplacesSchema.parse(request.body);

    const existing = await this.secretariesRepo.findById(id, clinicId);
    if (!existing) throw new NotFoundError('منشی مورد نظر یافت نشد');

    const updated = await this.secretariesRepo.updateWorkplaces(id, body.workplaceIds);
    return reply.send({ success: true, data: updated });
  };

  updatePermissions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = updateSecretaryPermissionsSchema.parse(request.body);

    const existing = await this.secretariesRepo.findById(id, clinicId);
    if (!existing) throw new NotFoundError('منشی مورد نظر یافت نشد');
    if (!existing.isActive) {
      throw new ValidationError('منشی غیرفعال است و نمی‌توان دسترسی‌های او را تغییر داد');
    }

    const updated = await this.secretariesRepo.updatePermissions(id, body.permissions);
    return reply.send({ success: true, data: updated });
  };

  setActive = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };
    const body = setSecretaryActiveSchema.parse(request.body);

    const existing = await this.secretariesRepo.findById(id, clinicId);
    if (!existing) throw new NotFoundError('منشی مورد نظر یافت نشد');

    const updated = await this.secretariesRepo.setActive(id, body.isActive);
    return reply.send({ success: true, data: updated });
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { clinicId } = request.user as UserPayload;
    const { id } = request.params as { id: string };

    const deleted = await this.secretariesRepo.delete(id, clinicId);
    if (deleted.count === 0) throw new NotFoundError('منشی مورد نظر یافت نشد');

    return reply.send({ success: true, data: { message: 'منشی با موفقیت حذف شد' } });
  };
}
