export {
  AppError,
  assignSequentialIds,
  createErrors,
  fromLegacyConstants,
  isAppError,
  parseStatusFromErrorId,
} from './errors/index.js';
export type {
  ErrorCatalog,
  ErrorDefinition,
  ErrorMap,
  ExplicitErrorCatalog,
  ExplicitErrorDefinition,
  LegacyErrorConstant,
} from './errors/index.js';

export { ok, err, isOk, isErr, unwrapOrThrow } from './result/index.js';
export type { Ok, Err, Result } from './result/index.js';

export { createApi, errorTypeFromStatus } from './api/index.js';
export type {
  Api,
  ApiPreset,
  CreateApiOptions,
  DownstreamPolicy,
  FieldToggles,
  RequestContext,
  SuccessEnvelope,
  FailureEnvelope,
  ResolvedApiOptions,
  UnexpectedErrorPolicy,
} from './api/index.js';

export type { Logger, LogMeta } from './logger/index.js';
export { noopLogger } from './logger/index.js';
