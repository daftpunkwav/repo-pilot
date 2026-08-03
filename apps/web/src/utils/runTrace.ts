import type { AgentId, ToolCallData } from '@/api/types';

export interface SubagentTrace {
  agentId: AgentId;
  task?: string;
  reason?: string;
  status: 'running' | 'ok' | 'question' | 'error';
  /** 从 Hub 合流思考中拆出的该专家片段 */
  thinking?: string;
}

const AGENT_TITLE: Record<string, string> = {
  hub: 'Hub',
  scout: 'Scout',
  mentor: 'Mentor',
  navigator: 'Navigator',
  curator: 'Curator',
  scribe: 'Scribe',
  atlas: 'Atlas',
};

export function agentDisplayName(agentId: string): string {
  return AGENT_TITLE[agentId] ?? agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

/** 从合流 thinking 中拆出 【Scout】… 片段 */
export function extractExpertThinking(
  fullThinking: string | undefined | null,
  agentId: string
): string {
  const text = (fullThinking ?? '').trim();
  if (!text) return '';
  const name = agentDisplayName(agentId);
  const re = new RegExp(
    `【${name}】\\s*\\n?([\\s\\S]*?)(?=\\n【[A-Za-z\\u4e00-\\u9fff]+】|$)`
  );
  const m = text.match(re);
  return (m?.[1] ?? '').trim();
}

export function snapshotToolCalls(
  toolCalls: Map<string, { name: string; args: Record<string, unknown>; result?: unknown }>
): ToolCallData[] {
  return Array.from(toolCalls.entries())
    .filter(([, tc]) => tc.name !== 'ask_user')
    .map(([, tc]) => ({
      name: tc.name,
      args: tc.args ?? {},
      ...(tc.result !== undefined ? { result: tc.result } : {}),
    }));
}

export function snapshotSubagents(
  subagents: Array<{
    agentId: AgentId;
    task?: string;
    reason?: string;
    status: SubagentTrace['status'];
  }>,
  fullThinking: string | undefined | null
): SubagentTrace[] {
  return subagents.map((sa) => {
    const thinking = extractExpertThinking(fullThinking, sa.agentId);
    return {
      agentId: sa.agentId,
      task: sa.task,
      reason: sa.reason,
      status: sa.status === 'running' ? 'ok' : sa.status,
      ...(thinking ? { thinking } : {}),
    };
  });
}
