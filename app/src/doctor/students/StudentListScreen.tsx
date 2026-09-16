import type { Student } from '@omp/shared';
import { ChevronRight, Play, Plus, SquarePen } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { InstallGuide } from '../../install/InstallGuide.tsx';
import { Logo } from '../../layout/Logo.tsx';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { SyncBadge } from '../components/SyncBadge.tsx';
import { learnerLabel } from '../format.ts';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

function StudentRow({ student }: { student: Student }) {
  const navigate = useNavigate();
  return (
    <li
      style={{
        ...ds.card,
        display: 'flex',
        alignItems: 'stretch',
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => navigate(`/session/setup?student=${student.id}`)}
        aria-label={`Teach ${student.name}`}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 15,
              fontWeight: 700,
              color: ds.tx,
            }}
          >
            {student.name}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: ds.txMuted,
              marginTop: 2,
            }}
          >
            {learnerLabel(student.level, student.year)}
            {student.pmdcNumber ? ` · PMDC ${student.pmdcNumber}` : ''}
          </span>
        </span>
        <ChevronRight size={18} color={ds.txL} />
      </button>
      <Link
        to={`/students/${student.id}/edit`}
        aria-label={`Edit ${student.name}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 14px',
          borderLeft: `1px solid ${ds.bdL}`,
          color: ds.priText,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <SquarePen size={14} />
        Edit
      </Link>
    </li>
  );
}

/** Pick the learner: search the shared list, add a student, or correct one. */
export function StudentListScreen() {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const navigate = useNavigate();
  const repository = useRepository();
  const students = useRepositoryQuery(
    (repo) => repo.listStudents(search),
    [search],
  );
  const draft = useRepositoryQuery((repo) => repo.loadDraft(), []);
  const draftStudentId = draft.data?.studentId ?? '';
  const draftStudent = useRepositoryQuery(
    (repo) =>
      draftStudentId
        ? repo.getStudent(draftStudentId)
        : Promise.resolve(undefined),
    [draftStudentId],
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const list = students.data ?? [];

  return (
    <>
      <header
        style={{
          background: ds.gradHdr,
          padding: 'calc(14px + env(safe-area-inset-top)) 16px 20px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={38} />
            <h1
              style={{
                color: ds.txW,
                fontSize: 17,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              ONE-MINUTE
              <br />
              PRECEPTOR
            </h1>
          </div>
          <SyncBadge />
        </div>
        <p style={{ color: ds.txW, fontSize: 14, margin: '10px 0 0' }}>
          Choose the learner to teach
        </p>
      </header>

      <div style={{ flex: 1, padding: 16 }}>
        {draft.data && (
          <section
            aria-label="Session in progress"
            style={{
              ...ds.card,
              padding: 14,
              marginBottom: 12,
              borderLeft: `3px solid ${ds.coral}`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: ds.tx }}>
              Session in progress
              {draftStudent.data ? ` with ${draftStudent.data.name}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button
                icon={<Play size={14} />}
                onClick={() =>
                  navigate(
                    draft.data?.stage === 'log' ? '/session/log' : '/session',
                  )
                }
                style={{ flex: 2, padding: '10px 12px' }}
              >
                Resume
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmDiscard(true)}
                style={{ flex: 1, padding: '10px 12px' }}
              >
                Discard
              </Button>
            </div>
          </section>
        )}

        <InstallGuide />
        <label htmlFor={searchId} className="visually-hidden">
          Search students by name or PMDC number
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or PMDC number"
          autoComplete="off"
          style={{ ...ds.input, marginBottom: 12 }}
        />

        <Button
          variant="secondary"
          fullWidth
          icon={<Plus size={16} />}
          onClick={() => navigate('/students/new')}
          style={{ marginBottom: 14, color: ds.priText }}
        >
          Add student
        </Button>

        <p className="visually-hidden" aria-live="polite">
          {students.status === 'ready' ? `${list.length} students` : ''}
        </p>
        <ul
          aria-label="Students"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {list.map((student) => (
            <StudentRow key={student.id} student={student} />
          ))}
        </ul>
        {students.status === 'ready' && list.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: ds.txMuted,
              fontSize: 14,
              margin: '24px 0',
            }}
          >
            {search
              ? 'No student matches that search.'
              : 'No students yet. Add the first one.'}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard the session in progress?"
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void repository.discardDraft();
        }}
      >
        Nothing from it will be saved.
      </ConfirmDialog>
    </>
  );
}
