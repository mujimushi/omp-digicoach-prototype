import { describe, expect, it } from 'vitest';
import {
  SessionDraft,
  type SessionStep,
  Step3Content,
  Step4Content,
  TeachingSession,
  TimerState,
} from './session.ts';

const ids = {
  session: '6f1c7a2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
  student: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  pearl: '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b',
};

function steps(): SessionStep[] {
  return [
    {
      step: 1,
      seconds: 20,
      rating: 3,
      content: { learnerAnswer: 'Pneumonia' },
    },
    { step: 2, seconds: 20, rating: 4, content: { mode: 'quick' } },
    {
      step: 3,
      seconds: 20,
      rating: null,
      content: { points: ['CURB-65', '', '', '', ''] },
    },
    {
      step: 4,
      seconds: 15,
      rating: 5,
      content: { starters: ['a', '', ''], tags: ['Good history'] },
    },
    {
      step: 5,
      seconds: 15,
      rating: 1,
      content: { starters: ['', '', ''], actionPlan: '' },
    },
  ];
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.session,
    studentId: ids.student,
    department: 'medicine',
    caseType: 'long_case',
    learnerLevel: 'medical_student',
    learnerYear: '3rd',
    startedAt: '2026-09-17T04:15:00.000Z',
    teachingSeconds: 90,
    overtimeSeconds: 30,
    pausedSeconds: 0,
    logSeconds: 25,
    diagnosis: 'Pneumonia',
    learnerGaveDiagnosis: true,
    usefulness: 5,
    appVersion: '1.0.0',
    steps: steps(),
    ...overrides,
  };
}

function withStep(index: number, patch: Record<string, unknown>) {
  const list: Record<string, unknown>[] = steps();
  list[index] = { ...list[index], ...patch };
  return session({ steps: list });
}

describe('TeachingSession', () => {
  it('accepts a complete session', () => {
    expect(TeachingSession.safeParse(session()).success).toBe(true);
  });

  it('accepts a skipped quick log', () => {
    const result = TeachingSession.safeParse(
      session({
        diagnosis: null,
        learnerGaveDiagnosis: null,
        usefulness: null,
      }),
    );
    expect(result.success).toBe(true);
  });

  describe('five steps, numbered 1 to 5', () => {
    it('refuses a session with four steps', () => {
      expect(
        TeachingSession.safeParse(session({ steps: steps().slice(0, 4) }))
          .success,
      ).toBe(false);
    });

    it('refuses steps out of order', () => {
      const list = steps();
      const reordered = [list[1], list[0], list[2], list[3], list[4]];
      expect(
        TeachingSession.safeParse(session({ steps: reordered })).success,
      ).toBe(false);
    });

    it('refuses a step numbered 6', () => {
      expect(TeachingSession.safeParse(withStep(4, { step: 6 })).success).toBe(
        false,
      );
    });
  });

  describe('ratings: 1 to 5 or null', () => {
    it.each([1, 5, null])('accepts %s', (rating) => {
      expect(TeachingSession.safeParse(withStep(0, { rating })).success).toBe(
        true,
      );
    });

    it.each([0, 6, 2.5, '3'])('refuses %s', (rating) => {
      expect(TeachingSession.safeParse(withStep(0, { rating })).success).toBe(
        false,
      );
    });
  });

  describe('usefulness: 1 to 6 or null', () => {
    it.each([1, 6, null])('accepts %s', (usefulness) => {
      expect(TeachingSession.safeParse(session({ usefulness })).success).toBe(
        true,
      );
    });

    it.each([0, 7])('refuses %s', (usefulness) => {
      expect(TeachingSession.safeParse(session({ usefulness })).success).toBe(
        false,
      );
    });
  });

  describe('second counts: whole numbers from 0 to 21,600', () => {
    it('accepts 0 and 21,600', () => {
      expect(
        TeachingSession.safeParse(
          session({
            teachingSeconds: 21_600,
            overtimeSeconds: 21_540,
            pausedSeconds: 0,
          }),
        ).success,
      ).toBe(true);
    });

    it.each([
      ['pausedSeconds', -1],
      ['logSeconds', 21_601],
      ['pausedSeconds', 1.5],
    ])('refuses %s = %s', (field, value) => {
      expect(
        TeachingSession.safeParse(session({ [field]: value })).success,
      ).toBe(false);
    });

    it('refuses a step with negative seconds', () => {
      expect(
        TeachingSession.safeParse(withStep(2, { seconds: -5 })).success,
      ).toBe(false);
    });
  });

  describe('extra time equals teaching time beyond 60 seconds', () => {
    it('accepts 45 seconds of teaching with no extra time', () => {
      expect(
        TeachingSession.safeParse(
          session({ teachingSeconds: 45, overtimeSeconds: 0 }),
        ).success,
      ).toBe(true);
    });

    it('refuses wrong extra time', () => {
      const result = TeachingSession.safeParse(
        session({ teachingSeconds: 90, overtimeSeconds: 20 }),
      );
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['overtimeSeconds']);
    });

    it('refuses extra time under 60 seconds of teaching', () => {
      expect(
        TeachingSession.safeParse(
          session({ teachingSeconds: 50, overtimeSeconds: 10 }),
        ).success,
      ).toBe(false);
    });
  });

  describe('year only for medical students', () => {
    it('accepts a resident with no year', () => {
      expect(
        TeachingSession.safeParse(
          session({ learnerLevel: 'resident', learnerYear: null }),
        ).success,
      ).toBe(true);
    });

    it('refuses a year for a resident', () => {
      expect(
        TeachingSession.safeParse(
          session({ learnerLevel: 'resident', learnerYear: 'final' }),
        ).success,
      ).toBe(false);
    });
  });

  it('refuses a doctor ID in the payload, because the doctor comes from the login', () => {
    expect(
      TeachingSession.safeParse(session({ doctorId: ids.student })).success,
    ).toBe(false);
  });

  it('refuses a diagnosis over 200 characters', () => {
    expect(
      TeachingSession.safeParse(session({ diagnosis: 'x'.repeat(201) }))
        .success,
    ).toBe(false);
  });
});

