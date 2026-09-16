import { RATING_LABELS, type Rating, ratingLabel } from '@omp/shared';
import { Star } from 'lucide-react';
import { type KeyboardEvent, useRef } from 'react';
import { ds } from '../styles/tokens.ts';

export type RatingStarsProps = {
  /** The group's accessible name, such as "Rate Step 1". */
  label: string;
  value: Rating | null;
  onChange: (value: Rating | null) => void;
};

const STARS = [1, 2, 3, 4, 5] as const;

/** One rating from 1 to 5 stars. Tapping the chosen star again clears the rating. */
export function RatingStars({ label, value, onChange }: RatingStarsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      Home: 0,
      End: STARS.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[Math.max(0, Math.min(STARS.length - 1, next))]?.focus();
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <fieldset
        style={{
          display: 'flex',
          gap: 2,
          border: 0,
          margin: 0,
          padding: 0,
          minWidth: 0,
        }}
      >
        <legend className="visually-hidden">{label}</legend>
        {STARS.map((star, index) => {
          const filled = value !== null && star <= value;
          return (
            <button
              key={star}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              aria-pressed={value === star}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'}, ${RATING_LABELS[index]}`}
              onClick={() => onChange(value === star ? null : star)}
              onKeyDown={(event) => onKeyDown(event, index)}
              style={{
                background: 'none',
                border: 'none',
                padding: 6,
                minWidth: 40,
                minHeight: 40,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Star
                size={26}
                color={ds.gold}
                fill={filled ? ds.gold : 'none'}
                strokeWidth={1.6}
              />
            </button>
          );
        })}
      </fieldset>
      <span
        aria-live="polite"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: value ? ds.warmDk : ds.txMuted,
          minWidth: 110,
        }}
      >
        {value ? ratingLabel(value) : 'Not rated'}
      </span>
    </div>
  );
}
