import { HttpException } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';

export type DownstreamErrorPayload = {
  statusCode: number;
  errorId: string;
  title: string;
  message: string;
};

export type ParseDownstreamOptions = {
  /** Remap statuses when forwarding. Default: `{ 500: 503 }`. */
  remapStatus?: Partial<Record<number, number>>;
  /** Fallback when the body is not a structured error. */
  fallback?: {
    errorId?: string;
    title?: string;
    message?: string;
  };
};

function remapStatusCode(
  statusCode: number,
  remap: Partial<Record<number, number>>,
): number {
  return remap[statusCode] ?? statusCode;
}

/**
 * Parse a downstream JSON error body into a forwardable payload.
 * Returns undefined when the body is not structured enough to forward.
 */
export function parseDownstreamError(
  body: unknown,
  httpStatus: number,
  options: ParseDownstreamOptions = {},
): DownstreamErrorPayload | undefined {
  const remap = options.remapStatus ?? { 500: 503 };

  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const obj = body as Record<string, unknown>;
  const statusCode =
    typeof obj.statusCode === 'number'
      ? obj.statusCode
      : typeof obj.status === 'number'
        ? obj.status
        : httpStatus;
  const message = typeof obj.message === 'string' ? obj.message : undefined;
  const title = typeof obj.title === 'string' ? obj.title : undefined;
  const errorId =
    typeof obj.errorId === 'string'
      ? obj.errorId
      : typeof obj.id === 'string'
        ? obj.id
        : undefined;

  if (!message || !title || !errorId) {
    return undefined;
  }

  return {
    statusCode: remapStatusCode(statusCode, remap),
    errorId,
    title,
    message,
  };
}

/**
 * Forwards a structured downstream error to the client unchanged (after optional status remap).
 */
export class DownstreamHttpException extends HttpException {
  readonly payload: DownstreamErrorPayload;

  constructor(payload: DownstreamErrorPayload) {
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
    options: ParseDownstreamOptions = {},
  ): DownstreamHttpException {
    const parsed = parseDownstreamError(body, httpStatus, options);
    if (parsed) {
      return new DownstreamHttpException(parsed);
    }

    const remap = options.remapStatus ?? { 500: 503 };
    const statusCode = remapStatusCode(
      httpStatus >= 400 ? httpStatus : 503,
      remap,
    );
    const fallback = options.fallback ?? {};
    return new DownstreamHttpException({
      statusCode,
      errorId: fallback.errorId ?? `DOWNSTREAM-${statusCode}-1`,
      title: fallback.title ?? 'Upstream service error',
      message: fallback.message ?? 'The upstream service returned an unexpected error.',
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

export const DOWNSTREAM_DEFAULT_STATUS = 503;
