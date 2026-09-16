import { z } from 'zod';
import { PUSH_BATCH_MAX } from '../constants.ts';
import { Id } from './common.ts';
import { Pearl, PearlIdPayload } from './pearl.ts';
import { TeachingSession } from './session.ts';
import { Student, StudentAlias, StudentInput } from './student.ts';

export const PUSH_ITEM_TYPES = [
  'student.upsert',
  'session.create',
  'pearl.upsert',
  'pearl.delete',
  'pearl.use',
] as const;
export type PushItemType = (typeof PUSH_ITEM_TYPES)[number];

export const PushItem = z.discriminatedUnion('type', [
  z.strictObject({
    opId: Id,
    type: z.literal('student.upsert'),
    payload: StudentInput,
  }),
  z.strictObject({
    opId: Id,
    type: z.literal('session.create'),
    payload: TeachingSession,
  }),
  z.strictObject({
    opId: Id,
    type: z.literal('pearl.upsert'),
    payload: Pearl,
  }),
  z.strictObject({
    opId: Id,
    type: z.literal('pearl.delete'),
    payload: PearlIdPayload,
  }),
  z.strictObject({
    opId: Id,
    type: z.literal('pearl.use'),
    payload: PearlIdPayload,
  }),
]);
export type PushItem = z.infer<typeof PushItem>;

/** What the phone sends: 1–50 items, in order. */
export const PushRequest = z.strictObject({
  items: z.array(PushItem).min(1).max(PUSH_BATCH_MAX),
});
export type PushRequest = z.infer<typeof PushRequest>;

/**
 * What the route checks: the batch only. Each payload is checked on its own by the server, so a
 * bad payload refuses only its own item.
 */
export const PushEnvelope = z.strictObject({
  items: z
    .array(
      z.object({
        opId: Id,
        type: z.string().min(1).max(40),
        payload: z.unknown(),
      }),
    )
    .min(1)
    .max(PUSH_BATCH_MAX),
});
export type PushEnvelope = z.infer<typeof PushEnvelope>;

export const PUSH_REJECT_CODES = [
  'unknown_student',
  'validation_failed',
  'forbidden',
  'pmdc_taken',
] as const;
export const PushRejectCode = z.enum(PUSH_REJECT_CODES);
export type PushRejectCode = z.infer<typeof PushRejectCode>;

export const PushResult = z.strictObject({
  opId: Id,
  status: z.enum(['applied', 'duplicate', 'rejected']),
  code: PushRejectCode.optional(),
  /** The existing student a new student was stored under, because they share a PMDC number. */
  mappedStudentId: Id.optional(),
});
export type PushResult = z.infer<typeof PushResult>;

export const PushResponse = z.strictObject({
  results: z.array(PushResult),
});
export type PushResponse = z.infer<typeof PushResponse>;

export const PullQuery = z.strictObject({
  cursor: z.string().max(64).optional(),
});
export type PullQuery = z.infer<typeof PullQuery>;

/** Everything changed since the cursor: all students and aliases, the caller's sessions and pearls. */
export const PullResponse = z.strictObject({
  cursor: z.string(),
  students: z.array(Student),
  studentAliases: z.array(StudentAlias),
  sessions: z.array(TeachingSession),
  pearls: z.array(Pearl),
});
export type PullResponse = z.infer<typeof PullResponse>;
