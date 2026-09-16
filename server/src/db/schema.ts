import type { StepContent } from '@omp/shared';
import { CASE_TYPES, LEVELS, YEARS } from '@omp/shared';
import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
/** Set only through `nextChangeSeq()`, inside the writing transaction. */
const changeSeq = () => bigint('change_seq', { mode: 'number' }).notNull();

export const learnerLevel = pgEnum('learner_level', LEVELS);
export const learnerYear = pgEnum('learner_year', YEARS);
export const caseType = pgEnum('case_type', CASE_TYPES);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    // Departments and designations are checked by Zod, so adding one needs no migration.
    department: text('department'),
    designation: text('designation'),
    isDoctor: boolean('is_doctor').notNull().default(true),
    isAdmin: boolean('is_admin').notNull().default(false),
    active: boolean('active').notNull().default(true),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_username_unique').on(lower(t.username))],
);

export const loginSessions = pgTable(
  'login_sessions',
  {
    /** SHA-256 of the cookie token. The token itself is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('login_sessions_user_id_idx').on(t.userId)],
);

export const loginAttempts = pgTable('login_attempts', {
  /** Kept for any username, whether or not the account exists. */
  usernameLower: text('username_lower').primaryKey(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const students = pgTable(
  'students',
  {
    /** Made on the phone. */
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    pmdcNumber: text('pmdc_number'),
    level: learnerLevel('level').notNull(),
    year: learnerYear('year'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    changeSeq: changeSeq(),
  },
  (t) => [
    uniqueIndex('students_pmdc_unique')
      .on(t.pmdcNumber)
      .where(sql`${t.pmdcNumber} is not null`),
    check(
      'students_year_only_for_medical_students',
      sql`${t.year} is null or ${t.level} = 'medical_student'`,
    ),
    index('students_change_seq_idx').on(t.changeSeq),
  ],
);

export const studentAliases = pgTable(
  'student_aliases',
  {
    aliasId: uuid('alias_id').primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    createdAt: createdAt(),
    changeSeq: changeSeq(),
  },
  (t) => [index('student_aliases_change_seq_idx').on(t.changeSeq)],
);

export const teachingSessions = pgTable(
  'teaching_sessions',
  {
    /** Made on the phone. */
    id: uuid('id').primaryKey(),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    department: text('department').notNull(),
    caseType: caseType('case_type').notNull(),
    learnerLevel: learnerLevel('learner_level').notNull(),
    learnerYear: learnerYear('learner_year'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    teachingSeconds: integer('teaching_seconds').notNull(),
    overtimeSeconds: integer('overtime_seconds').notNull(),
    pausedSeconds: integer('paused_seconds').notNull(),
    logSeconds: integer('log_seconds').notNull(),
    diagnosis: text('diagnosis'),
    learnerGaveDiagnosis: boolean('learner_gave_diagnosis'),
    usefulness: smallint('usefulness'),
    appVersion: text('app_version').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSeq: changeSeq(),
  },
  (t) => [
    check(
      'teaching_sessions_seconds_not_negative',
      sql`${t.teachingSeconds} >= 0 and ${t.overtimeSeconds} >= 0 and ${t.pausedSeconds} >= 0 and ${t.logSeconds} >= 0`,
    ),
    check(
      'teaching_sessions_usefulness_range',
      sql`${t.usefulness} is null or ${t.usefulness} between 1 and 6`,
    ),
    check(
      'teaching_sessions_year_only_for_medical_students',
      sql`${t.learnerYear} is null or ${t.learnerLevel} = 'medical_student'`,
    ),
    index('teaching_sessions_doctor_started_idx').on(t.doctorId, t.startedAt),
    index('teaching_sessions_student_started_idx').on(t.studentId, t.startedAt),
    index('teaching_sessions_change_seq_idx').on(t.changeSeq),
  ],
);

export const sessionSteps = pgTable(
  'session_steps',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => teachingSessions.id, { onDelete: 'cascade' }),
    step: smallint('step').notNull(),
    seconds: integer('seconds').notNull(),
    rating: smallint('rating'),
    content: jsonb('content').$type<StepContent>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.step] }),
    check('session_steps_step_range', sql`${t.step} between 1 and 5`),
    check('session_steps_seconds_not_negative', sql`${t.seconds} >= 0`),
    check(
      'session_steps_rating_range',
      sql`${t.rating} is null or ${t.rating} between 1 and 5`,
    ),
  ],
);

export const pearls = pgTable(
  'pearls',
  {
    /** Made on the phone. */
    id: uuid('id').primaryKey(),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    diagnosis: text('diagnosis').notNull(),
    points: jsonb('points').$type<string[]>().notNull(),
    timesUsed: integer('times_used').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    changeSeq: changeSeq(),
  },
  (t) => [index('pearls_doctor_change_seq_idx').on(t.doctorId, t.changeSeq)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entityType, t.entityId)],
);

export const processedOps = pgTable('processed_ops', {
  opId: uuid('op_id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: text('type').notNull(),
  /** The result sent back, returned again when the same item arrives twice. */
  result: jsonb('result').notNull(),
  createdAt: createdAt(),
});

/** One row. Every write of a student, alias, session or pearl takes its `change_seq` from here. */
export const changeCounter = pgTable(
  'change_counter',
  {
    id: smallint('id').primaryKey(),
    value: bigint('value', { mode: 'number' }).notNull().default(0),
  },
  (t) => [check('change_counter_single_row', sql`${t.id} = 1`)],
);
