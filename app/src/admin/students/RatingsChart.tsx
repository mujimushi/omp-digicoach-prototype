import { type RatingsPoint, STEPS } from '@omp/shared';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartBox, STEP_COLOURS } from '../components.tsx';
import { formatDay } from '../format.ts';

/** Ratings per step over time, one line per step, with the same numbers in a table for screen readers. */
export function RatingsChart({ points }: { points: readonly RatingsPoint[] }) {
  const data = points.map((p) => ({
    date: formatDay(p.startedAt),
    ...Object.fromEntries(
      p.ratings.map((rating, i) => [`step${i + 1}`, rating]),
    ),
  }));
  return (
    <>
      <ChartBox height={260}>
        {(size) => (
          <LineChart data={data} {...size} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              width={28}
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Legend />
            {STEPS.map((step, i) => (
              <Line
                key={step.id}
                type="monotone"
                dataKey={`step${step.id}`}
                name={`Step ${step.id}`}
                stroke={STEP_COLOURS[i] ?? '#735596'}
                strokeWidth={2}
                connectNulls
                dot
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ChartBox>
      <table className="visually-hidden">
        <caption>Ratings per step over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {STEPS.map((step) => (
              <th key={step.id} scope="col">
                Step {step.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.sessionId}>
              <th scope="row">{formatDay(p.startedAt)}</th>
              {p.ratings.map((rating, i) => (
                <td key={STEPS[i]?.id}>{rating ?? 'not rated'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
