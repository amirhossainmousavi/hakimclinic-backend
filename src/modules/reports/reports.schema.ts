import { z } from 'zod';

export const getRevenueQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  paymentType: z.enum(['pos', 'card_to_card', 'bank_transfer']).optional(),
  admissionPlaceId: z.string().uuid().optional(),
});

export type GetRevenueQuery = z.infer<typeof getRevenueQuerySchema>;
