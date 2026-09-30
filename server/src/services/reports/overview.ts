import { isRatedStep, type OverviewStats } from '@omp/shared';
import { sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { TZ, toAverage, toNumber } from './sql.ts';

/** The dashboard's first page. Weeks start on Monday and months on the 1st, in Pakistan time. */
export async function getOverview(db: Db, now: Date): Promise<OverviewStats> {
  const at = sql`${now.toISOString()}::timestamptz`;
  const weekStart = sql`(date_trunc('week', ${at} at time zone ${TZ}) at time zone ${TZ})`;
  const monthStart = sql`(date_trunc('month', ${at} at time zone ${TZ}) at time zone ${TZ})`;

  const [figures, ratings, weeks] = await Promise.all([
    db.execute(sql`
      select
        (select count(distinct doctor_id) from teaching_sessions where started_at >= ${at} - interval '14 days') as active_doctors,
        (select count(*) from teaching_sessions where started_at >= ${weekStart}) as sessions_this_week,
        (select count(*) from students) as students,
        (select avg(teaching_seconds) from teaching_sessions where started_at >= ${monthStart}) as avg_teaching,
        (select avg(overtime_seconds) from teaching_sessions where started_at >= ${monthStart}) as avg_overtime`),
    db.execute(sql`
      select ss.step, avg(ss.rating) as average
      from session_steps ss join teaching_sessions s on s.id = ss.session_id
      where s.started_at >= ${monthStart} and ss.rating is not null
      group by ss.step`),
    db.execute(sql`
      select to_char(w.start, 'YYYY-MM-DD') as week_start, count(s.id) as sessions
      from generate_series(
        date_trunc('week', ${at} at time zone ${TZ}) - interval '11 weeks',
        date_trunc('week', ${at} at time zone ${TZ}),
        interval '1 week'
      ) as w(start)
      left join teaching_sessions s
        on s.started_at >= (w.start at time zone ${TZ})
        and s.started_at < ((w.start + interval '1 week') at time zone ${TZ})
      group by w.start
      order by w.start`),
  ]);

  const row = figures.rows[0] ?? {};
  const perStep = [
    null,
    null,
    null,
    null,
    null,
  ] as OverviewStats['avgRatingPerStepThisMonth'];
  // Steps no longer rated keep their stored ratings, but stay out of every average.
  for (const entry of ratings.rows) {
    const step = toNumber(entry.step);
    if (isRatedStep(step)) perStep[step - 1] = toAverage(entry.average);
  }

  return {
    activeDoctors: toNumber(row.active_doctors),
    sessionsThisWeek: toNumber(row.sessions_this_week),
    students: toNumber(row.students),
    avgTeachingSecondsThisMonth: toAverage(row.avg_teaching),
    avgOvertimeSecondsThisMonth: toAverage(row.avg_overtime),
    avgRatingPerStepThisMonth: perStep,
    sessionsPerWeek: weeks.rows.map((w) => ({
      weekStart: String(w.week_start),
      sessions: toNumber(w.sessions),
    })),
  };
}
