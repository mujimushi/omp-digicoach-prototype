import {
  CASE_TYPE_LABELS,
  CASE_TYPES,
  type CaseType,
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  type Department,
} from '@omp/shared';
import { BuildingComplex, ClipboardList, Play, User } from 'lucide-react';
import { useId, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useUser } from '../../auth/AuthProvider.tsx';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { ChipGroup } from '../../ui/ChipGroup.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { IconCircle } from '../../ui/IconCircle.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { learnerLabel } from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';
import { newDraft } from './draft.ts';

const CASE_OPTIONS = CASE_TYPES.map((value) => ({
  value,
  label: CASE_TYPE_LABELS[value],
}));

/** Department preset from the doctor's profile, case type chips, and Start. */
export function SessionSetupScreen() {
  const user = useUser();
  const repository = useRepository();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const studentId = params.get('student') ?? '';
  const student = useRepositoryQuery(
    (repo) => repo.getStudent(studentId),
    [studentId],
  );
  const existingDraft = useRepositoryQuery((repo) => repo.loadDraft(), []);
  const [department, setDepartment] = useState<Department>(
    user.department ?? 'medicine',
  );
  const [caseType, setCaseType] = useState<CaseType | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [starting, setStarting] = useState(false);
  const departmentId = useId();

  if (student.status === 'ready' && !student.data)
    return <Navigate to="/" replace />;
  const learner = student.data;

  async function start() {
    if (!learner || !caseType) return;
    setStarting(true);
    const now = Date.now();
    await repository.saveDraft(
      newDraft({
        id: crypto.randomUUID(),
        student: learner,
        department,
        caseType,
        now,
      }),
    );
    navigate('/session', { replace: true });
  }

  function onStart() {
    if (existingDraft.data) setConfirmReplace(true);
    else void start();
  }

  return (
    <>
      <ScreenHeader
        gradient
        title="Session setup"
        subtitle="Where and what you are teaching"
        backTo="/"
      />
      <div style={{ flex: 1, padding: 16 }}>
        {learner && (
          <Card padding={14} accent={ds.coral} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconCircle Icon={User} color={ds.coral} size={34} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ds.tx }}>
                  {learner.name}
                </div>
                <div style={{ fontSize: 13, color: ds.txB }}>
                  {learnerLabel(learner.level, learner.year)}
                  {learner.pmdcNumber ? ` · PMDC ${learner.pmdcNumber}` : ''}
                </div>
              </div>
            </div>
          </Card>
        )}
        <Card padding={16} style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <IconCircle Icon={BuildingComplex} color={ds.pri} />
            <div>
              <label
                htmlFor={departmentId}
                style={{ fontSize: 15, fontWeight: 700, color: ds.tx }}
              >
                Department
              </label>
              <div style={{ fontSize: 13, color: ds.txB }}>
                Where this teaching is happening
              </div>
            </div>
          </div>
          <select
            id={departmentId}
            value={department}
            onChange={(event) =>
              setDepartment(event.target.value as Department)
            }
            style={{ ...ds.input, appearance: 'auto' }}
          >
            {DEPARTMENTS.map((value) => (
              <option key={value} value={value}>
                {DEPARTMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </Card>
        <Card padding={16} style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <IconCircle Icon={ClipboardList} color={ds.gold} />
            <div style={{ fontSize: 15, fontWeight: 700, color: ds.tx }}>
              Case type
            </div>
          </div>
          <ChipGroup<CaseType>
            label="Case type"
            options={CASE_OPTIONS}
            value={caseType}
            color={ds.goldFill}
            onChange={setCaseType}
          />
        </Card>
        <button
          type="button"
          onClick={onStart}
          disabled={!learner || !caseType || starting}
          style={{
            ...ds.btnPri,
            width: '100%',
            padding: '16px 20px',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: !learner || !caseType ? 0.55 : 1,
            cursor: !learner || !caseType ? 'not-allowed' : 'pointer',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={14} color="#fff" fill="#fff" />
          </span>
          <span style={{ textAlign: 'left' }}>
            <span style={{ display: 'block' }}>Start teaching session</span>
            <span
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 400,
                marginTop: 2,
              }}
            >
              One-Minute Preceptor: a 60-second countdown
            </span>
          </span>
        </button>
        {!caseType && (
          <p
            style={{
              fontSize: 12,
              color: ds.txMuted,
              textAlign: 'center',
              margin: '8px 0 0',
            }}
          >
            Choose a case type to start.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirmReplace}
        title="Discard the session in progress?"
        confirmLabel="Discard and start"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false);
          void start();
        }}
      >
        Another session hasn’t been saved yet. Starting a new one discards it.
      </ConfirmDialog>
    </>
  );
}
