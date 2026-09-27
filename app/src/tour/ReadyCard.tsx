import { CircleCheck } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { ds } from '../styles/tokens.ts';
import { Button } from '../ui/Button.tsx';
import { IconCircle } from '../ui/IconCircle.tsx';

/** The last card, after the practice session. */
export function ReadyCard({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.focus();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,46,92,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 300,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          ...ds.card,
          background: '#fff',
          width: '100%',
          maxWidth: 360,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <IconCircle Icon={CircleCheck} color={ds.green} size={52} />
        </div>
        <h2
          id={titleId}
          style={{ fontSize: 19, color: ds.warmDk, margin: '14px 0 8px' }}
        >
          You’re ready
        </h2>
        <p style={{ fontSize: 15, color: ds.txB, margin: '0 0 20px' }}>
          Replay this tour from More.
        </p>
        <Button ref={button} fullWidth onClick={onClose}>
          Start teaching
        </Button>
      </div>
    </div>
  );
}
