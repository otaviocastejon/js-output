import 'reflect-metadata';
import {
  Controller,
  Get,
  HttpCode,
  type INestApplication,
  Module,
  Param,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createErrors } from '../src/index.js';
import {
  DownstreamError,
  JsOutputModule,
  OkMessage,
  readDownstream,
  toHttp,
  validationError,
} from '../src/nest/index.js';
import { requestPath } from '../src/nest/request-path.js';

const Users = createErrors({
  NOT_FOUND: {
    status: 404,
    errorId: 'USERS-404-1',
    title: 'User not found',
    message: 'No user exists for this id.',
  },
} as const);

@Controller('users')
class UsersController {
  @Get(':id')
  @OkMessage('User fetched successfully')
  getOne(@Param('id') id: string) {
    if (id === 'missing') {
      throw Users.NOT_FOUND;
    }
    if (id === 'boom') {
      throw new Error('secret');
    }
    if (id === 'down') {
      throw DownstreamError.fromBody(
        {
          statusCode: 500,
          errorId: 'PAYMENTS-500-1',
          title: 'Payment failed',
          message: 'Card declined upstream',
        },
        500,
      );
    }
    return { id, name: 'Ada' };
  }

  @Get()
  @HttpCode(201)
  @OkMessage({ 201: 'User created successfully' })
  create() {
    return { id: 'new' };
  }
}

@Module({
  imports: [JsOutputModule],
  controllers: [UsersController],
})
class AppModule {}

describe('js-output/nest', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('wraps successful responses', async () => {
    const res = await request(app.getHttpServer()).get('/users/1').expect(200);
    expect(res.body).toMatchObject({
      statusCode: 200,
      message: 'User fetched successfully',
      path: '/users/1',
      data: { id: '1', name: 'Ada' },
    });
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses per-status success messages', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(201);
    expect(res.body.message).toBe('User created successfully');
    expect(res.body.data).toEqual({ id: 'new' });
  });

  it('formats thrown AppError catalogs', async () => {
    const res = await request(app.getHttpServer()).get('/users/missing').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      errorId: 'USERS-404-1',
      title: 'User not found',
      message: 'No user exists for this id.',
      path: '/users/missing',
    });
    expect(res.body).not.toHaveProperty('errorType');
  });

  it('maps unexpected errors with built-in Defaults.UNEXPECTED', async () => {
    const res = await request(app.getHttpServer()).get('/users/boom').expect(503);
    expect(res.body).toMatchObject({
      statusCode: 503,
      errorId: 'APP-503-1',
      title: 'Service Unavailable',
    });
    // Non-production test env keeps original error for debugging
    expect(res.body.debug).toMatchObject({
      message: 'secret',
      name: 'Error',
    });
  });

  it('forwards DownstreamError and remaps 500 → 503', async () => {
    const res = await request(app.getHttpServer()).get('/users/down').expect(503);
    expect(res.body).toMatchObject({
      errorId: 'PAYMENTS-500-1',
      title: 'Payment failed',
      message: 'Card declined upstream',
    });
  });
});

describe('nest helpers', () => {
  it('toHttp preserves AppError fields', () => {
    const http = toHttp(Users.NOT_FOUND);
    expect(http.getStatus()).toBe(404);
    expect(http.getResponse()).toMatchObject({
      errorId: 'USERS-404-1',
      title: 'User not found',
    });
  });

  it('readDownstream remaps 500 → 503', () => {
    const parsed = readDownstream(
      {
        statusCode: 500,
        errorId: 'X-500-1',
        title: 'Fail',
        message: 'Nope',
      },
      500,
    );
    expect(parsed).toEqual({
      statusCode: 503,
      errorId: 'X-500-1',
      title: 'Fail',
      message: 'Nope',
    });
  });

  it('validationError builds structured 400s', () => {
    const factory = validationError();
    const exception = factory([
      {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      },
    ]);
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      errorId: 'VALIDATION-400-1',
      title: 'Validation failed',
      message: 'email: email must be an email',
    });
  });
});

describe('requestPath', () => {
  it('drops the query string', () => {
    expect(requestPath('/users/1?token=secret')).toBe('/users/1');
    expect(requestPath('/users/1')).toBe('/users/1');
    expect(requestPath(undefined)).toBeUndefined();
  });
});
