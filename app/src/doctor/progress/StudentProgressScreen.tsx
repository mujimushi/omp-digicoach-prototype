import { isRatedStep, RATED_STEPS } from '@omp/shared';
import { User } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { IconCircle } from '../../ui/IconCircle.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { formatDate, formatShortDate, learnerLabel } from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

/** One student's ratings per step over time, from this doctor's sessions only. */
export function StudentProgressScreen() {
  const { studentId = '' } = useParams();
  const query = useRepositoryQuery(
    async (repo) => {
      const [student, sessions] = await Promise.all([
        repo.getStudent(studentId),
        repo.listMySessions({ studentId }),
      ]);
      return { student, sessions: [...sessions].reverse() };
    },
    [studentId],
  );

  const student = query.data?.student;
  const sessions = query.data?.sessions ?? [];
  const ratings = sessions.flatMap((s) =>
    s.steps.flatMap((step) =>
      step.rating === null || !isRatedStep(step.step) ? [] : [step.rating],
    ),
  );
  const average = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;

  return (
    <>
      <ScreenHeader
        title={student?.name ?? 'Student progress'}
        subtitle="Your sessions with this student"
        backTo="/progress"
      />
      <div style={{ flex: 1, padding: '0 16px 20px' }}>
        {student && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconCircle Icon={User} color={ds.coral} size={44} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: ds.tx }}>
                  {student.name}
                </div>
                <div style={{ fontSize: 13, color: ds.txB }}>
                  {learnerLabel(student.level, student.year)}
                  {student.pmdcNumber ? ` · PMDC ${student.pmdcNumber}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div
                style={{
                  flex: 1,
                  background: ds.bdL,
                  borderRadius: 10,
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: ds.warmDk }}
                >
                  {sessions.length}
                </div>
                <div style={{ fontSize: 12, color: ds.txB }}>Sessions</div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: ds.bdL,
                  borderRadius: 10,
                  padding: 10,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: ds.warmDk }}
                >
                  {average === null ? '–' : average.toFixed(1)}
                </div>
                <div style={{ fontSize: 12, color: ds.txB }}>
                  Average rating
                </div>
              </div>
            </div>
          </Card>
        )}

        {sessions.length > 0 && (
          <Card style={{ marginBottom: 12, overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <caption
                style={{
                  textAlign: 'left',
                  fontSize: 15,
                  fontWeight: 700,
                  color: ds.warmDk,
                  marginBottom: 8,
                }}
              >
                Ratings per step over time
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{
                      textAlign: 'left',
                      color: ds.txB,
                      fontWeight: 600,
                      padding: '4px 6px 4px 0',
                    }}
                  >
                    Date
                  </th>
                  {RATED_STEPS.map((step) => (
                    <th
                      key={step.id}
                      scope="col"
                      title={step.name}
                      style={{ color: ds.txB, fontWeight: 600, padding: 4 }}
                    >
                      <abbr
                        title={step.name}
                        style={{ textDecoration: 'none' }}
                      >
                        S{step.id}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    style={{ borderTop: `1px solid ${ds.bdL}` }}
                  >
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        fontWeight: 400,
                        color: ds.tx,
                        padding: '6px 6px 6px 0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatShortDate(session.startedAt)}
                    </th>
                    {session.steps
                      .filter((step) => isRatedStep(step.step))
                      .map((step) => (
                        <td
                          key={step.step}
                          style={{
                            textAlign: 'center',
                            padding: 4,
                            color: ds.warmDk,
                            fontWeight: 700,
                          }}
                        >
                          {step.rating ?? '–'}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: ds.txMuted, margin: '8px 0 0' }}>
              1 is needs improvement, 5 is excellent. – means not rated.
            </p>
          </Card>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[...sessions].reverse().map((session) => (
            <li key={session.id} style={{ marginBottom: 6 }}>
              <Link
                to={`/history/${session.id}`}
                style={{
                  ...ds.card,
                  display: 'block',
                  padding: 12,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: ds.tx,
                  }}
                >
                  {session.diagnosis ?? 'No diagnosis recorded'}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: ds.txMuted,
                    marginTop: 2,
                  }}
                >
                  {formatDate(session.startedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {query.status === 'ready' && sessions.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: ds.txMuted,
              fontSize: 14,
              marginTop: 24,
            }}
          >
            You haven’t taught this student yet.{' '}
            <Link to="/progress">Back to your students</Link>
          </p>
        )}
      </div>
    </>
  );
}
