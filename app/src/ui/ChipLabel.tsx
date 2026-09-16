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
 * A chip's label that keeps the same width when selected. An invisible bold copy, with the icon,
 * sits under the visible label in one grid cell, so turning bold or showing the tick never
 * resizes the chip.
 */
export function ChipLabel({ on, icon, children }: ChipLabelProps) {
  return (
    <span style={{ display: 'grid' }}>
      <span
        aria-hidden="true"
        data-chip-layer="sizer"
        style={{ ...layer, fontWeight: 600, visibility: 'hidden' }}
      >
        {icon}
        <span>{children}</span>
      </span>
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
