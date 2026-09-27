import { useCallback, useEffect, useRef, useState } from 'react';
import { ds } from '../styles/tokens.ts';
import { HINTS, type Hint } from './hints.ts';

type Shown = { hint: Hint; rect: DOMRect };

const GAP = 12;

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

function targetOf(hint: Hint): Element | null {
  return document.querySelector(`[data-tour="${hint.id}"]`);
}

/**
 * The practice session's hints: a ring around the control and one short line beside it. Neither
 * blocks taps, so the doctor uses the real screen.
 */
export function CoachMarks() {
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [shown, setShown] = useState<Shown | null>(null);
  const lastId = useRef<string | null>(null);

  const finishHint = useCallback((id: string) => {
    setDone((previous) => new Set(previous).add(id));
  }, []);

  // Find the first unfinished hint on screen, and follow its target as the page moves.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hint = HINTS.find((h) => !done.has(h.id) && targetOf(h));
        const target = hint && targetOf(hint);
        if (!hint || !target) {
          setShown(null);
          lastId.current = null;
          return;
        }
        if (lastId.current !== hint.id) {
          lastId.current = hint.id;
          target.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        }
        const rect = target.getBoundingClientRect();
        setShown((previous) =>
          previous?.hint.id === hint.id && sameRect(previous.rect, rect)
            ? previous
            : { hint, rect },
        );
      });
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    // Smooth scrolling and layout shifts after a tap don't always cause a mutation.
    const interval = setInterval(measure, 400);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      clearInterval(interval);
    };
  }, [done]);

  // Tapping a hint's target finishes it.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.('[data-tour]');
      const id = target?.getAttribute('data-tour');
      if (id && HINTS.some((h) => h.id === id)) finishHint(id);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [finishHint]);

  if (!shown) return <div role="status" className="visually-hidden" />;

  const { hint, rect } = shown;
  const below = rect.top + rect.height / 2 < window.innerHeight / 2;
  const width = Math.min(window.innerWidth, 500) - 32;
  const left = Math.max(16, (window.innerWidth - width) / 2);

  return (
    <>
      <div
        aria-hidden="true"
        className="omp-tour-ring"
        style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          border: `2px solid ${ds.coral}`,
          borderRadius: 14,
          pointerEvents: 'none',
          zIndex: 250,
        }}
      />
      <div
        role="status"
        style={{
          position: 'fixed',
          left,
          width,
          ...(below
            ? { top: rect.bottom + GAP }
            : { bottom: window.innerHeight - rect.top + GAP }),
          background: ds.warmDk,
          color: ds.txW,
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 14,
          lineHeight: 1.4,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 6px 20px rgba(61,46,92,0.25)',
          zIndex: 260,
        }}
      >
        <span style={{ flex: 1 }}>{hint.text}</span>
        {hint.doneBy === 'ack' && (
          <button
            type="button"
            onClick={() => finishHint(hint.id)}
            style={{
              background: '#fff',
              color: ds.warmDk,
              border: 'none',
              borderRadius: 10,
              padding: '0 12px',
              minHeight: 36,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Got it
          </button>
        )}
      </div>
    </>
  );
}
