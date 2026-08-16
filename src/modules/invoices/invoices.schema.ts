import { z } from 'zod';
import { InvoiceType, PaymentType } from '@prisma/client';

export const invoiceItemSchema = z.object({
  serviceId: z.string().uuid(),
  tariffId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
});

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  invoiceNumber: z.string().min(1).default(`INV-${Date.now()}`),
  invoiceType: z.nativeEnum(InvoiceType),
  paymentType: z.nativeEnum(PaymentType),
  discountTotal: z.number().min(0).default(0),
  prepaidAmount: z.number().min(0).default(0),
  description: z.string().optional().nullable(),
  serviceDate: z.coerce.date().optional().nullable(),
  iban: z.string().optional().nullable(),
  ibanNote: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, 'فاکتور باید حداقل شامل یک آیتم باشد'),
});

export const getInvoicesQuerySchema = z
  .object({
    search: z.string().optional(),
    patientId: z.string().uuid().optional(),
    type: z.nativeEnum(InvoiceType).optional(),
    // فرانت کلید invoiceType می‌فرستد (جایگزین type)
    invoiceType: z.nativeEnum(InvoiceType).optional(),
    page: z.string().default('1').transform((v) => parseInt(v, 10)),
    limit: z.string().default('10').transform((v) => parseInt(v, 10)),
  })
  .transform((q) => ({ ...q, invoiceType: q.invoiceType ?? q.type }));

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type GetInvoicesQuery = z.infer<typeof getInvoicesQuerySchema>;
