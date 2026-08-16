import { randomUUID } from 'node:crypto';
import { PatientFileType } from '@prisma/client';
import { FilesRepository } from './files.repository';
import { getStorageAdapter } from '../../integrations/storage/storage.adapter';
import { PatientsRepository } from '../patients/patients.repository';
import { NotFoundError, ForbiddenError } from '../../common/errors/custom.error';

export interface UploadFileParams {
  clinicId: string;
  patientId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  size: number;
}

export class FilesService {
  private filesRepo = new FilesRepository();
  private patientsRepo = new PatientsRepository();
  private storage = getStorageAdapter();

  private checkScope(patient: { admissionPlaceId: string | null }, userRole: string, scopes?: string[]) {
    if (userRole !== 'manager' && scopes && scopes.length > 0) {
      if (!patient.admissionPlaceId || !scopes.includes(patient.admissionPlaceId)) {
        throw new ForbiddenError('شما دسترسی به این بیمار را ندارید');
      }
    }
  }

  async upload(params: UploadFileParams, userRole: string, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(params.clinicId, params.patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);

    const type: PatientFileType = params.mimeType.startsWith('video/') ? 'video' : 'image';
    const key = `patients/${params.patientId}/${randomUUID()}`;
    const url = await this.storage.save(params.buffer, key, params.mimeType);

    return this.filesRepo.create({
      clinicId: params.clinicId,
      patientId: params.patientId,
      type,
      mimeType: params.mimeType,
      fileName: params.fileName,
      fileSize: params.size,
      url,
    });
  }

  async list(clinicId: string, patientId: string, userRole: string, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    return this.filesRepo.findByPatient(clinicId, patientId);
  }

  async remove(clinicId: string, id: string, userRole: string, scopes?: string[]) {
    const file = await this.filesRepo.findById(clinicId, id);
    if (!file) {
      throw new NotFoundError('فایل مورد نظر یافت نشد');
    }
    const patient = await this.patientsRepo.findById(clinicId, file.patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    await this.storage.delete(file.url);
    await this.filesRepo.delete(clinicId, id);
    return true;
  }
}
