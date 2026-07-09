import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const reactDir = path.dirname(require.resolve('react/package.json'));
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 保证全应用使用同一份 React（避免 monorepo hoist 到 React 18）
      react: reactDir,
      'react-dom': reactDomDir,
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:19876',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
