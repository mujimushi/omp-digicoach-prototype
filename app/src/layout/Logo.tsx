import { useId } from 'react';

/** The app logo, copied from the prototype's `Logo`. */
export function Logo({ size = 80 }: { size?: number }) {
  const id = useId();
  const ring = `${id}-ring`;
  const tick = `${id}-tick`;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5CB8D4" />
          <stop offset="50%" stopColor="#E88C5A" />
          <stop offset="100%" stopColor="#8B6BAE" />
        </linearGradient>
        <linearGradient id={tick} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E88C5A" />
          <stop offset="100%" stopColor="#D4A76A" />
        </linearGradient>
      </defs>
      <circle
        cx="40"
        cy="42"
        r="28"
        fill="none"
        stroke={`url(#${ring})`}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect x="37" y="10" width="6" height="10" rx="2" fill={`url(#${ring})`} />
      <rect
        x="50"
        y="12"
        width="8"
        height="6"
        rx="2"
        fill={`url(#${ring})`}
        transform="rotate(30 54 15)"
      />
      <polyline
        points="30,42 38,50 52,34"
        fill="none"
        stroke={`url(#${tick})`}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
