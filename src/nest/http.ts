import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError, isAppError } from '../app-error.js';

/** HttpException that preserves structured AppError fields for OutputFilter. */
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

/** Adapt an AppError (or Error) into a Nest HttpException. */
export function toHttp(error: AppError | unknown): HttpException {
  if (error instanceof HttpException) return error;
  if (isAppError(error)) return new AppHttpException(error);
  if (error instanceof Error) {
    return new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}
