# js-output

Stable HTTP response envelopes and typed error catalogs for TypeScript — with a NestJS module that works with zero config.

```bash
npm install js-output
```

**Throw in your use cases. Shape responses once at the boundary.**

---

## The problem

Every Nest (and most Node HTTP) service ends up inventing the same three things:

1. A consistent success/error JSON shape for clients  
2. Stable `errorId`s you can throw from business code  
3. A global exception filter + response interceptor  

Envelope packages usually wrap responses. They rarely give you a catalog you can `throw`. This library does both.

---

## Nest (recommended)

### 1. Install the module

```ts
import { Module } from '@nestjs/common';
import { JsOutputModule } from 'js-output/nest';

@Module({
  imports: [JsOutputModule],
})
export class AppModule {}
```

That registers:

- a global exception filter  
- a response interceptor  
- the `api` preset (product-shaped envelopes)  
- a built-in fallback for unknown errors (`Defaults.UNEXPECTED` → `APP-503-1`)

No options required.

### 2. Define errors and throw them

```ts
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
import { Controller, Get, Param } from '@nestjs/common';
import { OkMessage } from 'js-output/nest';
import { Users } from './users.errors.js';

@Controller('users')
export class UsersController {
  @Get(':id')
  @OkMessage('User fetched successfully')
  getOne(@Param('id') id: string) {
    if (id !== '1') throw Users.NOT_FOUND;
    return { id, name: 'Ada' };
  }
}
```

### What clients get

Success:

```json
{
  "statusCode": 200,
  "message": "User fetched successfully",
  "timestamp": "2026-08-03T12:00:00.000Z",
  "data": { "id": "1", "name": "Ada" }
}
```

Failure:

```json
{
  "statusCode": 404,
  "errorId": "USERS-404-1",
  "title": "User not found",
  "message": "No user exists for this id.",
  "timestamp": "2026-08-03T12:00:00.000Z"
}
```

`title` is the short UI headline; `message` is the detail. Request `path` is off in production by default (`path: 'auto'`) — see below.

### Customize when you need to

`forRoot` accepts the same options as `createApi`:

```ts
JsOutputModule.forRoot({
  service: 'billing-api',
  fallback: Users.UNAVAILABLE, // catalog entry, not a magic string
  debug: 'auto',               // attach original error under `debug` outside production
  path: 'auto',                // echo request path outside production (default)
  // path: true | false,       // always / never
});
```

Other Nest helpers (opt-in):

| Export | Use for |
|--------|---------|
| `@OkMessage(...)` | Per-route success copy |
| `validationError()` | `ValidationPipe` → catalog-shaped 400 |
| `DownstreamError` / `readDownstream` | Forward upstream error envelopes |
| `toHttp` / `AppHttpException` | Turn `AppError` into Nest `HttpException` |

---

## Plain Node / Express / Fastify

Same core, no Nest:

```ts
import { createApi, createErrors } from 'js-output';

const api = createApi(); // api preset + Defaults.UNEXPECTED

const Orders = createErrors({
  NOT_FOUND: {
    status: 404,
    errorId: 'ORDERS-404-1',
    title: 'Order not found',
    message: 'No order exists for this id.',
  },
} as const);

app.get('/orders/:id', (req, res) => {
  try {
    const order = getOrder(req.params.id); // may throw Orders.NOT_FOUND
    res.json(api.success(order, { path: req.path, message: 'Order fetched' }));
  } catch (error) {
    const body = api.failure(error, { path: req.path });
    res.status(body.statusCode).json(body);
  }
});
```

Wire `success` / `failure` **once** at the HTTP boundary. Keep throwing in the rest of the app.

---

## Error catalogs

Prefer explicit fields — they are your public contract:

```ts
createErrors({
  CONFLICT: {
    status: 409,
    errorId: 'ORDERS-409-1',
    title: 'Conflict',
    message: 'Order already exists.',
  },
} as const);
```

Helpers when you need them:

```ts
import { Defaults, errorsFromIds, withSeqIds } from 'js-output';

Defaults.UNEXPECTED; // APP-503-1 — used when something unexpected blows up

// Status lives in the id (ORDERS-ITEMS-404-1 → 404)
errorsFromIds({
  NOT_FOUND: {
    errorId: 'ORDERS-ITEMS-404-1',
    title: 'Not found',
    message: 'Missing item',
  },
});

// Auto-seq ids: PREFIX-STATUS-N
withSeqIds('BILLING', {
  INVALID: { status: 400, title: 'Invalid', message: 'Bad input' },
});
```

---

## Presets

| Preset | Behavior |
|--------|----------|
| `api` (default) | Product envelope; `path: 'auto'`; unknown errors → `APP-503-1`; downstream `500 → 503` |
| `detailed` | Rich fields without the opinionated fallback/remap policies |
| `minimal` | `{ statusCode, message, data? }` only |

```ts
createApi({ preset: 'minimal' });
```

---

## Debugging

Client messages stay safe. Original errors are not thrown away:

- **Nest** logs unexpected throws (message + stack) via Nest’s Logger  
- **`onFailure(envelope, original)`** always receives the raw value  
- **`debug: 'auto'`** (default) adds `{ message, name, stack }` on the failure body outside production  
- **`path: 'auto'`** (default on `api`) echoes the request pathname outside production (`true` / `false` to force)  

```ts
createApi({
  debug: false, // never expose debug on the wire
  onFailure(envelope, original) {
    // your access log / metrics
  },
});
```

---

## API surface

**`js-output`**

`createApi`, `createErrors`, `errorsFromIds`, `withSeqIds`, `statusFromId`, `AppError`, `isAppError`, `Defaults`, plus small Result helpers (`ok` / `err` / …).

**`js-output/nest`**

`JsOutputModule`, `OutputFilter`, `OutputInterceptor`, `OkMessage`, `DownstreamError`, `readDownstream`, `validationError`, `toHttp`, `AppHttpException`.

Result helpers are optional. Prefer **throw**.

---

## Examples

```bash
npm run example:plain   # core only
npm run example:nest    # Nest on :3000 — /users/ok | /users/missing | /users/boom
```

---

## Versioning

This is **0.x**. Envelope and catalog shapes may still evolve; see [CHANGELOG.md](./CHANGELOG.md).

After **1.0**, field changes that clients depend on are semver-major.

---

## License

MIT © [Otavio Castejon](https://github.com/otaviocastejon)

See [CONTRIBUTING.md](./CONTRIBUTING.md) to develop locally.
