# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-03

### Added

- Opinionated `createApi({ preset: 'api' })` HTTP contract (timestamp, path, errorId, errorType, title; unexpected → 503; downstream 500 → 503)
- Explicit `errorId` on catalog entries (alias of `id`); `fromLegacyConstants`, `assignSequentialIds`, `parseStatusFromErrorId`
- Multi-segment prefix docs/tests (`ORDERS-ITEMS-404-1`)
- `onFailure` hook and downstream forward policies on `createApi`
- Nest subpath `js-output/nest`: `JsOutputModule`, exception filter, transform interceptor, `@SuccessMessage`, `DownstreamHttpException`, `validationExceptionFactory`, `toHttpException`
- Duck-typed `isAppError` so catalog errors work across the core and `js-output/nest` bundle entries

### Changed

- README positioned for NPM strangers (throw-first, Nest as install reason)
- Package metadata: keywords, peerDependencies (Nest optional), dual exports

## [0.1.0] - 2026-07-31

### Added

- Initial `createErrors`, `AppError`, `createApi` (`minimal` / `detailed`), Result helpers, optional logger
