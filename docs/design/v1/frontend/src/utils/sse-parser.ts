import type { SSEEvent, SSEEventType } from '@/api/types';

/**
 * 解析 SSE 文本流（`event: xxx\ndata: {...}\n\n` 格式）
 * 供真实后端 ReadableStream 消费使用
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const event = parseSSEBlock(part);
      if (event) yield event;
    }
  }

  if (buffer.trim()) {
    const event = parseSSEBlock(buffer);
    if (event) yield event;
  }
}

function parseSSEBlock(block: string): SSEEvent | null {
  let eventType: SSEEventType | null = null;
  let dataStr = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim() as SSEEventType;
    } else if (line.startsWith('data:')) {
      dataStr += line.slice(5).trim();
    }
  }

  if (!eventType || !dataStr) return null;

  try {
    const data = JSON.parse(dataStr) as Record<string, unknown>;
    return { event: eventType, data };
  } catch {
    return null;
  }
}
