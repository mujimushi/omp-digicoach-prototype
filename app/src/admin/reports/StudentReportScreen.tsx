import {
  LEVEL_LABELS,
  RATED_STEPS,
  ratedValues,
  YEAR_LABELS,
} from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useId } from 'react';
import { useParams, useSearchParams } from 'react-router';
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
import { formatAverage, formatDay, formatSeconds } from '../format.ts';
import { RatingsChart } from '../students/RatingsChart.tsx';

const inRange = (iso: string, from: string, to: string) => {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
  }).format(new Date(iso));
  return (from === '' || day >= from) && (to === '' || day <= to);
};

/** A printable student report: summary, ratings over time and the session list, for a date range. */
export function StudentReportScreen() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const fromId = useId();
  const toId = useId();
  const detail = useQuery({
    queryKey: adminKeys.student(id),
    queryFn: () => adminApi.student(id),
  });

  if (detail.isPending) return <Loading what="the report" />;
  if (detail.isError) return <LoadError error={detail.error} />;
  const { student, summary } = detail.data;
  // The date range narrows what the server sent; every number shown comes from the server's rows.
  const sessions = detail.data.sessions.filter((s) =>
    inRange(s.startedAt, from, to),
  );
  const points = detail.data.ratingsOverTime.filter((p) =>
    inRange(p.startedAt, from, to),
  );
  const range =
    from || to
      ? `${from ? formatDay(`${from}T12:00:00+05:00`) : 'the start'} to ${to ? formatDay(`${to}T12:00:00+05:00`) : 'today'}`
      : 'All sessions';

  return (
    <div className="print-report">
      <PageHeader
        title={`Student report: ${student.name}`}
        subtitle={range}
        actions={
          <Button icon={<Printer size={16} />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        }
      />
      <div
        className="no-print"
        style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}
      >
        <div>
          <label
            htmlFor={fromId}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ds.txB,
              display: 'block',
              marginBottom: 6,
            }}
          >
            From
          </label>
          <input
            id={fromId}
            type="date"
            value={from}
            onChange={(e) => setParams({ from: e.target.value, to })}
            style={ds.input}
          />
        </div>
        <div>
          <label
            htmlFor={toId}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ds.txB,
              display: 'block',
              marginBottom: 6,
            }}
          >
            To
          </label>
          <input
            id={toId}
            type="date"
            value={to}
            onChange={(e) => setParams({ from, to: e.target.value })}
            style={ds.input}
          />
        </div>
      </div>
      <Panel title="Student">
        <p style={{ margin: 0, fontSize: 14 }}>
          {student.name} ·{' '}
          {student.pmdcNumber ? `PMDC ${student.pmdcNumber}` : 'No PMDC number'}{' '}
          · {LEVEL_LABELS[student.level]}
          {student.year ? `, ${YEAR_LABELS[student.year]}` : ''}
        </p>
      </Panel>
      <Panel title="Summary">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
          }}
        >
          <Figure label="Sessions in range" value={String(sessions.length)} />
          <Figure label="Sessions in total" value={String(summary.sessions)} />
          <Figure label="Doctors in total" value={String(summary.doctors)} />
          {RATED_STEPS.map((step) => (
            <Figure
              key={step.id}
              label={`Step ${step.id} average, all sessions`}
              value={formatAverage(
                summary.avgRatingPerStep[step.id - 1] ?? null,
              )}
            />
          ))}
        </div>
      </Panel>
      <Panel title="Ratings over time">
        {points.length > 0 ? (
          <RatingsChart points={points} />
        ) : (
          <p style={{ color: ds.txMuted }}>No sessions in this range.</p>
        )}
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
                'Doctor',
                'Diagnosis',
                'Teaching',
                ...RATED_STEPS.map((step) => `Step ${step.id}`),
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
                <td style={{ padding: 6 }}>{s.doctorName}</td>
                <td style={{ padding: 6 }}>{s.diagnosis ?? '–'}</td>
                <td style={{ padding: 6 }}>
                  {formatSeconds(s.teachingSeconds)}
                </td>
                {ratedValues(s.ratings).map((rating, i) => (
                  <td key={RATED_STEPS[i]?.id} style={{ padding: 6 }}>
                    {rating ?? '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
