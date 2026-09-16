import {
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  DESIGNATION_LABELS,
  DESIGNATIONS,
  type Department,
  type Designation,
  DoctorInput,
  DoctorUpdate,
  LIMITS,
} from '@omp/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Power, Wand } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../../api/errors.ts';
import { useUser } from '../../auth/AuthProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { adminApi, adminKeys } from '../api.ts';
import { LoadError, Loading, PageHeader, Panel } from '../components.tsx';
import { PasswordOnce } from './PasswordOnce.tsx';
import { generateReadablePassword } from './temporary-password.ts';

function Select<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T | '';
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T | '') => void;
}) {
  const id = useId();
  return (
    <div style={{ marginBottom: 14 }}>
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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        style={{ ...ds.input, appearance: 'auto' }}
      >
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        color: ds.tx,
        marginBottom: 10,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
      {label}
    </label>
  );
}

function messageOf(error: unknown): string {
  return error instanceof ApiRequestError
    ? error.message
    : 'The doctor was not saved. Try again.';
}

/** Add a doctor, or edit one: name, username, department, designation, roles, switch on or off, reset password. */
export function DoctorFormScreen() {
  const { id } = useParams();
  const editing = id !== undefined;
  const me = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: adminKeys.doctor(id ?? ''),
    queryFn: () => adminApi.doctor(id ?? ''),
    enabled: editing,
  });

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [designation, setDesignation] = useState<Designation | ''>('');
  const [isDoctor, setIsDoctor] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [shown, setShown] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'off' | null>(null);

  const activity = existing.data?.activity;
  useEffect(() => {
    if (!activity) return;
    setName(activity.name);
    setUsername(activity.username);
    setDepartment(activity.department ?? '');
    setDesignation(activity.designation ?? '');
    setIsDoctor(activity.isDoctor);
    setIsAdmin(activity.isAdmin);
  }, [activity]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin'] });

  const create = useMutation({
    mutationFn: adminApi.createDoctor,
    onSuccess: (result) => {
      void invalidate();
      setShown({
        username: result.doctor.username,
        password: result.temporaryPassword,
      });
    },
  });
  const update = useMutation({
    mutationFn: (changes: DoctorUpdate) =>
      adminApi.updateDoctor(id ?? '', changes),
    onSuccess: () => {
      void invalidate();
    },
  });
  const reset = useMutation({
    mutationFn: () => adminApi.resetPassword(id ?? ''),
    onSuccess: (result) =>
      setShown({ username, password: result.temporaryPassword }),
  });

  const input = {
    name,
    username,
    department: department === '' ? null : department,
    designation: designation === '' ? null : designation,
    isDoctor,
    isAdmin,
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };
  const check = DoctorInput.safeParse(input);
  const errors: Record<string, string> = {};
  if (!check.success) {
    for (const issue of check.error.issues) {
      const field = String(issue.path[0] ?? 'form');
      errors[field] ??= issue.message;
    }
  }
  if (!isDoctor && !isAdmin) errors.role = 'Choose doctor, admin or both.';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0 || !check.success) return;
    if (editing) {
      const { temporaryPassword: _, ...changes } = check.data;
      update.mutate(DoctorUpdate.parse(changes));
    } else {
      create.mutate(check.data);
    }
  }

  if (shown) {
    return (
      <>
        <PageHeader title={editing ? 'Password reset' : 'Doctor added'} />
        <PasswordOnce
          username={shown.username}
          password={shown.password}
          onDone={() => {
            setShown(null);
            navigate(editing ? `/admin/doctors/${id}` : '/admin/doctors');
          }}
        />
      </>
    );
  }
  if (editing && existing.isPending) return <Loading what="the doctor" />;
  if (editing && existing.isError) return <LoadError error={existing.error} />;

  const error = create.error ?? update.error ?? reset.error;
  const self = editing && id === me.id;

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${activity?.name ?? 'doctor'}` : 'Add doctor'}
        subtitle={
          editing && activity
            ? activity.active
              ? 'Active'
              : 'Switched off'
            : 'They choose their own password at first login'
        }
      />
      <Panel style={{ maxWidth: 560 }}>
        <form onSubmit={onSubmit} noValidate>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            maxLength={LIMITS.nameMax}
            error={touched ? (errors.name ?? null) : null}
            required
          />
          <TextField
            label="Username"
            value={username}
            onChange={setUsername}
            maxLength={LIMITS.usernameMax}
            autoCapitalize="none"
            hint="3–30 lower-case letters, digits, dots or underscores, such as dr.sana"
            error={touched ? (errors.username ?? null) : null}
            required
          />
          <Select
            label="Department"
            value={department}
            options={DEPARTMENTS}
            labels={DEPARTMENT_LABELS}
            onChange={setDepartment}
          />
          <Select
            label="Designation"
            value={designation}
            options={DESIGNATIONS}
            labels={DESIGNATION_LABELS}
            onChange={setDesignation}
          />
          {touched && errors.department && (
            <p
              role="alert"
              style={{ color: ds.redText, fontSize: 13, marginTop: -6 }}
            >
              {errors.department}
            </p>
          )}
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
            <legend
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                marginBottom: 8,
              }}
            >
              Role
            </legend>
            <Checkbox
              label="Doctor: uses the phone app"
              checked={isDoctor}
              onChange={setIsDoctor}
            />
            <Checkbox
              label="Admin: uses this dashboard"
              checked={isAdmin}
              onChange={setIsAdmin}
              disabled={self && isAdmin}
            />
            {touched && errors.role && (
              <p role="alert" style={{ color: ds.redText, fontSize: 13 }}>
                {errors.role}
              </p>
            )}
          </fieldset>
          {!editing && (
            <div>
              <TextField
                label="Temporary password (optional)"
                value={temporaryPassword}
                onChange={setTemporaryPassword}
                hint={`Leave empty for a generated one. At least ${LIMITS.passwordMin} characters.`}
                error={touched ? (errors.temporaryPassword ?? null) : null}
                autoComplete="off"
              />
              <Button
                variant="secondary"
                icon={<Wand size={16} />}
                onClick={() => setTemporaryPassword(generateReadablePassword())}
                style={{ marginBottom: 14 }}
              >
                Generate password
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" style={{ color: ds.redText, fontSize: 14 }}>
              {messageOf(error)}
            </p>
          )}
          {update.isSuccess && (
            <p role="status" style={{ color: ds.greenText, fontSize: 14 }}>
              Saved.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(editing ? `/admin/doctors/${id}` : '/admin/doctors')
              }
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              {editing ? 'Save changes' : 'Add doctor'}
            </Button>
          </div>
        </form>
      </Panel>

      {editing && activity && (
        <Panel title="Access" style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              icon={<KeyRound size={16} />}
              onClick={() => setConfirm('reset')}
            >
              Reset password
            </Button>
            {activity.active ? (
              <Button
                variant="danger"
                icon={<Power size={16} />}
                disabled={self}
                onClick={() => setConfirm('off')}
              >
                Switch off
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<Power size={16} />}
                onClick={() => update.mutate({ active: true })}
              >
                Switch on
              </Button>
            )}
          </div>
          {self && (
            <p style={{ fontSize: 13, color: ds.txMuted }}>
              You can’t switch off your own account.
            </p>
          )}
        </Panel>
      )}

      <ConfirmDialog
        open={confirm === 'reset'}
        title={`Reset the password for ${username}?`}
        confirmLabel="Reset password"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          reset.mutate();
        }}
      >
        Their current logins end, and they must choose a new password with the
        temporary one.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'off'}
        title={`Switch off ${activity?.name ?? 'this doctor'}?`}
        confirmLabel="Switch off"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          update.mutate({ active: false });
        }}
      >
        They can’t log in or send sessions until switched on again. Their
        sessions stay.
      </ConfirmDialog>
    </>
  );
}
