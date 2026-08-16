import { z } from 'zod';
import { AppointmentStatus, AdmissionType } from '@prisma/client';

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1, 'نام کامل الزامی است'),
  nationalCode: z.string().min(1, 'کدملی الزامی است'),
  phone: z.string().min(1, 'شماره تماس الزامی است'),
  birthDate: z.string().transform((val) => new Date(val)),
  admissionType: z.nativeEnum(AdmissionType),
  admissionPlaceId: z.string().uuid().optional().nullable(),
  appointmentDate: z.string().transform((val) => new Date(val)),
  appointmentTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'ساعت نوبت باید به‌صورت HH:mm باشد')
    .optional()
    .nullable(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

export const updateAppointmentSchema = createAppointmentSchema.partial().extend({
  status: z.nativeEnum(AppointmentStatus).optional(),
});

export const getAppointmentsQuerySchema = z
  .object({
    dateFrom: z.string().transform((val) => new Date(val)).optional(),
    dateTo: z.string().transform((val) => new Date(val)).optional(),
    // فرانت از from/to/search/page/limit استفاده می‌کند
    from: z.string().transform((val) => new Date(val)).optional(),
    to: z.string().transform((val) => new Date(val)).optional(),
    search: z.string().optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    page: z.string().default('1').transform((v) => parseInt(v, 10)),
    limit: z.string().default('10').transform((v) => parseInt(v, 10)),
  })
  .transform((q) => ({ ...q, dateFrom: q.dateFrom ?? q.from, dateTo: q.dateTo ?? q.to }));

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type GetAppointmentsQuery = z.infer<typeof getAppointmentsQuerySchema>;
