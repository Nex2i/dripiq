class BaseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends BaseError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class ConflictError extends BaseError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class BadRequestError extends BaseError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationError extends ForbiddenError {
  constructor(message = 'Validation Error') {
    super(message);
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message = 'Service Unavailable') {
    super(message, 503);
  }
}
