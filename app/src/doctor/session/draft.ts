import type {
  CaseType,
  Department,
  SessionDraft,
  SessionStep,
  Student,
  TeachingSession,
} from '@omp/shared';
import { startTimer, toSessionTiming } from '../timer/timer.ts';

export const APP_VERSION = __APP_VERSION__;

/** A new draft: the timer starts now, on Step 1, with nothing entered. */
export function newDraft(options: {
  id: string;
  student: Pick<Student, 'id' | 'level' | 'year'>;
  department: Department;
  caseType: CaseType;
  now: number;
}): SessionDraft {
  return {
    id: options.id,
    studentId: options.student.id,
    department: options.department,
    caseType: options.caseType,
    learnerLevel: options.student.level,
    learnerYear:
      options.student.level === 'medical_student' ? options.student.year : null,
    timer: startTimer(options.now),
    stage: 'steps',
    ratings: [null, null, null, null, null],
    step1: { learnerAnswer: '' },
    step2: { mode: 'quick' },
    step3: { points: ['', '', '', '', ''] },
    step4: { starters: ['', '', ''], tags: [] },
    step5: { starters: ['', '', ''], actionPlan: '' },
    log: { diagnosis: '', learnerGaveDiagnosis: null, usefulness: null },
    savedAtMs: options.now,
  };
}

/**
 * The finished session from a draft. `skipLog` leaves the quick log's answers empty, as Skip
 * does; the log's time is still recorded.
 */
export function buildSession(
  draft: SessionDraft,
  logSavedAtMs: number,
  { skipLog }: { skipLog: boolean },
): TeachingSession {
  const timing = toSessionTiming(draft.timer, logSavedAtMs);
  const { pearlUsedId, pearlSavedId, points } = draft.step3;
  const steps: SessionStep[] = [
    {
      step: 1,
      seconds: timing.stepSeconds[0],
      rating: draft.ratings[0],
      content: draft.step1,
    },
    {
      step: 2,
      seconds: timing.stepSeconds[1],
      rating: draft.ratings[1],
      content: draft.step2,
    },
    {
      step: 3,
      seconds: timing.stepSeconds[2],
      rating: draft.ratings[2],
      content: {
        points,
        ...(pearlUsedId ? { pearlUsedId } : {}),
        ...(pearlSavedId ? { pearlSavedId } : {}),
      },
    },
    {
      step: 4,
      seconds: timing.stepSeconds[3],
      rating: draft.ratings[3],
      content: draft.step4,
    },
    {
      step: 5,
      seconds: timing.stepSeconds[4],
      rating: draft.ratings[4],
      content: draft.step5,
    },
  ];
  const diagnosis = draft.log.diagnosis.trim();
  return {
    id: draft.id,
    studentId: draft.studentId,
    department: draft.department,
    caseType: draft.caseType,
    learnerLevel: draft.learnerLevel,
    learnerYear: draft.learnerYear,
    startedAt: new Date(draft.timer.startedAtMs).toISOString(),
    teachingSeconds: timing.teachingSeconds,
    overtimeSeconds: timing.overtimeSeconds,
    pausedSeconds: timing.pausedSeconds,
    logSeconds: timing.logSeconds,
    diagnosis: skipLog || diagnosis === '' ? null : diagnosis,
    learnerGaveDiagnosis: skipLog ? null : draft.log.learnerGaveDiagnosis,
    usefulness: skipLog ? null : draft.log.usefulness,
    appVersion: APP_VERSION,
    steps,
  };
}
