import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchSelect } from './SearchSelect.tsx';

const options = [
  { value: 'a', label: 'Ahmed Khan', description: 'PMDC 12345-P' },
  { value: 'f', label: 'Fatima Rizvi', description: 'PMDC 23456-P' },
  { value: 'b', label: 'Bilal Hussain', description: 'House Officer' },
];

describe('SearchSelect', () => {
  it('filters by name or description as the doctor types', async () => {
    const user = userEvent.setup();
    render(
      <SearchSelect
        label="Find a student"
        options={options}
        onSelect={vi.fn()}
      />,
    );
    const list = screen.getByRole('list', { name: 'Find a student' });
    expect(within(list).getAllByRole('button')).toHaveLength(3);

    await user.type(
      screen.getByRole('searchbox', { name: 'Find a student' }),
      '23456',
    );
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Fatima RizviPMDC 23456-P']);
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('shows the empty text when nothing matches', async () => {
    const user = userEvent.setup();
    render(
      <SearchSelect
        label="Find"
        options={options}
        onSelect={vi.fn()}
        emptyText="No student found"
      />,
    );
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No student found')).toBeInTheDocument();
  });

  it('selects by tapping an option', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchSelect label="Find" options={options} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /Bilal Hussain/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('moves with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchSelect label="Find" options={options} onSelect={onSelect} />);
    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(screen.getByRole('button', { name: /Ahmed Khan/ })).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('f');
  });

  it('selects the only match with Enter in the search box', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SearchSelect label="Find" options={options} onSelect={onSelect} />);
    await user.type(screen.getByRole('searchbox'), 'bilal{Enter}');
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
