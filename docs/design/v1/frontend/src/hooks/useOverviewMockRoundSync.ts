import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@/api/client';
import { MockApiClient } from '@/api/mock';
import {
  readOverviewMockRound,
  syncOverviewMockRoundFromUrl,
} from '@/api/mock/data/overviewScenarios';
import { invalidateOverviewQueries } from '@/utils/invalidateOverview';

/**
 * 同步 URL ?mock_round= → localStorage，并重新加载 Mock 总览 snapshot。
 * 解决：客户端改 URL 不刷新、刷新后 Query 缓存与 Mock 内存态不一致。
 */
export function useOverviewMockRoundSync() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const mockRoundParam = searchParams.get('mock_round');

  useEffect(() => {
    void (async () => {
      syncOverviewMockRoundFromUrl(window.location.href);
      const round = readOverviewMockRound();
      const client = await getApiClient();
      if (!(client instanceof MockApiClient)) return;

      client.applyOverviewScenario(round);
      await invalidateOverviewQueries(qc);
    })();
  }, [mockRoundParam, qc]);
}
