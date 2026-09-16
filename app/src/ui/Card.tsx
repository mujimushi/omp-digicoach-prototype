import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { ds } from '../styles/tokens.ts';

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'style'> & {
  children: ReactNode;
  /** A coloured bar down the left edge. */
  accent?: string;
  padding?: number;
  as?: 'div' | 'section' | 'article' | 'li';
  style?: CSSProperties;
};

export function Card({
  children,
  accent,
  padding = 16,
  as: Element = 'div',
  style,
  ...rest
}: CardProps) {
  return (
    <Element
      style={{
        ...ds.card,
        padding,
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Element>
  );
}
