import { PatientsRepository } from './patients.repository';
import { CreatePatientInput, GetPatientsQuery, InsuranceApprovalInput, UpdatePatientInput, AttachPatientServiceInput } from './patients.schema';
import { NotFoundError, ForbiddenError } from '../../common/errors/custom.error';
import { PatientStatus, Role } from '@prisma/client';

export class PatientsService {
  private patientsRepo = new PatientsRepository();

  async createPatient(clinicId: string, userId: string, data: CreatePatientInput) {
    const patient = await this.patientsRepo.create(clinicId, userId, data);
    if (!patient) {
      throw new NotFoundError('خدمت مورد نظر یافت نشد');
    }
    return patient;
  }

  private checkScope(patient: { admissionPlaceId: string | null }, userRole: Role, scopes?: string[]) {
    if (userRole !== 'manager' && scopes && scopes.length > 0) {
      if (!patient.admissionPlaceId || !scopes.includes(patient.admissionPlaceId)) {
        throw new ForbiddenError('شما دسترسی به این بیمار را ندارید');
      }
    }
  }

  async getPatientById(clinicId: string, id: string, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, id);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }

    this.checkScope(patient, userRole, scopes);

    return patient;
  }

  async listPatients(clinicId: string, query: GetPatientsQuery, userRole: Role, scopes?: string[]) {
    let allowedScopes = scopes;
    if (userRole === 'manager') {
      allowedScopes = undefined; // Manager sees all
    }

    return this.patientsRepo.findAll(clinicId, query, allowedScopes);
  }

  async updatePatient(clinicId: string, id: string, data: UpdatePatientInput, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, id);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    const updated = await this.patientsRepo.update(clinicId, id, data);
    if (!updated) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    return updated;
  }

  async updatePatientStatus(clinicId: string, patientId: string, status: PatientStatus, userId: string, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    const updated = await this.patientsRepo.updateStatus(clinicId, patientId, status, userId);
    if (!updated) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    return updated;
  }

  async addInsuranceApproval(clinicId: string, patientId: string, userId: string, data: InsuranceApprovalInput, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    return this.patientsRepo.addInsuranceApproval(clinicId, patientId, userId, data);
  }

  async attachPatientService(clinicId: string, patientId: string, data: AttachPatientServiceInput, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    const attached = await this.patientsRepo.attachService(clinicId, patientId, data);
    if (!attached) {
      throw new NotFoundError('خدمت مورد نظر یافت نشد');
    }
    return attached;
  }

  async listPatientServices(clinicId: string, patientId: string, userRole: Role, scopes?: string[]) {
    const patient = await this.patientsRepo.findById(clinicId, patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    return this.patientsRepo.listPatientServices(clinicId, patientId);
  }

  async removePatientService(clinicId: string, id: string, userRole: Role, scopes?: string[]) {
    const patientService = await this.patientsRepo.findServiceById(clinicId, id);
    if (!patientService) {
      throw new NotFoundError('خدمت بیمار مورد نظر یافت نشد');
    }
    const patient = await this.patientsRepo.findById(clinicId, patientService.patientId);
    if (!patient) {
      throw new NotFoundError('بیمار مورد نظر یافت نشد');
    }
    this.checkScope(patient, userRole, scopes);
    const removed = await this.patientsRepo.removeService(clinicId, id);
    if (!removed) {
      throw new NotFoundError('خدمت بیمار مورد نظر یافت نشد');
    }
    return removed;
  }
}
