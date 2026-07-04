import type { AgentId, AgentProfile } from '@/api/types';
import { useAgentStore } from '@/stores/agentStore';

interface AgentSelectorProps {
  profiles: AgentProfile[];
}

export function AgentSelector({ profiles }: AgentSelectorProps) {
  const activeAgent = useAgentStore((s) => s.activeAgent);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);

  return (
    <div className="agent-selector">
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`agent-selector__btn ${activeAgent === p.id ? 'active' : ''}`}
          onClick={() => setActiveAgent(p.id as AgentId)}
          title={p.description}
        >
          <span className="agent-selector__emoji">{p.avatar_emoji}</span>
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  );
}
