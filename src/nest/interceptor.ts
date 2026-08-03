import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import type { Api, SuccessEnvelope } from '../create-api.js';
import { OUTPUT_API } from './api.js';
import { OK_MESSAGE_KEY, type OkMessages } from './ok-message.js';

@Injectable()
export class OutputInterceptor implements NestInterceptor {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(OUTPUT_API) private readonly api: Api,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessEnvelope> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ url?: string; method?: string }>();

    const messages = this.reflector.getAllAndOverride<OkMessages | undefined>(
      OK_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        const res = http.getResponse() as { statusCode?: number };
        const statusCode =
          typeof res.statusCode === 'number' ? res.statusCode : 200;

        return this.api.success(data, {
          statusCode,
          message: resolveOkMessage(messages, statusCode),
          path: request.url,
          method: request.method,
        });
      }),
    );
  }
}

function resolveOkMessage(
  messages: OkMessages | undefined,
  statusCode: number,
): string | undefined {
  if (messages === undefined) return undefined;
  if (typeof messages === 'string') return messages;
  return messages[statusCode];
}
