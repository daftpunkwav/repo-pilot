import { useState } from "react";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onSwitchToRegister: () => void;
}

export function LoginForm({ onLogin, onSwitchToRegister }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onLogin(username, password);
      }}
      className="w-full max-w-sm space-y-4 p-6 bg-surface rounded-lg border border-border"
    >
      <h1 className="text-xl font-semibold">RepoPilot 登录</h1>
      <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
      <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" className="w-full">登录</Button>
      <button type="button" onClick={onSwitchToRegister} className="w-full text-sm text-muted hover:text-text">
        还没有账号？注册
      </button>
    </form>
  );
}
