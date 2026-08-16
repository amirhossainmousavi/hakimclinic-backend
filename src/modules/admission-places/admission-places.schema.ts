import { z } from 'zod';
import { AdmissionPlaceType } from '@prisma/client';

export const createAdmissionPlaceSchema = z.object({
  name: z.string().min(1, 'نام محل پذیرش الزامی است'),
  address: z.string().min(1, 'آدرس محل پذیرش الزامی است'),
  description: z.string().optional().nullable(),
  admissionType: z.nativeEnum(AdmissionPlaceType),
  insuranceIds: z.array(z.string().uuid()).optional(),
});

export const updateAdmissionPlaceSchema = createAdmissionPlaceSchema.partial();

export const admissionPlaceParamsSchema = z.object({
  id: z.string().uuid('شناسه محل پذیرش نامعتبر است'),
});

export type CreateAdmissionPlaceInput = z.infer<typeof createAdmissionPlaceSchema>;
export type UpdateAdmissionPlaceInput = z.infer<typeof updateAdmissionPlaceSchema>;
