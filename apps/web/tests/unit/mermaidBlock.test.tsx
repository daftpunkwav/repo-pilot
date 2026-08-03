import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { looksLikeMermaid } from '@/components/common/MermaidBlock';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

describe('looksLikeMermaid', () => {
  it('识别 language-mermaid', () => {
    expect(looksLikeMermaid('mermaid', 'graph TD\nA-->B')).toBe(true);
  });

  it('识别 graph/flowchart 开头的 fence 内容', () => {
    expect(looksLikeMermaid(null, 'graph TD\nA-->B')).toBe(true);
    expect(looksLikeMermaid('text', 'flowchart LR\nA-->B')).toBe(true);
    expect(looksLikeMermaid(null, 'sequenceDiagram\nA->>B: hi')).toBe(true);
  });

  it('普通代码不误判', () => {
    expect(looksLikeMermaid('python', 'print("hi")')).toBe(false);
    expect(looksLikeMermaid(null, 'const x = 1')).toBe(false);
  });
});

describe('MarkdownRenderer mermaid', () => {
  it('普通段落可渲染（冒烟）', () => {
    render(createElement(MarkdownRenderer, { content: 'hello **world**' }));
    expect(screen.getByText('world')).toBeTruthy();
  });

  it('mermaid fence 走图组件路径（初始为 fallback 代码块）', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```';
    render(createElement(MarkdownRenderer, { content: md }));
    // 渲染成功前/失败时均为 fallback；关键是出现 mermaid 专用容器而非裸 pre.hljs
    const fallback = screen.getByTestId('mermaid-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('graph TD');
    expect(document.querySelector('.md-codeblock > pre.hljs:not(.md-mermaid--fallback *)')).toBeNull();
  });

  it('graph TD 无语言标记也走 MermaidBlock', () => {
    const md = '```\ngraph TD\n  A-->B\n```';
    render(createElement(MarkdownRenderer, { content: md }));
    expect(screen.getByTestId('mermaid-fallback')).toBeTruthy();
  });
});
