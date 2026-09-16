import { CASE_TYPE_LABELS, type SessionListRow } from '@omp/shared';
import { Link } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import type { Column } from '../components.tsx';
import { formatDateTime, formatSeconds } from '../format.ts';

const ratingsText = (row: SessionListRow) =>
  row.ratings.map((r) => r ?? '–').join(' · ');

/** Session table columns, shared by the sessions list, doctor and student pages. */
export function sessionColumns(
  options: { doctor?: boolean; student?: boolean } = {},
): Column<SessionListRow>[] {
  const columns: Column<SessionListRow>[] = [
    {
      key: 'date',
      label: 'Date',
      sortValue: (r) => r.startedAt,
      render: (r) => (
        <Link
          to={`/admin/sessions/${r.id}`}
          style={{ color: ds.priText, fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          {formatDateTime(r.startedAt)}
        </Link>
      ),
    },
  ];
  if (options.doctor !== false) {
    columns.push({
      key: 'doctor',
      label: 'Doctor',
      sortValue: (r) => r.doctorName,
      render: (r) => r.doctorName,
    });
  }
  if (options.student !== false) {
    columns.push({
      key: 'student',
      label: 'Student',
      sortValue: (r) => r.studentName,
      render: (r) => (
        <Link to={`/admin/students/${r.studentId}`}>{r.studentName}</Link>
      ),
    });
  }
  columns.push(
    {
      key: 'case',
      label: 'Case type',
      sortValue: (r) => r.caseType,
      render: (r) => CASE_TYPE_LABELS[r.caseType],
    },
    { key: 'diagnosis', label: 'Diagnosis', render: (r) => r.diagnosis ?? '–' },
    {
      key: 'time',
      label: 'Teaching',
      align: 'right',
      sortValue: (r) => r.teachingSeconds,
      render: (r) => formatSeconds(r.teachingSeconds),
    },
    {
      key: 'extra',
      label: 'Extra',
      align: 'right',
      sortValue: (r) => r.overtimeSeconds,
      render: (r) => formatSeconds(r.overtimeSeconds),
    },
    { key: 'ratings', label: 'Ratings, steps 1–5', render: ratingsText },
    {
      key: 'useful',
      label: 'Useful',
      align: 'right',
      sortValue: (r) => r.usefulness,
      render: (r) => r.usefulness ?? '–',
    },
  );
  return columns;
}
