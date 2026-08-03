# Adoption notes

## Proven locally

- Core + Nest unit/integration tests: `npm test` (32 passing)
- Generic Nest sample: `npm run example:nest`
  - `GET /users/ok` → success envelope with `@SuccessMessage`
  - `GET /users/missing` → catalog failure `USERS-404-1`
  - `GET /users/boom` → unexpected policy `APP-503-1` / 503
- Plain HTTP sketch: `npm run example:plain`

## Prove it helps strangers

1. Run the Nest sample and confirm envelopes match the README.
2. Drop `JsOutputModule.forRoot` into a greenfield Nest service and replace a hand-rolled filter/interceptor.
3. Keep public docs generic — do not require knowledge of any private codebase.

## Soft launch checklist

- [x] `npm pack --dry-run` includes dist + README + LICENSE + CHANGELOG
- [x] Package name `js-output` is available on the registry
- [x] README install path works for someone who has never seen this repo
- [ ] Nest Discord / relevant forums: short “what problem / how it differs from envelope-only packages” post after publish

## Kill criteria reminder

If feedback is “this is just another interceptor” without catalog value, revisit positioning before `1.0`.
