import { useEffect, useId, useState } from 'react';

/** 显式 mermaid fence，或内容以常见图语法开头 */
export function looksLikeMermaid(lang: string | null | undefined, code: string): boolean {
  if ((lang || '').toLowerCase() === 'mermaid') return true;
  const head = code.trimStart().slice(0, 48);
  return /^(graph\s|flowchart\s|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie\b|mindmap|timeline)/i.test(
    head,
  );
}

interface MermaidBlockProps {
  code: string;
}

/**
 * 客户端 Mermaid → SVG；流式未闭合或语法错误时降级为代码块，避免白屏。
 */
export function MermaidBlock({ code }: MermaidBlockProps) {
  const reactId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);

    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'strict',
          fontFamily: 'inherit',
        });
        const { svg: rendered } = await mermaid.render(`mmd-${reactId}`, code);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setSvg(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (failed || !svg) {
    return (
      <div className="md-codeblock md-mermaid--fallback" data-testid="mermaid-fallback">
        <div className="md-codeblock__lang">mermaid</div>
        <pre className="hljs">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="md-mermaid"
      data-testid="mermaid-svg"
      // Mermaid 输出受 securityLevel=strict 约束
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
