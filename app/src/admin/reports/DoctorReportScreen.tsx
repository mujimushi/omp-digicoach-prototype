import {
  DEPARTMENT_LABELS,
  DESIGNATION_LABELS,
  ratedStepsText,
  ratedValues,
} from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { adminApi, adminKeys } from '../api.ts';
import {
  Figure,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { RatingSpreadTable } from '../doctors/DoctorDetailScreen.tsx';
import { formatDay, formatSeconds, formatShare } from '../format.ts';

/** A printable doctor report: activity, sessions and the spread of ratings. */
export function DoctorReportScreen() {
  const { id = '' } = useParams();
  const detail = useQuery({
    queryKey: adminKeys.doctor(id),
    queryFn: () => adminApi.doctor(id),
  });
  if (detail.isPending) return <Loading what="the report" />;
  if (detail.isError) return <LoadError error={detail.error} />;
  const { activity, sessions, ratingSpread } = detail.data;

  return (
    <div className="print-report">
      <PageHeader
        title={`Doctor report: ${activity.name}`}
        subtitle={[
          activity.department ? DEPARTMENT_LABELS[activity.department] : null,
          activity.designation
            ? DESIGNATION_LABELS[activity.designation]
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Button icon={<Printer size={16} />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        }
      />
      <Panel title="Activity">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <Figure label="Sessions" value={String(activity.sessionsTotal)} />
          <Figure
            label="Last 7 days"
            value={String(activity.sessionsLast7Days)}
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
        </div>
      </Panel>
      <Panel title="Spread of ratings">
        <RatingSpreadTable spread={ratingSpread} />
      </Panel>
      <Panel title="Sessions">
        <table
          className="admin-table"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <caption className="visually-hidden">Sessions</caption>
          <thead>
            <tr>
              {[
                'Date',
                'Student',
                'Diagnosis',
                'Teaching',
                'Extra',
                `Ratings, ${ratedStepsText()}`,
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: 6,
                    borderBottom: `2px solid ${ds.bd}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${ds.bdL}` }}>
                <td style={{ padding: 6 }}>{formatDay(s.startedAt)}</td>
                <td style={{ padding: 6 }}>{s.studentName}</td>
                <td style={{ padding: 6 }}>{s.diagnosis ?? '–'}</td>
                <td style={{ padding: 6 }}>
                  {formatSeconds(s.teachingSeconds)}
                </td>
                <td style={{ padding: 6 }}>
                  {formatSeconds(s.overtimeSeconds)}
                </td>
                <td style={{ padding: 6 }}>
                  {ratedValues(s.ratings)
                    .map((r) => r ?? '–')
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
