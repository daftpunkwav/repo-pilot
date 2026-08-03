"""SSE 事件格式化"""
import json
from typing import Any


def format_sse(event: str, data: dict[str, Any]) -> str:
    """把事件包装为 SSE 帧：`event: <event>\\ndata: <json>\\n\\n`。

    契约说明（供前端）：
    - data 为 JSON，字面换行会被 json.dumps 转义为 `\\n`，不会破坏帧结构。
    - `content` 等文本字段是 **Markdown 原文**（含 `<`/`>` 等字符，不做 HTML 转义，
      转义会破坏 Markdown 渲染）。前端必须用 Markdown 渲染器展示，
      禁止 `dangerouslySetInnerHTML` / `innerHTML` 直接注入。
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
