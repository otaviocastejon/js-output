import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'nest/index': 'src/nest/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
  ],
});
