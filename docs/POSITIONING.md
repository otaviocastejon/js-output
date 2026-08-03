# Positioning brief

## Problem

Nest (and many Node HTTP apps) leave teams to reinvent the same glue on every service:

1. Typed, stable **error catalogs** (`errorId` + status + client-safe title/message) thrown from use cases
2. Consistent **success/failure JSON envelopes** so clients can rely on one shape
3. Drop-in **ExceptionFilter + response interceptor + DI module** instead of copying ~200 lines per service
4. Sensible **boundary policies** (unexpected errors, downstream forward) without becoming a logging framework

Nest’s built-in filter only handles `HttpException` with a minimal body. RFC 9457 packages solve a different contract. Most “envelope” packages wrap responses but do not ship a first-class typed catalog + throw style.

## Ideal customer profile (ICP)

- Teams building **Nest REST APIs** (especially multi-service) who want one shared response/error contract
- Also useful for plain Node/Express/Fastify via the framework-agnostic core
- Prefer **throw** from use cases, wire envelopes once at the HTTP boundary

## Competitors (snapshot)

| Approach | Strength | Gap vs js-output |
|----------|----------|------------------|
| DIY filter/interceptor | Full control | Reinvented per repo; drift across services |
| Nest envelope modules (e.g. nestjs-http-envelope, nestjs-api-forge) | Drop-in wrap | Little/no typed error catalog story |
| RFC 9457 Problem Details filters | Standards compliance | Different JSON contract than many product APIs want |

## Differentiation

**Core** (catalogs + envelopes + policies) + optional **Nest product surface** (`js-output/nest`) that registers filter + interceptor once.

- Throw `Catalog.KEY` in business code
- Stable explicit `errorId`s as the recommended product style
- Opinionated `api` preset for a predictable HTTP contract
- No forced logging framework

Core alone is useful; Nest drop-in is why strangers install it.

## What we refuse to be

- Result/`ok`/`err` as the primary DX (helpers stay optional)
- A Datadog/logging product
- Infinite field-toggle soup without a default preset
- A replacement for auth/upload/domain exception trees

## Kill criteria

Stop or pivot if:

- Differentiation collapses to “yet another envelope interceptor”
- Docs only make sense with one private API style
- Result becomes the main pitch
- No opinionated preset a stranger can adopt in five minutes

## Verdict

Wedge holds: catalogs + throw + Nest module is underserved relative to envelope-only packages. Proceed to publish `0.x` with core + `js-output/nest`, stranger-facing docs, and a generic Nest example.
