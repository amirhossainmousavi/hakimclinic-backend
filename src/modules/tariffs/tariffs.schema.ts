import { z } from 'zod';

export const createTariffSchema = z.object({
  itemCode: z.string().min(1, 'کد قطعه الزامی است'),
  itemDescription: z.string().min(1, 'توضیحات قطعه الزامی است'),
  price: z.number().min(0),
  description: z.string().optional().nullable(),
});

export const updateTariffSchema = createTariffSchema.partial();

export const getTariffsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().default('1').transform((v) => parseInt(v, 10)),
  limit: z.string().default('10').transform((v) => parseInt(v, 10)),
});

export type CreateTariffInput = z.infer<typeof createTariffSchema>;
export type UpdateTariffInput = z.infer<typeof updateTariffSchema>;
export type GetTariffsQuery = z.infer<typeof getTariffsQuerySchema>;
