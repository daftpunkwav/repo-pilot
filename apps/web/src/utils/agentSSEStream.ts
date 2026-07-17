/**
 * 可复用的 Agent SSE 流消费器。
 * 主聊天、导入助手、图谱向导、详情分析等均可共用。
 */
import type { SSEEvent } from '@/api/types';
import { asSSETextDelta, asSSEThinking } from '@/utils/sse-helpers';

export interface AgentStreamHandlers {
  onTextDelta?: (piece: string, fullText: string) => void;
  onThinking?: (piece: string, fullThinking: string) => void;
  onSelectRepos?: (data: Record<string, unknown>) => void;
  onToolCall?: (data: Record<string, unknown>) => void;
  onToolResult?: (data: Record<string, unknown>) => void;
  onAgentSwitch?: (data: Record<string, unknown>) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (message: string, data?: Record<string, unknown>) => void;
  /** 任意事件兜底钩子 */
  onEvent?: (event: SSEEvent) => void;
}

export interface AgentStreamResult {
  text: string;
  thinking: string;
  sawError: boolean;
  errorMessage: string;
  doneData: Record<string, unknown> | null;
}

/**
 * 消费 Agent SSE 流，聚合 text / thinking，并分发到 handlers。
 * 不负责 UI 状态；调用方可在 onTextDelta 中节流刷新界面。
 */
export async function consumeAgentSSEStream(
  stream: AsyncIterable<SSEEvent>,
  handlers: AgentStreamHandlers = {},
  options?: { signal?: AbortSignal },
): Promise<AgentStreamResult> {
  let text = '';
  let thinking = '';
  let sawError = false;
  let errorMessage = '';
  let doneData: Record<string, unknown> | null = null;
  const signal = options?.signal;

  for await (const event of stream) {
    if (signal?.aborted) break;
    handlers.onEvent?.(event);

    switch (event.event) {
      case 'text_delta': {
        const piece = asSSETextDelta(event.data).content ?? '';
        if (piece) {
          text += piece;
          handlers.onTextDelta?.(piece, text);
        }
        break;
      }
      case 'thinking': {
        const piece = asSSEThinking(event.data).content ?? '';
        if (piece) {
          thinking += piece;
          handlers.onThinking?.(piece, thinking);
        }
        break;
      }
      case 'select_repos': {
        handlers.onSelectRepos?.(event.data as Record<string, unknown>);
        break;
      }
      case 'tool_call': {
        handlers.onToolCall?.(event.data as Record<string, unknown>);
        break;
      }
      case 'tool_result': {
        handlers.onToolResult?.(event.data as Record<string, unknown>);
        break;
      }
      case 'agent_switch': {
        handlers.onAgentSwitch?.(event.data as Record<string, unknown>);
        break;
      }
      case 'done': {
        doneData = event.data as Record<string, unknown>;
        handlers.onDone?.(doneData);
        break;
      }
      case 'error': {
        sawError = true;
        errorMessage =
          (event.data as { message?: string })?.message ??
          '助手返回错误，请稍后再试。';
        handlers.onError?.(errorMessage, event.data as Record<string, unknown>);
        break;
      }
      default:
        break;
    }
  }

  return { text, thinking, sawError, errorMessage, doneData };
}
