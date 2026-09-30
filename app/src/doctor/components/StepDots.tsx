import { isRatedStep, type TeachingSession } from '@omp/shared';
import { ds } from '../../styles/tokens.ts';

const COLOURS = [ds.teal, ds.teal, ds.lavender, ds.green, ds.gold];

/** One dot per rated step, filled when the step was rated, as the prototype's history cards show. */
export function StepDots({ session }: { session: TeachingSession }) {
  const steps = session.steps.filter((step) => isRatedStep(step.step));
  const rated = steps.filter((step) => step.rating !== null).length;
  return (
    <div
      role="img"
      aria-label={`${rated} of ${steps.length} steps rated`}
      style={{ display: 'flex', gap: 3, marginTop: 8 }}
    >
      {steps.map((step) => (
        <div
          key={step.step}
          style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: step.rating !== null ? COLOURS[step.step - 1] : ds.bd,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              height: 2,
              flex: 1,
              borderRadius: 1,
              background:
                step.rating !== null ? `${COLOURS[step.step - 1]}4D` : ds.bdL,
            }}
          />
        </div>
      ))}
    </div>
  );
}
