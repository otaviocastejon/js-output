/**
 * Structured application error. Catalog entries from `createErrors` are instances of this class
 * and can be thrown directly or passed to `err()`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly title?: string;
  readonly errorId?: string;
  readonly key?: string;

  constructor(options: {
    message: string;
    status: number;
    title?: string;
    errorId?: string;
    key?: string;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.status = options.status;
    this.title = options.title;
    this.errorId = options.errorId;
    this.key = options.key;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Recommended product catalog entry: stable id + client-facing title/message + HTTP status.
 */
export type ExplicitErrorDefinition = {
  status: number;
  message: string;
  title: string;
  errorId: string;
};

/**
 * Loose catalog entry. Prefer `ExplicitErrorDefinition` for product APIs.
 * `id` is an alias for `errorId`.
 */
export type ErrorDefinition = {
  status: number;
  message: string;
  title?: string;
  /** Explicit error id. When omitted and a module prefix is set, an id is auto-generated. */
  id?: string;
  errorId?: string;
};

export type ErrorCatalog = Record<string, ErrorDefinition>;

export type ExplicitErrorCatalog = Record<string, ExplicitErrorDefinition>;

export type ErrorMap<T extends ErrorCatalog> = {
  [K in keyof T]: AppError;
};

/**
 * Legacy constant shape used by many services: status lives inside `errorId`
 * as `PREFIX-STATUS-SEQ` (supports multi-segment prefixes).
 */
export type LegacyErrorConstant = {
  errorId: string;
  title: string;
  message: string;
};

/**
 * Parse HTTP status from an error id. Uses the second-to-last numeric segment
 * so multi-segment ids like `ORDERS-ITEMS-404-1` resolve to 404.
 */
export function parseStatusFromErrorId(errorId: string): number | undefined {
  const parts = errorId.split('-');
  if (parts.length < 2) return undefined;
  const statusPart = parts[parts.length - 2];
  if (!statusPart || !/^\d{3}$/.test(statusPart)) return undefined;
  return Number(statusPart);
}

function resolveExplicitId(entry: ErrorDefinition): string | undefined {
  return entry.errorId ?? entry.id;
}

function buildErrorId(
  modulePrefix: string | undefined,
  entry: ErrorDefinition,
  sequenceForStatus: number,
): string | undefined {
  const explicit = resolveExplicitId(entry);
  if (explicit) return explicit;
  if (!modulePrefix) return undefined;
  return `${modulePrefix}-${entry.status}-${sequenceForStatus}`;
}

function defineCatalogMap<T extends ErrorCatalog>(
  catalog: T,
  modulePrefix?: string,
): ErrorMap<T> {
  const statusSequences = new Map<number, number>();
  const result = {} as ErrorMap<T>;

  for (const key of Object.keys(catalog) as Array<keyof T>) {
    const entry = catalog[key];
    if (!entry || typeof entry.status !== 'number' || typeof entry.message !== 'string') {
      throw new TypeError(
        `createErrors: catalog entry "${String(key)}" must include status (number) and message (string)`,
      );
    }

    const seq = (statusSequences.get(entry.status) ?? 0) + 1;
    statusSequences.set(entry.status, seq);

    const errorId = buildErrorId(modulePrefix, entry, seq);
    const keyName = String(key);

    // Fresh instance per access so `throw Catalog.KEY` gets a useful stack.
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: false,
      get(): AppError {
        return new AppError({
          message: entry.message,
          status: entry.status,
          title: entry.title,
          errorId,
          key: keyName,
        });
      },
    });
  }

  return result;
}

