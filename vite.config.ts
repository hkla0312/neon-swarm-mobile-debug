import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 53173, strictPort: true },
  preview: { host: '0.0.0.0', port: 54173, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: [] }
});

