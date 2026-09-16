import { type SessionDraft, USEFULNESS_MAX } from '@omp/shared';
import { Check, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { caseTypeLabel, departmentLabel, formatDuration } from '../format.ts';
import { toSessionTiming } from '../timer/timer.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';
import { buildSession } from './draft.ts';
import { useSessionDraft } from './useSessionDraft.ts';

type Log = SessionDraft['log'];

/** Diagnosis, whether the learner gave it, and usefulness. Save and Skip both store the session. */
export function QuickLogScreen() {
  const repository = useRepository();
  const navigate = useNavigate();
  const toast = useToast();
  const { draft, update } = useSessionDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const diagnosisId = useId();
  const studentId = draft?.studentId ?? '';
  const student = useRepositoryQuery(
    (repo) => repo.getStudent(studentId),
    [studentId],
  );

  if (draft === undefined) return null;
  if (draft === null) return <Navigate to="/" replace />;
  if (draft.stage !== 'log') return <Navigate to="/session" replace />;

  const timing = toSessionTiming(
    draft.timer,
    draft.timer.finishedAtMs ?? Date.now(),
  );
  const setLog = (patch: Partial<Log>) =>
    update((d) => ({ ...d, log: { ...d.log, ...patch } }));

  async function complete(skipLog: boolean) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await repository.completeSession(
        buildSession(draft, Date.now(), { skipLog }),
      );
      // Only now, after the phone has stored it.
      toast('Session saved', {
        detail: 'It will be sent when there is signal.',
      });
      navigate('/', { replace: true });
    } catch {
      setError('The session was not saved. Try again.');
      setSaving(false);
    }
  }

  const facts: [string, string][] = [
    ['Learner', student.data?.name ?? '…'],
    ['Case', caseTypeLabel(draft.caseType)],
    ['Department', departmentLabel(draft.department)],
  ];

  return (
    <>
      <ScreenHeader
        title="Quick log"
        subtitle={
          <span data-testid="log-times">
            Teaching time {formatDuration(timing.teachingSeconds)} · Extra time{' '}
            {formatDuration(timing.overtimeSeconds)}
          </span>
        }
      />
      <div style={{ flex: 1, padding: '0 16px 16px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {facts.map(([label, value]) => (
            <Card key={label} padding={10} style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  color: ds.txMuted,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: ds.tx,
                  marginTop: 2,
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor={diagnosisId}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ds.txB,
              display: 'block',
              marginBottom: 6,
            }}
          >
            Diagnosis
          </label>
          <input
            id={diagnosisId}
            value={draft.log.diagnosis}
            maxLength={200}
            placeholder="e.g. Pneumonia"
            aria-describedby={`${diagnosisId}-hint`}
            onChange={(event) => setLog({ diagnosis: event.target.value })}
            style={ds.input}
          />
          <p
            id={`${diagnosisId}-hint`}
            style={{ fontSize: 12, color: ds.txMuted, margin: '6px 0 0' }}
          >
            The diagnosis only. Don’t type patient names.
          </p>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ds.txB,
              marginBottom: 8,
            }}
          >
            Did the learner give the diagnosis?
          </legend>
          <div style={{ display: 'flex', gap: 10 }}>
            {[true, false].map((value) => {
              const on = draft.log.learnerGaveDiagnosis === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setLog({ learnerGaveDiagnosis: on ? null : value })
                  }
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    border: `1px solid ${on ? (value ? ds.greenText : ds.redText) : ds.bd}`,
                    background: on
                      ? value
                        ? `${ds.green}1F`
                        : `${ds.red}1A`
                      : '#fff',
                    color: on ? (value ? ds.greenText : ds.redText) : ds.tx,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {value ? <Check size={16} /> : <X size={16} />}
                  {value ? 'Yes' : 'No'}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ds.txB,
              marginBottom: 8,
            }}
          >
            How useful was this teaching? (1 to {USEFULNESS_MAX})
          </legend>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from(
              { length: USEFULNESS_MAX },
              (_, i) => (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
            ).map((n) => {
              const on = draft.log.usefulness === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Usefulness ${n}`}
                  onClick={() => setLog({ usefulness: on ? null : n })}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 10,
                    border: on
                      ? `1px solid ${ds.priText}`
                      : `1px solid ${ds.bd}`,
                    background: on ? ds.priText : '#fff',
                    color: on ? ds.txW : ds.tx,
                    fontSize: 17,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" style={{ color: ds.redText, fontSize: 14 }}>
            {error}
          </p>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '10px 16px calc(14px + env(safe-area-inset-bottom))',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={() => void complete(true)}
          style={{
            ...ds.btnSec,
            flex: 1,
            minHeight: 48,
            fontSize: 15,
            fontWeight: 600,
            color: ds.txB,
          }}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void complete(false)}
          style={{
            ...ds.btnPri,
            flex: 2,
            minHeight: 48,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Check size={16} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}