/**
 * Create a map of throwable `AppError` values from a catalog.
 *
 * Prefer explicit `errorId` + `title` + `message` + `status` for product APIs.
 * Auto-seq ids (`PREFIX-STATUS-N`) are a helper when a module prefix is set and `errorId` is omitted.
 *
 * @example
 * // Recommended: explicit stable ids
 * const Users = createErrors({
 *   NOT_FOUND: {
 *     status: 404,
 *     errorId: 'USERS-404-1',
 *     title: 'User not found',
 *     message: 'No user exists for this id.',
 *   },
 * } as const);
 * throw Users.NOT_FOUND;
 *
 * @example
 * // Helper: auto-seq with multi-segment prefix
 * const Items = createErrors('ORDERS-ITEMS', {
 *   NOT_FOUND: { status: 404, title: 'Not found', message: 'Missing item' },
 * });
 * // Items.NOT_FOUND.errorId === 'ORDERS-ITEMS-404-1'
 */
export function createErrors<T extends ErrorCatalog>(catalog: T): ErrorMap<T>;
export function createErrors<T extends ErrorCatalog>(
  modulePrefix: string,
  catalog: T,
): ErrorMap<T>;
export function createErrors<T extends ErrorCatalog>(
  modulePrefixOrCatalog: string | T,
  maybeCatalog?: T,
): ErrorMap<T> {
  const hasPrefix = typeof modulePrefixOrCatalog === 'string';
  const modulePrefix = hasPrefix ? modulePrefixOrCatalog : undefined;
  const catalog = (hasPrefix ? maybeCatalog : modulePrefixOrCatalog) as T;

  if (!catalog || typeof catalog !== 'object') {
    throw new TypeError('createErrors requires an error catalog object');
  }

  return defineCatalogMap(catalog, modulePrefix);
}

/**
 * Build a catalog from legacy `{ errorId, title, message }` constants.
 * Status is parsed from the error id (second-to-last segment).
 */
export function fromLegacyConstants<T extends Record<string, LegacyErrorConstant>>(
  constants: T,
): ErrorMap<{ [K in keyof T]: ExplicitErrorDefinition }> {
  const catalog = {} as { [K in keyof T]: ExplicitErrorDefinition };

  for (const key of Object.keys(constants) as Array<keyof T>) {
    const entry = constants[key];
    if (!entry || typeof entry.errorId !== 'string') {
      throw new TypeError(
        `fromLegacyConstants: entry "${String(key)}" must include errorId (string)`,
      );
    }
    const status = parseStatusFromErrorId(entry.errorId);
    if (status === undefined) {
      throw new TypeError(
        `fromLegacyConstants: cannot parse status from errorId "${entry.errorId}"`,
      );
    }
    catalog[key] = {
      status,
      errorId: entry.errorId,
      title: entry.title,
      message: entry.message,
    };
  }

  return createErrors(catalog);
}

/**
 * Assign sequential `PREFIX-STATUS-N` ids to definitions that omit `errorId` / `id`.
 * Use when you want auto-seq without making it the default product style.
 */
export function assignSequentialIds<T extends ErrorCatalog>(
  modulePrefix: string,
  catalog: T,
): { [K in keyof T]: ErrorDefinition & { errorId: string } } {
  const statusSequences = new Map<number, number>();
  const result = {} as { [K in keyof T]: ErrorDefinition & { errorId: string } };

  for (const key of Object.keys(catalog) as Array<keyof T>) {
    const entry = catalog[key];
    if (!entry) {
      throw new TypeError(`assignSequentialIds: missing entry "${String(key)}"`);
    }
    const explicit = resolveExplicitId(entry);
    const seq = (statusSequences.get(entry.status) ?? 0) + 1;
    statusSequences.set(entry.status, seq);
    const errorId = explicit ?? `${modulePrefix}-${entry.status}-${seq}`;
    result[key] = { ...entry, errorId };
  }

  return result;
}

export function isAppError(value: unknown): value is AppError {
  if (value instanceof AppError) return true;
  // Duck-type so dual package entries / realms still recognize catalog errors.
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Error).name === 'AppError' &&
    typeof (value as AppError).status === 'number' &&
    typeof (value as AppError).message === 'string'
  );
}
