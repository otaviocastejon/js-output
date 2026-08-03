import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { JsOutputExceptionFilter } from './exception.filter.js';
import { JS_OUTPUT_OPTIONS, type JsOutputModuleOptions } from './options.js';
import { JsOutputTransformInterceptor } from './transform.interceptor.js';

@Global()
@Module({})
export class JsOutputModule {
  static forRoot(options: JsOutputModuleOptions = {}): DynamicModule {
    return {
      module: JsOutputModule,
      providers: [
        {
          provide: JS_OUTPUT_OPTIONS,
          useValue: options,
        },
        {
          provide: APP_FILTER,
          useClass: JsOutputExceptionFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: JsOutputTransformInterceptor,
        },
      ],
      exports: [JS_OUTPUT_OPTIONS],
    };
  }
}
