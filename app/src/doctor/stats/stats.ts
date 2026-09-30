import { isRatedStep, type TeachingSession } from '@omp/shared';

export type DoctorStats = {
  total: number;
  thisWeek: number;
  avgTeachingSeconds: number | null;
  avgOvertimeSeconds: number | null;
  /** Average rating per step, over the sessions that rated it. Null for steps not rated. */
  avgRatingPerStep: (number | null)[];
  /** Monday first. */
  perWeekday: number[];
  /** Share of sessions with every rated step rated. */
  allStepsRatedShare: number | null;
};

const average = (values: number[]) =>
  values.length === 0
    ? null
    : values.reduce((a, b) => a + b, 0) / values.length;

/** Monday 00:00 of the week containing `now`, in the phone's time zone. */
export function startOfWeek(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function computeStats(
  sessions: readonly TeachingSession[],
  now: Date,
): DoctorStats {
  const weekStart = startOfWeek(now).getTime();
  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const session of sessions) {
    const day = new Date(session.startedAt).getDay();
    perWeekday[(day + 6) % 7] = (perWeekday[(day + 6) % 7] ?? 0) + 1;
  }
  return {
    total: sessions.length,
    thisWeek: sessions.filter(
      (s) => new Date(s.startedAt).getTime() >= weekStart,
    ).length,
    avgTeachingSeconds: average(sessions.map((s) => s.teachingSeconds)),
    avgOvertimeSeconds: average(sessions.map((s) => s.overtimeSeconds)),
    avgRatingPerStep: [0, 1, 2, 3, 4].map((i) =>
      !isRatedStep(i + 1)
        ? null
        : average(
            sessions.flatMap((s) => {
              const rating = s.steps[i]?.rating;
              return rating === null || rating === undefined ? [] : [rating];
            }),
          ),
    ),
    perWeekday,
    allStepsRatedShare:
      sessions.length === 0
        ? null
        : sessions.filter((s) =>
            s.steps.every(
              (step) => !isRatedStep(step.step) || step.rating !== null,
            ),
          ).length / sessions.length,
  };
}
