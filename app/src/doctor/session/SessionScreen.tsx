import { STEPS, type StepId } from '@omp/shared';
import {
  BookOpen,
  Check,
  ChevronLeft,
  Lightbulb,
  type LucideIcon,
  Search,
  Target,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ds, stepColor } from '../../styles/tokens.ts';
import { TimerRing } from '../timer/TimerRing.tsx';
import { finish, goToStep, pause, readTimer, resume } from '../timer/timer.ts';
import { Step1, Step2, Step3, Step4, Step5, StepRating } from './steps.tsx';
import { useSessionDraft } from './useSessionDraft.ts';

const STEP_ICONS: Record<StepId, LucideIcon> = {
  1: Target,
  2: Search,
  3: BookOpen,
  4: Check,
  5: Lightbulb,
};

function useCompactRing() {
  const query = '(max-height: 760px)';
  const [compact, setCompact] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const onChange = () => setCompact(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return compact;
}

/** The five steps under one whole-session timer. Back and Next move freely; Finish is on Step 5. */
export function SessionScreen() {
  const navigate = useNavigate();
  const { draft, update, saveNow } = useSessionDraft();
  const compact = useCompactRing();
  const scroller = useRef<HTMLDivElement>(null);
  const step = draft?.timer.currentStep ?? 1;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the top whenever the step changes
  useEffect(() => {
    scroller.current?.scrollTo?.({ top: 0 });
  }, [step]);

  if (draft === undefined) return null;
  if (draft === null) return <Navigate to="/" replace />;
  if (draft.stage === 'log') return <Navigate to="/session/log" replace />;

  const info = STEPS[step - 1];
  if (!info) return null;
  const Icon = STEP_ICONS[step];
  const colour = stepColor(step);
  const textColour = step <= 3 ? ds.tealText : ds.goldText;

  const move = (to: StepId) =>
    update((d) => ({ ...d, timer: goToStep(d.timer, to, Date.now()) }));

  const togglePause = () =>
    update((d) => {
      const now = Date.now();
      return {
        ...d,
        timer: readTimer(d.timer, now).isPaused
          ? resume(d.timer, now)
          : pause(d.timer, now),
      };
    });

  async function onFinish() {
    if (!draft) return;
    const finished = {
      ...draft,
      timer: finish(draft.timer, Date.now()),
      stage: 'log' as const,
    };
    update(() => finished);
    await saveNow(finished);
    navigate('/session/log');
  }

  const StepBody = [Step1, Step2, Step3, Step4, Step5][step - 1] ?? Step1;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: ds.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'calc(8px + env(safe-area-inset-top)) 12px 0',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Leave session"
          onClick={() => {
            void saveNow();
            navigate('/');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            color: ds.txB,
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <h1
          style={{ fontSize: 15, fontWeight: 700, color: ds.warmDk, margin: 0 }}
        >
          Step {step} of 5
        </h1>
        <span style={{ minWidth: 44 }} />
      </div>
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          gap: 4,
          padding: '4px 16px 0',
          flexShrink: 0,
        }}
      >
        {STEPS.map((s) => (
          <div
            key={s.id}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: s.id <= step ? colour : ds.bd,
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
      <div style={{ padding: compact ? '8px 0 0' : '12px 0 0', flexShrink: 0 }}>
        <TimerRing
          timer={draft.timer}
          onToggle={togglePause}
          compact={compact}
        />
      </div>
      <div
        style={{ textAlign: 'center', padding: '6px 16px 0', flexShrink: 0 }}
      >
        <h2
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: `${colour}24`,
            padding: '5px 14px',
            borderRadius: 20,
            fontSize: 15,
            fontWeight: 700,
            color: textColour,
            margin: 0,
          }}
        >
          <Icon size={16} />
          {info.name}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: ds.txB,
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}
        >
          {info.instruction}
        </p>
      </div>
      <div
        ref={scroller}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '12px 16px 8px',
        }}
      >
        <StepBody draft={draft} update={update} />
        <StepRating draft={draft} update={update} />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 16px calc(14px + env(safe-area-inset-bottom))',
          flexShrink: 0,
          background: ds.surface,
        }}
      >
        <button
          type="button"
          onClick={() => move((step - 1) as StepId)}
          disabled={step === 1}
          aria-label="Previous step"
          style={{
            ...ds.btnSec,
            flex: 1,
            minHeight: 48,
            color: ds.tx,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: step === 1 ? 0.45 : 1,
          }}
        >
          <ChevronLeft size={18} />
          Back
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={() => move((step + 1) as StepId)}
            data-tour="next"
            style={{ ...ds.btnPri, flex: 3, minHeight: 48, fontSize: 15 }}
          >
            Next step
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onFinish()}
            data-tour="finish"
            style={{
              ...ds.btnPri,
              flex: 3,
              minHeight: 48,
              fontSize: 15,
              background: `linear-gradient(135deg, ${ds.greenFill}, #14532D)`,
              boxShadow: '0 4px 14px rgba(22,101,52,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Check size={16} />
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
