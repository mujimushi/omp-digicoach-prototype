import {
  type Rating,
  type SessionDraft,
  STEP3_TEMPLATES,
  STEP4_TAGS,
  STEPS,
  type Step4Tag,
} from '@omp/shared';
import { Check, SquarePen, Star } from 'lucide-react';
import { type CSSProperties, useId, useState } from 'react';
import { useRepository } from '../../data/RepositoryProvider.tsx';
import { ds } from '../../styles/tokens.ts';
import { Card } from '../../ui/Card.tsx';
import { ChipGroup } from '../../ui/ChipGroup.tsx';
import { RatingStars } from '../../ui/RatingStars.tsx';
import { useRepositoryQuery } from '../useRepositoryQuery.ts';

type Update = (change: (draft: SessionDraft) => SessionDraft) => void;
export type StepProps = { draft: SessionDraft; update: Update };

const PATIENT_REMINDER = 'Don’t type patient names.';

const blankInput: CSSProperties = {
  ...ds.input,
  background: ds.bdL,
  padding: '12px',
};

function setAt<T>(list: readonly T[], index: number, value: T): T[] {
  const next = [...list];
  next[index] = value;
  return next;
}

function PromptCard({
  lead,
  prompts,
}: {
  lead: string;
  prompts: readonly string[];
}) {
  return (
    <Card padding={14}>
      <p style={{ fontSize: 13, color: ds.txB, margin: '0 0 6px' }}>{lead}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {prompts.map((prompt, index) => (
          <li
            key={prompt}
            style={{
              fontSize: 14,
              color: ds.tx,
              lineHeight: 1.5,
              padding: '7px 0',
              borderBottom:
                index < prompts.length - 1 ? `1px solid ${ds.bdL}` : 'none',
            }}
          >
            • {prompt}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StepRating({ draft, update }: StepProps) {
  const index = draft.timer.currentStep - 1;
  return (
    <Card padding={14} style={{ marginTop: 10 }} data-tour="rating">
      <div
        style={{ fontSize: 14, fontWeight: 700, color: ds.tx, marginBottom: 4 }}
      >
        Rate the learner on this step
      </div>
      <RatingStars
        label={`Rate Step ${draft.timer.currentStep}`}
        value={draft.ratings[index] ?? null}
        onChange={(value: Rating | null) =>
          update((d) => ({
            ...d,
            ratings: setAt(d.ratings, index, value) as SessionDraft['ratings'],
          }))
        }
      />
    </Card>
  );
}

export function Step1({ draft, update }: StepProps) {
  const id = useId();
  return (
    <>
      <PromptCard lead="Ask the learner:" prompts={STEPS[0].prompts} />
      <Card padding={14} style={{ marginTop: 10 }}>
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
          Learner’s answer
        </label>
        <input
          id={id}
          value={draft.step1.learnerAnswer}
          maxLength={500}
          placeholder="e.g. Pneumonia"
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const learnerAnswer = event.target.value;
            update((d) => ({ ...d, step1: { learnerAnswer } }));
          }}
          style={ds.input}
        />
        <p
          id={`${id}-hint`}
          style={{ fontSize: 12, color: ds.txMuted, margin: '6px 0 0' }}
        >
          Used to find your saved teaching pearl. {PATIENT_REMINDER}
        </p>
      </Card>
    </>
  );
}

export function Step2({ draft, update }: StepProps) {
  const mode = draft.step2.mode;
  const prompts =
    mode === 'quick' ? STEPS[1].quickPrompts : STEPS[1].deepPrompts;
  return (
    <>
      <fieldset
        style={{
          display: 'flex',
          justifyContent: 'center',
          border: 0,
          margin: '0 0 10px',
          padding: 0,
        }}
      >
        <legend className="visually-hidden">Question set</legend>
        {(['quick', 'deep'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => update((d) => ({ ...d, step2: { mode: value } }))}
            style={{
              padding: '10px 26px',
              minHeight: 44,
              fontSize: 14,
              fontWeight: mode === value ? 700 : 400,
              color: mode === value ? ds.txW : ds.txB,
              background: mode === value ? ds.warmDk : '#fff',
              border: `1px solid ${ds.bd}`,
              borderRadius:
                value === 'quick' ? '10px 0 0 10px' : '0 10px 10px 0',
              cursor: 'pointer',
            }}
          >
            {value === 'quick' ? 'Quick' : 'Deep'}
          </button>
        ))}
      </fieldset>
      <PromptCard lead="Explore reasoning:" prompts={prompts} />
    </>
  );
}

export function Step3({ draft, update }: StepProps) {
  const repository = useRepository();
  const answer = draft.step1.learnerAnswer;
  const { points, pearlUsedId, pearlSavedId } = draft.step3;
  const match = useRepositoryQuery(
    (repo) => repo.findPearlForAnswer(answer),
    [answer],
  );
  const pearl = match.data;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const baseId = useId();

  const setPoint = (index: number, value: string) =>
    update((d) => ({
      ...d,
      step3: {
        ...d.step3,
        points: setAt(
          d.step3.points,
          index,
          value,
        ) as SessionDraft['step3']['points'],
      },
    }));

  async function applyPearl() {
    if (!pearl) return;
    update((d) => ({
      ...d,
      step3: { ...d.step3, points: [...pearl.points], pearlUsedId: pearl.id },
    }));
    await repository.markPearlUsed(pearl.id);
  }

  async function savePearl() {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await repository.savePearl({
        id: crypto.randomUUID(),
        diagnosis: answer.trim(),
        points: [...points],
      });
      update((d) => ({ ...d, step3: { ...d.step3, pearlSavedId: saved.id } }));
    } catch {
      setSaveError('The pearl was not saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const input = (index: number, style?: CSSProperties) => {
    const template = STEP3_TEMPLATES[index];
    const value = points[index] ?? '';
    return (
      <input
        id={`${baseId}-${index}`}
        aria-label={template?.label}
        value={value}
        maxLength={500}
        placeholder={template?.placeholder}
        onChange={(event) => setPoint(index, event.target.value)}
        style={{
          ...blankInput,
          background: value ? `${ds.gold}14` : ds.bdL,
          borderColor: value ? ds.gold : ds.bd,
          ...style,
        }}
      />
    );
  };

  const canSave = answer.trim() !== '' && points.some((p) => p.trim() !== '');

  return (
    <>
      {pearl && pearlUsedId !== pearl.id && (
        <Card
          padding={12}
          accent={ds.gold}
          style={{ marginBottom: 10 }}
          data-testid="pearl-banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star size={14} color={ds.goldText} />
            <span style={{ fontSize: 14, fontWeight: 700, color: ds.goldText }}>
              Saved pearl for “{pearl.diagnosis}”
            </span>
          </div>
          <p style={{ fontSize: 12, color: ds.txB, margin: '4px 0 0' }}>
            Tap below to fill in your points.
          </p>
          <button
            type="button"
            onClick={() => void applyPearl()}
            style={{
              ...ds.btnSec,
              width: '100%',
              marginTop: 8,
              padding: 10,
              minHeight: 44,
              fontSize: 14,
              fontWeight: 600,
              color: ds.goldText,
              borderColor: ds.gold,
            }}
          >
            Use saved pearl
          </button>
        </Card>
      )}
      <Card padding={14}>
        <p style={{ fontSize: 13, color: ds.txB, margin: '0 0 10px' }}>
          Teach 1–2 key points:
        </p>
        <div style={{ marginBottom: 10 }}>
          <label
            htmlFor={`${baseId}-0`}
            style={{ fontSize: 13, color: ds.txB }}
          >
            • {STEP3_TEMPLATES[0].label}…
          </label>
          {input(0, { marginTop: 4 })}
        </div>
        <div
          style={{
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <label
            htmlFor={`${baseId}-1`}
            style={{ fontSize: 13, color: ds.txB }}
          >
            • {STEP3_TEMPLATES[1].label}
          </label>
          {input(1, { width: 'auto', flex: '1 1 110px', minWidth: 0 })}
          <label
            htmlFor={`${baseId}-2`}
            style={{ fontSize: 13, color: ds.txB }}
          >
            {STEP3_TEMPLATES[2].label}
          </label>
          {input(2, { width: 'auto', flex: '1 1 110px', minWidth: 0 })}
        </div>
        <div style={{ marginBottom: 10 }}>
          <label
            htmlFor={`${baseId}-3`}
            style={{ fontSize: 13, color: ds.txB }}
          >
            • {STEP3_TEMPLATES[3].label}…
          </label>
          {input(3, { marginTop: 4 })}
        </div>
        <div>
          <label
            htmlFor={`${baseId}-4`}
            style={{ fontSize: 13, color: ds.txB }}
          >
            • {STEP3_TEMPLATES[4].label}:
          </label>
          {input(4, { marginTop: 4 })}
        </div>
        <p style={{ fontSize: 12, color: ds.txMuted, margin: '8px 0 0' }}>
          {PATIENT_REMINDER}
        </p>
      </Card>
      <button
        type="button"
        disabled={!canSave || saving || pearlSavedId !== undefined}
        onClick={() => void savePearl()}
        aria-describedby={canSave ? undefined : `${baseId}-save-hint`}
        style={{
          ...ds.btnSec,
          width: '100%',
          marginTop: 10,
          padding: 12,
          minHeight: 44,
          fontSize: 14,
          fontWeight: 600,
          color: pearlSavedId ? ds.greenText : ds.txB,
          borderColor: pearlSavedId ? ds.green : ds.bd,
          background: pearlSavedId ? `${ds.green}14` : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: !canSave && !pearlSavedId ? 0.6 : 1,
        }}
      >
        {pearlSavedId ? <Check size={14} /> : <Star size={14} />}
        {pearlSavedId
          ? 'Pearl saved'
          : saving
            ? 'Saving…'
            : 'Save as teaching pearl'}
      </button>
      {!canSave && !pearlSavedId && (
        <p
          id={`${baseId}-save-hint`}
          style={{
            fontSize: 12,
            color: ds.txMuted,
            margin: '6px 0 0',
            textAlign: 'center',
          }}
        >
          Enter the learner’s answer in Step 1 and at least one point to save a
          pearl.
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          style={{ fontSize: 13, color: ds.redText, margin: '6px 0 0' }}
        >
          {saveError}
        </p>
      )}
    </>
  );
}

function StarterRows({
  lead,
  starters,
  values,
  onChange,
}: {
  lead: string;
  starters: readonly string[];
  values: readonly string[];
  onChange: (index: number, value: string) => void;
}) {
  const baseId = useId();
  return (
    <Card padding={14}>
      <p style={{ fontSize: 13, color: ds.txB, margin: '0 0 10px' }}>{lead}</p>
      {starters.map((starter, index) => (
        <div
          key={starter}
          data-testid="starter-row"
          style={{
            display: 'flex',
            marginBottom: 8,
            borderRadius: 12,
            border: `1px solid ${ds.bd}`,
            overflow: 'hidden',
          }}
        >
          <label
            htmlFor={`${baseId}-${index}`}
            style={{
              padding: 12,
              fontSize: 13,
              color: ds.txB,
              fontWeight: 500,
              borderRight: `1px solid ${ds.bd}`,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {starter}
          </label>
          <input
            id={`${baseId}-${index}`}
            data-testid="starter-input"
            value={values[index] ?? ''}
            maxLength={500}
            placeholder="___"
            onChange={(event) => onChange(index, event.target.value)}
            style={{
              flex: '1 0 120px',
              minWidth: 0,
              padding: 12,
              border: 'none',
              fontSize: 16,
              outline: 'none',
              background: ds.bdL,
              fontFamily: 'inherit',
              color: ds.tx,
            }}
          />
        </div>
      ))}
    </Card>
  );
}

const TAG_OPTIONS = STEP4_TAGS.map((tag) => ({ value: tag, label: tag }));

export function Step4({ draft, update }: StepProps) {
  return (
    <>
      <StarterRows
        lead="Provide positive feedback:"
        starters={STEPS[3].starters}
        values={draft.step4.starters}
        onChange={(index, value) =>
          update((d) => ({
            ...d,
            step4: {
              ...d.step4,
              starters: setAt(
                d.step4.starters,
                index,
                value,
              ) as SessionDraft['step4']['starters'],
            },
          }))
        }
      />
      <ChipGroup<Step4Tag>
        multiple
        label="Strengths"
        options={TAG_OPTIONS}
        value={draft.step4.tags}
        color={ds.greenFill}
        showCheck
        onChange={(tags) =>
          update((d) => ({ ...d, step4: { ...d.step4, tags } }))
        }
        style={{ marginTop: 10 }}
      />
    </>
  );
}

export function Step5({ draft, update }: StepProps) {
  const id = useId();
  return (
    <>
      <StarterRows
        lead="Guide improvement:"
        starters={STEPS[4].starters}
        values={draft.step5.starters}
        onChange={(index, value) =>
          update((d) => ({
            ...d,
            step5: {
              ...d.step5,
              starters: setAt(
                d.step5.starters,
                index,
                value,
              ) as SessionDraft['step5']['starters'],
            },
          }))
        }
      />
      <Card padding={14} style={{ marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <label
            htmlFor={id}
            style={{ fontSize: 15, fontWeight: 700, color: ds.tx }}
          >
            Action plan
          </label>
          <SquarePen size={16} color={ds.txL} />
        </div>
        <textarea
          id={id}
          value={draft.step5.actionPlan}
          maxLength={1000}
          rows={2}
          placeholder="What should the learner study next?"
          onChange={(event) => {
            const actionPlan = event.target.value;
            update((d) => ({ ...d, step5: { ...d.step5, actionPlan } }));
          }}
          style={{ ...ds.input, resize: 'none', background: ds.bdL }}
        />
      </Card>
    </>
  );
}
