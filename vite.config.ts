import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    build: { outDir: 'docs', emptyOutDir: true, sourcemap: false },
    server: { host: '0.0.0.0', port: 5173 },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
    test: { environment: 'node', include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.mjs'], testTimeout: 180000, hookTimeout: 300000 },
  };
});
