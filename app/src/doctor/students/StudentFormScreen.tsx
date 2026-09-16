import {
  LEVEL_LABELS,
  LEVELS,
  type Level,
  PMDC_PATTERN,
  StudentInput,
  YEAR_LABELS,
  YEARS,
  type Year,
} from '@omp/shared';
import { TriangleAlert } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Button } from '../../ui/Button.tsx';
import { Card } from '../../ui/Card.tsx';
import { ChipGroup } from '../../ui/ChipGroup.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { ScreenHeader } from '../components/ScreenHeader.tsx';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

const LEVEL_OPTIONS = LEVELS.map((value) => ({
  value,
  label: LEVEL_LABELS[value],
}));
const YEAR_OPTIONS = YEARS.map((value) => ({
  value,
  label: YEAR_LABELS[value],
}));

const normalise = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Add a student, or correct one. Any doctor may correct; the server records who changed what. */
export function StudentFormScreen() {
  const { id: editId } = useParams();
  const navigate = useNavigate();
  const repository = useRepository();
  const toast = useToast();
  const existing = useRepositoryQuery(
    (repo) => (editId ? repo.getStudent(editId) : Promise.resolve(undefined)),
    [editId],
  );
  const everyone = useRepositoryQuery((repo) => repo.listStudents(), []);

  const [name, setName] = useState('');
  const [pmdc, setPmdc] = useState('');
  const [level, setLevel] = useState<Level | null>(null);
  const [year, setYear] = useState<Year | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaded = existing.data;
  useEffect(() => {
    if (!loaded) return;
    setName(loaded.name);
    setPmdc(loaded.pmdcNumber ?? '');
    setLevel(loaded.level);
    setYear(loaded.year);
  }, [loaded]);

  const trimmedName = name.trim().replace(/\s+/g, ' ');
  const nameError = trimmedName.length < 2 ? 'Enter the student’s name.' : null;
  const cleanPmdc = pmdc.trim().toUpperCase();
  const pmdcError =
    cleanPmdc !== '' && !PMDC_PATTERN.test(cleanPmdc)
      ? 'Use 3–20 letters, digits or hyphens, such as 12345-P.'
      : null;
  const levelError = level === null ? 'Choose a level.' : null;

  const namesake =
    trimmedName.length >= 2
      ? (everyone.data ?? []).find(
          (student) =>
            student.id !== editId &&
            normalise(student.name) === normalise(trimmedName),
        )
      : undefined;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameError || pmdcError || !level) return;
    setSaving(true);
    setError(null);
    try {
      const input = StudentInput.parse({
        id: editId ?? crypto.randomUUID(),
        name: trimmedName,
        pmdcNumber: cleanPmdc,
        level,
        year: level === 'medical_student' ? year : null,
      });
      await repository.saveStudent(input);
      toast(editId ? 'Student corrected' : 'Student added');
      navigate('/', { replace: true });
    } catch {
      setError('The student was not saved. Check the details and try again.');
      setSaving(false);
    }
  }

  const title = editId ? 'Correct student' : 'Add student';

  return (
    <>
      <ScreenHeader title={title} backTo="/" />
      <form
        onSubmit={onSubmit}
        noValidate
        style={{ flex: 1, padding: '0 16px 24px' }}
      >
        <Card>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            maxLength={100}
            autoComplete="off"
            required
            error={touched ? nameError : null}
          />
          {namesake && (
            <div
              role="status"
              style={{
                display: 'flex',
                gap: 8,
                background: `${ds.gold}1F`,
                borderRadius: 10,
                padding: '10px 12px',
                margin: '-4px 0 14px',
                fontSize: 13,
                color: ds.warmDk,
              }}
            >
              <TriangleAlert
                size={16}
                color={ds.goldText}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                Is this {namesake.name}
                {namesake.pmdcNumber ? `, PMDC ${namesake.pmdcNumber}` : ''}?{' '}
                <Link
                  to={`/session/setup?student=${namesake.id}`}
                  style={{ color: ds.priText, fontWeight: 600 }}
                >
                  Teach {namesake.name}
                </Link>
              </span>
            </div>
          )}
          <TextField
            label="PMDC number (optional)"
            value={pmdc}
            onChange={setPmdc}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            error={touched || pmdc.length >= 3 ? pmdcError : null}
          />
          <div style={{ margin: '0 0 14px' }}>
            <div
              aria-hidden="true"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ds.txB,
                marginBottom: 8,
              }}
            >
              Level
            </div>
            <ChipGroup<Level>
              label="Level"
              options={LEVEL_OPTIONS}
              value={level}
              onChange={(value) => {
                setLevel(value);
                if (value !== 'medical_student') setYear(null);
              }}
            />
            {touched && levelError && (
              <p
                role="alert"
                style={{ fontSize: 12, color: ds.redText, margin: '6px 0 0' }}
              >
                {levelError}
              </p>
            )}
          </div>
          {level === 'medical_student' && (
            <div>
              <div
                aria-hidden="true"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: ds.txB,
                  marginBottom: 8,
                }}
              >
                Year
              </div>
              <ChipGroup<Year>
                label="Year"
                options={YEAR_OPTIONS}
                value={year}
                onChange={setYear}
              />
            </div>
          )}
        </Card>
        {error && (
          <p role="alert" style={{ color: ds.redText, fontSize: 14 }}>
            {error}
          </p>
        )}
        <Button
          type="submit"
          fullWidth
          disabled={saving}
          style={{ marginTop: 16 }}
        >
          {saving ? 'Saving…' : editId ? 'Save correction' : 'Add student'}
        </Button>
      </form>
    </>
  );
}
