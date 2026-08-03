/**
 * Minimal NestJS sample using js-output/nest (compiled against published-style dist).
 *
 * From repo root:
 *   npm run example:nest
 *
 * Then try:
 *   curl localhost:3000/users/ok
 *   curl localhost:3000/users/missing
 *   curl localhost:3000/users/boom
 */
import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createErrors } from 'js-output';
import { JsOutputModule, SuccessMessage } from 'js-output/nest';

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
  @Get('ok')
  @SuccessMessage('User fetched successfully')
  getOk() {
    return { id: '1', name: 'Ada' };
  }

  @Get('missing')
  missing() {
    throw Users.NOT_FOUND;
  }

  @Get('boom')
  boom() {
    throw new Error('secret internals');
  }
}

@Module({
  imports: [
    JsOutputModule.forRoot({
      service: 'example-api',
      unexpectedError: {
        statusCode: 503,
        errorId: 'APP-503-1',
        title: 'Service Unavailable',
        message: 'Service temporarily unavailable',
      },
    }),
  ],
  controllers: [UsersController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('Nest example listening on http://localhost:3000');
  console.log('  GET /users/ok');
  console.log('  GET /users/missing');
  console.log('  GET /users/boom');
}

bootstrap();
