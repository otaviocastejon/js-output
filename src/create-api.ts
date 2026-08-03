import { AppError, isAppError } from './app-error.js';
import type { ErrorDef } from './app-error.js';
import { Defaults } from './defaults.js';
import type { Logger } from './logger.js';
import { isForwardable, readStructuredFields, remapStatus } from './parse.js';

export type ApiPreset = 'minimal' | 'detailed' | 'api';

export type EnvelopeFields = {
  timestamp?: boolean;
  path?: boolean;
  method?: boolean;
  requestId?: boolean;
  errorId?: boolean;
  errorType?: boolean;
  title?: boolean;
};

/** Resolved shape used internally after normalizing a catalog entry / AppError. */
export type FallbackError = {
  statusCode: number;
  message?: string;
  title?: string;
  errorId?: string;
};

/**
 * Prefer a catalog `AppError` (or explicit definition). Plain policy objects remain supported.
 *
 * @example
 * const Catalog = createErrors({
 *   UNEXPECTED: {
 *     status: 503,
 *     errorId: 'APP-503-1',
 *     title: 'Service Unavailable',
 *     message: 'Service temporarily unavailable',
 *   },
 * } as const);
 * createApi({ preset: 'api', fallback: Defaults.UNEXPECTED });
 */
export type FallbackInput =
  | AppError
  | ErrorDef
  | FallbackError;

export type ForwardConfig = {
  /**
   * When a structured error already carries id/title/message/status, pass them through.
   * Default: true.
   */
  forward?: boolean;
  /**
   * Remap this status to another when forwarding (e.g. 500 → 503).
   * Default: no remap.
   */
  remapStatus?: Partial<Record<number, number>>;
};

export type ApiConfig = EnvelopeFields & {
  /** Shortcut over toggles. Explicit flags override the preset. */
  preset?: ApiPreset;
  logger?: Logger;
  service?: string;
  skipErrorIds?: string[];
  /** Default success message when none is passed to `success()`. */
  okMessage?: string;
  /**
   * Catalog entry (preferred) or policy for unknown / bare Error values.
   * Default for `api` preset: status 503. Default otherwise: status 500.
   */
  fallback?: FallbackInput;
  /** Downstream structured-error forwarding. */
  downstream?: ForwardConfig;
  /**
   * Optional hook after a failure envelope is built (e.g. access-log integration).
   * Prefer this over baking a second log stream into the library.
   * Always receives the original thrown value as the second argument.
   */
  onFailure?: (envelope: FailureEnvelope, original: unknown) => void;
  /**
   * Attach original error details on the failure envelope under `debug`
   * (message / name / stack). Default `'auto'` = on when `NODE_ENV !== 'production'`.
   * Client-facing `message` / `title` stay catalog-safe either way.
   */
  debug?: boolean | 'auto';
};

export type HttpCtx = {
  statusCode?: number;
  message?: string;
  path?: string;
  method?: string;
  requestId?: string;
};

export type SuccessEnvelope = {
  statusCode: number;
  message: string;
  data?: unknown;
  timestamp?: string;
  path?: string;
  method?: string;
  requestId?: string;
};

/** Original error details for local debugging — not a substitute for server logs. */
export type ErrorDebug = {
  message: string;
  name?: string;
  stack?: string;
};

export type FailureEnvelope = {
  statusCode: number;
  message: string;
  timestamp?: string;
  path?: string;
  method?: string;
  requestId?: string;
  errorId?: string;
  errorType?: string;
  title?: string;
  debug?: ErrorDebug;
};

export type Api = {
  success: <T>(data?: T, context?: HttpCtx) => SuccessEnvelope;
  failure: (error: unknown, context?: HttpCtx) => FailureEnvelope;
  readonly options: ResolvedApi;
};

export type ResolvedApi = Required<EnvelopeFields> & {
  preset: ApiPreset;
  logger?: Logger;
  service?: string;
  skipErrorIds: string[];
  okMessage: string;
  fallback: FallbackError;
  downstream: Required<Pick<ForwardConfig, 'forward'>> & {
    remapStatus: Partial<Record<number, number>>;
  };
  onFailure?: (envelope: FailureEnvelope, original: unknown) => void;
  debug: boolean;
};

