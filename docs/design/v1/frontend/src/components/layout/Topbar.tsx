import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const BREADCRUMB_MAP: Record<string, string> = {
  '/': '总览',
  '/projects': '项目库',
  '/agent': 'Agent Chat',
  '/graph': '知识图谱',
  '/notes': '笔记',
  '/settings': '设置',
  '/profile': '个人资料',
};

function getBreadcrumb(pathname: string): string {
  if (pathname.startsWith('/projects/') && pathname !== '/projects') {
    const id = pathname.split('/')[2] ?? '';
    return `项目库 / ${id}`;
  }
  if (pathname.startsWith('/agent/sessions/')) {
    return 'Agent Chat';
  }
  return BREADCRUMB_MAP[pathname] ?? '总览';
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initial = user?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <header className="topbar">
      <div className="topbar__breadcrumb">{getBreadcrumb(location.pathname)}</div>
      <div className="topbar__user">
        <button
          type="button"
          className="topbar__user-btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="topbar__avatar" />
          ) : (
            <span className="topbar__avatar topbar__avatar--placeholder">{initial}</span>
          )}
          <span>{user?.username}</span>
          <span aria-hidden>▾</span>
        </button>
        {menuOpen && (
          <div className="topbar__menu glass">
            <Link to="/profile" className="topbar__menu-item" onClick={() => setMenuOpen(false)}>
              个人资料
            </Link>
            <Link to="/settings" className="topbar__menu-item" onClick={() => setMenuOpen(false)}>
              设置
            </Link>
            <hr className="topbar__menu-divider" />
            <button type="button" className="topbar__menu-item" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
