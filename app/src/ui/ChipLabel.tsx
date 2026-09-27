import type { CSSProperties, ReactNode } from 'react';

export type ChipLabelProps = {
  on: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

const layer: CSSProperties = {
  gridArea: '1/1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

/**
 * A chip's label that keeps the same width when selected. Invisible bold and regular copies, with
 * the icon, sit under the visible label in one grid cell, so turning bold or showing the tick never
 * resizes the chip. Both weights are needed: in some fonts, such as Segoe UI, bold text is narrower.
 */
export function ChipLabel({ on, icon, children }: ChipLabelProps) {
  return (
    <span style={{ display: 'grid' }}>
      {[600, 400].map((weight) => (
        <span
          key={weight}
          aria-hidden="true"
          data-chip-layer="sizer"
          style={{ ...layer, fontWeight: weight, visibility: 'hidden' }}
        >
          {icon}
          <span>{children}</span>
        </span>
      ))}
      <span
        data-chip-layer="visible"
        style={{ ...layer, fontWeight: on ? 600 : 400 }}
      >
        {on && icon}
        <span>{children}</span>
      </span>
    </span>
  );
}
