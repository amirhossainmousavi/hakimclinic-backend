import { z } from 'zod';

export const createDailyExpenseSchema = z.object({
  title: z.string().min(1, 'عنوان هزینه الزامی است'),
  amount: z.number().min(0, 'مبلغ باید معتبر باشد'),
  expenseDate: z.string().transform((val) => new Date(val)),
  admissionPlaceId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const createCompanyExpenseSchema = z.object({
  title: z.string().min(1, 'عنوان الزامی است'),
  companyName: z.string().min(1, 'نام شرکت الزامی است'),
  amount: z.number().min(0),
  invoiceDate: z.string().transform((val) => new Date(val)),
  partName: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1).optional(),
  unitAmount: z.number().min(0).optional(),
  description: z.string().optional().nullable(),
});

export const getExpensesQuerySchema = z.object({
  dateFrom: z.string().transform((val) => new Date(val)).optional(),
  dateTo: z.string().transform((val) => new Date(val)).optional(),
  admissionPlaceId: z.string().uuid().optional(),
});

// پارامترهای لیست یکپارچه /expenses (مطابق فرانت)
export const getUnifiedExpensesQuerySchema = z
  .object({
    search: z.string().optional(),
    type: z.enum(['daily', 'company']).optional(),
    from: z.string().transform((val) => new Date(val)).optional(),
    to: z.string().transform((val) => new Date(val)).optional(),
    admissionPlaceId: z.string().uuid().optional(),
    page: z.string().default('1').transform((v) => parseInt(v, 10)),
    limit: z.string().default('10').transform((v) => parseInt(v, 10)),
  })
  .transform((q) => q);

export const getMonthlyChartQuerySchema = z.object({
  admissionPlaceId: z.string().uuid().optional(),
});

export type CreateDailyExpenseInput = z.infer<typeof createDailyExpenseSchema>;
export type CreateCompanyExpenseInput = z.infer<typeof createCompanyExpenseSchema>;
export type GetExpensesQuery = z.infer<typeof getExpensesQuerySchema>;
export type GetUnifiedExpensesQuery = z.infer<typeof getUnifiedExpensesQuerySchema>;
export type GetMonthlyChartQuery = z.infer<typeof getMonthlyChartQuerySchema>;
