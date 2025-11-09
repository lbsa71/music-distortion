import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: i => `__tla_${i}`
    })
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    host: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  assetsInclude: ['**/*.wgsl']
});