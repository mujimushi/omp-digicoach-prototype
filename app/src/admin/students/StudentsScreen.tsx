import {
  LEVEL_LABELS,
  RATED_STEP_IDS,
  STUDENT_SORTS,
  type StudentSummaryRow,
  YEAR_LABELS,
} from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { adminApi, adminKeys } from '../api.ts';
import {
  type Column,
  DataTable,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { formatAverage, formatDay } from '../format.ts';

type Sort = (typeof STUDENT_SORTS)[number];

const COLUMNS: Column<StudentSummaryRow>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (r) => (
      <Link
        to={`/admin/students/${r.id}`}
        style={{ color: ds.priText, fontWeight: 600 }}
      >
        {r.name}
      </Link>
    ),
  },
  { key: 'pmdc', label: 'PMDC number', render: (r) => r.pmdcNumber ?? '–' },
  { key: 'level', label: 'Level', render: (r) => LEVEL_LABELS[r.level] },
  {
    key: 'year',
    label: 'Year',
    render: (r) => (r.year ? YEAR_LABELS[r.year] : '–'),
  },
  {
    key: 'sessions',
    label: 'Sessions',
    align: 'right',
    render: (r) => r.sessions,
  },
  {
    key: 'doctors',
    label: 'Doctors',
    align: 'right',
    render: (r) => r.doctors,
  },
  ...RATED_STEP_IDS.map(
    (id): Column<StudentSummaryRow> => ({
      key: `step${id}`,
      label: `Step ${id}`,
      align: 'right',
      render: (r) => formatAverage(r.avgRatingPerStep[id - 1] ?? null),
    }),
  ),
  {
    key: 'last',
    label: 'Last session',
    render: (r) => formatDay(r.lastSessionAt),
  },
];

const SORT_LABELS: Record<Sort, string> = {
  name: 'Name',
  sessions: 'Most sessions',
  last_session: 'Most recent session',
  pmdc_number: 'PMDC number',
};

export function StudentsScreen() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const searchId = useId();
  const sortId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const params = { query: debounced, sort };
  const students = useQuery({
    queryKey: adminKeys.students(params),
    queryFn: () => adminApi.students(params),
  });

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Every student any doctor has added. Average rating per step, 1 to 5."
      />
      <Panel>
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <label
              htmlFor={searchId}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Search by name or PMDC number
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={ds.input}
            />
          </div>
          <div style={{ flex: '0 1 220px' }}>
            <label
              htmlFor={sortId}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Sort by
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              style={{ ...ds.input, appearance: 'auto' }}
            >
              {STUDENT_SORTS.map((value) => (
                <option key={value} value={value}>
                  {SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {students.isPending ? (
          <Loading what="students" />
        ) : students.isError ? (
          <LoadError error={students.error} />
        ) : (
          <DataTable
            caption="Students"
            rows={students.data}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            empty="No student matches."
          />
        )}
      </Panel>
    </>
  );
}
