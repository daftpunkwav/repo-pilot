interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-page__blob" aria-hidden />
      <div className="auth-card glass">
        <div className="auth-card__brand">
          <div className="auth-card__logo">RP</div>
          <span className="auth-card__name">RepoPilot</span>
        </div>
        <h1 className="auth-card__title">{title}</h1>
        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
