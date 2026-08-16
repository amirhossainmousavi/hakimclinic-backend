import { z } from 'zod';

export const loginSchema = z.object({
  nationalCode: z.string().min(1, 'کدملی الزامی است'),
  phone: z.string().min(1, 'شماره تماس الزامی است'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'رفرش توکن الزامی است'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
