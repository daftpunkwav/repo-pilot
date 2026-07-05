import { useState } from "react";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

interface RegisterFormProps {
  onRegister: (username: string, password: string, email?: string) => void;
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRegister(username, password, email);
      }}
      className="w-full max-w-sm space-y-4 p-6 bg-surface rounded-lg border border-border"
    >
      <h1 className="text-xl font-semibold">注册</h1>
      <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
      <Input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" className="w-full">注册</Button>
      <button type="button" onClick={onSwitchToLogin} className="w-full text-sm text-muted hover:text-text">
        已有账号？登录
      </button>
    </form>
  );
}
