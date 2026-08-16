import { z } from 'zod';
import { ServiceType } from '@prisma/client';

export const createServiceSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  treatmentProcess: z.string().min(1, 'فرآیند درمان الزامی است'),
  serviceCode: z.string().min(1, 'کد خدمت الزامی است'),
  price: z.number().min(0, 'قیمت باید بزرگتر یا مساوی صفر باشد'),
  description: z.string().optional().nullable(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const getServicesQuerySchema = z.object({
  search: z.string().optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  page: z.string().default('1').transform((v) => parseInt(v, 10)),
  limit: z.string().default('10').transform((v) => parseInt(v, 10)),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type GetServicesQuery = z.infer<typeof getServicesQuerySchema>;
