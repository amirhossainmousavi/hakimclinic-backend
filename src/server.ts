import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import Redis from 'ioredis';
import { env } from './config/env';
import { prisma } from './common/prisma/prisma.client';
import { errorHandler } from './common/errors/error-handler';
import { authRoutes } from './modules/auth/auth.routes';
import { patientsRoutes } from './modules/patients/patients.routes';
import { servicesRoutes } from './modules/services/services.routes';
import { tariffsRoutes } from './modules/tariffs/tariffs.routes';
import { invoicesRoutes } from './modules/invoices/invoices.routes';
import { appointmentsRoutes } from './modules/appointments/appointments.routes';
import { expensesRoutes } from './modules/expenses/expenses.routes';
import { secretariesRoutes } from './modules/secretaries/secretaries.routes';
import { admissionPlacesRoutes } from './modules/admission-places/admission-places.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { filesRoutes } from './modules/files/files.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { insurancesRoutes } from './modules/insurances/insurances.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function bootstrap() {
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.register(multipart);
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.setErrorHandler(errorHandler);

  // Protect uploaded files: require a valid access token.
  // <img>/<video> tags cannot send an Authorization header, so the token is
  // passed via the `token` query parameter (short-lived access token only).
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/uploads/')) return;
    if (request.method === 'OPTIONS') return;
    const token = (request.query as Record<string, string | undefined> | undefined)?.token;
    if (!token) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'توکن لازم است', details: null },
      });
    }
    try {
      await app.jwt.verify(token);
    } catch {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'توکن نامعتبر است', details: null },
      });
    }
  });

  // Static files (uploaded images/videos)
  const uploadsDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await app.register(fastifyStatic, { root: uploadsDir, prefix: '/uploads/' });

  // Health check (backend + database + redis)
  app.get('/health', async (request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};
    let healthy = true;

    // Database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    // Redis (probe only; used by BullMQ queues in the future)
    let redis: Redis | null = null;
    try {
      redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      await redis.connect();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
      if (pong !== 'PONG') healthy = false;
    } catch {
      checks.redis = 'error';
      healthy = false;
    } finally {
      if (redis) {
        try {
          redis.disconnect();
        } catch {
          /* noop */
        }
      }
    }

    if (!healthy) {
      return reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
    return { status: 'ok', timestamp: new Date().toISOString(), checks };
  });

  // API Routes v1
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(patientsRoutes, { prefix: '/api/v1/patients' });
  await app.register(servicesRoutes, { prefix: '/api/v1/services' });
  await app.register(tariffsRoutes, { prefix: '/api/v1/tariffs' });
  await app.register(invoicesRoutes, { prefix: '/api/v1/invoices' });
  await app.register(appointmentsRoutes, { prefix: '/api/v1/appointments' });
  await app.register(expensesRoutes, { prefix: '/api/v1/expenses' });
  await app.register(secretariesRoutes, { prefix: '/api/v1/secretaries' });
  await app.register(admissionPlacesRoutes, { prefix: '/api/v1/admission-places' });
  await app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  await app.register(filesRoutes, { prefix: '/api/v1' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(insurancesRoutes, { prefix: '/api/v1/insurances' });
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
