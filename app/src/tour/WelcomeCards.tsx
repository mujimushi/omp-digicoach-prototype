import { STEPS } from '@omp/shared';
import {
  ListOrdered,
  type LucideIcon,
  Play,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ds } from '../styles/tokens.ts';
import { Button } from '../ui/Button.tsx';
import { IconCircle } from '../ui/IconCircle.tsx';

type WelcomeCard = {
  Icon: LucideIcon;
  colour: string;
  title: string;
  body: ReactNode;
};

const CARDS: readonly WelcomeCard[] = [
  {
    Icon: Sparkles,
    colour: ds.coral,
    title: 'Welcome to OMP DigiCoach',
    body: 'The app guides each step and keeps time.',
  },
  {
    Icon: ListOrdered,
    colour: ds.teal,
    title: 'Five steps, one minute',
    body: (
      <ol style={{ margin: 0, paddingLeft: 20, textAlign: 'left' }}>
        {STEPS.map((step) => (
          <li key={step.id} style={{ marginBottom: 2 }}>
            {step.name}
          </li>
        ))}
      </ol>
    ),
  },
  {
    Icon: WifiOff,
    colour: ds.pri,
    title: 'Works without signal',
    body: 'Sessions save on your phone and send later.',
  },
  {
    Icon: Play,
    colour: ds.gold,
    title: 'Try a practice session',
    body: 'Nothing you enter is saved.',
  },
];

/** The tour's opening cards. Skip is on every card. */
export function WelcomeCards({
  onSkip,
  onStartPractice,
}: {
  onSkip: () => void;
  onStartPractice: () => void;
}) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const card = CARDS[index] ?? CARDS[0];
  const last = index === CARDS.length - 1;

  // Give focus back to where it was when the cards close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  // Each new card's title takes focus, so screen readers read it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the card changes
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  if (!card) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,46,92,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 300,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          ...ds.card,
          background: '#fff',
          width: '100%',
          maxWidth: 360,
          padding: '14px 20px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 44,
          }}
        >
          <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
            {CARDS.map((c, i) => (
              <span
                key={c.title}
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === index ? ds.pri : ds.bd,
                  transition: 'width 0.2s ease',
                }}
              />
            ))}
          </div>
          <span className="visually-hidden">
            Card {index + 1} of {CARDS.length}
          </span>
          {!last && (
            <Button
              variant="ghost"
              onClick={onSkip}
              style={{ minHeight: 44, padding: '0 4px', color: ds.priText }}
            >
              Skip
            </Button>
          )}
        </div>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <IconCircle Icon={card.Icon} color={card.colour} size={52} />
          </div>
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            style={{
              fontSize: 19,
              color: ds.warmDk,
              margin: '14px 0 8px',
              outline: 'none',
            }}
          >
            {card.title}
          </h2>
          <div
            style={{
              fontSize: 15,
              color: ds.txB,
              lineHeight: 1.45,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {card.body}
          </div>
        </div>
        {last ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={onSkip} style={{ flex: 1 }}>
              Skip
            </Button>
            <Button onClick={onStartPractice} style={{ flex: 2 }}>
              Start practice
            </Button>
          </div>
        ) : (
          <Button fullWidth onClick={() => setIndex(index + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
