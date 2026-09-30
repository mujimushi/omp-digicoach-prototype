import {
  DEPARTMENT_LABELS,
  DESIGNATION_LABELS,
  LEVEL_LABELS,
  RATED_STEPS,
  RATING_LABELS,
  type TaughtStudentRow,
  YEAR_LABELS,
} from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { FileText, SquarePen } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../ui/Button.tsx';
import { adminApi, adminKeys } from '../api.ts';
import {
  type Column,
  DataTable,
  Figure,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { formatDay, formatSeconds, formatShare } from '../format.ts';
import { sessionColumns } from '../sessions/columns.tsx';

const STUDENT_COLUMNS: Column<TaughtStudentRow>[] = [
  {
    key: 'name',
    label: 'Student',
    sortValue: (r) => r.name,
    render: (r) => <Link to={`/admin/students/${r.id}`}>{r.name}</Link>,
  },
  { key: 'pmdc', label: 'PMDC number', render: (r) => r.pmdcNumber ?? '–' },
  {
    key: 'level',
    label: 'Level',
    render: (r) =>
      r.year
        ? `${LEVEL_LABELS[r.level]}, ${YEAR_LABELS[r.year]}`
        : LEVEL_LABELS[r.level],
  },
  {
    key: 'sessions',
    label: 'Sessions',
    align: 'right',
    sortValue: (r) => r.sessions,
    render: (r) => r.sessions,
  },
  {
    key: 'last',
    label: 'Last session',
    sortValue: (r) => r.lastSessionAt,
    render: (r) => formatDay(r.lastSessionAt),
  },
];

export function RatingSpreadTable({
  spread,
}: {
  spread: { counts: number[]; unrated: number }[];
}) {
  return (
    <table
      className="admin-table"
      style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
    >
      <caption className="visually-hidden">Spread of ratings per step</caption>
      <thead>
        <tr>
          <th scope="col" style={{ textAlign: 'left', padding: 6 }}>
            Step
          </th>
          {RATING_LABELS.map((label, i) => (
            <th
              key={label}
              scope="col"
              style={{ textAlign: 'right', padding: 6 }}
            >
              {i + 1}: {label}
            </th>
          ))}
          <th scope="col" style={{ textAlign: 'right', padding: 6 }}>
            Not rated
          </th>
        </tr>
      </thead>
      <tbody>
        {RATED_STEPS.map((step) => (
          <tr key={step.id}>
            <th
              scope="row"
              style={{ textAlign: 'left', fontWeight: 400, padding: 6 }}
            >
              {step.id}. {step.name}
            </th>
            {spread[step.id - 1]?.counts.map((count, j) => (
              <td
                key={RATING_LABELS[j]}
                style={{ textAlign: 'right', padding: 6 }}
              >
                {count}
              </td>
            ))}
            <td style={{ textAlign: 'right', padding: 6 }}>
              {spread[step.id - 1]?.unrated}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DoctorDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const detail = useQuery({
    queryKey: adminKeys.doctor(id),
    queryFn: () => adminApi.doctor(id),
  });
  if (detail.isPending) return <Loading what="the doctor" />;
  if (detail.isError) return <LoadError error={detail.error} />;
  const { activity, sessions, students, ratingSpread } = detail.data;

  return (
    <>
      <PageHeader
        title={activity.name}
        subtitle={[
          activity.username,
          activity.department ? DEPARTMENT_LABELS[activity.department] : null,
          activity.designation
            ? DESIGNATION_LABELS[activity.designation]
            : null,
          activity.active ? null : 'Switched off',
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<FileText size={16} />}
              onClick={() => navigate(`/admin/reports/doctors/${id}`)}
            >
              Report
            </Button>
            <Button
              icon={<SquarePen size={16} />}
              onClick={() => navigate(`/admin/doctors/${id}/edit`)}
            >
              Edit
            </Button>
          </>
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Figure
          label="Sessions"
          value={String(activity.sessionsTotal)}
          note={`${activity.sessionsLast7Days} in the last 7 days`}
        />
        <Figure
          label="Average teaching time"
          value={formatSeconds(activity.avgTeachingSeconds)}
        />
        <Figure
          label="Average extra time"
          value={formatSeconds(activity.avgOvertimeSeconds)}
        />
        <Figure
          label="All rated steps done"
          value={formatShare(activity.allStepsRatedShare)}
        />
        <Figure
          label="Students taught"
          value={String(activity.studentsTaught)}
        />
        <Figure label="Last login" value={formatDay(activity.lastLoginAt)} />
      </div>
      <Panel title="Spread of ratings">
        <RatingSpreadTable spread={ratingSpread} />
      </Panel>
      <Panel title="Students taught">
        <DataTable
          caption="Students taught"
          rows={students}
          columns={STUDENT_COLUMNS}
          rowKey={(r) => r.id}
        />
      </Panel>
      <Panel title="Sessions">
        <DataTable
          caption="Sessions"
          rows={sessions}
          columns={sessionColumns({ doctor: false })}
          rowKey={(r) => r.id}
          empty="No sessions yet."
        />
      </Panel>
    </>
  );
}
