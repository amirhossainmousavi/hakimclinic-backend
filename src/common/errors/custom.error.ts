export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'منبع مورد نظر یافت نشد', code = 'NOT_FOUND', details = null) {
    super(message, 404, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'اطلاعات ورودی نامعتبر است', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'احراز هویت انجام نشده است', code = 'UNAUTHORIZED', details = null) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'شما دسترسی به این عملیات را ندارید', code = 'FORBIDDEN', details = null) {
    super(message, 403, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'اطلاعات وارد شده تکراری یا در تعارض است', code = 'CONFLICT', details = null) {
    super(message, 409, code, details);
  }
}