const STATUS_TO_ERROR_TYPE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const PRESET_FLAGS: Record<ApiPreset, Required<EnvelopeFields>> = {
  minimal: {
    timestamp: false,
    path: false,
    method: false,
    requestId: false,
    errorId: false,
    errorType: false,
    title: false,
  },
  detailed: {
    timestamp: true,
    path: true,
    method: false,
    requestId: false,
    errorId: true,
    errorType: true,
    title: true,
  },
  /** Opinionated HTTP API contract for product clients. */
  api: {
    timestamp: true,
    path: true,
    method: false,
    requestId: false,
    errorId: true,
    errorType: true,
    title: true,
  },
};

function resolveFallback(
  input: FallbackInput | undefined,
  preset: ApiPreset,
): FallbackError {
  if (input === undefined) {
    if (preset === 'api') {
      const unexpected = Defaults.UNEXPECTED;
      return {
        statusCode: unexpected.status,
        message: unexpected.message,
        title: unexpected.title,
        errorId: unexpected.errorId,
      };
    }
    return { statusCode: 500 };
  }

  if (isAppError(input)) {
    return {
      statusCode: input.status,
      message: input.message,
      title: input.title,
      errorId: input.errorId,
    };
  }

  if ('status' in input && typeof input.status === 'number') {
    const def = input as ErrorDef;
    return {
      statusCode: def.status,
      message: def.message,
      title: def.title,
      errorId: def.errorId,
    };
  }

  return { ...(input as FallbackError) };
}

function resolveOptions(options: ApiConfig = {}): ResolvedApi {
  const preset = options.preset ?? 'api';
  const base = PRESET_FLAGS[preset];

  return {
    preset,
    timestamp: options.timestamp ?? base.timestamp,
    path: options.path ?? base.path,
    method: options.method ?? base.method,
    requestId: options.requestId ?? base.requestId,
    errorId: options.errorId ?? base.errorId,
    errorType: options.errorType ?? base.errorType,
    title: options.title ?? base.title,
    logger: options.logger,
    service: options.service,
    skipErrorIds: options.skipErrorIds ?? [],
    okMessage:
      options.okMessage ??
      (preset === 'api' ? 'Operation completed successfully' : 'OK'),
    fallback: resolveFallback(options.fallback, preset),
    downstream: {
      forward: options.downstream?.forward ?? true,
      remapStatus: options.downstream?.remapStatus ?? (preset === 'api' ? { 500: 503 } : {}),
    },
    onFailure: options.onFailure,
    debug: resolveDebug(options.debug),
  };
}

function resolveDebug(option: boolean | 'auto' | undefined): boolean {
  const mode = option ?? 'auto';
  if (mode === true) return true;
  if (mode === false) return false;
  return process.env.NODE_ENV !== 'production';
}

export function errorCause(original: unknown): ErrorDebug {
  if (original instanceof Error) {
    const info: ErrorDebug = {
      message: original.message,
      name: original.name,
    };
    if (original.stack) info.stack = original.stack;
    return info;
  }

  if (original && typeof original === 'object') {
    const obj = original as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      return { message: obj.message };
    }
  }

  return { message: original == null ? String(original) : String(original) };
}

export function typeFromStatus(status: number): string {
  return STATUS_TO_ERROR_TYPE[status] ?? 'Error';
}

type NormalizedFailure = {
  statusCode: number;
  message: string;
  title?: string;
  errorId?: string;
  fromStructured?: boolean;
};




function normalizeError(
  error: unknown,
  resolved: ResolvedApi,
): NormalizedFailure {
  if (isAppError(error)) {
    return {
      statusCode: error.status,
      message: error.message,
      title: error.title,
      errorId: error.errorId,
      fromStructured: true,
    };
  }

  if (error && typeof error === 'object' && !(error instanceof Error)) {
    const obj = error as Record<string, unknown>;
    const fields = readStructuredFields(obj);

    if (resolved.downstream.forward && isForwardable(fields)) {
      return {
        statusCode: remapStatus(fields.statusCode!, resolved.downstream.remapStatus),
        message: fields.message!,
        title: fields.title,
        errorId: fields.errorId,
        fromStructured: true,
      };
    }

    if (typeof fields.statusCode === 'number' || typeof fields.message === 'string') {
      return {
        statusCode: remapStatus(
          fields.statusCode ?? resolved.fallback.statusCode,
          resolved.downstream.remapStatus,
        ),
        message: fields.message ?? '',
        title: fields.title,
        errorId: fields.errorId,
        fromStructured: Boolean(fields.errorId && fields.title),
      };
    }
  }

  const unexpected = resolved.fallback;
  const message =
    unexpected.message ??
    (error instanceof Error ? error.message : error == null ? '' : String(error));

  return {
    statusCode: unexpected.statusCode,
    message,
    title: unexpected.title,
    errorId: unexpected.errorId,
    fromStructured: false,
  };
}

