interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

/** 登录/注册页布局 — 对齐 archive/login.html */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="auth-bg" style={{ minHeight: '100vh' }}>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          padding: '48px 32px',
        }}
      >
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-logo">RP</div>
            <h1 className="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          </div>
          {children}
          <p className="auth-version">RepoPilot v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
