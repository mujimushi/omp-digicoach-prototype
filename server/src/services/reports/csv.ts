import {
  CSV_COLUMNS,
  type CsvColumn,
  type ExportQuery,
  REPORT_TIME_ZONE,
} from '@omp/shared';
import { sql } from 'drizzle-orm';
import type { Db } from '../../db/client.ts';
import { auditLog } from '../../db/schema.ts';
import { sessionConditions } from './sessions.ts';
import { TZ } from './sql.ts';

const BYTE_ORDER_MARK = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell. A value that starts like a formula gets a leading apostrophe, so a spreadsheet
 * shows it as text; commas, quotes and line breaks are quoted as RFC 4180 requires.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvLine(values: readonly unknown[]): string {
  return values.map(csvCell).join(',');
}

const yesNo = (value: unknown) =>
  value === null || value === undefined ? '' : value ? 'yes' : 'no';

/** Every session in the date range, one row each, with a byte-order mark so Excel reads names correctly. */
export async function buildSessionsCsv(
  db: Db,
  actorId: string,
  filters: ExportQuery,
  now: Date,
): Promise<{ csv: string; rows: number; filename: string }> {
  const result = await db.execute(sql`
    select s.id, s.department, s.case_type, s.learner_level, s.learner_year, s.teaching_seconds,
      s.overtime_seconds, s.paused_seconds, s.log_seconds, s.diagnosis, s.learner_gave_diagnosis,
      s.usefulness, s.app_version, s.student_id,
      to_char(s.started_at at time zone ${TZ}, 'YYYY-MM-DD') as date,
      to_char(s.started_at at time zone ${TZ}, 'HH24:MI') as start_time,
      u.username as doctor_username, u.name as doctor_name, u.department as doctor_department,
      u.designation as doctor_designation, st.name as student_name, st.pmdc_number,
      (select array_agg(ss.rating order by ss.step) from session_steps ss where ss.session_id = s.id) as ratings,
      (select array_agg(ss.seconds order by ss.step) from session_steps ss where ss.session_id = s.id) as step_seconds,
      (select ss.content ->> 'mode' from session_steps ss where ss.session_id = s.id and ss.step = 2) as step2_mode,
      (select ss.content -> 'tags' from session_steps ss where ss.session_id = s.id and ss.step = 4) as step4_tags,
      (select ss.content ->> 'pearlUsedId' from session_steps ss where ss.session_id = s.id and ss.step = 3) as pearl_used_id
    from teaching_sessions s
    join users u on u.id = s.doctor_id
    join students st on st.id = s.student_id
    where ${sessionConditions(filters)}
    order by s.started_at, s.id`);

  const lines = [CSV_COLUMNS.join(',')];
  for (const row of result.rows) {
    const ratings = (row.ratings as (number | null)[] | null) ?? [];
    const seconds = (row.step_seconds as number[] | null) ?? [];
    const tags = (row.step4_tags as string[] | null) ?? [];
    const cells: Record<CsvColumn, unknown> = {
      session_id: row.id,
      date: row.date,
      start_time: row.start_time,
      doctor_username: row.doctor_username,
      doctor_name: row.doctor_name,
      doctor_department: row.doctor_department,
      doctor_designation: row.doctor_designation,
      student_id: row.student_id,
      student_name: row.student_name,
      pmdc_number: row.pmdc_number,
      learner_level: row.learner_level,
      learner_year: row.learner_year,
      department: row.department,
      case_type: row.case_type,
      teaching_seconds: row.teaching_seconds,
      overtime_seconds: row.overtime_seconds,
      paused_seconds: row.paused_seconds,
      log_seconds: row.log_seconds,
      step1_rating: ratings[0],
      step2_rating: ratings[1],
      step3_rating: ratings[2],
      step4_rating: ratings[3],
      step5_rating: ratings[4],
      step1_seconds: seconds[0],
      step2_seconds: seconds[1],
      step3_seconds: seconds[2],
      step4_seconds: seconds[3],
      step5_seconds: seconds[4],
      step2_mode: row.step2_mode,
      step4_tags: tags.join('; '),
      diagnosis: row.diagnosis,
      learner_gave_diagnosis: yesNo(row.learner_gave_diagnosis),
      usefulness: row.usefulness,
      pearl_used: row.pearl_used_id ? 'yes' : 'no',
      app_version: row.app_version,
    };
    lines.push(csvLine(CSV_COLUMNS.map((column) => cells[column])));
  }

  await db.insert(auditLog).values({
    actorId,
    action: 'sessions.export',
    entityType: 'export',
    entityId: 'sessions.csv',
    before: null,
    after: {
      from: filters.from ?? null,
      to: filters.to ?? null,
      rows: result.rows.length,
    },
    createdAt: now,
  });

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE,
  }).format(now);
  return {
    csv: `${BYTE_ORDER_MARK}${lines.join('\r\n')}\r\n`,
    rows: result.rows.length,
    filename: `omp-sessions-${today}.csv`,
  };
}
