import { z } from 'zod';

export const createInsuranceSchema = z.object({
  name: z.string().min(1, 'نام بیمه الزامی است'),
});

export const insuranceParamsSchema = z.object({
  id: z.string().uuid('شناسه بیمه نامعتبر است'),
});

export type CreateInsuranceInput = z.infer<typeof createInsuranceSchema>;
