import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStats } from '@/hooks/useProjects';
import { useAllNotes } from '@/hooks/useNotes';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { key: 'overview', label: '总览', path: '/', badge: 'projects' as const },
  { key: 'projects', label: '项目库', path: '/projects', badge: 'projects' as const },
  { key: 'agent', label: 'Agent Chat', path: '/agent', badge: 'ai' as const },
  { key: 'graph', label: '图谱', path: '/graph', badge: null },
  { key: 'notes', label: '笔记', path: '/notes', badge: 'notes' as const },
  { key: 'settings', label: '设置', path: '/settings', badge: null },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const { data: stats } = useProjectStats();
  const { data: notes } = useAllNotes();

  return (
    <aside className={cn('sidebar', collapsed && 'sidebar--collapsed')}>
      <div className="sidebar__brand">
        <div className="sidebar__logo">RP</div>
        {!collapsed && <span className="sidebar__title">RepoPilot</span>}
      </div>
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn('sidebar__link', isActive && 'sidebar__link--active')
            }
          >
            <span className="sidebar__link-label">{item.label}</span>
            {item.badge === 'ai' && !collapsed && (
              <span className="sidebar__badge sidebar__badge--ai">AI</span>
            )}
            {item.badge === 'projects' && stats && !collapsed && item.key === 'projects' && (
              <span className="sidebar__badge">{stats.total}</span>
            )}
            {item.badge === 'notes' && notes && !collapsed && (
              <span className="sidebar__badge">{notes.length}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        className="sidebar__toggle"
        onClick={toggle}
        aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
      >
        {collapsed ? '»' : '«'}
      </button>
    </aside>
  );
}
