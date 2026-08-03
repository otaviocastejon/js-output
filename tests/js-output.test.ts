import { describe, expect, it, vi } from 'vitest';
import {
  AppError,
  Defaults,
  createApi,
  createErrors,
  err,
  errorsFromIds,
  isAppError,
  isErr,
  isOk,
  ok,
  statusFromId,
  unwrapOrThrow,
  withSeqIds,
} from '../src/index.js';

describe('createErrors', () => {
  it('creates throwable AppErrors without errorIds when no module prefix', () => {
    const Users = createErrors({
      NOT_FOUND: { status: 404, message: 'User not found' },
    });

    expect(Users.NOT_FOUND).toBeInstanceOf(AppError);
    expect(Users.NOT_FOUND.status).toBe(404);
    expect(Users.NOT_FOUND.message).toBe('User not found');
    expect(Users.NOT_FOUND.errorId).toBeUndefined();
    expect(isAppError(Users.NOT_FOUND)).toBe(true);
    expect(Users.NOT_FOUND).not.toBe(Users.NOT_FOUND);

    expect(() => {
      throw Users.NOT_FOUND;
    }).toThrow(AppError);
  });

  it('prefers explicit errorId + title for product catalogs', () => {
    const Users = createErrors({
      NOT_FOUND: {
        status: 404,
        errorId: 'USERS-404-1',
        title: 'User not found',
        message: 'No user exists for this id.',
      },
    } as const);

    expect(Users.NOT_FOUND.errorId).toBe('USERS-404-1');
    expect(Users.NOT_FOUND.title).toBe('User not found');
    expect(Users.NOT_FOUND.status).toBe(404);
  });

  it('auto-generates MODULE-STATUS-SEQ error ids with a prefix', () => {
    const Orders = createErrors('ORDERS', {
      NOT_FOUND: {
        status: 404,
        title: 'Order not found',
        message: 'No order exists for this id.',
      },
      ALSO_MISSING: {
        status: 404,
        message: 'Also missing',
      },
      CONFLICT: {
        status: 409,
        message: 'Conflict',
      },
    });

    expect(Orders.NOT_FOUND.errorId).toBe('ORDERS-404-1');
    expect(Orders.ALSO_MISSING.errorId).toBe('ORDERS-404-2');
    expect(Orders.CONFLICT.errorId).toBe('ORDERS-409-1');
    expect(Orders.NOT_FOUND.title).toBe('Order not found');
  });

  it('supports multi-segment prefixes', () => {
    const Items = createErrors('ORDERS-ITEMS', {
      NOT_FOUND: { status: 404, title: 'Not found', message: 'Missing' },
    });
    expect(Items.NOT_FOUND.errorId).toBe('ORDERS-ITEMS-404-1');
  });

  it('respects explicit id / errorId over auto generation', () => {
    const Catalog = createErrors('X', {
      CUSTOM: { status: 400, message: 'bad', id: 'CUSTOM-ID' },
      ALSO: { status: 400, message: 'bad2', errorId: 'ALSO-ID' },
    });
    expect(Catalog.CUSTOM.errorId).toBe('CUSTOM-ID');
    expect(Catalog.ALSO.errorId).toBe('ALSO-ID');
  });
});

describe('statusFromId / errorsFromIds / withSeqIds', () => {
  it('parses second-to-last segment as status', () => {
    expect(statusFromId('USERS-404-1')).toBe(404);
    expect(statusFromId('ORDERS-ITEMS-403-2')).toBe(403);
    expect(statusFromId('bad')).toBeUndefined();
  });

  it('imports legacy constants without rewriting ids', () => {
    const Catalog = errorsFromIds({
      NOT_FOUND: {
        errorId: 'ORDERS-ITEMS-404-1',
        title: 'Not found',
        message: 'Missing item',
      },
    } as const);

    expect(Catalog.NOT_FOUND.errorId).toBe('ORDERS-ITEMS-404-1');
    expect(Catalog.NOT_FOUND.status).toBe(404);
    expect(Catalog.NOT_FOUND.title).toBe('Not found');
  });

  it('withSeqIds fills missing ids', () => {
    const defs = withSeqIds('BILLING', {
      A: { status: 400, message: 'a' },
      B: { status: 400, message: 'b', errorId: 'KEEP-ME' },
    });
    expect(defs.A.errorId).toBe('BILLING-400-1');
    expect(defs.B.errorId).toBe('KEEP-ME');
  });
});

