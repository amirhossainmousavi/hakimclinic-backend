import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z
  .object({
    PORT: z.string().default('3000').transform((v) => parseInt(v, 10)),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    DATABASE_URL: z.string(),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.string().default('6379').transform((v) => parseInt(v, 10)),
    REDIS_PASSWORD: z.string().optional().default(''),

    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET باید حداقل ۱۶ کاراکتر باشد'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET باید حداقل ۱۶ کاراکتر باشد'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    SMS_PROVIDER: z.enum(['kavenegar', 'melli_payamak', 'farapayamak', 'mock']).default('mock'),
    SMS_API_KEY: z.string().default('mock'),

    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      ),

    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('default'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET: z.string().default('clinic-panel-storage'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const insecureDefaults = [
        'access_secret_super_key_change_in_production_12345',
        'refresh_secret_super_key_change_in_production_12345',
      ];
      if (insecureDefaults.includes(env.JWT_ACCESS_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message: 'JWT_ACCESS_SECRET در production نباید مقدار پیش‌فرض باشد',
        });
      }
      if (insecureDefaults.includes(env.JWT_REFRESH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_REFRESH_SECRET'],
          message: 'JWT_REFRESH_SECRET در production نباید مقدار پیش‌فرض باشد',
        });
      }
    }
  });

export const env = envSchema.parse(process.env);
