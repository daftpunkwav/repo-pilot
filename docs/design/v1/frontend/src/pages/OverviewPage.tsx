import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatRelativeTime, formatDateTime } from '@/utils/date';
import { formatNumber, langCssClass, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { AgentCarousel } from '@/components/agent/AgentCarousel';
import type { LookTarget } from '@/components/agent/AgentAvatar';
import type { ProjectProgress, TrendingPeriod } from '@/api/types';

const PROGRESS_ROWS: Array<{ key: ProjectProgress; label: string; color: string }> = [
  { key: 'none', label: '待开始', color: 'fill-none' },
  { key: 'learning', label: '学习中', color: 'fill-learning' },
  { key: 'learned', label: '已学习', color: 'fill-learned' },
  { key: 'mastered', label: '已掌握', color: 'fill-mastered' },
];

export function OverviewPage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useProjectStats();
  const { data: notes = [] } = useAllNotes();
  const { data: projectsData } = useProjects();
  const { data: activities } = useActivities();
  const [period, setPeriod] = useState<TrendingPeriod>('weekly');
  const { data: trending = [] } = useTrending(period);

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await getApi().getUserProfile()).data,
  });

  const [trendingVisible, setTrendingVisible] = useState(false);
  const [chatBtnLookTarget, setChatBtnLookTarget] = useState<LookTarget | null>(null);

  const handleChatBtnLook = (event: MouseEvent<HTMLAnchorElement>) => {
    setChatBtnLookTarget({ x: event.clientX, y: event.clientY });
  };

  const handleChatBtnLookEnd = () => {
    setChatBtnLookTarget(null);
  };

  useEffect(() => {
    const t = setTimeout(() => setTrendingVisible(true), 80);
    return () => clearTimeout(t);
  }, [period, trending]);

  const recommended = useMemo(() => {
    const items = projectsData?.items ?? [];
    return [...items].sort((a, b) => b.stars - a.stars).slice(0, 5);
  }, [projectsData]);

  const recentNotes = useMemo(() => {
    return [...notes].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 4);
  }, [notes]);

  if (statsLoading) return <LoadingSpinner />;

  const total = stats?.total ?? 0;
  const byProgress = stats?.by_progress ?? {
    none: 0,
    learning: 0,
    learned: 0,
    mastered: 0,
  };
  const maxProgress = Math.max(...PROGRESS_ROWS.map((p) => byProgress[p.key] ?? 0), 1);

  const username = user?.username ?? '同学';
  const heroLede = user
    ? `上次登录 ${formatDateTime(user.created_at)} · GitHub 已绑定（@${user.github_login ?? 'unknown'}）`
    : `你的项目库有 ${total} 个项目等待探索`;

  const MIN_TREND_W = 38;
  const trendStep = trending.length > 1 ? (100 - MIN_TREND_W) / (trending.length - 1) : 0;

  const heroArtChars = ['R', 'e', 'p', 'o', 'P', 'i', 'l', 'o', 't'];

  return (
    <>
      <div className="overview-hero-wrap">
        <div className="overview-hero-art" aria-hidden>
          <span className="overview-hero-artword">
            {heroArtChars.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="overview-hero-art-char"
                style={{ ['--art-i' as string]: index }}
              >
                <span className="overview-hero-art-char-glyph">{char}</span>
              </span>
            ))}
          </span>
        </div>
        <div className="overview-hero-glass glass-card glass-card--panel" aria-hidden />
        <section className="overview-hero-content">
          <h1>
            你好，<span>{username}</span> 👋
          </h1>
          <p className="lede">{heroLede}</p>
          <div className="quick-actions">
            <Link
              to="/agent"
              className="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass-btn quick-action-brand"
              onMouseEnter={handleChatBtnLook}
              onMouseMove={handleChatBtnLook}
              onMouseLeave={handleChatBtnLookEnd}
            >
              和 Agent 对话
            </Link>
            <Link
              to="/projects"
              className="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass-btn"
            >
              浏览项目库
            </Link>
            <Link
              to="/graph"
              className="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass-btn"
            >
              查看图谱
            </Link>
            <Link
              to="/settings"
              className="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass-btn"
            >
              设置
            </Link>
          </div>
        </section>
      </div>

      <section className="stat-grid" data-testid="stats-cards">
        <article className="stat-card">
          <div className="stat-label">总项目数</div>
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18}>
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
          </div>
          <div className="stat-value">{total}</div>
          <div className="stat-meta">
            {Object.keys(stats?.by_language ?? {}).length} 种语言 · 多分类
          </div>
        </article>
        <article className="stat-card stat-green">
          <div className="stat-label">已掌握</div>
          <div className="stat-value">{byProgress.mastered}</div>
          <div className="stat-meta">
            {total ? Math.round((byProgress.mastered / total) * 100) : 0}% · 占比
          </div>
        </article>
        <article className="stat-card stat-orange">
          <div className="stat-label">学习中</div>
          <div className="stat-value">{byProgress.learning}</div>
          <div className="stat-meta">
            {total ? Math.round((byProgress.learning / total) * 100) : 0}% · 占比
          </div>
        </article>
        <article className="stat-card stat-purple">
          <div className="stat-label">待开始</div>
          <div className="stat-value">{byProgress.none}</div>
          <div className="stat-meta">
            {total ? Math.round((byProgress.none / total) * 100) : 0}% · 占比
          </div>
        </article>
      </section>

      <AgentCarousel externalLookTarget={chatBtnLookTarget} />

      <section className="row-2col">
        <div className="panel panel-progress">
          <h3>学习进度分布</h3>
          <div className="progress-panel-body">
            <section className="agent-summary progress-panel-summary" aria-label="Mentor 学习周报">
              <div className="summary-head">
                <div className="summary-avatar">M</div>
                <div className="summary-meta">
                  <div className="summary-agent">Mentor · 本周学习总结</div>
                  <div className="summary-time">由 AI 自动生成</div>
                </div>
                <span className="summary-badge">AI</span>
              </div>
              <div className="summary-body">
                <p
                  dangerouslySetInnerHTML={{
                    __html:
                      profile?.history_summary ??
                      `${username}，本周继续保持学习节奏，Agent 将为你生成个性化周报。`,
                  }}
                />
              </div>
            </section>
            <div className="progress-overview">
              <p className="progress-section-title">分类总览</p>
              <div className="progress-bars">
                {PROGRESS_ROWS.map((p) => {
                  const v = byProgress[p.key] ?? 0;
                  const pct = Math.round((v / maxProgress) * 100);
                  return (
                    <div key={p.key} className="progress-row">
                      <span className="pl">{p.label}</span>
                      <div className="track">
                        <div className={`fill ${p.color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="pv">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h3>最近活动</h3>
            <Link to="/agent" className="more">
              查看全部 →
            </Link>
          </div>
          <div className="activity-list">
            {(activities ?? []).length === 0 ? (
              <div style={{ padding: '20px 12px', color: 'var(--text-400)', fontSize: 12, textAlign: 'center' }}>
                暂无活动
              </div>
            ) : (
              (activities ?? []).slice(0, 5).map((a) => (
                <Link key={a.id} className="activity-item" to="/agent">
                  <div className="activity-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={14} height={14}>
                      <path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9z" />
                    </svg>
                  </div>
                  <div className="activity-body">
                    <div className="activity-title">{a.title}</div>
                    <div className="activity-desc">{a.description}</div>
                  </div>
                  <span className="activity-time">{formatRelativeTime(a.created_at)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="row-2col">
        <div className="panel">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h3>为你推荐</h3>
            <Link to="/projects" className="more">
              查看全部 →
            </Link>
          </div>
          <div className="project-list">
            {recommended.map((p, i) => {
              const { owner, repo } = splitRepoName(p.name);
              return (
                <Link key={p.id} className="project-item" to={`/projects/${p.id}`}>
                  <div
                    className="project-avatar"
                    style={{ background: REPO_AVATAR_GRADIENTS[i % REPO_AVATAR_GRADIENTS.length] }}
                  >
                    {(repo[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="project-info">
                    <div className="project-name">
                      <span className="owner">{owner}</span>
                      <span className="slash">/</span>
                      <span>{repo}</span>
                    </div>
                    <div className="project-desc">{p.description ?? ''}</div>
                  </div>
                  <span className="project-stars">⭐ {formatNumber(p.stars)}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h3>最近笔记</h3>
            <Link to="/notes" className="more">
              查看全部 →
            </Link>
          </div>
          <div className="notes-list">
            {recentNotes.length === 0 ? (
              <div style={{ padding: '20px 12px', color: 'var(--text-400)', fontSize: 12, textAlign: 'center' }}>
                暂无笔记
              </div>
            ) : (
              recentNotes.map((n) => {
                const project = projectsData?.items.find((p) => p.id === n.project_id);
                return (
                  <Link key={n.id} className="note-item" to="/notes">
                    <div className="note-title">{n.title}</div>
                    <div className="note-meta">
                      <span className="tag-link">{project?.name ?? n.project_id}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(n.updated_at)}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="trending-section">
        <div className="trending-head">
          <div className="trending-head-left">
            <h2>
              <span className="trending-fire" aria-hidden>
                🔥
              </span>
              GitHub 近期热门
            </h2>
            <span className="trending-subtitle">基于 trending 数据，帮助你发现值得关注的项目</span>
          </div>
          <div className="period-toggle" role="tablist">
            {(['daily', 'weekly', 'monthly'] as TrendingPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`period-btn ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'daily' ? '今日' : p === 'weekly' ? '本周' : '本月'}
              </button>
            ))}
          </div>
        </div>
        <div className="trending-grid">
          {trending.length === 0 ? (
            <div className="trending-empty">该周期暂无数据</div>
          ) : (
            trending.slice(0, 50).map((r, index) => {
              const widthPct = Math.max(100 - index * trendStep, MIN_TREND_W);
              const { owner, repo } = splitRepoName(`${r.owner}/${r.repo}`);
              return (
                <a
                  key={`${r.owner}/${r.repo}`}
                  className={`trending-card ${trendingVisible ? 'is-visible' : ''}`}
                  style={{ ['--card-w' as string]: `${widthPct.toFixed(2)}%` }}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="trending-rank">{r.rank ?? index + 1}</div>
                  <div className="trending-body">
                    <div className="trending-name">
                      <span className="owner">{owner}</span>
                      <span className="slash">/</span>
                      <span>{repo}</span>
                    </div>
                    <div className="trending-desc">{r.description ?? ''}</div>
                    <div className="trending-meta">
                      <span className={`lang-dot ${langCssClass(r.language)}`}>
                        {r.language ?? '-'}
                      </span>
                      <span className="stars">★ {formatNumber(r.stars)}</span>
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
