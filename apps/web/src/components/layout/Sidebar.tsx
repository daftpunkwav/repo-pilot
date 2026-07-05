import { useAuthStore } from "../../store/authStore";
import { Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/", label: "项目" },
  { to: "/graph", label: "图谱" },
  { to: "/agent", label: "Agent" },
  { to: "/settings", label: "设置" },
];

export function Sidebar() {
  const pathname = useLocation().pathname;
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="w-60 border-r border-border bg-surface flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <div className="text-sm font-semibold">RepoPilot</div>
        <div className="text-xs text-muted mt-1">{user?.username}</div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map((item) => (
          <Link key={item.to} to={item.to} className={`block px-3 py-2 rounded text-sm ${pathname === item.to ? "bg-primary/10 text-primary" : "text-muted hover:text-text"}`}>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
