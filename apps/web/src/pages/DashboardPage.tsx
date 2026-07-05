import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { api } from "../api/client";
import type { Project } from "../types/project";
import { PROGRESS_LABELS } from "../types/project";

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get("/projects").then((res) => {
      const data = res as { data: Project[] };
      setProjects(data.data);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted">未登录，跳转中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">RepoPilot v2.0</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{user.username}</span>
          <button
            onClick={() => {
              clearAuth();
              navigate("/login");
            }}
            className="text-sm text-red-400 hover:text-red-300"
          >
            退出
          </button>
        </div>
      </header>
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="p-4 bg-surface border border-border rounded cursor-pointer hover:border-primary transition"
            >
              <h3 className="font-medium truncate">{p.name}</h3>
              <p className="text-sm text-muted mt-1 line-clamp-2">{p.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>{p.language || "未知语言"}</span>
                <span>{PROGRESS_LABELS[p.progress as keyof typeof PROGRESS_LABELS] || p.progress}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}