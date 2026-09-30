import { DEPARTMENT_LABELS, type DoctorActivityRow } from '@omp/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { adminApi, adminKeys } from '../api.ts';
import {
  type Column,
  DataTable,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components.tsx';
import { formatDay, formatSeconds, formatShare } from '../format.ts';

const COLUMNS: Column<DoctorActivityRow>[] = [
  {
    key: 'name',
    label: 'Name',
    sortValue: (r) => r.name.toLowerCase(),
    render: (r) => (
      <Link
        to={`/admin/doctors/${r.id}`}
        style={{ color: ds.priText, fontWeight: 600 }}
      >
        {r.name}
      </Link>
    ),
  },
  {
    key: 'username',
    label: 'Username',
    sortValue: (r) => r.username,
    render: (r) => r.username,
  },
  {
    key: 'department',
    label: 'Department',
    sortValue: (r) => r.department,
    render: (r) => (r.department ? DEPARTMENT_LABELS[r.department] : '–'),
  },
  {
    key: 'role',
    label: 'Role',
    render: (r) =>
      [r.isDoctor ? 'Doctor' : null, r.isAdmin ? 'Admin' : null]
        .filter(Boolean)
        .join(', '),
  },
  {
    key: 'status',
    label: 'Status',
    sortValue: (r) => (r.active ? 1 : 0),
    render: (r) =>
      r.active
        ? r.mustChangePassword
          ? 'Must change password'
          : 'Active'
        : 'Switched off',
  },
  {
    key: 'sessions',
    label: 'Sessions',
    align: 'right',
    sortValue: (r) => r.sessionsTotal,
    render: (r) => r.sessionsTotal,
  },
  {
    key: 'week',
    label: 'Last 7 days',
    align: 'right',
    sortValue: (r) => r.sessionsLast7Days,
    render: (r) => r.sessionsLast7Days,
  },
  {
    key: 'last',
    label: 'Last session',
    sortValue: (r) => r.lastSessionAt,
    render: (r) => formatDay(r.lastSessionAt),
  },
  {
    key: 'time',
    label: 'Avg teaching',
    align: 'right',
    sortValue: (r) => r.avgTeachingSeconds,
    render: (r) => formatSeconds(r.avgTeachingSeconds),
  },
  {
    key: 'extra',
    label: 'Avg extra',
    align: 'right',
    sortValue: (r) => r.avgOvertimeSeconds,
    render: (r) => formatSeconds(r.avgOvertimeSeconds),
  },
  {
    key: 'rated',
    label: 'All rated',
    align: 'right',
    sortValue: (r) => r.allStepsRatedShare,
    render: (r) => formatShare(r.allStepsRatedShare),
  },
  {
    key: 'students',
    label: 'Students taught',
    align: 'right',
    sortValue: (r) => r.studentsTaught,
    render: (r) => r.studentsTaught,
  },
  {
    key: 'login',
    label: 'Last login',
    sortValue: (r) => r.lastLoginAt,
    render: (r) => formatDay(r.lastLoginAt),
  },
];

export function DoctorsScreen() {
  const navigate = useNavigate();
  const doctors = useQuery({
    queryKey: adminKeys.doctors,
    queryFn: adminApi.doctors,
  });
  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Everyone who can log in, with their teaching activity"
        actions={
          <Button
            icon={<Plus size={16} />}
            onClick={() => navigate('/admin/doctors/new')}
          >
            Add doctor
          </Button>
        }
      />
      <Panel>
        {doctors.isPending ? (
          <Loading what="doctors" />
        ) : doctors.isError ? (
          <LoadError error={doctors.error} />
        ) : (
          <DataTable
            caption="Doctors"
            rows={doctors.data}
            columns={COLUMNS}
            rowKey={(r) => r.id}
            initialSort={{ key: 'name', descending: false }}
          />
        )}
      </Panel>
    </>
  );
}
