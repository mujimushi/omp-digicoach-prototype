import {
  isRatedStep,
  type SessionStep,
  STEP3_TEMPLATES,
  STEPS,
  type TeachingSession,
  USEFULNESS_LABEL,
} from '@omp/shared';
import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { StarsText } from '../components/StarsText.tsx';
import {
  caseTypeLabel,
  departmentLabel,
  formatDate,
  formatDuration,
  formatTime,
  learnerLabel,
} from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: `1px solid ${ds.bdL}`,
      }}
    >
      <dt style={{ fontSize: 13, color: ds.txB }}>{label}</dt>
      <dd
        style={{
          fontSize: 13,
          color: ds.tx,
          fontWeight: 600,
          margin: 0,
          textAlign: 'right',
        }}
      >
        {children}
      </dd>
    </div>
  );
}

function Entered({ label, text }: { label: string; text: string }) {
  if (text.trim() === '') return null;
  return (
    <p style={{ fontSize: 13, color: ds.tx, margin: '4px 0', lineHeight: 1.5 }}>
      <span style={{ color: ds.txMuted, fontWeight: 600 }}>{label}</span> {text}
    </p>
  );
}

function StepText({ step }: { step: SessionStep }) {
  switch (step.step) {
    case 1:
      return (
        <Entered label="Learner’s answer:" text={step.content.learnerAnswer} />
      );
    case 2:
      return (
        <Entered
          label="Questions:"
          text={step.content.mode === 'quick' ? 'Quick' : 'Deep'}
        />
      );
    case 3:
      return (
        <>
          {step.content.points.map((point, i) => (
            <Entered
              key={STEP3_TEMPLATES[i]?.label}
              label={`${STEP3_TEMPLATES[i]?.shortLabel}:`}
              text={point}
            />
          ))}
          {step.content.pearlUsedId && (
            <Entered label="Pearl:" text="Used a saved pearl" />
          )}
        </>
      );
    case 4:
      return (
        <>
          {step.content.starters.map((text, i) => (
            <Entered
              key={STEPS[3].starters[i]}
              label={`${STEPS[3].starters[i]}`}
              text={text}
            />
          ))}
          <Entered label="Strengths:" text={step.content.tags.join(', ')} />
        </>
      );
    case 5:
      return (
        <>
          {step.content.starters.map((text, i) => (
            <Entered
              key={STEPS[4].starters[i]}
              label={`${STEPS[4].starters[i]}`}
              text={text}
            />
          ))}
          <Entered label="Action plan:" text={step.content.actionPlan} />
        </>
      );
  }
}

/** One of the doctor's sessions: times, each step's rating with its label, and the text entered. */
export function SessionDetailScreen() {
  const { id = '' } = useParams();
  const query = useRepositoryQuery(
    async (repo) => {
      const session = await repo.getMySession(id);
      const student = session
        ? await repo.getStudent(session.studentId)
        : undefined;
      return { session, student };
    },
    [id],
  );

  if (query.status === 'ready' && !query.data.session)
    return <Navigate to="/history" replace />;
  const session: TeachingSession | undefined = query.data?.session;
  if (!session) return null;
  const student = query.data?.student;

  return (
    <>
      <ScreenHeader
        title={session.diagnosis ?? 'No diagnosis recorded'}
        subtitle={`${formatDate(session.startedAt)} at ${formatTime(session.startedAt)}`}
        backTo="/history"
      />
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        <Card style={{ marginBottom: 12 }}>
          <dl style={{ margin: 0 }}>
            <Fact label="Student">{student?.name ?? 'Student'}</Fact>
            <Fact label="Learner">
              {learnerLabel(session.learnerLevel, session.learnerYear)}
            </Fact>
            <Fact label="Case type">{caseTypeLabel(session.caseType)}</Fact>
            <Fact label="Department">
              {departmentLabel(session.department)}
            </Fact>
            <Fact label="Teaching time">
              {formatDuration(session.teachingSeconds)}
            </Fact>
            <Fact label="Extra time">
              {formatDuration(session.overtimeSeconds)}
            </Fact>
            <Fact label="Paused">{formatDuration(session.pausedSeconds)}</Fact>
            <Fact label="Quick log time">
              {formatDuration(session.logSeconds)}
            </Fact>
            <Fact label="Learner gave the diagnosis">
              {session.learnerGaveDiagnosis === null
                ? 'Not recorded'
                : session.learnerGaveDiagnosis
                  ? 'Yes'
                  : 'No'}
            </Fact>
            <Fact label={USEFULNESS_LABEL}>
              {session.usefulness === null
                ? 'Not recorded'
                : `${session.usefulness} of 6`}
            </Fact>
          </dl>
        </Card>
        {session.steps.map((step) => (
          <Card
            key={step.step}
            style={{ marginBottom: 10 }}
            data-testid={`step-${step.step}`}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: ds.tx,
                  margin: 0,
                }}
              >
                {step.step}. {STEPS[step.step - 1]?.name}
              </h2>
              <span style={{ fontSize: 12, color: ds.txMuted }}>
                {formatDuration(step.seconds)}
              </span>
            </div>
            <div style={{ margin: '6px 0' }}>
              {isRatedStep(step.step) && <StarsText rating={step.rating} />}
            </div>
            <StepText step={step} />
          </Card>
        ))}
      </div>
    </>
  );
}
