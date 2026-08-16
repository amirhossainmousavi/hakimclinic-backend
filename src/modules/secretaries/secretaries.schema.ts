import { z } from 'zod';
import { SecretaryPermissionKey } from '@prisma/client';

/** Default permissions for each secretary — applied unless the manager specifies otherwise */
export const DEFAULT_SECRETARY_PERMISSIONS: SecretaryPermissionKey[] = [
  SecretaryPermissionKey.dashboard,
  SecretaryPermissionKey.patients,
  SecretaryPermissionKey.invoices,
];

export const createSecretarySchema = z.object({
  fullName: z.string().min(1, 'نام کامل الزامی است'),
  nationalCode: z.string().min(1, 'کدملی الزامی است'),
  phone: z.string().min(1, 'شماره تماس الزامی است'),
  workplaceIds: z.array(z.string().uuid('شناسه محل پذیرش نامعتبر است')).optional(),
  permissions: z.array(z.nativeEnum(SecretaryPermissionKey)).optional(),
});

export const updateSecretarySchema = z.object({
  fullName: z.string().min(1, 'نام کامل الزامی است').optional(),
  nationalCode: z.string().min(1, 'کدملی الزامی است').optional(),
  phone: z.string().min(1, 'شماره تماس الزامی است').optional(),
});

export const updateSecretaryWorkplacesSchema = z.object({
  workplaceIds: z.array(z.string().uuid('شناسه محل پذیرش نامعتبر است')),
});

export const updateSecretaryPermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(SecretaryPermissionKey)),
});

export const setSecretaryActiveSchema = z.object({
  isActive: z.boolean(),
});

export type CreateSecretaryInput = z.infer<typeof createSecretarySchema>;
export type UpdateSecretaryInput = z.infer<typeof updateSecretarySchema>;
export type UpdateSecretaryWorkplacesInput = z.infer<typeof updateSecretaryWorkplacesSchema>;
export type UpdateSecretaryPermissionsInput = z.infer<typeof updateSecretaryPermissionsSchema>;
export type SetSecretaryActiveInput = z.infer<typeof setSecretaryActiveSchema>;
