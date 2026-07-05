import { useState } from "react";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">设置</h1>
      </header>
      <main className="p-6 max-w-2xl space-y-6">
        <section>
          <h2 className="text-sm font-medium mb-2">主题</h2>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="px-3 py-2 bg-bg border border-border rounded"
          >
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </section>
        <section>
          <h2 className="text-sm font-medium mb-2">AI 配置</h2>
          <p className="text-sm text-muted">v2.0 将在此处接入 LLM API Key 配置。</p>
        </section>
      </main>
    </div>
  );
}
