import { REPORT_TIME_ZONE } from '@omp/shared';
import { type SQL, sql } from 'drizzle-orm';

/** Pakistan time, for grouping and filtering by day. */
export const TZ = sql.raw(`'${REPORT_TIME_ZONE}'`);

/** Midnight at the start of a calendar day in Pakistan time, as a timestamp. */
export function startOfDay(date: string): SQL {
  return sql`(${date}::date::timestamp at time zone ${TZ})`;
}

/** Midnight at the end of a calendar day in Pakistan time: the start of the next day. */
export function endOfDay(date: string): SQL {
  return sql`((${date}::date + 1)::timestamp at time zone ${TZ})`;
}

/** Escapes `%`, `_` and `\` so a search matches them literally in `ilike`. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function toAverage(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return (
    value instanceof Date ? value : new Date(String(value))
  ).toISOString();
}
