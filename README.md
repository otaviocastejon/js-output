# js-output

Typed **error catalogs** and consistent HTTP **response envelopes** for JavaScript/TypeScript — with a drop-in **NestJS** module so you stop copying the same filter and interceptor into every service.

```bash
npm install js-output
# Nest apps also need Nest peers (already in most Nest projects):
# @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Why this exists

Most Nest apps reinvent:

1. Stable error ids + client-safe messages thrown from use cases
2. One success/failure JSON shape for clients
3. A global exception filter + response interceptor

Envelope-only packages wrap responses. RFC 9457 packages target Problem Details. **js-output** combines catalogs you `throw` with envelopes and optional Nest wiring.

## 30-second Nest setup

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { JsOutputModule } from 'js-output/nest';

@Module({
  imports: [
    JsOutputModule.forRoot({
      unexpectedError: {
        statusCode: 503,
        errorId: 'APP-503-1',
        title: 'Service Unavailable',
        message: 'Service temporarily unavailable',
      },
    }),
  ],
})
export class AppModule {}
```

```ts
// users.errors.ts
import { createErrors } from 'js-output';

export const Users = createErrors({
  NOT_FOUND: {
    status: 404,
    errorId: 'USERS-404-1',
    title: 'User not found',
    message: 'No user exists for this id.',
  },
} as const);
```

```ts
// users.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { SuccessMessage } from 'js-output/nest';
import { Users } from './users.errors.js';

@Controller('users')
export class UsersController {
  @Get(':id')
  @SuccessMessage('User fetched successfully')
  getOne(@Param('id') id: string) {
    if (id !== '1') throw Users.NOT_FOUND;
    return { id, name: 'Ada' };
  }
}
```

**Success**

```json
{
  "statusCode": 200,
  "message": "User fetched successfully",
  "timestamp": "2026-08-03T12:00:00.000Z",
  "path": "/users/1",
  "data": { "id": "1", "name": "Ada" }
}
```

**Failure**

```json
{
  "statusCode": 404,
  "errorType": "Not Found",
  "errorId": "USERS-404-1",
  "title": "User not found",
  "message": "No user exists for this id.",
  "timestamp": "2026-08-03T12:00:00.000Z",
  "path": "/users/missing"
}
```

## Core-only (Express / Fastify / plain Node)

```ts
import { createApi, createErrors } from 'js-output';

const Orders = createErrors({
  NOT_FOUND: {
    status: 404,
    errorId: 'ORDERS-404-1',
    title: 'Order not found',
    message: 'No order exists for this id.',
  },
} as const);

const api = createApi({ preset: 'api' });

try {
  throw Orders.NOT_FOUND;
} catch (error) {
  const body = api.failure(error, { path: '/orders/1' });
  // res.status(body.statusCode).json(body)
}
```

Business code throws. Wire `api.success` / `api.failure` once at the HTTP boundary.

## Presets

| Preset | Use when |
|--------|----------|
| `minimal` (default) | Smallest `{ statusCode, message, data? }` |
| `detailed` | Adds timestamp, path, errorId, errorType, title |
| `api` | **Recommended product HTTP contract** — same rich fields, unexpected errors → 503 by default, downstream `500 → 503` remap |

```ts
createApi({ preset: 'api' });
```

## Error catalogs

Prefer **explicit** `errorId` + `title` + `message` + `status` for product APIs (stable client contracts).

Auto-seq (`PREFIX-STATUS-N`) is available as a helper — including multi-segment prefixes:

```ts
createErrors('ORDERS-ITEMS', {
  NOT_FOUND: { status: 404, title: 'Not found', message: 'Missing' },
});
// → ORDERS-ITEMS-404-1
```

Migrate existing `{ errorId, title, message }` maps without rewriting ids:

```ts
import { fromLegacyConstants } from 'js-output';

const Catalog = fromLegacyConstants({
  NOT_FOUND: {
    errorId: 'ORDERS-ITEMS-404-1',
    title: 'Not found',
    message: 'Missing item',
  },
});
```

## Nest extras

| Export | Role |
|--------|------|
| `JsOutputModule.forRoot(options)` | Registers filter + interceptor |
| `JsOutputExceptionFilter` | Failure envelopes |
| `JsOutputTransformInterceptor` | Success envelopes |
| `@SuccessMessage(...)` | Per-route success copy |
| `toHttpException` / `AppHttpException` | AppError → Nest HttpException |
| `DownstreamHttpException` / `parseDownstreamError` | Forward structured upstream errors |
| `validationExceptionFactory` | Map ValidationPipe errors into the catalog shape |

```ts
app.useGlobalPipes(
  new ValidationPipe({
    exceptionFactory: validationExceptionFactory(),
  }),
);
```

Logging stays optional: no logger by default. Use `onFailure` or `skipErrorIds` to integrate with your access logger — not a second error stream inside the library.

## Result helpers (optional)

Most Nest apps should **throw**. Tiny `ok` / `err` helpers are available for Result-style code paths; they are not the primary DX.

## Examples

```bash
npm run example:plain   # core envelopes, no framework
npm run example:nest    # Nest module on :3000 (/users/ok|missing|boom)
```

## Semver

- **0.x** — API may evolve; changelog every release
- Envelope field additions/removals after **1.0** are breaking when clients depend on the shape

See [CHANGELOG.md](./CHANGELOG.md). Positioning notes: [docs/POSITIONING.md](./docs/POSITIONING.md).

## License

MIT
