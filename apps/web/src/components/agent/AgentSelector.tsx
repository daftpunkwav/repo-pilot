import type { AgentId, AgentProfile } from '@/api/types';
import { useAgentStore } from '@/stores/agentStore';
import { AGENT_INITIALS } from '@/utils/labels';

interface AgentSelectorProps {
  profiles: AgentProfile[];
}

export function AgentSelector({ profiles }: AgentSelectorProps) {
  const activeAgent = useAgentStore((s) => s.activeAgent);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);

  return (
    <div className="agent-switcher" title="切换 Agent">
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`agent-avatar agent-${p.id} ${activeAgent === p.id ? 'active' : ''}`}
          title={`${p.name} · ${p.description}`}
          onClick={() => setActiveAgent(p.id as AgentId)}
        >
          <span>{AGENT_INITIALS[p.id] ?? p.name[0]}</span>
        </button>
      ))}
    </div>
  );
}
