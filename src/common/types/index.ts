import { Role, SecretaryPermissionKey } from '@prisma/client';

export interface UserPayload {
  sub: string;
  userId: string;
  clinicId: string;
  role: Role;
  /** آیدی محل‌های پذیرش که منشی به آن‌ها دسترسی دارد (برای manager undefined است) */
  scopes?: string[];
  /** دسترسی‌های پنل که منشی می‌تواند استفاده کند (برای manager undefined است) */
  permissions?: SecretaryPermissionKey[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload;
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
