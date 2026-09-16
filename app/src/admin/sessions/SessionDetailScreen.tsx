import {
  CASE_TYPE_LABELS,
  DEPARTMENT_LABELS,
  LEVEL_LABELS,
  ratingLabel,
  type SessionStep,
  STEP3_TEMPLATES,
  STEPS,
  YEAR_LABELS,
} from '@omp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { adminApi, adminKeys } from '../api.ts';
import { LoadError, Loading, PageHeader, Panel } from '../components.tsx';
import { formatDateTime, formatSeconds } from '../format.ts';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th
        scope="row"
        style={{
          textAlign: 'left',
          fontWeight: 400,
          color: ds.txB,
          padding: '5px 12px 5px 0',
          whiteSpace: 'nowrap',
          verticalAlign: 'top',
        }}
      >
        {label}
      </th>
      <td style={{ padding: '5px 0', color: ds.tx }}>{children}</td>
    </tr>
  );
}

function stepText(step: SessionStep): [string, string][] {
  switch (step.step) {
    case 1:
      return [['Learner’s answer', step.content.learnerAnswer]];
    case 2:
      return [['Questions', step.content.mode === 'quick' ? 'Quick' : 'Deep']];
    case 3:
      return [
        ...step.content.points.map((point, i): [string, string] => [
          STEP3_TEMPLATES[i]?.shortLabel ?? '',
          point,
        ]),
        ['Saved pearl used', step.content.pearlUsedId ? 'Yes' : 'No'],
      ];
    case 4:
      return [
        ...step.content.starters.map((text, i): [string, string] => [
          STEPS[3].starters[i] ?? '',
          text,
        ]),
        ['Strengths', step.content.tags.join(', ')],
      ];
    case 5:
      return [
        ...step.content.starters.map((text, i): [string, string] => [
          STEPS[4].starters[i] ?? '',
          text,
        ]),
        ['Action plan', step.content.actionPlan],
      ];
  }
}

export function SessionDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const detail = useQuery({
    queryKey: adminKeys.session(id),
    queryFn: () => adminApi.session(id),
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      navigate('/admin/sessions', { replace: true });
    },
  });

  if (detail.isPending) return <Loading what="the session" />;
  if (detail.isError) return <LoadError error={detail.error} />;
  const { session, doctor, student, receivedAt } = detail.data;

  return (
    <>
      <PageHeader
        title={session.diagnosis ?? 'No diagnosis recorded'}
        subtitle={formatDateTime(session.startedAt)}
        actions={
          <Button
            variant="danger"
            icon={<Trash size={16} />}
            onClick={() => setConfirming(true)}
          >
            Delete session
          </Button>
        }
      />
      <Panel title="Session">
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <caption className="visually-hidden">Session details</caption>
          <tbody>
            <Row label="Doctor">
              <Link to={`/admin/doctors/${doctor.id}`}>{doctor.name}</Link> (
              {doctor.username})
            </Row>
            <Row label="Student">
              <Link to={`/admin/students/${student.id}`}>{student.name}</Link>
              {student.pmdcNumber ? `, PMDC ${student.pmdcNumber}` : ''}
            </Row>
            <Row label="Learner on the day">
              {LEVEL_LABELS[session.learnerLevel]}
              {session.learnerYear
                ? `, ${YEAR_LABELS[session.learnerYear]}`
                : ''}
            </Row>
            <Row label="Department">
              {DEPARTMENT_LABELS[session.department]}
            </Row>
            <Row label="Case type">{CASE_TYPE_LABELS[session.caseType]}</Row>
            <Row label="Teaching time">
              {formatSeconds(session.teachingSeconds)}
            </Row>
            <Row label="Extra time">
              {formatSeconds(session.overtimeSeconds)}
            </Row>
            <Row label="Paused">{formatSeconds(session.pausedSeconds)}</Row>
            <Row label="Quick log time">
              {formatSeconds(session.logSeconds)}
            </Row>
            <Row label="Learner gave the diagnosis">
              {session.learnerGaveDiagnosis === null
                ? 'Not recorded'
                : session.learnerGaveDiagnosis
                  ? 'Yes'
                  : 'No'}
            </Row>
            <Row label="Usefulness">
              {session.usefulness === null
                ? 'Not recorded'
                : `${session.usefulness} of 6`}
            </Row>
            <Row label="App version">{session.appVersion}</Row>
            <Row label="Received">{formatDateTime(receivedAt)}</Row>
          </tbody>
        </table>
      </Panel>
      {session.steps.map((step) => (
        <Panel
          key={step.step}
          title={`Step ${step.step}: ${STEPS[step.step - 1]?.name}`}
        >
          <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
            <caption className="visually-hidden">Step {step.step}</caption>
            <tbody>
              <Row label="Rating">
                {step.rating === null
                  ? 'Not rated'
                  : `${step.rating} of 5, ${ratingLabel(step.rating)}`}
              </Row>
              <Row label="Time">{formatSeconds(step.seconds)}</Row>
              {stepText(step).map(([label, text]) => (
                <Row key={label} label={label}>
                  {text.trim() === '' ? '–' : text}
                </Row>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
      <ConfirmDialog
        open={confirming}
        title="Delete this session?"
        confirmLabel="Delete session"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate();
        }}
      >
        Its steps and ratings are deleted too. The deletion is recorded.
      </ConfirmDialog>
    </>
  );
}
