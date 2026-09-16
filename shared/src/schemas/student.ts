import { z } from 'zod';
import { PMDC_PATTERN } from '../constants.ts';
import { Id, IsoDateTime, LevelKey, PersonName, YearKey } from './common.ts';

const YEAR_RULE = {
  message: 'Year applies to medical students only',
  path: ['year'],
};

function yearFitsLevel(value: {
  level?: string | undefined;
  year?: string | null | undefined;
}) {
  return (
    value.year === null ||
    value.year === undefined ||
    value.level === 'medical_student'
  );
}

/** Trims and upper-cases; an empty value becomes null. */
export function cleanPmdcNumber(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toUpperCase();
  return trimmed === '' ? null : trimmed;
}

export const PmdcNumber = z.preprocess(
  cleanPmdcNumber,
  z
    .string()
    .regex(PMDC_PATTERN, 'Use 3–20 letters, digits or hyphens')
    .nullable(),
);

export const Student = z
  .strictObject({
    id: Id,
    name: z.string(),
    pmdcNumber: z.string().nullable(),
    level: LevelKey,
    year: YearKey.nullable(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .refine(yearFitsLevel, YEAR_RULE);
export type Student = z.infer<typeof Student>;

/** A new or corrected student, with an ID made on the phone. */
export const StudentInput = z
  .strictObject({
    id: Id,
    name: PersonName,
    pmdcNumber: PmdcNumber,
    level: LevelKey,
    year: YearKey.nullable(),
  })
  .refine(yearFitsLevel, YEAR_RULE);
export type StudentInput = z.infer<typeof StudentInput>;

/** The admin's correction. The server merges it with the stored record and checks the year rule again. */
export const StudentUpdate = z
  .strictObject({
    name: PersonName.optional(),
    pmdcNumber: PmdcNumber.optional(),
    level: LevelKey.optional(),
    year: YearKey.nullable().optional(),
  })
  .refine(
    (value) => value.level === undefined || yearFitsLevel(value),
    YEAR_RULE,
  );
export type StudentUpdate = z.infer<typeof StudentUpdate>;

export const StudentAlias = z.strictObject({
  aliasId: Id,
  studentId: Id,
});
export type StudentAlias = z.infer<typeof StudentAlias>;
