import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  type CSSProperties,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useState,
} from 'react';
import { ResponsiveContainer } from 'recharts';
import { ds } from '../styles/tokens.ts';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1
          style={{ fontSize: 26, fontWeight: 700, color: ds.warmDk, margin: 0 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: ds.txB, margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      aria-label={title}
      className="admin-panel"
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${ds.bd}`,
        padding: 18,
        marginBottom: 16,
        ...style,
      }}
    >
      {title && (
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: ds.warmDk,
            margin: '0 0 12px',
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${ds.bd}`,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 13, color: ds.txB }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: ds.warmDk,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {note && (
        <div style={{ fontSize: 12, color: ds.txMuted, marginTop: 2 }}>
          {note}
        </div>
      )}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <p role="status" style={{ color: ds.txMuted }}>
      Loading {what}…
    </p>
  );
}

export function LoadError({ error }: { error: unknown }) {
  return (
    <p role="alert" style={{ color: ds.redText }}>
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  );
}

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** A value to sort by. Columns without it can't be sorted. */
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right' | 'center';
};

/** A table whose headers sort the rows the server sent. */
export function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  initialSort,
  empty = 'Nothing to show.',
}: {
  caption: string;
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; descending: boolean };
  empty?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const column = columns.find((c) => c.key === sort?.key);
  const sorted = column?.sortValue
    ? [...rows].sort((a, b) => {
        const va = column.sortValue?.(a) ?? null;
        const vb = column.sortValue?.(b) ?? null;
        if (va === vb) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const order = va < vb ? -1 : 1;
        return sort?.descending ? -order : order;
      })
    : rows;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        className="admin-table"
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}
      >
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    active
                      ? sort?.descending
                        ? 'descending'
                        : 'ascending'
                      : undefined
                  }
                  style={{
                    textAlign: c.align ?? 'left',
                    padding: '8px 10px',
                    borderBottom: `2px solid ${ds.bd}`,
                    color: ds.txB,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort({
                          key: c.key,
                          descending: active ? !sort?.descending : false,
                        })
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 700,
                        color: ds.txB,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      {c.label}
                      {active &&
                        (sort?.descending ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronUp size={14} />
                        ))}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              style={{ borderBottom: `1px solid ${ds.bdL}` }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align ?? 'left',
                    padding: '8px 10px',
                    color: ds.tx,
                    verticalAlign: 'top',
                  }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p style={{ color: ds.txMuted, textAlign: 'center', padding: 16 }}>
          {empty}
        </p>
      )}
    </div>
  );
}

/** Tests give charts a fixed size, because jsdom draws a responsive chart at zero size. */
export const ChartSizeContext = createContext<{
  width: number;
  height: number;
} | null>(null);

export function ChartBox({
  height,
  children,
}: {
  height: number;
  children: (size: { width?: number; height?: number }) => ReactNode;
}) {
  const fixed = useContext(ChartSizeContext);
  if (fixed) return <>{children(fixed)}</>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children({}) as ReactElement}
    </ResponsiveContainer>
  );
}

export const STEP_COLOURS = [
  '#2F7F96',
  '#5CB8D4',
  '#735596',
  '#15803D',
  '#9A6B1F',
];
