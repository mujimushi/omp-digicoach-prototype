import type { CSSProperties } from 'react';

/** Design tokens, copied from the prototype's `ds`. */
export const ds = {
  warmDk: '#3D2E5C',
  pri: '#8B6BAE',
  coral: '#E88C5A',
  teal: '#5CB8D4',
  gold: '#D4A76A',
  lavender: '#BDA6CE',
  cream: '#FDF8F3',
  surface: '#F5F0EA',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#B45309',
  tx: '#3D2E5C',
  txB: '#6B5B8A',
  /** The prototype's light text. Too pale for text (3.1:1); use for icons and borders only. */
  txL: '#9B8BB4',
  // Darker shades for text and for white text on a fill, so every pair reaches WCAG AA (4.5:1).
  txMuted: '#6F5F8C',
  priText: '#6E4F92',
  goldText: '#7A5A22',
  tealText: '#256B80',
  greenText: '#166534',
  redText: '#B91C1C',
  lavenderFill: '#735596',
  goldFill: '#7C5B1F',
  greenFill: '#166534',
  txW: '#FFFFFF',
  bd: '#E8DFF0',
  bdL: '#F3EEF8',
  gradBtn: 'linear-gradient(135deg, #E88C5A, #8B6BAE)',
  gradHdr: 'linear-gradient(135deg, #8B6BAE, #5CB8D4)',
  card: {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(61,46,92,0.06)',
  } satisfies CSSProperties,
  input: {
    background: '#fff',
    border: '1px solid #E8DFF0',
    borderRadius: 12,
    padding: '14px',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    width: '100%',
    transition: 'all 0.2s ease',
    color: '#3D2E5C',
  } satisfies CSSProperties,
  btnPri: {
    background: 'linear-gradient(135deg, #E88C5A, #8B6BAE)',
    borderRadius: 14,
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 14px rgba(139,107,174,0.3)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } satisfies CSSProperties,
  btnSec: {
    background: '#fff',
    border: '1px solid #E8DFF0',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } satisfies CSSProperties,
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
} as const;

/** Colour for a step: teal for the first three, gold for the last two, as in the prototype. */
export function stepColor(step: number): string {
  return step <= 3 ? ds.teal : ds.gold;
}
