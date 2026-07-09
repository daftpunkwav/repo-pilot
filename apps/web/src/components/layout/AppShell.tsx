import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, type SidebarPageKey } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/common/ToastContainer';
import { useOverviewMockRoundSync } from '@/hooks/useOverviewMockRoundSync';

function resolveActivePage(pathname: string): SidebarPageKey {
  if (pathname === '/') return 'overview';
  if (pathname.startsWith('/projects/')) return 'project-detail';
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/agent')) return 'agent';
  if (pathname.startsWith('/graph')) return 'graph';
  if (pathname.startsWith('/notes')) return 'notes';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'overview';
}

/** 标准应用壳：与原型 .app > .main > .content 一致 */
export function AppShell() {
  const { pathname } = useLocation();
  const activePage = resolveActivePage(pathname);
  useOverviewMockRoundSync();

  return (
    <div className="app">
      <Sidebar activePage={activePage} />
      <div className="main">
        <Topbar />
        <main className="content">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

/** Agent 页专用壳：四栏 grid，无顶栏 */
export function AgentShell() {
  return (
    <div className="agent-shell">
      <Sidebar activePage="agent" />
      <Outlet />
      <ToastContainer />
    </div>
  );
}

/** 笔记页专用壳：侧栏 + notes-main，无标准顶栏 */
export function NotesShell() {
  return (
    <div className="app">
      <Sidebar activePage="notes" />
      <div className="notes-main">
        <Outlet />
      </div>
      <ToastContainer />
    </div>
  );
}
