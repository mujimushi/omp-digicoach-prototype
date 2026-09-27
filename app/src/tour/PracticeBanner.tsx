import { GraduationCap } from 'lucide-react';
import { ds } from '../styles/tokens.ts';
import { useTour } from './useTour.ts';

/** A strip above every screen during practice, with a way out. */
export function PracticeBanner() {
  const { practice, endTour } = useTour();
  if (!practice) return null;
  return (
    <div
      style={{
        background: ds.goldFill,
        color: ds.txW,
        padding: 'calc(6px + env(safe-area-inset-top)) 16px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        fontSize: 13,
      }}
    >
      <GraduationCap size={16} aria-hidden="true" />
      <span style={{ flex: 1, fontWeight: 600 }}>
        Practice · nothing is saved
      </span>
      <button
        type="button"
        onClick={endTour}
        style={{
          background: '#fff',
          color: ds.goldText,
          border: 'none',
          borderRadius: 10,
          padding: '0 12px',
          minHeight: 32,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Exit practice
      </button>
    </div>
  );
}
