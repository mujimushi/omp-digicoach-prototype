import { type CSSProperties, type ReactNode, useId } from 'react';
import { ds } from '../styles/tokens.ts';

export type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'search';
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  hint?: ReactNode;
  error?: string | null;
  autoComplete?: string;
  required?: boolean;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
  icon?: ReactNode;
  inputStyle?: CSSProperties;
  style?: CSSProperties;
  name?: string;
  autoFocus?: boolean;
  inputMode?: 'text' | 'numeric' | 'search';
  autoCapitalize?: string;
};

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 2,
  maxLength,
  hint,
  error,
  autoComplete,
  required,
  hideLabel = false,
  icon,
  inputStyle,
  style,
  name,
  autoFocus,
  inputMode,
  autoCapitalize,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  const shared = {
    id,
    name,
    value,
    placeholder,
    maxLength,
    required,
    autoFocus,
    autoComplete,
    inputMode,
    autoCapitalize,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };

  const fieldStyle: CSSProperties = {
    ...ds.input,
    borderColor: error ? ds.red : ds.bd,
    ...(icon ? { paddingLeft: 40 } : {}),
    ...inputStyle,
  };

  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label
        htmlFor={id}
        className={hideLabel ? 'visually-hidden' : undefined}
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
      <div style={{ position: 'relative' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: multiline ? 16 : '50%',
              transform: multiline ? undefined : 'translateY(-50%)',
              display: 'flex',
              pointerEvents: 'none',
            }}
          >
            {icon}
          </span>
        )}
        {multiline ? (
          <textarea
            {...shared}
            rows={rows}
            onChange={(event) => onChange(event.target.value)}
            style={{ ...fieldStyle, resize: 'none' }}
          />
        ) : (
          <input
            {...shared}
            type={type}
            onChange={(event) => onChange(event.target.value)}
            style={fieldStyle}
          />
        )}
      </div>
      {hint && (
        <div
          id={hintId}
          style={{ fontSize: 12, color: ds.txB, marginTop: 6, lineHeight: 1.5 }}
        >
          {hint}
        </div>
      )}
      {error && (
        <div
          id={errorId}
          role="alert"
          style={{ fontSize: 12, color: ds.red, marginTop: 6 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
