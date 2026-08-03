import { HttpException } from '@nestjs/common';
import { AppError } from '../app-error.js';
import { isForwardable, readStructuredFields, remapStatus } from '../parse.js';

export type DownstreamBody = {
  statusCode: number;
  errorId: string;
  title: string;
  message: string;
};

export type DownstreamConfig = {
  /** Remap statuses when forwarding. Default: `{ 500: 503 }`. */
  remapStatus?: Partial<Record<number, number>>;
  /** Used when the body is not structured enough to forward. */
  fallback?: {
    errorId?: string;
    title?: string;
    message?: string;
  };
};

/** Read a downstream JSON error body into a forwardable payload. */
export function readDownstream(
  body: unknown,
  httpStatus: number,
  options: DownstreamConfig = {},
): DownstreamBody | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const fields = readStructuredFields(body as Record<string, unknown>);
  const statusCode = fields.statusCode ?? httpStatus;
  if (!isForwardable({ ...fields, statusCode })) return undefined;

  const remap = options.remapStatus ?? { 500: 503 };
  return {
    statusCode: remapStatus(statusCode, remap),
    errorId: fields.errorId!,
    title: fields.title!,
    message: fields.message!,
  };
}

/** Forwards a structured downstream error (after optional status remap). */
export class DownstreamError extends HttpException {
  readonly payload: DownstreamBody;

  constructor(payload: DownstreamBody) {
    super(
      {
        statusCode: payload.statusCode,
        errorId: payload.errorId,
        title: payload.title,
        message: payload.message,
      },
      payload.statusCode,
    );
    this.payload = payload;
  }

  static fromBody(
    body: unknown,
    httpStatus: number,
    options: DownstreamConfig = {},
  ): DownstreamError {
    const parsed = readDownstream(body, httpStatus, options);
    if (parsed) return new DownstreamError(parsed);

    const remap = options.remapStatus ?? { 500: 503 };
    const statusCode = remapStatus(
      httpStatus >= 400 ? httpStatus : 503,
      remap,
    );
    const fallback = options.fallback ?? {};
    return new DownstreamError({
      statusCode,
      errorId: fallback.errorId ?? `DOWNSTREAM-${statusCode}-1`,
      title: fallback.title ?? 'Upstream service error',
      message:
        fallback.message ?? 'The upstream service returned an unexpected error.',
    });
  }

  toAppError(): AppError {
    return new AppError({
      status: this.payload.statusCode,
      errorId: this.payload.errorId,
      title: this.payload.title,
      message: this.payload.message,
    });
  }
}
