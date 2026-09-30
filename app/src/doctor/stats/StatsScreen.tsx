import { RATED_STEPS, RATING_LABELS, ratedStepsText } from '@omp/shared';
import { Clock, Star, Timer, TimerReset } from 'lucide-react';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { IconCircle } from '../../ui/IconCircle.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { formatDuration } from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';
import { computeStats } from './stats.ts';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STEP_COLOURS = [ds.teal, ds.teal, ds.lavender, ds.green, ds.gold];

/** Figures from the doctor's own sessions only. */
export function StatsScreen() {
  const query = useRepositoryQuery((repo) => repo.listMySessions(), []);
  const stats = computeStats(query.data ?? [], new Date());
  const busiest = Math.max(1, ...stats.perWeekday);

  const tiles = [
    {
      label: 'Sessions',
      value: String(stats.total),
      note: `${stats.thisWeek} this week`,
      Icon: Timer,
      colour: ds.pri,
    },
    {
      label: 'Average teaching time',
      value:
        stats.avgTeachingSeconds === null
          ? '–'
          : formatDuration(stats.avgTeachingSeconds),
      note: 'Target: 1 minute',
      Icon: Clock,
      colour: ds.teal,
    },
    {
      label: 'Average extra time',
      value:
        stats.avgOvertimeSeconds === null
          ? '–'
          : formatDuration(stats.avgOvertimeSeconds),
      note: 'Beyond 60 seconds',
      Icon: TimerReset,
      colour: ds.coral,
    },
    {
      label: 'All rated steps done',
      value:
        stats.allStepsRatedShare === null
          ? '–'
          : `${Math.round(stats.allStepsRatedShare * 100)}%`,
      note: `Of your sessions, ${ratedStepsText()}`,
      Icon: Star,
      colour: ds.gold,
    },
  ];

  return (
    <>
      <ScreenHeader title="Stats" subtitle="From your own sessions" />
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {tiles.map((tile) => (
            <Card key={tile.label} padding={14}>
              <IconCircle Icon={tile.Icon} color={tile.colour} size={32} />
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: ds.warmDk,
                  marginTop: 8,
                }}
              >
                {tile.value}
              </div>
              <div style={{ fontSize: 13, color: ds.txB, marginTop: 1 }}>
                {tile.label}
              </div>
              <div style={{ fontSize: 12, color: ds.txMuted, marginTop: 4 }}>
                {tile.note}
              </div>
            </Card>
          ))}
        </div>

        <Card style={{ marginBottom: 14 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ds.warmDk,
              margin: '0 0 10px',
            }}
          >
            Average rating per step
          </h2>
          {RATED_STEPS.map((step) => {
            const value = stats.avgRatingPerStep[step.id - 1] ?? null;
            return (
              <div key={step.id} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: ds.tx,
                    marginBottom: 3,
                  }}
                >
                  <span>
                    {step.id}. {step.name}
                  </span>
                  <span style={{ fontWeight: 700 }}>
                    {value === null
                      ? 'No ratings'
                      : `${value.toFixed(1)} · ${RATING_LABELS[Math.round(value) - 1]}`}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  style={{ height: 8, borderRadius: 4, background: ds.bdL }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 4,
                      width: `${value === null ? 0 : (value / 5) * 100}%`,
                      background: STEP_COLOURS[step.id - 1],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Card>

        <Card>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: ds.warmDk,
              margin: '0 0 12px',
            }}
          >
            Sessions by weekday
          </h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 6,
              height: 96,
            }}
          >
            {WEEKDAYS.map((day, i) => {
              const count = stats.perWeekday[i] ?? 0;
              return (
                <div
                  key={day}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: ds.warmDk }}
                  >
                    {count}
                  </span>
                  <div
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      borderRadius: 6,
                      height: `${Math.max((count / busiest) * 56, 3)}px`,
                      background: count > 0 ? ds.pri : ds.bdL,
                    }}
                  />
                  <span style={{ fontSize: 11, color: ds.txB }}>{day}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
