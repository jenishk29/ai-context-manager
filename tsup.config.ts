import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    minify: true,
    sourcemap: true,
    splitting: false,
    outDir: 'dist',
  },
  {
    entry: ['bin/cli.js'],
    format: ['cjs'],
    minify: true,
    sourcemap: true,
    splitting: false,
    outDir: 'dist',
  }
]);
