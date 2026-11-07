import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// package.json "version" is the single source of truth for the app version.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// A unique id per build: the app compares it with version.json to spot a new deploy
// even if two builds share a version number.
const build = `${version}+${Date.now().toString(36)}`;

/**
 * Builds the service worker from src/pwa/sw.js with this release's version and
 * file list baked in (so every release changes sw.js and phones pick it up),
 * and writes version.json, which the app polls to notice a new release.
 */
function pwa(): Plugin {
  return {
    name: 'hexbound-pwa',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const precache = [...files, 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'].map((f) => `./${f}`);
      const sw = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
        .replace("'__HB_VERSION__'", JSON.stringify(build))
        .replace('__HB_ASSETS__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, build }) });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(build) },
  build: { target: 'es2022', assetsInlineLimit: 0 },
  plugins: [pwa()],
});
