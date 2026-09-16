import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ds } from '../styles/tokens.ts';
import { ChipLabel } from './ChipLabel.tsx';

export type ChipOption<T extends string> = { value: T; label: string };

type Common<T extends string> = {
  /** The group's accessible name, such as "Case type". */
  label: string;
  options: readonly ChipOption<T>[];
  /** Fill colour of a selected chip. */
  color?: string;
  /** Show a tick on selected chips, as Step 4's tags do. */
  showCheck?: boolean;
  style?: CSSProperties;
};

export type SingleChipGroupProps<T extends string> = Common<T> & {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
};

export type MultiChipGroupProps<T extends string> = Common<T> & {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
};

/** Chips for picking one option, or several. Selecting never changes a chip's size. */
export function ChipGroup<T extends string>(
  props: SingleChipGroupProps<T> | MultiChipGroupProps<T>,
) {
  const {
    label,
    options,
    color = ds.lavenderFill,
    showCheck = false,
    style,
  } = props;

  function isOn(value: T) {
    return props.multiple ? props.value.includes(value) : props.value === value;
  }

  function toggle(value: T) {
    if (props.multiple) {
      props.onChange(
        props.value.includes(value)
          ? props.value.filter((v) => v !== value)
          : [...props.value, value],
      );
    } else {
      props.onChange(value);
    }
  }

  return (
    <fieldset
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        border: 0,
        margin: 0,
        padding: 0,
        minWidth: 0,
        ...style,
      }}
    >
      <legend className="visually-hidden">{label}</legend>
      {options.map((option) => {
        const on = isOn(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option.value)}
            style={{
              padding: '8px 14px',
              minHeight: 36,
              borderRadius: 14,
              border: `1px solid ${on ? color : ds.bd}`,
              background: on ? color : '#fff',
              color: on ? ds.txW : ds.txB,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            <ChipLabel
              on={on}
              icon={showCheck ? <Check size={12} /> : undefined}
            >
              {option.label}
            </ChipLabel>
          </button>
        );
      })}
    </fieldset>
  );
}
