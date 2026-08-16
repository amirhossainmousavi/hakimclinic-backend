import { prisma } from '../../common/prisma/prisma.client';
import { CreatePatientInput, GetPatientsQuery, InsuranceApprovalInput, UpdatePatientInput, AttachPatientServiceInput } from './patients.schema';
import { PatientStatus } from '@prisma/client';

export class PatientsRepository {
  async create(clinicId: string, userId: string, data: CreatePatientInput) {
    const fileNumber = data.fileNumber || `PR-${Date.now()}`;
    const status: PatientStatus =
      data.admissionType === 'free' ? 'admitted' : 'pending_insurance_approval';

    // اعتبارسنجی خدمت‌ها و ثبت همزمان با بیمار (اتمیک)
    let serviceRows: Array<{ clinicId: string; serviceId: string; serviceDate: Date; unitPrice: number }> | undefined;
    if (data.services && data.services.length > 0) {
      const services = await prisma.service.findMany({
        where: { id: { in: data.services.map((s) => s.serviceId) }, clinicId },
      });
      if (services.length !== data.services.length) {
        return null;
      }
      serviceRows = data.services.map((s) => {
        const service = services.find((sv) => sv.id === s.serviceId)!;
        return {
          clinicId,
          serviceId: s.serviceId,
          serviceDate: s.serviceDate ?? new Date(),
          unitPrice: service.price,
        };
      });
    }

    const { services: _services, ...patientData } = data;

    return prisma.patient.create({
      data: {
        ...patientData,
        status,
        fileNumber,
        birthDate: data.birthDate ?? null,
        clinicId,
        admittedByUserId: userId,
        ...(serviceRows
          ? { patientServices: { create: serviceRows } }
          : {}),
      },
    });
  }

  async findById(clinicId: string, id: string) {
    const patient = await prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        admissionPlace: { select: { id: true, name: true } },
        insurance: true,
        admittedBy: { select: { id: true, fullName: true } },
        statusHistory: {
          include: { changedBy: { select: { id: true, fullName: true } } },
          orderBy: { changedAt: 'desc' },
        },
        insuranceApprovals: true,
        patientServices: {
          include: { service: true },
          orderBy: { serviceDate: 'desc' },
        },
      },
    });
    if (!patient) return null;

    const { admissionPlace, insurance, statusHistory, ...rest } = patient;
    return {
      ...rest,
      admissionPlaceName: admissionPlace?.name ?? null,
      insuranceName: insurance?.name ?? null,
      statusHistory: statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        changedAt: h.changedAt,
        changedByUserName: h.changedBy?.fullName ?? null,
      })),
    };
  }

  async findAll(clinicId: string, query: GetPatientsQuery, allowedScopes?: string[]) {
    const { search, status, placeId, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      clinicId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (placeId) {
      where.admissionPlaceId = placeId;
    }

    // Apply admission-place scopes if user is restricted
    if (allowedScopes && allowedScopes.length > 0) {
      where.admissionPlaceId = { in: allowedScopes };
    }

    if (search) {
      where.nationalCode = { contains: search };
    }

    const [items, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admissionPlace: { select: { id: true, name: true } },
          insurance: true,
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const flatItems = items.map(({ admissionPlace, insurance, ...rest }) => ({
      ...rest,
      admissionPlaceName: admissionPlace?.name ?? null,
      insuranceName: insurance?.name ?? null,
    }));

    return {
      items: flatItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(clinicId: string, id: string, data: UpdatePatientInput) {
    const { birthDate, ...rest } = data;
    const patient = await prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null },
    });
    if (!patient) return null;

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate !== undefined ? { birthDate } : {}),
      },
      include: {
        admissionPlace: { select: { id: true, name: true } },
        insurance: true,
        admittedBy: { select: { id: true, fullName: true } },
      },
    });

    const { admissionPlace, insurance, ...updatedRest } = updated;
    return {
      ...updatedRest,
      admissionPlaceName: admissionPlace?.name ?? null,
      insuranceName: insurance?.name ?? null,
    };
  }

  async updateStatus(clinicId: string, patientId: string, newStatus: PatientStatus, userId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null },
    });

    if (!patient) return null;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.patient.update({
        where: { id: patientId },
        data: { status: newStatus },
      });

      await tx.patientStatusHistory.create({
        data: {
          patientId,
          fromStatus: patient.status,
          toStatus: newStatus,
          changedByUserId: userId,
        },
      });

      return updated;
    });
  }

  async addInsuranceApproval(clinicId: string, patientId: string, userId: string, data: InsuranceApprovalInput) {
    return prisma.insuranceApproval.create({
      data: {
        patientId,
        receiptImageUrl: data.receiptImageUrl,
        approvalFileUrl: data.approvalFileUrl,
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });
  }

  async findServiceById(clinicId: string, id: string) {
    return prisma.patientService.findFirst({
      where: { id, clinicId },
    });
  }

  async attachService(clinicId: string, patientId: string, data: AttachPatientServiceInput) {
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, clinicId },
    });
    if (!service) return null;

    return prisma.patientService.create({
      data: {
        clinicId,
        patientId,
        serviceId: data.serviceId,
        serviceDate: data.serviceDate ?? new Date(),
        unitPrice: service.price,
      },
      include: { service: true },
    });
  }

  async listPatientServices(clinicId: string, patientId: string) {
    return prisma.patientService.findMany({
      where: { clinicId, patientId },
      include: { service: true },
      orderBy: { serviceDate: 'desc' },
    });
  }

  async removeService(clinicId: string, id: string) {
    const deleted = await prisma.patientService.deleteMany({
      where: { id, clinicId },
    });
    return deleted.count > 0;
  }
}
