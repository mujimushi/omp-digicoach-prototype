import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
  Ref,
} from 'react';
import { ds } from '../styles/tokens.ts';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success';

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'style'
> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { ...ds.btnPri, background: ds.gradBtn },
  secondary: { ...ds.btnSec, color: ds.txB, fontWeight: 600 },
  ghost: {
    background: 'none',
    border: 'none',
    color: ds.pri,
    fontWeight: 600,
    cursor: 'pointer',
  },
  danger: {
    ...ds.btnSec,
    color: ds.red,
    borderColor: ds.red,
    fontWeight: 600,
  },
  success: {
    ...ds.btnPri,
    background: `linear-gradient(135deg, ${ds.green}, #16A34A)`,
    boxShadow: '0 4px 14px rgba(34,197,94,0.3)',
  },
};

export function Button({
  variant = 'primary',
  icon,
  fullWidth = false,
  style,
  children,
  type = 'button',
  disabled,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      style={{
        ...variants[variant],
        padding: variant === 'ghost' ? '8px 4px' : '14px 16px',
        fontSize: 15,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
