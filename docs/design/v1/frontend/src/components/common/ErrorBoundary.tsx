import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 应用级错误边界
 *
 * - 捕获子树渲染时的同步异常，避免整页白屏
 * - 提供「重新加载」入口
 * - 控制台保留原始错误信息便于排查
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // 生产环境可对接 Sentry / DataDog；本地仅 console.error
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="app-error-fallback" role="alert" data-testid="app-error-fallback">
        <h2>页面出错了</h2>
        <p>请刷新页面或点击下方按钮重试。</p>
        <pre className="app-error-fallback__detail">{error.message}</pre>
        <button type="button" className="btn btn-primary" onClick={this.reset}>
          重试
        </button>
      </div>
    );
  }
}
