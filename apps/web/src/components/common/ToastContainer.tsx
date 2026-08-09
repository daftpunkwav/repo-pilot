import { useUIStore } from '@/stores/uiStore';
import { describeError } from '@/utils/errorCodes';

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" role="alert">
      {toasts.map((t) => {
        const desc = t.code ? describeError(t.code) : null;
        const title = desc?.title ?? t.message;
        return (
          <div key={t.id} className={`toast toast--${t.type}`} role="alert">
            <div className="toast__body">
              <div className="toast__row">
                {t.code && (
                  <span className="toast-code" data-testid="toast-code">
                    [{t.code}]
                  </span>
                )}
                <span className="toast-title">{title}</span>
              </div>
              {desc?.hint && <span className="toast-hint">{desc.hint}</span>}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => removeToast(t.id)}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
