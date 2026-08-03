import { isAppError } from '../errors/app-error.js';
import type { Logger } from '../logger/types.js';

export type ApiPreset = 'minimal' | 'detailed' | 'api';

export type FieldToggles = {
  timestamp?: boolean;
  path?: boolean;
  method?: boolean;
  requestId?: boolean;
  errorId?: boolean;
  errorType?: boolean;
  title?: boolean;
};

/** How bare / unexpected errors map at the HTTP boundary. */
export type UnexpectedErrorPolicy = {
  statusCode: number;
  message?: string;
  title?: string;
  errorId?: string;
};

export type DownstreamPolicy = {
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

export type CreateApiOptions = FieldToggles & {
  /** Shortcut over toggles. Explicit flags override the preset. */
  preset?: ApiPreset;
  logger?: Logger;
  service?: string;
  skipErrorIds?: string[];
  /** Default success message when none is passed to `success()`. */
  defaultSuccessMessage?: string;
  /**
   * Mapping for unknown / bare Error values.
   * Default for `api` preset: status 503. Default otherwise: status 500.
   */
  unexpectedError?: UnexpectedErrorPolicy;
  /** Downstream structured-error forwarding. */
  downstream?: DownstreamPolicy;
  /**
   * Optional hook after a failure envelope is built (e.g. access-log integration).
   * Prefer this over baking a second log stream into the library.
   */
  onFailure?: (envelope: FailureEnvelope, original: unknown) => void;
};

export type RequestContext = {
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
};

export type Api = {
  success: <T>(data?: T, context?: RequestContext) => SuccessEnvelope;
  failure: (error: unknown, context?: RequestContext) => FailureEnvelope;
  readonly options: ResolvedApiOptions;
};

export type ResolvedApiOptions = Required<FieldToggles> & {
  preset: ApiPreset;
  logger?: Logger;
  service?: string;
  skipErrorIds: string[];
  defaultSuccessMessage: string;
  unexpectedError: UnexpectedErrorPolicy;
  downstream: Required<Pick<DownstreamPolicy, 'forward'>> & {
    remapStatus: Partial<Record<number, number>>;
  };
  onFailure?: (envelope: FailureEnvelope, original: unknown) => void;
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

const PRESET_FLAGS: Record<ApiPreset, Required<FieldToggles>> = {
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

function resolveOptions(options: CreateApiOptions = {}): ResolvedApiOptions {
  const preset = options.preset ?? 'minimal';
  const base = PRESET_FLAGS[preset];

  const defaultUnexpected: UnexpectedErrorPolicy =
    preset === 'api'
      ? {
          statusCode: 503,
          message: 'Service temporarily unavailable',
          title: 'Service Unavailable',
        }
      : { statusCode: 500 };

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
    defaultSuccessMessage:
      options.defaultSuccessMessage ??
      (preset === 'api' ? 'Operation completed successfully' : 'OK'),
    unexpectedError: {
      ...defaultUnexpected,
      ...options.unexpectedError,
    },
    downstream: {
      forward: options.downstream?.forward ?? true,
      remapStatus: options.downstream?.remapStatus ?? (preset === 'api' ? { 500: 503 } : {}),
    },
    onFailure: options.onFailure,
  };
}

export function errorTypeFromStatus(status: number): string {
  return STATUS_TO_ERROR_TYPE[status] ?? 'Error';
}

type NormalizedFailure = {
  statusCode: number;
  message: string;
  title?: string;
  errorId?: string;
  fromStructured?: boolean;
};

function applyRemap(
  statusCode: number,
  remap: Partial<Record<number, number>>,
): number {
  return remap[statusCode] ?? statusCode;
}

function readStructuredFields(obj: Record<string, unknown>): {
  statusCode?: number;
  message?: string;
  title?: string;
  errorId?: string;
} {
  const statusCode =
    typeof obj.statusCode === 'number'
      ? obj.statusCode
      : typeof obj.status === 'number'
        ? obj.status
        : undefined;
  const message = typeof obj.message === 'string' ? obj.message : undefined;
  const title = typeof obj.title === 'string' ? obj.title : undefined;
  const errorId =
    typeof obj.errorId === 'string'
      ? obj.errorId
      : typeof obj.id === 'string'
        ? obj.id
        : undefined;
  return { statusCode, message, title, errorId };
}

function isForwardableStructured(
  fields: ReturnType<typeof readStructuredFields>,
): boolean {
  return (
    typeof fields.statusCode === 'number' &&
    typeof fields.message === 'string' &&
    typeof fields.title === 'string' &&
    typeof fields.errorId === 'string'
  );
}

function normalizeError(
  error: unknown,
  resolved: ResolvedApiOptions,
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

    if (resolved.downstream.forward && isForwardableStructured(fields)) {
      return {
        statusCode: applyRemap(fields.statusCode!, resolved.downstream.remapStatus),
        message: fields.message!,
        title: fields.title,
        errorId: fields.errorId,
        fromStructured: true,
      };
    }

    if (typeof fields.statusCode === 'number' || typeof fields.message === 'string') {
      return {
        statusCode: applyRemap(
          fields.statusCode ?? resolved.unexpectedError.statusCode,
          resolved.downstream.remapStatus,
        ),
        message: fields.message ?? '',
        title: fields.title,
        errorId: fields.errorId,
        fromStructured: Boolean(fields.errorId && fields.title),
      };
    }
  }

  const unexpected = resolved.unexpectedError;
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
  flags: ResolvedApiOptions,
  context: RequestContext | undefined,
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
 * Create an API envelope helper. All options are optional; defaults are minimal.
 * Prefer `preset: 'api'` for product HTTP contracts.
 */
export function createApi(options: CreateApiOptions = {}): Api {
  const resolved = resolveOptions(options);

  function success<T>(data?: T, context: RequestContext = {}): SuccessEnvelope {
    const envelope: SuccessEnvelope = {
      statusCode: context.statusCode ?? 200,
      message: context.message ?? resolved.defaultSuccessMessage,
    };

    if (data !== undefined) {
      envelope.data = data;
    } else if (resolved.preset === 'api') {
      envelope.data = null;
    }

    applyContextFields(envelope as Record<string, unknown>, resolved, context);
    return envelope;
  }

  function failure(error: unknown, context: RequestContext = {}): FailureEnvelope {
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
      envelope.errorType = errorTypeFromStatus(statusCode);
    }

    if (resolved.title && normalized.title) {
      envelope.title = normalized.title;
    }

    maybeLogFailure(resolved, envelope, error);
    resolved.onFailure?.(envelope, error);
    return envelope;
  }

  return {
    success,
    failure,
    options: resolved,
  };
}

function maybeLogFailure(
  resolved: ResolvedApiOptions,
  envelope: FailureEnvelope,
  original: unknown,
): void {
  const logger = resolved.logger;
  if (!logger) return;

  if (envelope.errorId && resolved.skipErrorIds.includes(envelope.errorId)) {
    return;
  }

  const meta: Record<string, unknown> = {
    statusCode: envelope.statusCode,
    message: envelope.message,
  };

  if (resolved.service) meta.service = resolved.service;
  if (envelope.errorId) meta.errorId = envelope.errorId;
  if (envelope.errorType) meta.errorType = envelope.errorType;
  if (envelope.title) meta.title = envelope.title;
  if (envelope.path) meta.path = envelope.path;
  if (envelope.method) meta.method = envelope.method;
  if (envelope.requestId) meta.requestId = envelope.requestId;

  if (original instanceof Error && original.stack) {
    meta.stack = original.stack;
  }

  logger.error(envelope.message, meta);
}
