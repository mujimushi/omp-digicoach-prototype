import { Check, TriangleAlert } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ds } from '../styles/tokens.ts';

export type ToastTone = 'success' | 'error';

export type ToastProps = {
  message: string | null;
  detail?: string | undefined;
  tone?: ToastTone;
};

/** A short message at the top of the screen, read out by screen readers. */
export function Toast({ message, detail, tone = 'success' }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(16px + env(safe-area-inset-top))',
        left: 16,
        right: 16,
        maxWidth: 468,
        margin: '0 auto',
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      {message && (
        <div
          style={{
            background: tone === 'success' ? ds.greenFill : ds.redText,
            borderRadius: 14,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(22,101,52,0.35)',
            animation: 'omp-toast-in .3s ease',
          }}
        >
          {tone === 'success' ? (
            <Check size={20} color="#fff" />
          ) : (
            <TriangleAlert size={20} color="#fff" />
          )}
          <div>
            <div style={{ color: ds.txW, fontSize: 14, fontWeight: 700 }}>
              {message}
            </div>
            {detail && (
              <div style={{ color: ds.txW, fontSize: 12 }}>{detail}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type ShowToast = (
  message: string,
  options?: { detail?: string; tone?: ToastTone },
) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

export const TOAST_MS = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastProps>({ message: null });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<ShowToast>((message, options = {}) => {
    clearTimeout(timer.current);
    setToast({
      message,
      detail: options.detail,
      tone: options.tone ?? 'success',
    });
    timer.current = setTimeout(() => setToast({ message: null }), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast {...toast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
