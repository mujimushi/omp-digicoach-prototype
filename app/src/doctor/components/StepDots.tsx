import type { TeachingSession } from '@omp/shared';
import { ds } from '../../styles/tokens.ts';

const COLOURS = [ds.teal, ds.teal, ds.lavender, ds.green, ds.gold];

/** Five dots, filled for each rated step, as the prototype's history cards show. */
export function StepDots({ session }: { session: TeachingSession }) {
  const rated = session.steps.filter((step) => step.rating !== null).length;
  return (
    <div
      role="img"
      aria-label={`${rated} of 5 steps rated`}
      style={{ display: 'flex', gap: 3, marginTop: 8 }}
    >
      {session.steps.map((step, index) => (
        <div
          key={step.step}
          style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: step.rating !== null ? COLOURS[index] : ds.bd,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              height: 2,
              flex: 1,
              borderRadius: 1,
              background: step.rating !== null ? `${COLOURS[index]}4D` : ds.bdL,
            }}
          />
        </div>
      ))}
    </div>
  );
}
