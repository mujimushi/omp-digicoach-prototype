import { z } from 'zod';
import { LIMITS } from '../constants.ts';
import {
  CaseTypeKey,
  DepartmentKey,
  DesignationKey,
  Id,
  IsoDate,
  IsoDateTime,
  LevelKey,
  PerStep,
  PersonName,
  queryParam,
  RatingValue,
  UsefulnessValue,
  Username,
  YearKey,
} from './common.ts';
import { TeachingSession } from './session.ts';
import { Student } from './student.ts';
import { PublicUser } from './user.ts';

const Count = z.int().min(0);
/** An average, or null when there is nothing to average. */
const Average = z.number().nullable();

/** Doctors and admins log in separately, so no account has both roles. */
export const ONE_ROLE = 'An account is either a doctor or an admin, not both.';

export const DoctorInput = z
  .strictObject({
    name: PersonName,
    username: Username,
    department: DepartmentKey.nullable(),
    designation: DesignationKey.nullable(),
    isDoctor: z.boolean().default(true),
    isAdmin: z.boolean().default(false),
    /** Typed by the admin. Left out, the server generates a readable one. */
    temporaryPassword: z
      .string()
      .min(LIMITS.passwordMin)
      .max(LIMITS.passwordMax)
      .optional(),
  })
  .refine(
    (doctor) =>
      !doctor.isDoctor ||
      (doctor.department !== null && doctor.designation !== null),
    {
      message: 'A doctor needs a department and a designation',
      path: ['department'],
    },
  )
  .refine((account) => account.isDoctor !== account.isAdmin, {
    message: ONE_ROLE,
    path: ['role'],
  });
export type DoctorInput = z.infer<typeof DoctorInput>;

