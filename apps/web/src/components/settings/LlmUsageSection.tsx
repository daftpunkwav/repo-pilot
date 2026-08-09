import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

const DAYS_OPTIONS = [7, 14, 30, 90];

export function LlmUsageSection() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['llm-usage', days],
    queryFn: () => getApi().getLlmUsage(days),
  });

  const usage = data?.data;

  return (
    <section className="settings-section glass-card glass-card--overview-outer">
      <h2>LLM 用量统计</h2>
      <p className="section-desc">各模型调用量与费用估算（仅本实例，时区本地）</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-500)' }}>统计周期</span>
        <div className="layout-switch" style={{ height: 28 }}>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={days === d ? 'active' : ''}
              style={{ height: 22, fontSize: 12 }}
              onClick={() => setDays(d)}
            >
              {d === 7 ? '7 天' : d === 14 ? '14 天' : d === 30 ? '30 天' : '90 天'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ height: 28, marginLeft: 'auto' }}
          onClick={() => void refetch()}
        >
          刷新
        </button>
      </div>

      {isLoading && <LoadingSpinner />}
      {isError && (
        <p style={{ color: 'var(--error)', fontSize: 13 }}>
          [LLM_USAGE_MODULE_DOWN] 用量统计服务暂不可用
        </p>
      )}

      {usage && (
        <>
          {/* 总计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: '输入 Token', value: fmtTokens(usage.total_input_tokens) },
              { label: '输出 Token', value: fmtTokens(usage.total_output_tokens) },
              { label: '费用估算', value: fmtCost(usage.total_cost_usd) },
            ].map((item) => (
              <div key={item.label} className="glass-card glass-card--overview-inner" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-500)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 按模型汇总 */}
          {usage.by_model.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>按模型</h3>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 20 }}>
                <thead>
                  <tr style={{ color: 'var(--text-500)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px' }}>模型</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>输入</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>输出</th>
                    <th style={{ padding: '4px 8px', textAlign: 'right' }}>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.by_model.map((row) => (
                    <tr key={row.model} style={{ borderTop: '1px solid var(--bg-300)' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.model}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtTokens(row.input_tokens)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtTokens(row.output_tokens)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtCost(row.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* 按日趋势 */}
          {usage.by_day.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>每日趋势</h3>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 64, marginBottom: 4 }}>
                {usage.by_day.map((row) => {
                  const maxTotal = Math.max(...usage.by_day.map((r) => r.input_tokens + r.output_tokens), 1);
                  const total = row.input_tokens + row.output_tokens;
                  const pct = Math.round((total / maxTotal) * 100);
                  return (
                    <div key={row.date} title={`${row.date}: ${fmtTokens(total)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(4, pct * 0.56)}px`,
                          background: 'var(--brand-500)',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8,
                          transition: 'height 0.3s',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {usage.by_day.map((row) => (
                  <div key={row.date} style={{ flex: 1, fontSize: 9, color: 'var(--text-400)', textAlign: 'center', overflow: 'hidden' }}>
                    {row.date.slice(5)}
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 20 }} />
            </>
          )}

          {/* 最近调用 */}
          {usage.recent_calls.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>最近调用</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {usage.recent_calls.map((call, i) => (
                  <div key={i} className="glass-card glass-card--overview-inner" style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-400)', minWidth: 100 }}>{fmtTs(call.ts)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-500)' }}>{call.model}</span>
                    {call.agent && <span className="badge">{call.agent}</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', color: 'var(--text-500)' }}>
                      {fmtTokens(call.input_tokens)} → {fmtTokens(call.output_tokens)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
