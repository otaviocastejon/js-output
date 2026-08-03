import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import {
  createApi,
  type Api,
  type CreateApiOptions,
  type SuccessEnvelope,
} from '../api/create-api.js';
import { JS_OUTPUT_OPTIONS, type JsOutputModuleOptions } from './options.js';
import {
  SUCCESS_MESSAGES_METADATA_KEY,
  type SuccessMessageMap,
} from './success-message.decorator.js';

@Injectable()
export class JsOutputTransformInterceptor implements NestInterceptor {
  private readonly api: Api;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
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

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ url?: string; method?: string }>();

    const messages = this.reflector.getAllAndOverride<SuccessMessageMap | undefined>(
      SUCCESS_MESSAGES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        const statusCode =
          typeof (http.getResponse() as { statusCode?: number }).statusCode === 'number'
            ? (http.getResponse() as { statusCode: number }).statusCode
            : 200;

        const message = resolveSuccessMessage(messages, statusCode);

        return this.api.success(data, {
          statusCode,
          message,
          path: request.url,
          method: request.method,
        });
      }),
    );
  }
}

function resolveSuccessMessage(
  messages: SuccessMessageMap | undefined,
  statusCode: number,
): string | undefined {
  if (messages === undefined) return undefined;
  if (typeof messages === 'string') return messages;
  return messages[statusCode];
}
