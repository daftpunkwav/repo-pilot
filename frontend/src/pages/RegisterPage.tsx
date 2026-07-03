import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/auth/register", form);
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 p-6 bg-surface rounded-lg border border-border">
        <h1 className="text-xl font-semibold">注册</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input className="w-full px-3 py-2 bg-bg border border-border rounded" placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="w-full px-3 py-2 bg-bg border border-border rounded" placeholder="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="w-full px-3 py-2 bg-bg border border-border rounded" placeholder="密码" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" className="w-full py-2 bg-primary text-white rounded">注册</button>
      </form>
    </div>
  );
}
