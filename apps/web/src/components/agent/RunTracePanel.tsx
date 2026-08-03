import { useState } from 'react';
import type { AgentId, ToolCallData } from '@/api/types';
import { ToolCallCard } from '@/components/agent/ToolCallCard';
import { AGENT_INITIALS, AGENT_ROLE_LABELS } from '@/utils/labels';
import { displaySwitchReason } from '@/utils/agentSwitchDisplay';
import {
  agentDisplayName,
  type SubagentTrace,
} from '@/utils/runTrace';

interface RunTracePanelProps {
  toolCalls?: ToolCallData[];
  subagents?: SubagentTrace[];
  /** 流式中可选：点击专家时高亮/外控展开 */
  defaultOpenAgentId?: string | null;
}

/** 落盘后的调度/工具踪迹：可点击内嵌 Agent 查看其思考过程 */
export function RunTracePanel({
  toolCalls,
  subagents,
  defaultOpenAgentId = null,
}: RunTracePanelProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenAgentId);
  const tools = (toolCalls ?? []).filter((t) => t.name !== 'ask_user');
  const agents = subagents ?? [];
  if (tools.length === 0 && agents.length === 0) return null;

  return (
    <div className="run-trace" data-testid="run-trace">
      {agents.length > 0 && (
        <div className="hub-subagents" aria-label="内嵌 Agent">
          {agents.map((sa) => {
            const open = openId === sa.agentId;
            const hasThinking = Boolean(sa.thinking?.trim());
            return (
              <div key={sa.agentId} className="hub-subagent-wrap">
                <button
                  type="button"
                  className="hub-subagent hub-subagent--btn"
                  data-status={sa.status}
                  data-open={open ? '1' : '0'}
                  aria-expanded={hasThinking ? open : undefined}
                  disabled={!hasThinking}
                  onClick={() => {
                    if (!hasThinking) return;
                    setOpenId((cur) => (cur === sa.agentId ? null : sa.agentId));
                  }}
                >
                  <span className={`hub-subagent__avatar agent-${sa.agentId}`}>
                    {AGENT_INITIALS[sa.agentId as AgentId] ??
                      sa.agentId[0]?.toUpperCase()}
                  </span>
                  <div className="hub-subagent__meta">
                    <span className="hub-subagent__name">
                      {agentDisplayName(sa.agentId)}
                      <span className="hub-subagent__role">
                        {AGENT_ROLE_LABELS[sa.agentId as AgentId] ?? ''}
                      </span>
                    </span>
                    <span className="hub-subagent__status">
                      {sa.status === 'running'
                        ? '执行中'
                        : sa.status === 'question'
                          ? '等待回答'
                          : sa.status === 'error'
                            ? '失败'
                            : '完成'}
                      {hasThinking ? (open ? ' · 收起过程' : ' · 查看过程') : ''}
                    </span>
                    {sa.reason && (
                      <span className="hub-subagent__reason" title={sa.reason}>
                        {displaySwitchReason(sa.reason, sa.agentId, 64)}
                      </span>
                    )}
                  </div>
                </button>
                {open && hasThinking && (
                  <pre className="hub-subagent__thinking" data-testid="subagent-thinking">
                    {sa.thinking}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tools.map((tc, i) => (
        <ToolCallCard
          key={`${tc.name}_${i}`}
          name={tc.name}
          args={tc.args}
          result={tc.result}
        />
      ))}
    </div>
  );
}
