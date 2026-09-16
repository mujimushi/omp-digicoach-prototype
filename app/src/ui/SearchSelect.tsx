import { Search } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ds } from '../styles/tokens.ts';

export type SearchOption = {
  value: string;
  label: string;
  description?: string;
};

export type SearchSelectProps = {
  label: string;
  options: readonly SearchOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  /** Shown when nothing matches the search. */
  emptyText?: ReactNode;
  /** Filters by label and description. Replace it to search other fields. */
  matches?: (option: SearchOption, query: string) => boolean;
  hideLabel?: boolean;
};

function defaultMatches(option: SearchOption, query: string) {
  const text = query.trim().toLowerCase();
  return (
    option.label.toLowerCase().includes(text) ||
    (option.description ?? '').toLowerCase().includes(text)
  );
}

/**
 * A search box above a list of matching options. Each option is a button, so it works with a tap,
 * Tab and Enter; the arrow keys also move between the box and the options.
 */
export function SearchSelect({
  label,
  options,
  onSelect,
  placeholder,
  emptyText = 'Nothing matches.',
  matches = defaultMatches,
  hideLabel = false,
}: SearchSelectProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query, matches],
  );

  function move(event: KeyboardEvent, from: number) {
    const next =
      event.key === 'ArrowDown'
        ? from + 1
        : event.key === 'ArrowUp'
          ? from - 1
          : null;
    if (next === null) return;
    event.preventDefault();
    if (next < 0) input.current?.focus();
    else buttons.current[Math.min(next, filtered.length - 1)]?.focus();
  }

  return (
    <div>
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
        <Search
          size={16}
          color={ds.txL}
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        <input
          ref={input}
          id={id}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && filtered.length === 1 && filtered[0]) {
              event.preventDefault();
              onSelect(filtered[0].value);
            } else {
              move(event, -1);
            }
          }}
          autoComplete="off"
          style={{ ...ds.input, paddingLeft: 40 }}
        />
      </div>
      <p className="visually-hidden" aria-live="polite">
        {filtered.length === 1 ? '1 match' : `${filtered.length} matches`}
      </p>
      <ul
        aria-label={label}
        style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}
      >
        {filtered.map((option, index) => (
          <li key={option.value} style={{ marginBottom: 6 }}>
            <button
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              onClick={() => onSelect(option.value)}
              onKeyDown={(event) => move(event, index)}
              style={{
                ...ds.card,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 15,
                  fontWeight: 600,
                  color: ds.tx,
                }}
              >
                {option.label}
              </span>
              {option.description && (
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: ds.txMuted,
                    marginTop: 2,
                  }}
                >
                  {option.description}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p
          style={{
            fontSize: 13,
            color: ds.txMuted,
            textAlign: 'center',
            margin: '16px 0',
          }}
        >
          {emptyText}
        </p>
      )}
    </div>
  );
}
