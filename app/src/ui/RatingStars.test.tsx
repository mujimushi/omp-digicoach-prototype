import type { Rating } from '@omp/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { RatingStars } from './RatingStars.tsx';

function Rated({ initial = null }: { initial?: Rating | null }) {
  const [value, setValue] = useState<Rating | null>(initial);
  return <RatingStars label="Rate Step 1" value={value} onChange={setValue} />;
}

describe('RatingStars', () => {
  it('names each star with its label', () => {
    render(<Rated />);
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      '1 star, Needs improvement',
      '2 stars, Basic',
      '3 stars, Competent',
      '4 stars, Proficient',
      '5 stars, Excellent',
    ]);
    expect(screen.getByText('Not rated')).toBeInTheDocument();
  });

  it('tapping a star sets the rating; tapping it again clears it', async () => {
    const user = userEvent.setup();
    render(<Rated />);
    const third = screen.getByRole('button', { name: '3 stars, Competent' });

    await user.click(third);
    expect(third).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Competent')).toBeInTheDocument();

    await user.click(third);
    expect(third).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Not rated')).toBeInTheDocument();
  });

  it('tapping another star changes the rating', async () => {
    const user = userEvent.setup();
    render(<Rated initial={2} />);
    await user.click(
      screen.getByRole('button', { name: '5 stars, Excellent' }),
    );
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '2 stars, Basic' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('arrow keys move focus between stars', async () => {
    const user = userEvent.setup();
    render(<Rated />);
    const stars = screen.getAllByRole('button');

    stars[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(stars[1]).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(stars[3]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(stars[2]).toHaveFocus();
    await user.keyboard('{End}');
    expect(stars[4]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(stars[4]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(stars[0]).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Needs improvement')).toBeInTheDocument();
  });
});
