import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  createApi,
  type Api,
  type CreateApiOptions,
  type FailureEnvelope,
} from '../api/create-api.js';
import { AppError, isAppError } from '../errors/app-error.js';
import { DownstreamHttpException } from './downstream-http.exception.js';
import { JS_OUTPUT_OPTIONS, type JsOutputModuleOptions } from './options.js';
import { AppHttpException } from './to-http-exception.js';

type HttpRequestLike = { url?: string; method?: string };
type HttpResponseLike = {
  status: (code: number) => HttpResponseLike;
  json: (body: unknown) => unknown;
};

function httpExceptionToUnknown(exception: HttpException): unknown {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (exception instanceof DownstreamHttpException) {
    return exception.toAppError();
  }

  if (exception instanceof AppHttpException) {
    return exception.appError;
  }

  if (typeof response === 'string') {
    return {
      statusCode: status,
      message: response,
    };
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

  return {
    statusCode: status,
    message: exception.message,
  };
}

@Catch()
export class JsOutputExceptionFilter implements ExceptionFilter {
  private readonly api: Api;

  constructor(
    @Optional()
    @Inject(JS_OUTPUT_OPTIONS)
    options?: JsOutputModuleOptions,
  ) {
    const createOptions: CreateApiOptions = {
      preset: options?.preset ?? 'api',
      ...options?.api,
      unexpectedError: options?.unexpectedError ?? options?.api?.unexpectedError,
      downstream: options?.downstream ?? options?.api?.downstream,
      skipErrorIds: options?.skipErrorIds ?? options?.api?.skipErrorIds,
      onFailure: options?.onFailure ?? options?.api?.onFailure,
      logger: options?.logger ?? options?.api?.logger,
      service: options?.service ?? options?.api?.service,
      defaultSuccessMessage:
        options?.defaultSuccessMessage ?? options?.api?.defaultSuccessMessage,
    };
    this.api = createApi(createOptions);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();

    const source =
      exception instanceof HttpException
        ? httpExceptionToUnknown(exception)
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
