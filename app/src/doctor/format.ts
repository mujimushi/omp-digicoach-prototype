import {
  CASE_TYPE_LABELS,
  type CaseType,
  DEPARTMENT_LABELS,
  type Department,
  LEVEL_LABELS,
  type Level,
  YEAR_LABELS,
  type Year,
} from '@omp/shared';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "Thu, 17 Sept 2026" in the phone's time zone. */
export const formatDate = (iso: string | number) =>
  dateFormat.format(new Date(iso));
/** "17 Sept". */
export const formatShortDate = (iso: string | number) =>
  shortDateFormat.format(new Date(iso));
/** "09:15". */
export const formatTime = (iso: string | number) =>
  timeFormat.format(new Date(iso));

/** The phone's calendar day, as a key for grouping. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "1m 30s" or "45s". */
export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function learnerLabel(level: Level, year: Year | null): string {
  return year
    ? `${LEVEL_LABELS[level]} · ${YEAR_LABELS[year]}`
    : LEVEL_LABELS[level];
}

export const caseTypeLabel = (value: CaseType) => CASE_TYPE_LABELS[value];
export const departmentLabel = (value: Department) => DEPARTMENT_LABELS[value];
