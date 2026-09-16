import { STEPS } from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, adminKeys } from '../api.ts';
import {
  ChartBox,
  Figure,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { formatAverage, formatSeconds } from '../format.ts';

export function OverviewScreen() {
  const overview = useQuery({
    queryKey: adminKeys.overview,
    queryFn: adminApi.overview,
  });
  if (overview.isPending) return <Loading what="the overview" />;
  if (overview.isError) return <LoadError error={overview.error} />;
  const stats = overview.data;
  const weeks = stats.sessionsPerWeek.map((w) => ({
    week: w.weekStart.slice(5),
    sessions: w.sessions,
  }));

  return (
    <>
      <PageHeader title="Overview" subtitle="Figures in Pakistan time" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Figure
          label="Active doctors"
          value={String(stats.activeDoctors)}
          note="A session in the last 14 days"
        />
        <Figure
          label="Sessions this week"
          value={String(stats.sessionsThisWeek)}
          note="Since Monday"
        />
        <Figure label="Students" value={String(stats.students)} />
        <Figure
          label="Average teaching time"
          value={formatSeconds(stats.avgTeachingSecondsThisMonth)}
          note="This month"
        />
        <Figure
          label="Average extra time"
          value={formatSeconds(stats.avgOvertimeSecondsThisMonth)}
          note="This month"
        />
      </div>
      <Panel title="Sessions per week">
        <ChartBox height={240}>
          {(size) => (
            <BarChart data={weeks} {...size} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
              <Tooltip />
              <Bar
                dataKey="sessions"
                name="Sessions"
                fill="#735596"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ChartBox>
        <table className="visually-hidden">
          <caption>Sessions per week</caption>
          <tbody>
            {stats.sessionsPerWeek.map((w) => (
              <tr key={w.weekStart}>
                <th scope="row">Week of {w.weekStart}</th>
                <td>{w.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Average rating per step this month">
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
        >
          <caption className="visually-hidden">
            Average rating per step this month
          </caption>
          <tbody>
            {STEPS.map((step, i) => {
              const value = stats.avgRatingPerStepThisMonth[i] ?? null;
              return (
                <tr key={step.id}>
                  <th
                    scope="row"
                    style={{
                      textAlign: 'left',
                      fontWeight: 400,
                      padding: '6px 0',
                      width: 260,
                    }}
                  >
                    {step.id}. {step.name}
                  </th>
                  <td style={{ padding: '6px 8px' }}>
                    <div
                      aria-hidden="true"
                      style={{
                        height: 10,
                        borderRadius: 5,
                        background: '#F3EEF8',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 5,
                          width: `${value === null ? 0 : (value / 5) * 100}%`,
                          background: '#735596',
                        }}
                      />
                    </div>
                  </td>
                  <td
                    style={{ textAlign: 'right', fontWeight: 700, width: 60 }}
                  >
                    {formatAverage(value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
