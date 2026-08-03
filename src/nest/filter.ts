import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import type { Api, FailureEnvelope } from '../create-api.js';
import { AppError, isAppError } from '../app-error.js';
import { DownstreamError } from './downstream.js';
import { AppHttpException } from './http.js';
import { OUTPUT_API } from './api.js';

type Req = { url?: string; method?: string };
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => unknown;
};

function fromHttpException(exception: HttpException): unknown {
  if (exception instanceof DownstreamError) return exception.toAppError();
  if (exception instanceof AppHttpException) return exception.appError;

  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { statusCode: status, message: response };
  }

  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (
      typeof obj.errorId === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.message === 'string'
    ) {
      return new AppError({
        status: typeof obj.statusCode === 'number' ? obj.statusCode : status,
        errorId: obj.errorId,
        title: obj.title,
        message: obj.message,
      });
    }

    const message = Array.isArray(obj.message)
      ? obj.message.join(', ')
      : typeof obj.message === 'string'
        ? obj.message
        : exception.message;

    return {
      statusCode: typeof obj.statusCode === 'number' ? obj.statusCode : status,
      message,
      title: typeof obj.title === 'string' ? obj.title : undefined,
      errorId: typeof obj.errorId === 'string' ? obj.errorId : undefined,
    };
  }

  return { statusCode: status, message: exception.message };
}

function isCatalogThrow(exception: unknown): boolean {
  return (
    isAppError(exception) ||
    exception instanceof AppHttpException ||
    exception instanceof DownstreamError
  );
}

@Catch()
export class OutputFilter implements ExceptionFilter {
  private readonly nestLogger = new Logger(OutputFilter.name);

  constructor(@Inject(OUTPUT_API) private readonly api: Api) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Res>();
    const request = ctx.getRequest<Req>();

    if (!isCatalogThrow(exception)) {
      if (exception instanceof Error) {
        this.nestLogger.error(exception.message, exception.stack);
      } else {
        this.nestLogger.error(String(exception));
      }
    }

    const source =
      exception instanceof HttpException
        ? fromHttpException(exception)
        : isAppError(exception)
          ? exception
          : exception;

    const envelope: FailureEnvelope = this.api.failure(source, {
      path: request.url,
      method: request.method,
    });

    response.status(envelope.statusCode).json(envelope);
  }
}
