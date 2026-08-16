import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './custom.error';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    const formattedDetails = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'اطلاعات ورودی نامعتبر است',
        details: formattedDetails,
      },
    });
  }

  // Foreign key violation error (deleting a record that is still referenced)
  const code = (error as any)?.code;
  if (code === 'P2003' || code === 'P2014') {
    request.log.error(error);
    return reply.status(409).send({
      success: false,
      error: {
        code: 'REFERENCE_CONSTRAINT',
        message: 'این مورد در جای دیگری استفاده شده و امکان حذف آن وجود ندارد',
        details: null,
      },
    });
  }

  // Unique key violation error (national code, phone number, service code, etc. already registered)
  if (code === 'P2002') {
    request.log.error(error);
    return reply.status(409).send({
      success: false,
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'این اطلاعات قبلاً ثبت شده است',
        details: null,
      },
    });
  }

  request.log.error(error);

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'خطای داخلی سرور رخ داده است',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    },
  });
}