describe('step content', () => {
  it('Step 1 holds the learner’s answer', () => {
    expect(
      TeachingSession.safeParse(
        withStep(0, { content: { learnerAnswer: 'x'.repeat(501) } }),
      ).success,
    ).toBe(false);
  });

  it('Step 2 is quick or deep', () => {
    expect(
      TeachingSession.safeParse(withStep(1, { content: { mode: 'deep' } }))
        .success,
    ).toBe(true);
    expect(
      TeachingSession.safeParse(withStep(1, { content: { mode: 'slow' } }))
        .success,
    ).toBe(false);
  });

  it('Step 3 has exactly five points, with optional pearl IDs', () => {
    expect(
      Step3Content.safeParse({
        points: ['', '', '', '', ''],
        pearlUsedId: ids.pearl,
        pearlSavedId: ids.pearl,
      }).success,
    ).toBe(true);
    expect(Step3Content.safeParse({ points: ['', '', '', ''] }).success).toBe(
      false,
    );
  });

  it('Step 4 has three starters and tags from the list', () => {
    expect(
      Step4Content.safeParse({
        starters: ['', '', ''],
        tags: ['Good reasoning', 'Thorough workup'],
      }).success,
    ).toBe(true);
    expect(
      Step4Content.safeParse({ starters: ['', '', ''], tags: ['Brilliant'] })
        .success,
    ).toBe(false);
    expect(
      Step4Content.safeParse({
        starters: ['', '', ''],
        tags: ['Good history', 'Good history'],
      }).success,
    ).toBe(false);
  });

  it('Step 5 has three starters and an action plan up to 1,000 characters', () => {
    expect(
      TeachingSession.safeParse(
        withStep(4, {
          content: { starters: ['', '', ''], actionPlan: 'x'.repeat(1000) },
        }),
      ).success,
    ).toBe(true);
    expect(
      TeachingSession.safeParse(
        withStep(4, {
          content: { starters: ['', '', ''], actionPlan: 'x'.repeat(1001) },
        }),
      ).success,
    ).toBe(false);
  });

  it('refuses Step 2 content under Step 1', () => {
    expect(
      TeachingSession.safeParse(withStep(0, { content: { mode: 'quick' } }))
        .success,
    ).toBe(false);
  });
});

function timer(overrides: Record<string, unknown> = {}) {
  return {
    startedAtMs: 1_000,
    runningSinceMs: 1_000,
    activeMs: 0,
    pausedMs: 0,
    pausedSinceMs: null,
    stepActiveMs: [0, 0, 0, 0, 0],
    currentStep: 1,
    finishedAtMs: null,
    ...overrides,
  };
}

describe('TimerState', () => {
  it('accepts a running timer', () => {
    expect(TimerState.safeParse(timer()).success).toBe(true);
  });

  it('refuses four step totals', () => {
    expect(
      TimerState.safeParse(timer({ stepActiveMs: [0, 0, 0, 0] })).success,
    ).toBe(false);
  });

  it('refuses step 6', () => {
    expect(TimerState.safeParse(timer({ currentStep: 6 })).success).toBe(false);
  });
});

describe('SessionDraft', () => {
  const draft = {
    id: ids.session,
    studentId: ids.student,
    department: 'surgery',
    caseType: 'short_case',
    learnerLevel: 'house_officer',
    learnerYear: null,
    timer: timer(),
    stage: 'steps',
    ratings: [null, 2, null, null, null],
    step1: { learnerAnswer: '' },
    step2: { mode: 'quick' },
    step3: { points: ['', '', '', '', ''] },
    step4: { starters: ['', '', ''], tags: [] },
    step5: { starters: ['', '', ''], actionPlan: '' },
    log: { diagnosis: '', learnerGaveDiagnosis: null, usefulness: null },
    savedAtMs: 5_000,
  };

  it('accepts a draft in progress', () => {
    expect(SessionDraft.safeParse(draft).success).toBe(true);
  });

  it('refuses a rating of 6 in a draft', () => {
    expect(
      SessionDraft.safeParse({ ...draft, ratings: [6, null, null, null, null] })
        .success,
    ).toBe(false);
  });
});
