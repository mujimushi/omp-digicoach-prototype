import { z } from 'zod';
import {
  LIMITS,
  SESSION_SECONDS,
  STEP2_MODES,
  STEP4_TAGS,
} from '../constants.ts';
import {
  CaseTypeKey,
  DepartmentKey,
  Id,
  IsoDateTime,
  LevelKey,
  PerStep,
  RatingValue,
  Seconds,
  StepNumber,
  StepText,
  UsefulnessValue,
  YearKey,
} from './common.ts';

export const Step1Content = z.strictObject({
  learnerAnswer: StepText,
});
export type Step1Content = z.infer<typeof Step1Content>;

export const Step2Content = z.strictObject({
  mode: z.enum(STEP2_MODES),
});
export type Step2Content = z.infer<typeof Step2Content>;

export const Step3Content = z.strictObject({
  points: z.tuple([StepText, StepText, StepText, StepText, StepText]),
  pearlUsedId: Id.optional(),
  pearlSavedId: Id.optional(),
});
export type Step3Content = z.infer<typeof Step3Content>;

export const Step4Content = z.strictObject({
  starters: z.tuple([StepText, StepText, StepText]),
  tags: z
    .array(z.enum(STEP4_TAGS))
    .max(STEP4_TAGS.length)
    .refine((tags) => new Set(tags).size === tags.length, 'Each tag once'),
});
export type Step4Content = z.infer<typeof Step4Content>;

export const Step5Content = z.strictObject({
  starters: z.tuple([StepText, StepText, StepText]),
  actionPlan: z.string().max(LIMITS.actionPlanMax),
});
export type Step5Content = z.infer<typeof Step5Content>;

const stepFields = {
  seconds: Seconds,
  /** One rating per step, or null when the doctor didn't rate it. */
  rating: RatingValue.nullable(),
};

export const SessionStep = z.discriminatedUnion('step', [
  z.strictObject({ step: z.literal(1), ...stepFields, content: Step1Content }),
  z.strictObject({ step: z.literal(2), ...stepFields, content: Step2Content }),
  z.strictObject({ step: z.literal(3), ...stepFields, content: Step3Content }),
  z.strictObject({ step: z.literal(4), ...stepFields, content: Step4Content }),
  z.strictObject({ step: z.literal(5), ...stepFields, content: Step5Content }),
]);
export type SessionStep = z.infer<typeof SessionStep>;
export type StepContent = SessionStep['content'];

export function overtimeFor(teachingSeconds: number): number {
  return Math.max(0, teachingSeconds - SESSION_SECONDS);
}

/** A finished session. The server takes the doctor from the login, so there is no doctor field. */
export const TeachingSession = z
  .strictObject({
    id: Id,
    studentId: Id,
    department: DepartmentKey,
    caseType: CaseTypeKey,
    learnerLevel: LevelKey,
    learnerYear: YearKey.nullable(),
    startedAt: IsoDateTime,
    teachingSeconds: Seconds,
    overtimeSeconds: Seconds,
    pausedSeconds: Seconds,
    logSeconds: Seconds,
    diagnosis: z.string().trim().max(LIMITS.diagnosisMax).nullable(),
    learnerGaveDiagnosis: z.boolean().nullable(),
    usefulness: UsefulnessValue.nullable(),
    appVersion: z.string().min(1).max(LIMITS.appVersionMax),
    steps: z.array(SessionStep).length(5, 'A session has exactly five steps'),
  })
  .refine(
    (session) => session.steps.every((step, index) => step.step === index + 1),
    { message: 'Steps are numbered 1 to 5, in order', path: ['steps'] },
  )
  .refine(
    (session) =>
      session.overtimeSeconds === overtimeFor(session.teachingSeconds),
    {
      message: 'Extra time is teaching time beyond 60 seconds',
      path: ['overtimeSeconds'],
    },
  )
  .refine(
    (session) =>
      session.learnerYear === null ||
      session.learnerLevel === 'medical_student',
    {
      message: 'Year applies to medical students only',
      path: ['learnerYear'],
    },
  );
export type TeachingSession = z.infer<typeof TeachingSession>;

const EpochMs = z.int().min(0);

/** Times in milliseconds, so a reload can rebuild the clock exactly. */
export const TimerState = z.strictObject({
  startedAtMs: EpochMs,
  /** Start of the open active interval; null while paused or finished. */
  runningSinceMs: EpochMs.nullable(),
  activeMs: EpochMs,
  pausedMs: EpochMs,
  /** Start of the open paused interval; null while running. */
  pausedSinceMs: EpochMs.nullable(),
  stepActiveMs: PerStep(EpochMs),
  currentStep: StepNumber,
  finishedAtMs: EpochMs.nullable(),
});
export type TimerState = z.infer<typeof TimerState>;

export const QuickLog = z.strictObject({
  diagnosis: z.string().max(LIMITS.diagnosisMax),
  learnerGaveDiagnosis: z.boolean().nullable(),
  usefulness: UsefulnessValue.nullable(),
});
export type QuickLog = z.infer<typeof QuickLog>;

/** The session in progress, saved on the phone as the doctor works. */
export const SessionDraft = z.strictObject({
  /** Becomes the session's ID. */
  id: Id,
  studentId: Id,
  department: DepartmentKey,
  caseType: CaseTypeKey,
  learnerLevel: LevelKey,
  learnerYear: YearKey.nullable(),
  timer: TimerState,
  /** `log` once the doctor has tapped Finish. */
  stage: z.enum(['steps', 'log']),
  ratings: PerStep(RatingValue.nullable()),
  step1: Step1Content,
  step2: Step2Content,
  step3: Step3Content,
  step4: Step4Content,
  step5: Step5Content,
  log: QuickLog,
  savedAtMs: EpochMs,
});
export type SessionDraft = z.infer<typeof SessionDraft>;
