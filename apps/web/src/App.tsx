import { lazy, Suspense, useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell, AgentShell, NotesShell } from '@/components/layout/AppShell';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';

const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const OverviewPage = lazy(() =>
  import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
);
const ProjectDetailPage = lazy(() =>
  import('@/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage }))
);
const AgentPage = lazy(() =>
  import('@/pages/AgentPage').then((m) => ({ default: m.AgentPage }))
);
const GraphPage = lazy(() =>
  import('@/pages/GraphPage').then((m) => ({ default: m.GraphPage }))
);
const NotesPage = lazy(() =>
  import('@/pages/NotesPage').then((m) => ({ default: m.NotesPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner fullScreen />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
  },
  {
    path: '/register',
    element: (
      <Lazy>
        <RegisterPage />
      </Lazy>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <OverviewPage />
          </Lazy>
        ),
      },
      {
        path: 'projects',
        element: (
          <Lazy>
            <ProjectsPage />
          </Lazy>
        ),
      },
      {
        path: 'projects/:id',
        element: (
          <Lazy>
            <ProjectDetailPage />
          </Lazy>
        ),
      },
      {
        path: 'graph',
        element: (
          <Lazy>
            <GraphPage />
          </Lazy>
        ),
      },
      {
        path: 'settings',
        element: (
          <Lazy>
            <SettingsPage />
          </Lazy>
        ),
      },
      {
        path: 'profile',
        element: (
          <Lazy>
            <ProfilePage />
          </Lazy>
        ),
      },
    ],
  },
  {
    path: '/agent',
    element: (
      <ProtectedRoute>
        <AgentShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <AgentPage />
          </Lazy>
        ),
      },
      {
        path: 'sessions/:sessionId',
        element: (
          <Lazy>
            <AgentPage />
          </Lazy>
        ),
      },
    ],
  },
  {
    path: '/notes',
    element: (
      <ProtectedRoute>
        <NotesShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <NotesPage />
          </Lazy>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);
  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
