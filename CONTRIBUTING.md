# Contributing

## Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Layout

```
src/           core + nest/ subpath
tests/         vitest
examples/      plain HTTP + Nest sample
docs/          positioning / adoption notes
```

- Core entry: `js-output` → `src/index.ts`
- Nest entry: `js-output/nest` → `src/nest/index.ts`
- Keep the public API small; prefer catalog throws + envelopes over new knobs

## PR checklist

- [ ] `npm test` and `npm run typecheck` pass
- [ ] Changelog updated for user-facing changes
- [ ] Examples/README still match the public names