export const DoctorUpdate = z.strictObject({
  name: PersonName.optional(),
  username: Username.optional(),
  department: DepartmentKey.nullable().optional(),
  designation: DesignationKey.nullable().optional(),
  isDoctor: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type DoctorUpdate = z.infer<typeof DoctorUpdate>;

export const DoctorCreated = z.strictObject({
  doctor: PublicUser,
  temporaryPassword: z.string(),
});
export type DoctorCreated = z.infer<typeof DoctorCreated>;

export const TemporaryPasswordResponse = z.strictObject({
  temporaryPassword: z.string(),
});
export type TemporaryPasswordResponse = z.infer<
  typeof TemporaryPasswordResponse
>;

export const IdParams = z.strictObject({ id: Id });

export const WeekCount = z.strictObject({
  /** Monday of the week, in Pakistan time. */
  weekStart: IsoDate,
  sessions: Count,
});

export const OverviewStats = z.strictObject({
  /** Doctors with a session in the last 14 days. */
  activeDoctors: Count,
  /** Since Monday, in Pakistan time. */
  sessionsThisWeek: Count,
  students: Count,
  /** Since the first of the month, in Pakistan time. */
  avgTeachingSecondsThisMonth: Average,
  avgOvertimeSecondsThisMonth: Average,
  avgRatingPerStepThisMonth: PerStep(Average),
  /** The last 12 weeks, oldest first, including this week. */
  sessionsPerWeek: z.array(WeekCount).length(12),
});
export type OverviewStats = z.infer<typeof OverviewStats>;

export const DoctorActivityRow = z.strictObject({
  id: Id,
  name: z.string(),
  username: z.string(),
  department: DepartmentKey.nullable(),
  designation: DesignationKey.nullable(),
  isDoctor: z.boolean(),
  isAdmin: z.boolean(),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  sessionsTotal: Count,
  sessionsLast7Days: Count,
  lastSessionAt: IsoDateTime.nullable(),
  avgTeachingSeconds: Average,
  avgOvertimeSeconds: Average,
  /** Share of sessions with all five steps rated, from 0 to 1. */
  allStepsRatedShare: Average,
  studentsTaught: Count,
  lastLoginAt: IsoDateTime.nullable(),
});
export type DoctorActivityRow = z.infer<typeof DoctorActivityRow>;

export const SessionListRow = z.strictObject({
  id: Id,
  startedAt: IsoDateTime,
  doctorId: Id,
  doctorName: z.string(),
  studentId: Id,
  studentName: z.string(),
  pmdcNumber: z.string().nullable(),
  department: DepartmentKey,
  caseType: CaseTypeKey,
  learnerLevel: LevelKey,
  learnerYear: YearKey.nullable(),
  teachingSeconds: Count,
  overtimeSeconds: Count,
  pausedSeconds: Count,
  diagnosis: z.string().nullable(),
  usefulness: UsefulnessValue.nullable(),
  ratings: PerStep(RatingValue.nullable()),
});
export type SessionListRow = z.infer<typeof SessionListRow>;

export const TaughtStudentRow = z.strictObject({
  id: Id,
  name: z.string(),
  pmdcNumber: z.string().nullable(),
  level: LevelKey,
  year: YearKey.nullable(),
  sessions: Count,
  lastSessionAt: IsoDateTime,
});
export type TaughtStudentRow = z.infer<typeof TaughtStudentRow>;

/** For each step, how many sessions gave 1, 2, 3, 4 and 5 stars, and how many left it unrated. */
export const RatingSpread = PerStep(
  z.strictObject({
    counts: z.tuple([Count, Count, Count, Count, Count]),
    unrated: Count,
  }),
);
export type RatingSpread = z.infer<typeof RatingSpread>;

export const DoctorDetail = z.strictObject({
  activity: DoctorActivityRow,
  sessions: z.array(SessionListRow),
  students: z.array(TaughtStudentRow),
  ratingSpread: RatingSpread,
});
export type DoctorDetail = z.infer<typeof DoctorDetail>;

export const STUDENT_SORTS = [
  'name',
  'sessions',
  'last_session',
  'pmdc_number',
] as const;

export const StudentsQuery = z.strictObject({
  query: queryParam(z.string().trim().max(100)),
  sort: queryParam(z.enum(STUDENT_SORTS)),
});
export type StudentsQuery = z.infer<typeof StudentsQuery>;

export const StudentSummaryRow = z.strictObject({
  id: Id,
  name: z.string(),
  pmdcNumber: z.string().nullable(),
  level: LevelKey,
  year: YearKey.nullable(),
  sessions: Count,
  doctors: Count,
  avgRatingPerStep: PerStep(Average),
  lastSessionAt: IsoDateTime.nullable(),
});
export type StudentSummaryRow = z.infer<typeof StudentSummaryRow>;

export const AuditEntry = z.strictObject({
  id: z.int(),
  action: z.string(),
  actorName: z.string().nullable(),
  createdAt: IsoDateTime,
  before: z.unknown(),
  after: z.unknown(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const RatingsPoint = z.strictObject({
  sessionId: Id,
  startedAt: IsoDateTime,
  ratings: PerStep(RatingValue.nullable()),
});
export type RatingsPoint = z.infer<typeof RatingsPoint>;

export const StudentDetail = z.strictObject({
  student: Student,
  summary: StudentSummaryRow,
  sessions: z.array(SessionListRow),
  /** Oldest first. */
  ratingsOverTime: z.array(RatingsPoint),
  /** Newest first. */
  changes: z.array(AuditEntry),
});
export type StudentDetail = z.infer<typeof StudentDetail>;

export const SessionFilters = z
  .strictObject({
    from: queryParam(IsoDate),
    to: queryParam(IsoDate),
    doctorId: queryParam(Id),
    studentId: queryParam(Id),
    caseType: queryParam(CaseTypeKey),
    page: queryParam(z.coerce.number().int().min(1).max(100_000)),
  })
  .refine(
    (filters) =>
      filters.from === undefined ||
      filters.to === undefined ||
      filters.from <= filters.to,
    { message: 'The start date is after the end date', path: ['to'] },
  );
export type SessionFilters = z.infer<typeof SessionFilters>;

/** One page of `ADMIN_PAGE_SIZE` rows, newest first. */
export const SessionPage = z.strictObject({
  rows: z.array(SessionListRow),
  total: Count,
});
export type SessionPage = z.infer<typeof SessionPage>;

export const SessionDetail = z.strictObject({
  session: TeachingSession,
  doctor: z.strictObject({ id: Id, name: z.string(), username: z.string() }),
  student: z.strictObject({
    id: Id,
    name: z.string(),
    pmdcNumber: z.string().nullable(),
  }),
  receivedAt: IsoDateTime,
});
export type SessionDetail = z.infer<typeof SessionDetail>;

export const ExportQuery = z
  .strictObject({
    from: queryParam(IsoDate),
    to: queryParam(IsoDate),
  })
  .refine(
    (filters) =>
      filters.from === undefined ||
      filters.to === undefined ||
      filters.from <= filters.to,
    { message: 'The start date is after the end date', path: ['to'] },
  );
export type ExportQuery = z.infer<typeof ExportQuery>;

/** One row per session, in this order (docs/plan/api.md, CSV columns). */
export const CSV_COLUMNS = [
  'session_id',
  'date',
  'start_time',
  'doctor_username',
  'doctor_name',
  'doctor_department',
  'doctor_designation',
  'student_id',
  'student_name',
  'pmdc_number',
  'learner_level',
  'learner_year',
  'department',
  'case_type',
  'teaching_seconds',
  'overtime_seconds',
  'paused_seconds',
  'log_seconds',
  'step1_rating',
  'step2_rating',
  'step3_rating',
  'step4_rating',
  'step5_rating',
  'step1_seconds',
  'step2_seconds',
  'step3_seconds',
  'step4_seconds',
  'step5_seconds',
  'step2_mode',
  'step4_tags',
  'diagnosis',
  'learner_gave_diagnosis',
  'usefulness',
  'pearl_used',
  'app_version',
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];
