import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // مسارات نسبية بالكامل حتى يعمل النشر تحت أي مسار أساس (GitHub Pages أو غيره)
    base: env.VITE_BASE_PATH || './',
    plugins: [react()],
    build: { outDir: 'docs', emptyOutDir: true, sourcemap: false },
    server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
    test: { environment: 'node', include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.mjs'], testTimeout: 180000, hookTimeout: 300000 },
  };
});
