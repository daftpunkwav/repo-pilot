import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  applyOverviewScenarioIfMock,
  initApiClient,
} from '@/api/client';
import { App } from '@/App';
import '@/styles/design-system.css';
import '@/styles/liquid-glass.css';
import '@/styles/shell.css';
import '@/styles/pages/index.css';
import '@/styles/global.css';
import 'highlight.js/styles/github-dark.min.css';

async function bootstrap() {
  const client = await initApiClient();
  // Mock 场景数据仅在启用 Mock 时动态加载，避免 Real 构建硬依赖 mock 模块
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { readOverviewMockRound, syncOverviewMockRoundFromUrl } = await import(
      '@/api/mock/data/overviewScenarios'
    );
    syncOverviewMockRoundFromUrl();
    applyOverviewScenarioIfMock(client, readOverviewMockRound());
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root element #root not found');
  }

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
