import type { LucideIcon } from 'lucide-react';

export type IconCircleProps = {
  Icon: LucideIcon;
  color: string;
  size?: number;
};

/** An icon on a pale circle of its own colour, as in the prototype. */
export function IconCircle({ Icon, color, size = 36 }: IconCircleProps) {
  return (
    <div
      data-testid="icon-circle"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${color}1F`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={size * 0.5} color={color} strokeWidth={2.2} />
    </div>
  );
}