function applyContextFields(
  target: Record<string, unknown>,
  flags: ResolvedApi,
  context: HttpCtx | undefined,
): void {
  if (flags.timestamp) {
    target.timestamp = new Date().toISOString();
  }
  if (flags.path && context?.path !== undefined) {
    target.path = context.path;
  }
  if (flags.method && context?.method !== undefined) {
    target.method = context.method;
  }
  if (flags.requestId && context?.requestId !== undefined) {
    target.requestId = context.requestId;
  }
}

/**
 * Create an API envelope helper.
 * Defaults to the opinionated `api` preset (product HTTP contract + built-in unexpected catalog).
 * Pass `{ preset: 'minimal' }` for the smallest envelopes.
 */
export function createApi(options: ApiConfig = {}): Api {
  const resolved = resolveOptions(options);

  function success<T>(data?: T, context: HttpCtx = {}): SuccessEnvelope {
    const envelope: SuccessEnvelope = {
      statusCode: context.statusCode ?? 200,
      message: context.message ?? resolved.okMessage,
    };

    if (data !== undefined) {
      envelope.data = data;
    } else if (resolved.preset === 'api') {
      envelope.data = null;
    }

    applyContextFields(envelope as Record<string, unknown>, resolved, context);
    return envelope;
  }

  function failure(error: unknown, context: HttpCtx = {}): FailureEnvelope {
    const normalized = normalizeError(error, resolved);
    const statusCode = context.statusCode ?? normalized.statusCode;

    const envelope: FailureEnvelope = {
      statusCode,
      message: context.message ?? normalized.message,
    };

    applyContextFields(envelope as Record<string, unknown>, resolved, context);

    if (resolved.errorId && normalized.errorId) {
      envelope.errorId = normalized.errorId;
    }

    if (resolved.errorType) {
      envelope.errorType = typeFromStatus(statusCode);
    }

    if (resolved.title && normalized.title) {
      envelope.title = normalized.title;
    }

    if (resolved.debug) {
      const cause = errorCause(error);
      // Surface original details when the client-facing message is not the real error.
      if (!normalized.fromStructured || cause.message !== envelope.message) {
        envelope.debug = cause;
      }
    }

    logFailure(resolved, envelope, error);
    resolved.onFailure?.(envelope, error);
    return envelope;
  }

  return {
    success,
    failure,
    options: resolved,
  };
}

function logFailure(
  resolved: ResolvedApi,
  envelope: FailureEnvelope,
  original: unknown,
): void {
  const logger = resolved.logger;
  if (!logger) return;

  if (envelope.errorId && resolved.skipErrorIds.includes(envelope.errorId)) {
    return;
  }

  const cause = errorCause(original);
  const meta: Record<string, unknown> = {
    statusCode: envelope.statusCode,
    message: envelope.message,
    cause,
  };

  if (resolved.service) meta.service = resolved.service;
  if (envelope.errorId) meta.errorId = envelope.errorId;
  if (envelope.errorType) meta.errorType = envelope.errorType;
  if (envelope.title) meta.title = envelope.title;
  if (envelope.path) meta.path = envelope.path;
  if (envelope.method) meta.method = envelope.method;
  if (envelope.requestId) meta.requestId = envelope.requestId;
  if (cause.stack) meta.stack = cause.stack;

  // Prefer the real error text in the log line when the client message was replaced.
  const logMessage =
    cause.message && cause.message !== envelope.message
      ? cause.message
      : envelope.message;

  logger.error(logMessage, meta);
}
