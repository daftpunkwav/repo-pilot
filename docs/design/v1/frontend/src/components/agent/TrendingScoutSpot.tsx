import { AgentAvatar, type LookTarget } from '@/components/agent/AgentAvatar';
import type { TrendingRepo } from '@/api/types';
import { formatNumber } from '@/utils/format';

interface TrendingScoutSpotProps {
  repo: TrendingRepo | null;
  lookTarget: LookTarget | null;
}

/** Scout 快速介绍文案 */
export function buildTrendingScoutIntro(repo: TrendingRepo): string {
  const name = `${repo.owner}/${repo.repo}`;
  const extras: string[] = [];
  if (repo.language) extras.push(repo.language);
  if (repo.stars_today) extras.push(`今日 +${formatNumber(repo.stars_today)} ★`);
  else if (repo.stars) extras.push(`${formatNumber(repo.stars)} ★`);

  if (repo.description) {
    return extras.length ? `${repo.description}（${extras.join(' · ')}）` : repo.description;
  }
  return extras.length
    ? `${name} 正在 trending 上升：${extras.join(' · ')}`
    : `${name} 值得 Scout 帮你快速扫一眼。`;
}

export function TrendingScoutSpot({ repo, lookTarget }: TrendingScoutSpotProps) {
  if (!repo) return null;

  const name = `${repo.owner}/${repo.repo}`;

  return (
    <div
      className="trending-scout-spot"
      aria-live="polite"
      aria-label={`Scout 正在介绍 ${name}`}
    >
      <div className="trending-scout-bubble glass-card glass-card--control overview-control-surface">
        <span className="trending-scout-bubble-label">Scout</span>
        <p>{buildTrendingScoutIntro(repo)}</p>
      </div>
      <AgentAvatar
        agentId="scout"
        lookTarget={lookTarget}
        isFocused={false}
        blink
        size={58}
      />
    </div>
  );
}
