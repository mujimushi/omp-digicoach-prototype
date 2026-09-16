import { Copy } from 'lucide-react';
import { useState } from 'react';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';

/** A temporary password, shown once. It lives only in this page's memory. */
export function PasswordOnce({
  username,
  password,
  onDone,
}: {
  username: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      aria-label="Temporary password"
      style={{
        background: '#fff',
        border: `2px solid ${ds.goldFill}`,
        borderRadius: 14,
        padding: 20,
        maxWidth: 520,
      }}
    >
      <h2 style={{ fontSize: 18, color: ds.warmDk, margin: '0 0 8px' }}>
        Temporary password for {username}
      </h2>
      <p style={{ fontSize: 14, color: ds.txB, margin: '0 0 12px' }}>
        This is shown once. Give it in person or by phone, never by email or
        chat. They must choose their own password at first login.
      </p>
      <p
        data-testid="temporary-password"
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 24,
          letterSpacing: 1,
          color: ds.warmDk,
          margin: '0 0 14px',
        }}
      >
        {password}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant="secondary"
          icon={<Copy size={16} />}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(password)
              .then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </section>
  );
}
