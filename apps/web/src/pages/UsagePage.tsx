import { LlmUsageSection } from '@/components/settings/LlmUsageSection';

/** LLM 用量独立页（从设置迁至主导航） */
export function UsagePage() {
  return (
    <div className="usage-page" style={{ padding: '8px 4px 24px', maxWidth: 960 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>用量</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-500)' }}>
          本实例 LLM 调用量与费用估算
        </p>
      </header>
      <LlmUsageSection />
    </div>
  );
}
