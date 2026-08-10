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
      '@repopilot/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      // 保证全应用使用同一份 React（避免 monorepo hoist 到 React 18）
      react: reactDir,
      'react-dom': reactDomDir,
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  server: {
    host: '127.0.0.1',
    // 支持 VITE_PORT / VITE_API_TARGET 环境变量覆盖（默认与后端 npm run dev:api 一致）
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: true, // 端口被占用直接报错，避免静默顺延后 CORS/文案断链
    proxy: {
      // 19876 在部分 Windows 环境会出现幽灵 LISTENING；开发暂用 19878
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:19878',
        changeOrigin: true,
      },
      // 后端 /health 不在 /api 前缀下，需单独代理（EmbedAgentChat 挂载探测依赖它）
      '/health': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:19878',
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
