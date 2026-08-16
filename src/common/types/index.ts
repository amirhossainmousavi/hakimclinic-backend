import { Role, SecretaryPermissionKey } from '@prisma/client';

export interface UserPayload {
  sub: string;
  userId: string;
  clinicId: string;
  role: Role;
  /** IDs of admission places the secretary has access to (undefined for manager) */
  scopes?: string[];
  /** Panel permissions the secretary can use (undefined for manager) */
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
