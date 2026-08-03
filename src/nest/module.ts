import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import {
  createOutputApi,
  OUTPUT_API,
  OUTPUT_OPTIONS,
  type OutputModuleConfig,
} from './api.js';
import { OutputFilter } from './filter.js';
import { OutputInterceptor } from './interceptor.js';

/**
 * Drop-in Nest registration.
 *
 * @example
 * imports: [JsOutputModule]
 * // or
 * imports: [JsOutputModule.forRoot({ fallback: Defaults.UNEXPECTED })]
 */
@Global()
@Module({
  providers: [
    { provide: OUTPUT_OPTIONS, useValue: {} satisfies OutputModuleConfig },
    {
      provide: OUTPUT_API,
      useFactory: (opts: OutputModuleConfig) => createOutputApi(opts),
      inject: [OUTPUT_OPTIONS],
    },
    OutputFilter,
    OutputInterceptor,
    { provide: APP_FILTER, useExisting: OutputFilter },
    { provide: APP_INTERCEPTOR, useExisting: OutputInterceptor },
  ],
  exports: [OUTPUT_OPTIONS, OUTPUT_API],
})
export class JsOutputModule {
  /** Override defaults (same providers; only config changes). */
  static forRoot(options: OutputModuleConfig = {}): DynamicModule {
    return {
      module: JsOutputModule,
      providers: [{ provide: OUTPUT_OPTIONS, useValue: options }],
      exports: [OUTPUT_OPTIONS, OUTPUT_API],
    };
  }
}
