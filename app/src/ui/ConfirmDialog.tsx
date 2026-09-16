import { type ReactNode, useEffect, useId, useRef } from 'react';
import { ds } from '../styles/tokens.ts';
import { Button } from './Button.tsx';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
};

/** Asks before an action that can't be undone. Escape or Cancel closes it. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,46,92,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 300,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        style={{
          ...ds.card,
          background: '#fff',
          padding: 20,
          width: '100%',
          maxWidth: 380,
        }}
      >
        <h2
          id={titleId}
          style={{ fontSize: 18, margin: '0 0 8px', color: ds.warmDk }}
        >
          {title}
        </h2>
        {children && (
          <div
            id={bodyId}
            style={{ fontSize: 14, color: ds.txB, lineHeight: 1.5 }}
          >
            {children}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
