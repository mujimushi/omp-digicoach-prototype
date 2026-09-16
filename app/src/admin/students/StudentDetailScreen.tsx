import {
  LEVEL_LABELS,
  LEVELS,
  type Level,
  STEPS,
  type StudentUpdate,
  YEAR_LABELS,
  YEARS,
  type Year,
} from '@omp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../../api/errors.ts';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { adminApi, adminKeys } from '../api.ts';
import {
  DataTable,
  Figure,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { formatAverage, formatDateTime } from '../format.ts';
import { sessionColumns } from '../sessions/columns.tsx';
import { RatingsChart } from './RatingsChart.tsx';

function describeChange(value: unknown): string {
  if (value === null || value === undefined) return '–';
  if (typeof value !== 'object') return String(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([key, v]) => `${key}: ${v ?? '–'}`)
    .join(', ');
}

export function StudentDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: adminKeys.student(id),
    queryFn: () => adminApi.student(id),
  });
  const [name, setName] = useState('');
  const [pmdc, setPmdc] = useState('');
  const [level, setLevel] = useState<Level>('medical_student');
  const [year, setYear] = useState<Year | ''>('');
  const levelId = useId();
  const yearId = useId();

  const student = detail.data?.student;
  useEffect(() => {
    if (!student) return;
    setName(student.name);
    setPmdc(student.pmdcNumber ?? '');
    setLevel(student.level);
    setYear(student.year ?? '');
  }, [student]);

  const save = useMutation({
    mutationFn: (update: StudentUpdate) => adminApi.updateStudent(id, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  if (detail.isPending) return <Loading what="the student" />;
  if (detail.isError) return <LoadError error={detail.error} />;
  const { summary, sessions, ratingsOverTime, changes } = detail.data;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate({
      name,
      pmdcNumber: pmdc.trim() === '' ? null : pmdc,
      level,
      year: level === 'medical_student' && year !== '' ? year : null,
    });
  }

  return (
    <>
      <PageHeader
        title={summary.name}
        subtitle={
          summary.pmdcNumber ? `PMDC ${summary.pmdcNumber}` : 'No PMDC number'
        }
        actions={
          <Button
            variant="secondary"
            icon={<FileText size={16} />}
            onClick={() => navigate(`/admin/reports/students/${id}`)}
          >
            Report
          </Button>
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Figure label="Sessions" value={String(summary.sessions)} />
        <Figure label="Doctors" value={String(summary.doctors)} />
        {STEPS.map((step, i) => (
          <Figure
            key={step.id}
            label={`Step ${step.id} average`}
            value={formatAverage(summary.avgRatingPerStep[i] ?? null)}
          />
        ))}
      </div>
      <Panel title="Profile" style={{ maxWidth: 560 }}>
        <form onSubmit={onSubmit} noValidate>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            maxLength={100}
          />
          <TextField
            label="PMDC number"
            value={pmdc}
            onChange={setPmdc}
            maxLength={20}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, marginBottom: 14 }}>
              <label
                htmlFor={levelId}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: ds.txB,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Level
              </label>
              <select
                id={levelId}
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                style={{ ...ds.input, appearance: 'auto' }}
              >
                {LEVELS.map((value) => (
                  <option key={value} value={value}>
                    {LEVEL_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            {level === 'medical_student' && (
              <div style={{ flex: 1, marginBottom: 14 }}>
                <label
                  htmlFor={yearId}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: ds.txB,
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Year
                </label>
                <select
                  id={yearId}
                  value={year}
                  onChange={(e) => setYear(e.target.value as Year | '')}
                  style={{ ...ds.input, appearance: 'auto' }}
                >
                  <option value="">Not recorded</option>
                  {YEARS.map((value) => (
                    <option key={value} value={value}>
                      {YEAR_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {save.isError && (
            <p role="alert" style={{ color: ds.redText, fontSize: 14 }}>
              {save.error instanceof ApiRequestError
                ? save.error.message
                : 'The correction was not saved.'}
            </p>
          )}
          {save.isSuccess && (
            <p role="status" style={{ color: ds.greenText, fontSize: 14 }}>
              Saved.
            </p>
          )}
          <Button type="submit" disabled={save.isPending}>
            Save correction
          </Button>
        </form>
      </Panel>
      <Panel title="Ratings per step over time">
        {ratingsOverTime.length > 0 ? (
          <RatingsChart points={ratingsOverTime} />
        ) : (
          <p style={{ color: ds.txMuted }}>No sessions yet.</p>
        )}
      </Panel>
      <Panel title="Sessions">
        <DataTable
          caption="Sessions"
          rows={sessions}
          columns={sessionColumns({ student: false })}
          rowKey={(r) => r.id}
          empty="No sessions yet."
        />
      </Panel>
      <Panel title="Change history">
        {changes.length === 0 ? (
          <p style={{ color: ds.txMuted }}>No changes recorded.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {changes.map((change) => (
              <li key={change.id} style={{ marginBottom: 8, fontSize: 14 }}>
                <strong>{formatDateTime(change.createdAt)}</strong>,{' '}
                {change.actorName ?? 'the system'}:{' '}
                {describeChange(change.before)} → {describeChange(change.after)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
