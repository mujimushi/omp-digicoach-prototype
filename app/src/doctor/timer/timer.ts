import {
  MAX_SECONDS,
  RESUME_PROMPT_AFTER_MS,
  SESSION_SECONDS,
  type SessionDraft,
  type StepId,
  type TimerState,
} from '@omp/shared';

// Pure functions over TimerState. Time always comes from subtracting timestamps passed in as
// `now`, never from counting ticks, so a phone that locks or throttles the page keeps the right
// time. Reaching zero changes only what the display shows.

export const SESSION_MS = SESSION_SECONDS * 1000;
const MAX_MS = MAX_SECONDS * 1000;

type Five = [number, number, number, number, number];

export type TimerReading = {
  activeMs: number;
  /** Below zero in extra time. */
  remainingMs: number;
  overtimeMs: number;
  pausedMs: number;
  stepMs: Five;
  isOvertime: boolean;
  isPaused: boolean;
};

export type SessionTiming = {
  teachingSeconds: number;
  overtimeSeconds: number;
  pausedSeconds: number;
  logSeconds: number;
  stepSeconds: Five;
};

export function startTimer(now: number): TimerState {
  return {
    startedAtMs: now,
    runningSinceMs: now,
    activeMs: 0,
    pausedMs: 0,
    pausedSinceMs: null,
    stepActiveMs: [0, 0, 0, 0, 0],
    currentStep: 1,
    finishedAtMs: null,
  };
}

function addToStep(totals: readonly number[], step: StepId, ms: number): Five {
  return totals.map((total, index) =>
    index === step - 1 ? total + ms : total,
  ) as Five;
}

/** Adds the open active interval to the totals, and restarts it at `now` when still running. */
function closeActiveInterval(state: TimerState, now: number): TimerState {
  if (state.runningSinceMs === null) return state;
  const gap = Math.max(0, now - state.runningSinceMs);
  const stepActiveMs = addToStep(state.stepActiveMs, state.currentStep, gap);
  return {
    ...state,
    activeMs: state.activeMs + gap,
    stepActiveMs,
    runningSinceMs: now,
  };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.finishedAtMs !== null || state.runningSinceMs === null)
    return state;
  return {
    ...closeActiveInterval(state, now),
    runningSinceMs: null,
    pausedSinceMs: now,
  };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.finishedAtMs !== null || state.pausedSinceMs === null) return state;
  return {
    ...state,
    pausedMs: state.pausedMs + Math.max(0, now - state.pausedSinceMs),
    pausedSinceMs: null,
    runningSinceMs: now,
  };
}

/** Closes the current step's interval and opens the new step's. A paused timer stays paused. */
export function goToStep(
  state: TimerState,
  step: StepId,
  now: number,
): TimerState {
  if (state.finishedAtMs !== null || step === state.currentStep) return state;
  return { ...closeActiveInterval(state, now), currentStep: step };
}

export function finish(state: TimerState, now: number): TimerState {
  if (state.finishedAtMs !== null) return state;
  const closed = closeActiveInterval(state, now);
  return {
    ...closed,
    pausedMs:
      closed.pausedSinceMs === null
        ? closed.pausedMs
        : closed.pausedMs + Math.max(0, now - closed.pausedSinceMs),
    runningSinceMs: null,
    pausedSinceMs: null,
    finishedAtMs: now,
  };
}

export function readTimer(state: TimerState, now: number): TimerReading {
  const openActive =
    state.runningSinceMs === null ? 0 : Math.max(0, now - state.runningSinceMs);
  const openPaused =
    state.pausedSinceMs === null ? 0 : Math.max(0, now - state.pausedSinceMs);
  const activeMs = state.activeMs + openActive;
  const stepMs = addToStep(state.stepActiveMs, state.currentStep, openActive);
  return {
    activeMs,
    remainingMs: SESSION_MS - activeMs,
    overtimeMs: Math.max(0, activeMs - SESSION_MS),
    pausedMs: state.pausedMs + openPaused,
    stepMs,
    isOvertime: activeMs > SESSION_MS,
    isPaused: state.pausedSinceMs !== null,
  };
}

/** Whole seconds, halves rounded up, capped at six hours. */
function toSeconds(ms: number): number {
  return Math.min(
    MAX_SECONDS,
    Math.round(Math.min(Math.max(0, ms), MAX_MS) / 1000),
  );
}

/**
 * The stored times for a finished session. Teaching time ends at Finish; the quick log's time runs
 * from Finish to Save.
 */
export function toSessionTiming(
  state: TimerState,
  logSavedAtMs: number,
): SessionTiming {
  const end = state.finishedAtMs ?? logSavedAtMs;
  const reading = readTimer(state, end);
  const teachingSeconds = toSeconds(reading.activeMs);
  return {
    teachingSeconds,
    overtimeSeconds: Math.max(0, teachingSeconds - SESSION_SECONDS),
    pausedSeconds: toSeconds(reading.pausedMs),
    logSeconds: toSeconds(logSavedAtMs - end),
    stepSeconds: reading.stepMs.map(toSeconds) as Five,
  };
}

/** A draft last saved more than 15 minutes ago asks Resume or Discard before it opens. */
export function shouldPromptResume(
  draft: Pick<SessionDraft, 'savedAtMs'>,
  now: number,
): boolean {
  return now - draft.savedAtMs > RESUME_PROMPT_AFTER_MS;
}

/** `0:42` while counting down; `+0:15` in extra time. */
export function formatTimer(
  reading: Pick<TimerReading, 'remainingMs' | 'overtimeMs' | 'isOvertime'>,
): string {
  if (reading.isOvertime)
    return `+${formatClock(Math.floor(reading.overtimeMs / 1000))}`;
  return formatClock(Math.ceil(Math.max(0, reading.remainingMs) / 1000));
}

/** Seconds as `m:ss`, or `h:mm:ss` from an hour. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
