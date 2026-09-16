import { type Pearl, STEP3_TEMPLATES } from '@omp/shared';
import { SquarePen, Trash } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { Card } from '../../ui/Card.tsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

function PearlEditor({ pearl, onDone }: { pearl: Pearl; onDone: () => void }) {
  const repository = useRepository();
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState(pearl.diagnosis);
  const [points, setPoints] = useState<string[]>([...pearl.points]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (diagnosis.trim() === '') {
      setError('Enter a diagnosis.');
      return;
    }
    await repository.savePearl({
      id: pearl.id,
      diagnosis: diagnosis.trim(),
      points: points as Pearl['points'],
    });
    toast('Pearl saved');
    onDone();
  }

  return (
    <form onSubmit={onSubmit}>
      <TextField
        label="Diagnosis"
        value={diagnosis}
        onChange={setDiagnosis}
        maxLength={200}
        error={error}
      />
      {STEP3_TEMPLATES.map((template, i) => (
        <TextField
          key={template.label}
          label={template.shortLabel}
          value={points[i] ?? ''}
          maxLength={500}
          onChange={(value) =>
            setPoints((current) => current.map((p, j) => (j === i ? value : p)))
          }
        />
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={onDone} style={{ flex: 1 }}>
          Cancel
        </Button>
        <Button type="submit" style={{ flex: 2 }}>
          Save pearl
        </Button>
      </div>
    </form>
  );
}

/** The doctor's own pearls: search, edit and delete. */
export function PearlLibraryScreen() {
  const repository = useRepository();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Pearl | null>(null);
  const searchId = useId();
  const query = useRepositoryQuery((repo) => repo.listMyPearls(), []);
  const text = search.trim().toLowerCase();
  const pearls = (query.data ?? []).filter(
    (p) => text === '' || p.diagnosis.toLowerCase().includes(text),
  );

  return (
    <>
      <ScreenHeader
        title="Teaching pearls"
        subtitle="Only you see your pearls"
        backTo="/more"
      />
      <div style={{ flex: 1, padding: '0 16px 24px' }}>
        <label htmlFor={searchId} className="visually-hidden">
          Search pearls by diagnosis
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by diagnosis"
          style={{ ...ds.input, marginBottom: 12 }}
        />
        {query.status === 'ready' && pearls.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              color: ds.txMuted,
              fontSize: 14,
              marginTop: 24,
            }}
          >
            {text
              ? 'No pearl matches that search.'
              : 'Save a pearl from Step 3 of a session.'}
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {pearls.map((pearl) => (
            <li key={pearl.id} style={{ marginBottom: 8 }}>
              <Card padding={14}>
                {editing === pearl.id ? (
                  <PearlEditor pearl={pearl} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <h2
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: ds.tx,
                        margin: '0 0 6px',
                      }}
                    >
                      {pearl.diagnosis}
                    </h2>
                    {pearl.points.map((point, i) =>
                      point.trim() === '' ? null : (
                        <p
                          key={STEP3_TEMPLATES[i]?.label}
                          style={{
                            fontSize: 13,
                            color: ds.tx,
                            margin: '3px 0',
                            lineHeight: 1.5,
                          }}
                        >
                          <span style={{ color: ds.txMuted, fontWeight: 600 }}>
                            {STEP3_TEMPLATES[i]?.shortLabel}:
                          </span>{' '}
                          {point}
                        </p>
                      ),
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 8,
                      }}
                    >
                      <span style={{ fontSize: 12, color: ds.txMuted }}>
                        Used {pearl.timesUsed}{' '}
                        {pearl.timesUsed === 1 ? 'time' : 'times'}
                      </span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <Button
                          variant="ghost"
                          icon={<SquarePen size={14} />}
                          onClick={() => setEditing(pearl.id)}
                          aria-label={`Edit ${pearl.diagnosis}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<Trash size={14} />}
                          onClick={() => setDeleting(pearl)}
                          aria-label={`Delete ${pearl.diagnosis}`}
                          style={{ color: ds.redText }}
                        >
                          Delete
                        </Button>
                      </span>
                    </div>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete the pearl for “${deleting?.diagnosis ?? ''}”?`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void repository.deletePearl(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
