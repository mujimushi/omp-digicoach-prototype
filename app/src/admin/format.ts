import { REPORT_TIME_ZONE } from '@omp/shared';

const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: REPORT_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE });

/** Dates on the dashboard are in Pakistan time. */
export const formatDay = (iso: string | null) =>
  iso ? date.format(new Date(iso)) : '–';
export const formatDateTime = (iso: string | null) =>
  iso ? dateTime.format(new Date(iso)) : '–';
/** Today in Pakistan time, as YYYY-MM-DD. */
export const todayInPakistan = () => isoDay.format(new Date());

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '–';
  const whole = Math.round(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const formatAverage = (value: number | null, digits = 1) =>
  value === null ? '–' : value.toFixed(digits);
export const formatShare = (value: number | null) =>
  value === null ? '–' : `${Math.round(value * 100)}%`;
