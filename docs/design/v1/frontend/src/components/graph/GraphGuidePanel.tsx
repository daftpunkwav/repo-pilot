import { EmbedAgentChat } from '@/components/agent/EmbedAgentChat';

interface GraphGuidePanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedNodeId: string | null;
}

export function GraphGuidePanel({
  collapsed,
  onToggleCollapse,
  selectedNodeId,
}: GraphGuidePanelProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        className="graph-agent-collapse-tab"
        onClick={onToggleCollapse}
        title="展开图谱向导"
      >
        Atlas
      </button>
    );
  }

  return (
    <aside className="graph-agent-panel">
      <button
        type="button"
        className="graph-agent-panel__collapse"
        onClick={onToggleCollapse}
        aria-label="收起"
      >
        ›
      </button>
      <EmbedAgentChat
        mode="graph"
        title="Atlas · 图谱向导"
        subtitle="专用于解读项目关系网络"
        agentInitial="A"
        agentClassName="agent-navigator"
        graphNodeId={selectedNodeId}
        placeholder="问我图谱结构、相似度含义…"
      />
    </aside>
  );
}