describe('Result helpers', () => {
  const Users = createErrors({
    NOT_FOUND: { status: 404, message: 'User not found' },
  });

  it('supports ok / err / isOk / isErr', () => {
    const success = ok({ id: '1' });
    const failure = err(Users.NOT_FOUND);

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    if (success.ok) expect(success.value).toEqual({ id: '1' });
    if (!failure.ok) {
      expect(failure.error).toBeInstanceOf(AppError);
      expect(failure.error.status).toBe(404);
      expect(failure.error.message).toBe('User not found');
    }
  });

  it('unwrapOrThrow returns value or throws', () => {
    expect(unwrapOrThrow(ok(42))).toBe(42);
    expect(() => unwrapOrThrow(err(Users.NOT_FOUND))).toThrow(AppError);
  });
});

describe('createApi defaults (api preset)', () => {
  const api = createApi();
  const Users = createErrors({
    NOT_FOUND: { status: 404, message: 'User not found' },
  });

  it('builds the api success envelope by default', () => {
    const body = api.success({ id: 1 }, { path: '/x' });
    expect(body).toMatchObject({
      statusCode: 200,
      message: 'Operation completed successfully',
      path: '/x',
      data: { id: 1 },
    });
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('builds a rich failure envelope from AppError by default', () => {
    const body = api.failure(Users.NOT_FOUND, { path: '/users/1' });
    expect(body).toMatchObject({
      statusCode: 404,
      message: 'User not found',
      path: '/users/1',
      errorType: 'Not Found',
    });
  });

  it('maps bare Error to Defaults.UNEXPECTED by default', () => {
    const body = api.failure(new Error('boom'));
    expect(body).toMatchObject({
      statusCode: 503,
      errorId: 'APP-503-1',
      title: 'Service Unavailable',
      errorType: 'Service Unavailable',
    });
  });

  it('keeps the original error under debug outside production', () => {
    const api = createApi({ debug: true });
    const err = new Error('db connection refused');
    const body = api.failure(err);
    expect(body.message).not.toBe('db connection refused');
    expect(body.debug).toMatchObject({
      message: 'db connection refused',
      name: 'Error',
    });
    expect(body.debug?.stack).toContain('db connection refused');
  });

  it('omits debug when debug is false', () => {
    const api = createApi({ debug: false });
    const body = api.failure(new Error('secret'));
    expect(body).not.toHaveProperty('debug');
  });
});

describe('createApi minimal preset', () => {
  const api = createApi({ preset: 'minimal' });
  const Users = createErrors({
    NOT_FOUND: { status: 404, message: 'User not found' },
  });

  it('builds a minimal success envelope', () => {
    expect(api.success({ id: 1 })).toEqual({
      statusCode: 200,
      message: 'OK',
      data: { id: 1 },
    });
  });

  it('builds a minimal failure envelope from AppError', () => {
    expect(api.failure(Users.NOT_FOUND)).toEqual({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('ignores context fields when toggles are off', () => {
    const body = api.failure(Users.NOT_FOUND, {
      path: '/users/1',
      method: 'GET',
      requestId: 'req-1',
    });
    expect(body).not.toHaveProperty('path');
    expect(body).not.toHaveProperty('method');
    expect(body).not.toHaveProperty('requestId');
    expect(body).not.toHaveProperty('timestamp');
    expect(body).not.toHaveProperty('errorId');
    expect(body).not.toHaveProperty('errorType');
    expect(body).not.toHaveProperty('title');
  });
});

describe('createApi detailed preset and toggles', () => {
  const Orders = createErrors('ORDERS', {
    NOT_FOUND: {
      status: 404,
      title: 'Order not found',
      message: 'No order exists for this id.',
    },
  });

  it('detailed preset includes rich error fields', () => {
    const api = createApi({ preset: 'detailed' });
    const body = api.failure(Orders.NOT_FOUND, { path: '/orders/1' });

    expect(body.statusCode).toBe(404);
    expect(body.message).toBe('No order exists for this id.');
    expect(body.errorId).toBe('ORDERS-404-1');
    expect(body.errorType).toBe('Not Found');
    expect(body.title).toBe('Order not found');
    expect(body.path).toBe('/orders/1');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body).not.toHaveProperty('method');
    expect(body).not.toHaveProperty('requestId');
  });

  it('explicit flags override preset', () => {
    const api = createApi({
      preset: 'detailed',
      path: false,
      method: true,
      requestId: true,
    });
    const body = api.success({ ok: true }, {
      path: '/x',
      method: 'POST',
      requestId: 'abc',
      message: 'Created',
      statusCode: 201,
    });

    expect(body).toEqual({
      statusCode: 201,
      message: 'Created',
      data: { ok: true },
      timestamp: expect.any(String),
      method: 'POST',
      requestId: 'abc',
    });
    expect(body).not.toHaveProperty('path');
  });

  it('maps unknown Error to 500 without inventing an errorId', () => {
    const api = createApi({ preset: 'minimal', errorId: true, errorType: true });
    const body = api.failure(new Error('boom'));
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('boom');
    expect(body.errorType).toBe('Internal Server Error');
    expect(body).not.toHaveProperty('errorId');
  });
});

describe('createApi api preset and policies', () => {
  const Users = createErrors({
    NOT_FOUND: {
      status: 404,
      errorId: 'USERS-404-1',
      title: 'User not found',
      message: 'No user exists for this id.',
    },
  });

  it('emits the opinionated success contract', () => {
    const api = createApi({ preset: 'api' });
    const body = api.success({ id: 1 }, { path: '/users/1' });
    expect(body).toEqual({
      statusCode: 200,
      message: 'Operation completed successfully',
      timestamp: expect.any(String),
      path: '/users/1',
      data: { id: 1 },
    });
  });

  it('emits the opinionated failure contract', () => {
    const api = createApi({ preset: 'api' });
    const body = api.failure(Users.NOT_FOUND, { path: '/users/1' });
    expect(body).toEqual({
      statusCode: 404,
      errorType: 'Not Found',
      errorId: 'USERS-404-1',
      title: 'User not found',
      message: 'No user exists for this id.',
      timestamp: expect.any(String),
      path: '/users/1',
    });
  });

  it('maps bare Error using a catalog unexpected entry', () => {
    const Defaults = createErrors({
      UNEXPECTED: {
        status: 503,
        errorId: 'APP-503-1',
        title: 'Service Unavailable',
        message: 'Service temporarily unavailable',
      },
    } as const);
    const api = createApi({
      preset: 'api',
      fallback: Defaults.UNEXPECTED,
    });
    const body = api.failure(new Error('secret internals'));
    expect(body.statusCode).toBe(503);
    expect(body.errorId).toBe('APP-503-1');
    expect(body.title).toBe('Service Unavailable');
    expect(body.message).toBe('Service temporarily unavailable');
    expect(body.errorType).toBe('Service Unavailable');
  });

  it('forwards structured downstream errors and remaps 500 → 503', () => {
    const api = createApi({ preset: 'api' });
    const body = api.failure(
      {
        statusCode: 500,
        errorId: 'DOWNSTREAM-500-1',
        title: 'Upstream failed',
        message: 'Database error',
      },
      { path: '/proxy' },
    );
    expect(body.statusCode).toBe(503);
    expect(body.errorId).toBe('DOWNSTREAM-500-1');
    expect(body.title).toBe('Upstream failed');
    expect(body.message).toBe('Database error');
  });

  it('invokes onFailure without requiring a logger', () => {
    const onFailure = vi.fn();
    const api = createApi({ preset: 'api', onFailure });
    api.failure(Users.NOT_FOUND);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({
      statusCode: 404,
      errorId: 'USERS-404-1',
    });
  });
});

describe('createApi logger', () => {
  const Orders = createErrors('ORDERS', {
    NOT_FOUND: { status: 404, message: 'missing', id: 'ORDERS-404-1' },
    SKIP_ME: { status: 404, message: 'skip', id: 'SKIP-1' },
  });

  it('logs original cause when client message was replaced', () => {
    const error = vi.fn();
    const api = createApi({
      logger: { error },
      debug: false,
    });

    api.failure(new Error('db exploded'));

    expect(error).toHaveBeenCalledWith(
      'db exploded',
      expect.objectContaining({
        errorId: 'APP-503-1',
        cause: expect.objectContaining({ message: 'db exploded' }),
        stack: expect.stringContaining('db exploded'),
      }),
    );
  });

  it('logs on failure when logger is provided', () => {
    const error = vi.fn();
    const api = createApi({
      preset: 'minimal',
      logger: { error },
      service: 'billing-api',
      errorId: true,
    });

    api.failure(Orders.NOT_FOUND, { path: '/orders/1' });

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith('missing', expect.objectContaining({
      service: 'billing-api',
      statusCode: 404,
      errorId: 'ORDERS-404-1',
      message: 'missing',
      cause: expect.objectContaining({ message: 'missing' }),
    }));
  });

  it('skips logging for skipErrorIds', () => {
    const error = vi.fn();
    const api = createApi({
      logger: { error },
      errorId: true,
      skipErrorIds: ['SKIP-1'],
    });

    api.failure(Orders.SKIP_ME);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not log without a logger', () => {
    const api = createApi();
    expect(() => api.failure(Orders.NOT_FOUND)).not.toThrow();
  });
});
