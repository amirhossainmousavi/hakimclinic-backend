import { prisma } from '../../common/prisma/prisma.client';
import { CreateAppointmentInput, GetAppointmentsQuery, UpdateAppointmentInput } from './appointments.schema';
import { AppointmentStatus } from '@prisma/client';

export class AppointmentsRepository {
  async create(clinicId: string, userId: string, data: CreateAppointmentInput) {
    return prisma.appointment.create({
      data: {
        ...data,
        clinicId,
        createdByUserId: userId,
      },
    });
  }

  async findAll(clinicId: string, query: GetAppointmentsQuery) {
    const { dateFrom, dateTo, status, search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { clinicId };

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.appointmentDate = {};
      if (dateFrom) where.appointmentDate.gte = dateFrom;
      if (dateTo) where.appointmentDate.lte = dateTo;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { nationalCode: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appointmentDate: 'asc' },
        include: {
          patient: { select: { fullName: true, fileNumber: true } },
          admissionPlace: { select: { id: true, name: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    const flatItems = items.map(({ admissionPlace, ...rest }) => ({
      ...rest,
      admissionPlaceName: admissionPlace?.name ?? null,
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

  async update(clinicId: string, id: string, data: UpdateAppointmentInput) {
    const existing = await prisma.appointment.findFirst({
      where: { id, clinicId },
    });
    if (!existing) return null;

    // فیلدهای اطلاعات بیمار که به رکورد Patient متصل هم اعمال می‌شوند
    const patientFields = ['fullName', 'nationalCode', 'phone', 'birthDate', 'admissionPlaceId'] as const;
    const patientUpdate: Record<string, unknown> = {};
    for (const field of patientFields) {
      if (data[field] !== undefined) patientUpdate[field] = data[field];
    }

    return prisma.$transaction(async (tx) => {
      if (existing.patientId && Object.keys(patientUpdate).length > 0) {
        await tx.patient.updateMany({
          where: { id: existing.patientId, clinicId },
          data: patientUpdate,
        });
      }

      return tx.appointment.update({
        where: { id },
        data: { ...data, updatedAt: new Date() },
      });
    });
  }

  async updateStatus(clinicId: string, id: string, status: AppointmentStatus) {
    return prisma.appointment.updateMany({
      where: { id, clinicId },
      data: { status, updatedAt: new Date() },
    });
  }

  async delete(clinicId: string, id: string) {
    return prisma.appointment.deleteMany({
      where: { id, clinicId },
    });
  }
}
