import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError, isAppError } from '../errors/app-error.js';

/**
 * Adapt an AppError (or compatible value) into a Nest HttpException.
 * Response body stays minimal; the JsOutputExceptionFilter shapes the final envelope.
 */
export function toHttpException(error: AppError | unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  if (isAppError(error)) {
    return new HttpException(
      {
        statusCode: error.status,
        message: error.message,
        title: error.title,
        errorId: error.errorId,
      },
      error.status,
    );
  }

  if (error instanceof Error) {
    return new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}

/** HttpException subclass that preserves structured AppError fields. */
export class AppHttpException extends HttpException {
  readonly appError: AppError;

  constructor(error: AppError) {
    super(
      {
        statusCode: error.status,
        message: error.message,
        title: error.title,
        errorId: error.errorId,
      },
      error.status,
    );
    this.appError = error;
  }
}
