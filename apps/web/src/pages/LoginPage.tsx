import { FormEvent, useState } from "react";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { login } from "../api/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        const res = await login(form.username, form.password);
        const data = res as { data: { access_token: string; user: { id: string; username: string } } };
        setAuth(data.data.access_token, data.data.user);
        navigate("/");
      } else {
        await login(form.username, form.password, form.email);
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 bg-surface rounded-lg border border-border">
        <h1 className="text-xl font-semibold">{mode === "login" ? "登录" : "注册"}</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Input placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        {mode === "register" && <Input placeholder="邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        <Input type="password" placeholder="密码" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" className="w-full">{mode === "login" ? "登录" : "注册"}</Button>
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="w-full text-sm text-muted hover:text-text">
          {mode === "login" ? "还没有账号？注册" : "已有账号？登录"}
        </button>
      </form>
    </div>
  );
}
