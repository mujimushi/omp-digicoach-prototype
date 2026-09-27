import type { TimerState } from '@omp/shared';
import { ds } from '../../styles/tokens.ts';
import { formatTimer, readTimer, SESSION_MS } from './timer.ts';
import { useNow } from './useNow.ts';

export const TIMER_REFRESH_MS = 250;

/** Dark amber for extra time: 6.4:1 on the page background. */
const EXTRA_TIME = '#9A3412';

export type TimerRingProps = {
  timer: TimerState;
  onToggle: () => void;
  compact?: boolean;
};

/**
 * The whole-session countdown, copied from the prototype's ring. It counts down 60 seconds, then
 * shows extra time in amber with the ring full. Tapping it pauses or resumes.
 */
export function TimerRing({
  timer,
  onToggle,
  compact = false,
}: TimerRingProps) {
  const now = useNow(TIMER_REFRESH_MS);
  const reading = readTimer(timer, now);
  const text = formatTimer(reading);

  const size = compact ? 130 : 180;
  const radius = compact ? 54 : 76;
  const stroke = compact ? 7 : 9;
  const circumference = 2 * Math.PI * radius;
  const fraction = reading.isOvertime
    ? 1
    : Math.max(0, reading.remainingMs) / SESSION_MS;
  const colour = reading.isOvertime
    ? ds.coral
    : timer.currentStep <= 3
      ? ds.teal
      : ds.gold;

  const spoken = reading.isOvertime
    ? `Extra time ${text.slice(1)}`
    : `Time left ${text}`;
  const status = reading.isPaused
    ? 'PAUSED'
    : reading.isOvertime
      ? 'EXTRA TIME'
      : 'SECONDS';

  return (
    <button
      type="button"
      onClick={onToggle}
      data-tour="timer"
      aria-label={spoken}
      aria-pressed={reading.isPaused}
      aria-describedby="timer-hint"
      data-testid="timer-ring"
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        display: 'block',
        flexShrink: 0,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        borderRadius: '50%',
      }}
    >
      <span id="timer-hint" className="visually-hidden">
        {reading.isPaused ? 'Paused. Tap to resume.' : 'Tap to pause.'}
      </span>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`${colour}33`}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          data-testid="timer-text"
          style={{
            fontSize: compact ? 32 : 44,
            fontWeight: 700,
            color: reading.isOvertime ? EXTRA_TIME : ds.warmDk,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {text}
        </span>
        <span
          style={{
            fontSize: compact ? 10 : 11,
            fontWeight: 700,
            color: reading.isOvertime ? EXTRA_TIME : ds.txMuted,
            letterSpacing: 2,
            marginTop: 2,
          }}
        >
          {status}
        </span>
      </span>
    </button>
  );
}
