import {
  ADMIN_PAGE_SIZE,
  CASE_TYPE_LABELS,
  CASE_TYPES,
  type CaseType,
  type SessionFilters,
} from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { adminApi, adminKeys } from '../api.ts';
import {
  DataTable,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { sessionColumns } from './columns.tsx';

function Field({
  label,
  children,
  id,
}: {
  label: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div style={{ flex: '1 1 160px' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: ds.txB,
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** Every session, filtered by date, doctor, student and case type, 50 to a page. */
export function SessionsScreen() {
  const [params, setParams] = useSearchParams();
  const filters: SessionFilters = {
    ...(params.get('from') ? { from: params.get('from') ?? '' } : {}),
    ...(params.get('to') ? { to: params.get('to') ?? '' } : {}),
    ...(params.get('doctorId')
      ? { doctorId: params.get('doctorId') ?? '' }
      : {}),
    ...(params.get('studentId')
      ? { studentId: params.get('studentId') ?? '' }
      : {}),
    ...(params.get('caseType')
      ? { caseType: params.get('caseType') as CaseType }
      : {}),
    page: Number(params.get('page') ?? '1') || 1,
  };
  const [draft, setDraft] = useState({
    from: filters.from ?? '',
    to: filters.to ?? '',
    doctorId: filters.doctorId ?? '',
    caseType: filters.caseType ?? '',
  });
  const ids = {
    from: useId(),
    to: useId(),
    doctor: useId(),
    caseType: useId(),
  };

  const doctors = useQuery({
    queryKey: adminKeys.doctors,
    queryFn: adminApi.doctors,
  });
  const sessions = useQuery({
    queryKey: adminKeys.sessions(filters),
    queryFn: () => adminApi.sessions(filters),
  });
  const page = filters.page ?? 1;
  const pages = sessions.data
    ? Math.max(1, Math.ceil(sessions.data.total / ADMIN_PAGE_SIZE))
    : 1;

  function apply(next: Record<string, string | number>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next))
      if (value !== '' && value !== undefined) search.set(key, String(value));
    setParams(search);
  }

  const current = {
    ...draft,
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
  };

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle={sessions.data ? `${sessions.data.total} sessions` : undefined}
      />
      <Panel>
        <form
          className="no-print"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ ...current, page: 1 });
          }}
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: 12,
          }}
        >
          <Field label="From" id={ids.from}>
            <input
              id={ids.from}
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              style={ds.input}
            />
          </Field>
          <Field label="To" id={ids.to}>
            <input
              id={ids.to}
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              style={ds.input}
            />
          </Field>
          <Field label="Doctor" id={ids.doctor}>
            <select
              id={ids.doctor}
              value={draft.doctorId}
              onChange={(e) => setDraft({ ...draft, doctorId: e.target.value })}
              style={{ ...ds.input, appearance: 'auto' }}
            >
              <option value="">All doctors</option>
              {doctors.data
                ?.filter((d) => d.isDoctor)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Case type" id={ids.caseType}>
            <select
              id={ids.caseType}
              value={draft.caseType}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  caseType: e.target.value as CaseType | '',
                })
              }
              style={{ ...ds.input, appearance: 'auto' }}
            >
              <option value="">All case types</option>
              {CASE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {CASE_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">Filter</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({ from: '', to: '', doctorId: '', caseType: '' });
              apply({});
            }}
          >
            Clear
          </Button>
        </form>
        {filters.studentId && (
          <p style={{ fontSize: 14, color: ds.txB }}>
            Showing one student’s sessions.{' '}
            <button
              type="button"
              onClick={() => apply({ ...draft, page: 1 })}
              style={{
                background: 'none',
                border: 'none',
                color: ds.priText,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Show all students
            </button>
          </p>
        )}
        {sessions.isPending ? (
          <Loading what="sessions" />
        ) : sessions.isError ? (
          <LoadError error={sessions.error} />
        ) : (
          <>
            <DataTable
              caption="Sessions"
              rows={sessions.data.rows}
              columns={sessionColumns()}
              rowKey={(r) => r.id}
              empty="No sessions match these filters."
            />
            <nav
              aria-label="Pages"
              className="no-print"
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => apply({ ...current, page: page - 1 })}
              >
                Previous
              </Button>
              <span style={{ fontSize: 14, color: ds.txB }}>
                Page {page} of {pages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= pages}
                onClick={() => apply({ ...current, page: page + 1 })}
              >
                Next
              </Button>
            </nav>
          </>
        )}
      </Panel>
    </>
  );
}
