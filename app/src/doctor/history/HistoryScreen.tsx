import type { Student, TeachingSession } from '@omp/shared';
import { Link } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { StepDots } from '../components/StepDots.tsx';
import {
  caseTypeLabel,
  dayKey,
  formatDate,
  formatDuration,
  formatTime,
} from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

type Loaded = { sessions: TeachingSession[]; students: Map<string, Student> };

/** The doctor's own sessions, newest first, grouped by day. */
export function HistoryScreen() {
  const query = useRepositoryQuery(async (repo): Promise<Loaded> => {
    const [sessions, students] = await Promise.all([
      repo.listMySessions(),
      repo.listStudents(),
    ]);
    return { sessions, students: new Map(students.map((s) => [s.id, s])) };
  }, []);
  const sessions = query.data?.sessions ?? [];

  const groups: { key: string; label: string; sessions: TeachingSession[] }[] =
    [];
  for (const session of sessions) {
    const key = dayKey(session.startedAt);
    const last = groups.at(-1);
    if (last?.key === key) last.sessions.push(session);
    else
      groups.push({
        key,
        label: formatDate(session.startedAt),
        sessions: [session],
      });
  }

  return (
    <>
      <ScreenHeader title="History" subtitle="Your teaching sessions" />
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        {query.status === 'ready' && sessions.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: ds.txMuted,
              fontSize: 14,
              marginTop: 32,
            }}
          >
            No sessions yet. Choose a student to start one.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: ds.txMuted,
                letterSpacing: 1,
                margin: '14px 0 6px',
                textTransform: 'uppercase',
              }}
            >
              {group.label}
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.sessions.map((session) => {
                const student = query.data?.students.get(session.studentId);
                return (
                  <li key={session.id} style={{ marginBottom: 8 }}>
                    <Link
                      to={`/history/${session.id}`}
                      style={{
                        ...ds.card,
                        display: 'block',
                        padding: 14,
                        textDecoration: 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 15,
                              fontWeight: 700,
                              color: ds.tx,
                            }}
                          >
                            {session.diagnosis ?? 'No diagnosis recorded'}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 13,
                              color: ds.priText,
                              fontWeight: 600,
                              marginTop: 2,
                            }}
                          >
                            {student?.name ?? 'Student'}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: ds.txB,
                              marginTop: 2,
                            }}
                          >
                            {caseTypeLabel(session.caseType)} ·{' '}
                            {formatDuration(session.teachingSeconds)}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: ds.txMuted,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatTime(session.startedAt)}
                        </span>
                      </div>
                      <StepDots session={session} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
