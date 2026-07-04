import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  useActivities,
  useProjectStats,
  useProjects,
  useTrending,
} from '@/hooks/useProjects';
import { useAllNotes } from '@/hooks/useNotes';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import { GlassCard } from '@/components/common/GlassCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { formatRelativeTime } from '@/utils/date';
import type { ProjectProgress, TrendingPeriod } from '@/api/types';

const PROGRESS_LABELS: Record<ProjectProgress, string> = {
  none: '未开始',
  learning: '学习中',
  learned: '已掌握',
  mastered: '精通',
};

const PRODUCT_INTRO = `# RepoPilot 是什么

RepoPilot 是你的 **GitHub 项目学习驾驶舱**：导入 Stars、管理进度、与 6 个专业 Agent 对话、可视化知识图谱。

## 6 个专业 Agent

- **Hub** — 总调度
- **Scout** — 项目速览
- **Mentor** — 深度教学
- **Navigator** — 学习路径
- **Curator** — 项目整理
- **Scribe** — 笔记生成
`;

export function OverviewPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useProjectStats();
  const { data: notes } = useAllNotes();
  const { data: recent } = useProjects();
  const { data: activities } = useActivities();
  const [period, setPeriod] = useState<TrendingPeriod>('daily');
  const [langFilter, setLangFilter] = useState('');
  const { data: trending } = useTrending(period, langFilter || undefined);

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await getApi().getUserProfile()).data,
  });

  if (statsLoading) return <LoadingSpinner />;

  const total = stats?.total ?? 0;
  const learning = stats?.by_progress.learning ?? 0;
  const mastered = stats?.by_progress.mastered ?? 0;
  const noteCount = notes?.length ?? 0;

  return (
    <div className="page overview-page">
      <section className="overview-hero glass">
        <h1>欢迎回来，{user?.username ?? '用户'}</h1>
        <p className="overview-hero__lede">
          RepoPilot 帮你把 GitHub Stars 变成可执行的学习计划。
        </p>
        <div className="quick-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/projects?import=stars')}
          >
            导入 GitHub Stars
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/projects')}>
            浏览项目库
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/graph')}>
            打开图谱
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/agent')}>
            与 Agent 对话
          </button>
        </div>
      </section>

      <div className="stats-grid" data-testid="stats-cards">
        <GlassCard className="stat-card">
          <span className="stat-card__label">项目总数</span>
          <span className="stat-card__value">{total}</span>
        </GlassCard>
        <GlassCard className="stat-card">
          <span className="stat-card__label">学习中</span>
          <span className="stat-card__value">{learning}</span>
        </GlassCard>
        <GlassCard className="stat-card">
          <span className="stat-card__label">已掌握</span>
          <span className="stat-card__value">{mastered}</span>
        </GlassCard>
        <GlassCard className="stat-card">
          <span className="stat-card__label">笔记数</span>
          <span className="stat-card__value">{noteCount}</span>
        </GlassCard>
      </div>

      <div className="overview-row-2">
        <GlassCard className="progress-panel">
          <h2>学习进度分布</h2>
          {(Object.keys(PROGRESS_LABELS) as ProjectProgress[]).map((key) => {
            const count = stats?.by_progress[key] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="progress-bar-row">
                <span>{PROGRESS_LABELS[key]}</span>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                </div>
                <span>{count}</span>
              </div>
            );
          })}
        </GlassCard>

        <GlassCard className="activity-panel">
          <h2>最近动态</h2>
          <ul className="activity-list">
            {(activities ?? []).slice(0, 5).map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                <span>{a.description}</span>
                <time>{formatRelativeTime(a.created_at)}</time>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard className="agent-summary" onClick={() => navigate('/agent')}>
        <h2>Agent 周报</h2>
        <p>{profile?.history_summary ?? '本周暂无学习摘要'}</p>
        <span className="agent-summary__cta">查看 Agent Chat →</span>
      </GlassCard>

      <section className="continue-learning">
        <h2>继续学习</h2>
        <div className="project-cards-row">
          {(recent?.items ?? []).slice(0, 3).map((p) => (
            <GlassCard
              key={p.id}
              className="project-mini-card"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <span className="font-mono">{p.name}</span>
              <span>{p.language}</span>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="trending-section">
        <h2>GitHub 热门</h2>
        <div className="filter-tabs">
          {(['daily', 'weekly', 'monthly'] as TrendingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`filter-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'daily' ? '今日' : p === 'weekly' ? '本周' : '本月'}
            </button>
          ))}
          <select
            className="input"
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
          >
            <option value="">全部语言</option>
            <option value="TypeScript">TypeScript</option>
            <option value="Python">Python</option>
            <option value="Rust">Rust</option>
          </select>
        </div>
        <ul className="trending-list">
          {(trending ?? []).map((r) => (
            <li key={`${r.owner}/${r.repo}`}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.owner}/{r.repo}
              </a>
              <span>{r.language}</span>
              <span>★ {r.stars.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <details className="product-intro glass">
        <summary>RepoPilot 产品说明</summary>
        <MarkdownRenderer content={PRODUCT_INTRO} />
      </details>
    </div>
  );
}
