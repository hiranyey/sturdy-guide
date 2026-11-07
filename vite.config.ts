import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// package.json "version" is the single source of truth for the app version.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
