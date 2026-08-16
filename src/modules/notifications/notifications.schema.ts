import { z } from 'zod';

export const createNotificationSchema = z.object({
  message: z.string().min(1, 'متن اطلاعیه الزامی است'),
  admissionPlaceId: z.string().uuid('شناسه محل پذیرش نامعتبر است').nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
