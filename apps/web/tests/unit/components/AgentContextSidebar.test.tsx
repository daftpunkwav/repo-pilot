import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AgentContextSidebar } from '@/components/agent/AgentContextSidebar';

vi.mock('@/api/client', () => ({
  getApi: () => ({
    getUserProfile: vi.fn().mockResolvedValue({
      data: { memory_items: [], goals: [] },
    }),
    updateUserProfile: vi.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('AgentContextSidebar', () => {
  const baseProps = {
    contextProjects: [],
    sessionId: null,
    toolLogOpen: false,
    onToggleToolLog: vi.fn(),
    toolCalls: new Map<string, { name: string; result?: unknown }>(),
    onToggleCollapse: vi.fn(),
  };

  it('收起时仅显示展开标签', () => {
    render(<AgentContextSidebar {...baseProps} collapsed />, { wrapper });
    expect(screen.getByTestId('context-panel-expand')).toBeInTheDocument();
    expect(screen.queryByText(/当前上下文/)).not.toBeInTheDocument();
  });

  it('展开时显示面板与收起按钮', () => {
    render(<AgentContextSidebar {...baseProps} collapsed={false} />, { wrapper });
    expect(screen.getByTestId('context-panel-collapse')).toBeInTheDocument();
    expect(screen.getByText(/当前上下文/)).toBeInTheDocument();
  });

  it('点击收起按钮触发 onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    render(
      <AgentContextSidebar
        {...baseProps}
        collapsed={false}
        onToggleCollapse={onToggleCollapse}
      />,
      { wrapper }
    );
    fireEvent.click(screen.getByTestId('context-panel-collapse'));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });
});
