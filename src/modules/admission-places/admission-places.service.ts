import { prisma } from '../../common/prisma/prisma.client';
import { AdmissionPlacesRepository } from './admission-places.repository';
import { CreateAdmissionPlaceInput, UpdateAdmissionPlaceInput } from './admission-places.schema';
import { NotFoundError, ValidationError } from '../../common/errors/custom.error';

export class AdmissionPlacesService {
  private repo = new AdmissionPlacesRepository();

  private async validateRefs(clinicId: string, insuranceIds?: string[]) {
    if (insuranceIds && insuranceIds.length > 0) {
      const count = await prisma.insurance.count({ where: { id: { in: insuranceIds }, clinicId } });
      if (count !== insuranceIds.length) {
        throw new ValidationError('یک یا چند بیمه انتخاب‌شده معتبر نیست');
      }
    }
  }

  async create(clinicId: string, data: CreateAdmissionPlaceInput) {
    await this.validateRefs(clinicId, data.insuranceIds);
    return this.repo.create(clinicId, data);
  }

  async getById(clinicId: string, id: string) {
    const place = await this.repo.findById(clinicId, id);
    if (!place) throw new NotFoundError('محل پذیرش مورد نظر یافت نشد');
    return place;
  }

  async list(clinicId: string, scopes?: string[]) {
    return this.repo.findAll(clinicId, scopes);
  }

  async update(clinicId: string, id: string, data: UpdateAdmissionPlaceInput) {
    await this.validateRefs(clinicId, data.insuranceIds);
    const updated = await this.repo.update(clinicId, id, data);
    if (!updated) throw new NotFoundError('محل پذیرش مورد نظر یافت نشد');
    return updated;
  }

  async delete(clinicId: string, id: string) {
    const removed = await this.repo.delete(clinicId, id);
    if (!removed) throw new NotFoundError('محل پذیرش مورد نظر یافت نشد');
    return removed;
  }
}
