import { z } from 'zod';
import { LIMITS } from '../constants.ts';
import { Id, IsoDateTime, StepText } from './common.ts';

export const PearlPoints = z.tuple([
  StepText,
  StepText,
  StepText,
  StepText,
  StepText,
]);

/** A doctor's private teaching points for one diagnosis. */
export const Pearl = z.strictObject({
  id: Id,
  diagnosis: z.string().trim().min(1).max(LIMITS.diagnosisMax),
  points: PearlPoints,
  timesUsed: z.int().min(0),
  updatedAt: IsoDateTime,
  deleted: z.boolean(),
});
export type Pearl = z.infer<typeof Pearl>;

export const PearlIdPayload = z.strictObject({ id: Id });
export type PearlIdPayload = z.infer<typeof PearlIdPayload>;
