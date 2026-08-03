# Contributing

## Setup

```bash
npm install
npm run check
```

`npm install` enables a **pre-commit** hook (Husky) that runs `npm run check` — the same gate as CI: typecheck, tests, and build.

## Layout

```
src/           core + nest/ subpath
tests/         vitest
examples/      plain HTTP + Nest sample
```

- Core entry: `js-output` → `src/index.ts`
- Nest entry: `js-output/nest` → `src/nest/index.ts`
- Keep the public API small; prefer catalog throws + envelopes over new knobs

## PR checklist

- [ ] `npm run check` passes (also enforced on commit)
- [ ] Changelog updated for user-facing changes
- [ ] Examples/README still match the public names
