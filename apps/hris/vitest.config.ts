import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: { environment: 'node', include: ['**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
