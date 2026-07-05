import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initApiClient } from '@/api/client';
import { readOverviewMockRound, syncOverviewMockRoundFromUrl } from '@/api/mock/data/overviewScenarios';
import { MockApiClient } from '@/api/mock';
import { App } from '@/App';
import '@/styles/design-system.css';
import '@/styles/liquid-glass.css';
import '@/styles/shell.css';
import '@/styles/pages/index.css';
import '@/styles/global.css';

async function bootstrap() {
  syncOverviewMockRoundFromUrl();
  const client = await initApiClient();
  if (client instanceof MockApiClient) {
    client.applyOverviewScenario(readOverviewMockRound());
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
