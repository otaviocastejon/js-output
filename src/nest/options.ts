import type {
  CreateApiOptions,
  DownstreamPolicy,
  FailureEnvelope,
  UnexpectedErrorPolicy,
} from '../api/create-api.js';
import type { Logger } from '../logger/types.js';

export const JS_OUTPUT_OPTIONS = Symbol('JS_OUTPUT_OPTIONS');

export type JsOutputModuleOptions = {
  /** Defaults to `api`. */
  preset?: CreateApiOptions['preset'];
  /** Extra / overriding createApi options. */
  api?: CreateApiOptions;
  service?: string;
  logger?: Logger;
  skipErrorIds?: string[];
  defaultSuccessMessage?: string;
  unexpectedError?: UnexpectedErrorPolicy;
  downstream?: DownstreamPolicy;
  onFailure?: (envelope: FailureEnvelope, original: unknown) => void;
};
