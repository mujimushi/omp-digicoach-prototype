import type { Student } from '@omp/shared';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { formatShortDate, learnerLabel } from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

type Taught = { student: Student; sessions: number; lastAt: string };

/** Only the students this doctor has taught, from this doctor's sessions. */
export function ProgressScreen() {
  const query = useRepositoryQuery(async (repo): Promise<Taught[]> => {
    const sessions = await repo.listMySessions();
    const byStudent = new Map<string, { sessions: number; lastAt: string }>();
    for (const session of sessions) {
      const entry = byStudent.get(session.studentId);
      if (entry) entry.sessions += 1;
      else
        byStudent.set(session.studentId, {
          sessions: 1,
          lastAt: session.startedAt,
        });
    }
    const rows = await Promise.all(
      [...byStudent].map(async ([id, entry]) => {
        const student = await repo.getStudent(id);
        return student ? { student, ...entry } : undefined;
      }),
    );
    return rows
      .filter((row): row is Taught => row !== undefined)
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, []);
  const rows = query.data ?? [];

  return (
    <>
      <ScreenHeader
        title="Student progress"
        subtitle="Students you have taught"
      />
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        {query.status === 'ready' && rows.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: ds.txMuted,
              fontSize: 14,
              marginTop: 32,
            }}
          >
            Students appear here after you teach them.
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map(({ student, sessions, lastAt }) => (
            <li key={student.id} style={{ marginBottom: 8 }}>
              <Link
                to={`/progress/${student.id}`}
                style={{
                  ...ds.card,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  textDecoration: 'none',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 15,
                      fontWeight: 700,
                      color: ds.tx,
                    }}
                  >
                    {student.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: ds.txMuted,
                      marginTop: 2,
                    }}
                  >
                    {learnerLabel(student.level, student.year)} · {sessions}{' '}
                    {sessions === 1 ? 'session' : 'sessions'} · last{' '}
                    {formatShortDate(lastAt)}
                  </span>
                </span>
                <ChevronRight size={18} color={ds.txL} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
