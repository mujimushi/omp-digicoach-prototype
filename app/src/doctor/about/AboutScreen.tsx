import { RATING_LABELS, STEPS } from '@omp/shared';
import { Logo } from '../../layout/Logo.tsx';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';

/** The five steps, the rating scale and the study credits. */
export function AboutScreen() {
  return (
    <>
      <ScreenHeader title="About OMP" backTo="/more" />
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        <div
          style={{
            background: ds.gradHdr,
            borderRadius: 16,
            padding: 22,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: '50%',
              padding: 8,
            }}
          >
            <Logo size={48} />
          </div>
          <h2
            style={{
              color: ds.txW,
              fontSize: 18,
              fontWeight: 700,
              margin: '12px 0 4px',
            }}
          >
            The One-Minute Preceptor
          </h2>
          <p style={{ color: ds.txW, fontSize: 13, margin: 0 }}>
            A digital medical teaching intervention
          </p>
        </div>

        <Card style={{ marginBottom: 12 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ds.warmDk,
              margin: '0 0 8px',
            }}
          >
            The five steps
          </h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {STEPS.map((step) => (
              <li
                key={step.id}
                style={{ marginBottom: 8, fontSize: 14, color: ds.tx }}
              >
                <strong>{step.name}.</strong> {step.instruction}.
              </li>
            ))}
          </ol>
          <p style={{ fontSize: 13, color: ds.txB, margin: '8px 0 0' }}>
            One 60-second countdown covers the whole session. At zero it counts
            extra time; nothing moves on until you do.
          </p>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ds.warmDk,
              margin: '0 0 8px',
            }}
          >
            Rating scale
          </h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {RATING_LABELS.map((label) => (
              <li
                key={label}
                style={{ fontSize: 14, color: ds.tx, marginBottom: 4 }}
              >
                {label}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ds.warmDk,
              margin: '0 0 6px',
            }}
          >
            Study
          </h2>
          <p style={{ fontSize: 14, color: ds.tx, margin: 0, lineHeight: 1.6 }}>
            Developed for clinical teaching using the One-Minute Preceptor
            model, by Prof. Muneeza Rizwan.
          </p>
        </Card>
      </div>
    </>
  );
}
