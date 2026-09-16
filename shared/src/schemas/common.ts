import { z } from 'zod';
import {
  CASE_TYPES,
  DEPARTMENTS,
  DESIGNATIONS,
  LEVELS,
  LIMITS,
  MAX_SECONDS,
  STEP_IDS,
  USERNAME_PATTERN,
  YEARS,
} from '../constants.ts';

export const Id = z.uuid();
export const IsoDateTime = z.iso.datetime({ offset: true });
/** A calendar day, YYYY-MM-DD. */
export const IsoDate = z.iso.date();

export const LevelKey = z.enum(LEVELS);
export const YearKey = z.enum(YEARS);
export const CaseTypeKey = z.enum(CASE_TYPES);
export const DepartmentKey = z.enum(DEPARTMENTS);
export const DesignationKey = z.enum(DESIGNATIONS);
export const StepNumber = z.literal(STEP_IDS);

/** Whole seconds from 0 to six hours. */
export const Seconds = z.int().min(0).max(MAX_SECONDS);
export const RatingValue = z.literal([1, 2, 3, 4, 5]);
export const UsefulnessValue = z.literal([1, 2, 3, 4, 5, 6]);

/** Trims and collapses runs of spaces. */
export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export const PersonName = z
  .string()
  .overwrite(cleanName)
  .min(LIMITS.nameMin, `Use at least ${LIMITS.nameMin} characters`)
  .max(LIMITS.nameMax, `Use at most ${LIMITS.nameMax} characters`);

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    'Use 3–30 lower-case letters, digits, dots or underscores',
  );

export const StepText = z.string().max(LIMITS.stepTextMax);

/** Five numbers or nulls, one per step. */
export const PerStep = <T extends z.ZodType>(item: T) =>
  z.tuple([item, item, item, item, item]);

/** Treats an empty query value such as `?from=` as absent. */
export function queryParam<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    schema.optional(),
  );
}
