import { useState } from "react";
import { useAgentStore } from "../store/agentStore";
import { sendChatMessage } from "../api/agent";

export default function AgentPage() {
  const [input, setInput] = useState("");
  const { messages, appendMessage, setLoading } = useAgentStore();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    appendMessage({ id: Date.now().toString(), role: "user", content: input });
    setLoading(true);
    try {
      const res = await sendChatMessage(input);
      const data = res as { data?: { content?: string } };
      appendMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: data?.data?.content || "暂无回复" });
    } catch {
      appendMessage({ id: (Date.now() + 1).toString(), role: "assistant", content: "请求失败，请稍后重试" });
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Agent 对话</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-xl ${m.role === "user" ? "ml-auto text-right" : "mr-auto text-left"}`}>
            <span className="inline-block px-4 py-2 rounded-lg border border-border bg-surface whitespace-pre-wrap">{m.content}</span>
          </div>
        ))}
      </main>
      <footer className="p-4 border-t border-border">
        <form onSubmit={onSubmit} className="flex gap-2 max-w-3xl mx-auto">
          <input
            className="flex-1 px-3 py-2 bg-bg border border-border rounded"
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded">发送</button>
        </form>
      </footer>
    </div>
  );
}
