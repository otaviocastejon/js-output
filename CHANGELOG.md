# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-08-03

### Changed

- `api` preset: `path` defaults to `'auto'` (echo request path only outside production); set `path: true` / `false` to force
- `api` preset: `errorType` is opt-in (was on by default; it only mirrored `statusCode`)
- Nest strips query strings from echoed paths (`/users/1?token=…` → `/users/1`)
- README documents the lean production envelope (no redundant fields)

### Removed

- Internal `docs/POSITIONING.md` and `docs/ADOPTION.md` (README is the stranger-facing source of truth)

## [0.2.0] - 2026-08-03

### Added

- Opinionated `api` HTTP contract (timestamp, path, errorId, errorType, title; fallback → 503; downstream 500 → 503)
- Built-in `Defaults.UNEXPECTED` catalog (`APP-503-1`) for zero-config installs
- Explicit `errorId` on catalog entries; `errorsFromIds`, `withSeqIds`, `statusFromId`
- `onFailure` hook and downstream forward policies on `createApi`
- Nest subpath `js-output/nest`: drop-in `JsOutputModule`, `OutputFilter`, `OutputInterceptor`, `@OkMessage`, `DownstreamError`, `validationError`
- Duck-typed `isAppError` across core / nest bundle entries
- Preserve original errors for debugging: `debug` on failure envelopes (`debug: 'auto'`), logger `cause` + real message, Nest Logger for unexpected throws
- Flattened package layout; shared Nest `OUTPUT_API`; Nest config is plain `ApiConfig`

### Changed

- `createApi()` defaults to `preset: 'api'` + `Defaults.UNEXPECTED` (use `{ preset: 'minimal' }` for bare envelopes)
- `JsOutputModule` works with zero config (`imports: [JsOutputModule]`); `forRoot` only for overrides
- Public API renamed for clarity (`fallback`, `errorsFromIds`, `OkMessage`, `toHttp`, `readDownstream`, …)

## [0.1.0] - 2026-07-31

### Added

- Initial `createErrors`, `AppError`, `createApi` (`minimal` / `detailed`), Result helpers, optional logger
