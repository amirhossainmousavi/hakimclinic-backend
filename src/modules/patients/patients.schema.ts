import { z } from 'zod';
import { AdmissionType, PatientStatus } from '@prisma/client';

export const createPatientSchema = z.object({
  nationalCode: z.string().min(1, 'کدملی الزامی است'),
  fullName: z.string().min(1, 'نام کامل الزامی است'),
  phone: z.string().min(1, 'شماره تماس الزامی است'),
  birthDate: z.string().transform((val) => new Date(val)),
  fileNumber: z.string().min(1, 'شماره پرونده الزامی است').optional(),
  admissionPlaceId: z.string().uuid('شناسه محل پذیرش نامعتبر است').optional().nullable(),
  admissionType: z.nativeEnum(AdmissionType),
  insuranceId: z.string().uuid().optional().nullable(),
  suggestedDoctor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid('شناسه خدمت نامعتبر است'),
        serviceDate: z
          .string()
          .transform((val) => new Date(val))
          .optional(),
      })
    )
    .optional(),
});

export const updatePatientSchema = z.object({
  nationalCode: z.string().min(1, 'کدملی الزامی است').optional(),
  fullName: z.string().min(1, 'نام کامل الزامی است').optional(),
  phone: z.string().min(1, 'شماره تماس الزامی است').optional(),
  birthDate: z.string().transform((val) => new Date(val)).optional(),
  fileNumber: z.string().min(1, 'شماره پرونده الزامی است').optional(),
  admissionPlaceId: z.string().uuid('شناسه محل پذیرش نامعتبر است').optional().nullable(),
  admissionType: z.nativeEnum(AdmissionType).optional(),
  insuranceId: z.string().uuid().optional().nullable(),
  suggestedDoctor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(PatientStatus).optional(),
});

export const updatePatientStatusSchema = z.object({
  status: z.nativeEnum(PatientStatus),
});

export const insuranceApprovalSchema = z.object({
  receiptImageUrl: z.string().url('آدرس تصویر رسید نامعتبر است'),
  approvalFileUrl: z.string().url('آدرس فایل تاییدیه نامعتبر است').optional().nullable(),
});

export const getPatientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(PatientStatus).optional(),
  placeId: z.string().uuid().optional(),
  page: z.string().default('1').transform((v) => parseInt(v, 10)),
  limit: z.string().default('10').transform((v) => parseInt(v, 10)),
});

export const attachPatientServiceSchema = z.object({
  serviceId: z.string().uuid('شناسه خدمت نامعتبر است'),
  serviceDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
});

export const patientServiceParamsSchema = z.object({
  patientId: z.string().uuid('شناسه بیمار نامعتبر است'),
});

export const patientServiceIdParamsSchema = z.object({
  id: z.string().uuid('شناسه خدمت بیمار نامعتبر است'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientStatusInput = z.infer<typeof updatePatientStatusSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type InsuranceApprovalInput = z.infer<typeof insuranceApprovalSchema>;
export type GetPatientsQuery = z.infer<typeof getPatientsQuerySchema>;
export type AttachPatientServiceInput = z.infer<typeof attachPatientServiceSchema>;
