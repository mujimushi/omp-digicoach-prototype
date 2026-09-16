import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ds } from '../../styles/tokens.ts';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** Where Back goes. Left out, the header has no Back button. */
  backTo?: string;
  /** Right-hand content, such as the sync badge. */
  aside?: ReactNode;
  /** The prototype's purple-to-teal band, used on the main screens. */
  gradient?: boolean;
  icon?: ReactNode;
};

export function ScreenHeader({
  title,
  subtitle,
  backTo,
  aside,
  gradient = false,
  icon,
}: ScreenHeaderProps) {
  const navigate = useNavigate();
  const text = gradient ? ds.txW : ds.warmDk;
  return (
    <header
      style={{
        background: gradient ? ds.gradHdr : 'transparent',
        padding: 'calc(14px + env(safe-area-inset-top)) 16px 18px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {backTo && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(backTo)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              marginLeft: -6,
              minWidth: 40,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              color: text,
            }}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              color: text,
              fontSize: gradient ? 20 : 24,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                color: gradient ? ds.txW : ds.txB,
                fontSize: 13,
                margin: '4px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {aside}
      </div>
    </header>
  );
}
