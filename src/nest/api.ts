import type { Api, ApiConfig } from '../create-api.js';
import { createApi } from '../create-api.js';

/** Nest module options — same shape as `createApi` config. */
export type OutputModuleConfig = ApiConfig;

export const OUTPUT_OPTIONS = Symbol('OUTPUT_OPTIONS');
export const OUTPUT_API = Symbol('OUTPUT_API');

export function toApiConfig(options: OutputModuleConfig = {}): ApiConfig {
  return {
    preset: options.preset ?? 'api',
    ...options,
  };
}

export function createOutputApi(options: OutputModuleConfig = {}): Api {
  return createApi(toApiConfig(options));
}
