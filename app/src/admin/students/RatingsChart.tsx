import { RATED_STEPS, type RatingsPoint, ratedValues } from '@omp/shared';
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

/**
 * Ratings per rated step over time, one line per step, with the same numbers in a table for screen
 * readers. Steps that are no longer rated are left out, including ratings stored for them earlier.
 */
export function RatingsChart({ points }: { points: readonly RatingsPoint[] }) {
  const data = points.map((p) => ({
    date: formatDay(p.startedAt),
    ...Object.fromEntries(
      RATED_STEPS.map((step) => [`step${step.id}`, p.ratings[step.id - 1]]),
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
            {RATED_STEPS.map((step) => (
              <Line
                key={step.id}
                type="monotone"
                dataKey={`step${step.id}`}
                name={`Step ${step.id}`}
                stroke={STEP_COLOURS[step.id - 1] ?? '#735596'}
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
            {RATED_STEPS.map((step) => (
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
              {ratedValues(p.ratings).map((rating, i) => (
                <td key={RATED_STEPS[i]?.id}>{rating ?? 'not rated'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
