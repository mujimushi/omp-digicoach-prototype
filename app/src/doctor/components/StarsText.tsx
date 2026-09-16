import { type Rating, ratingLabel } from '@omp/shared';
import { Star } from 'lucide-react';
import { ds } from '../../styles/tokens.ts';

/** A read-only rating: stars and the label, such as "3 stars, Competent". */
export function StarsText({
  rating,
  size = 14,
}: {
  rating: Rating | null;
  size?: number;
}) {
  if (rating === null) {
    return <span style={{ fontSize: 13, color: ds.txMuted }}>Not rated</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 1 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            color={ds.gold}
            fill={n <= rating ? ds.gold : 'none'}
          />
        ))}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: ds.warmDk }}>
        <span className="visually-hidden">
          {rating} {rating === 1 ? 'star' : 'stars'},{' '}
        </span>
        {ratingLabel(rating)}
      </span>
    </span>
  );
}
