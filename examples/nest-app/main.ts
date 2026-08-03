/**
 * Minimal NestJS sample — zero-config JsOutputModule.
 *
 *   npm run example:nest
 */
import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createErrors } from 'js-output';
import { JsOutputModule, OkMessage } from 'js-output/nest';

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
  @OkMessage('User fetched successfully')
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
  imports: [JsOutputModule],
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
