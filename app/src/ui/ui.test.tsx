import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { ChipGroup } from './ChipGroup.tsx';
import { ChipLabel } from './ChipLabel.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { IconCircle } from './IconCircle.tsx';
import { TabBar } from './TabBar.tsx';
import { TextField } from './TextField.tsx';
import { TOAST_MS, Toast, ToastProvider, useToast } from './Toast.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('Button', () => {
  it('calls onClick, and not when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a plain button by default, so it never submits a form by accident', () => {
    render(<Button>Next</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Card', () => {
  it('renders its children with an accent bar', () => {
    render(
      <Card accent="#E88C5A" data-testid="card">
        Ahmed Khan
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveTextContent('Ahmed Khan');
    expect(card.style.borderLeft).toContain('3px solid');
  });
});

describe('IconCircle', () => {
  it('draws the icon hidden from screen readers on a tinted circle', () => {
    render(<IconCircle Icon={Star} color="#D4A76A" size={40} />);
    const circle = screen.getByTestId('icon-circle');
    expect(circle.style.width).toBe('40px');
    expect(circle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ChipLabel', () => {
  it('stacks an invisible bold copy under the visible label, so width never changes', () => {
    const { container, rerender } = render(
      <ChipLabel on={false}>Long Case</ChipLabel>,
    );
    const sizer = container.querySelector<HTMLElement>(
      '[data-chip-layer="sizer"]',
    );
    const visible = container.querySelector<HTMLElement>(
      '[data-chip-layer="visible"]',
    );

    expect(sizer?.style.visibility).toBe('hidden');
    expect(sizer?.style.fontWeight).toBe('600');
    expect(sizer).toHaveAttribute('aria-hidden', 'true');
    expect(visible?.style.fontWeight).toBe('400');
    expect(sizer?.style.gridArea).toBe(visible?.style.gridArea);

    rerender(<ChipLabel on>Long Case</ChipLabel>);
    expect(
      container.querySelector<HTMLElement>('[data-chip-layer="visible"]')?.style
        .fontWeight,
    ).toBe('600');
  });

  it('keeps the icon in the sizer even when off', () => {
    const { container } = render(
      <ChipLabel on={false} icon={<svg data-testid="tick" />}>
        Good history
      </ChipLabel>,
    );
    const sizer = container.querySelector('[data-chip-layer="sizer"]');
    const visible = container.querySelector('[data-chip-layer="visible"]');
    expect(sizer?.querySelector('[data-testid="tick"]')).not.toBeNull();
    expect(visible?.querySelector('[data-testid="tick"]')).toBeNull();
  });
});

describe('ChipGroup', () => {
  const options = [
    { value: 'long_case', label: 'Long Case' },
    { value: 'short_case', label: 'Short Case' },
  ] as const;

  it('selects one option at a time', async () => {
    const user = userEvent.setup();
    function Single() {
      const [value, setValue] = useState<'long_case' | 'short_case' | null>(
        null,
      );
      return (
        <ChipGroup
          label="Case type"
          options={options}
          value={value}
          onChange={setValue}
        />
      );
    }
    render(<Single />);

    const long = screen.getByRole('button', { name: 'Long Case' });
    const short = screen.getByRole('button', { name: 'Short Case' });
    expect(
      screen.getByRole('group', { name: 'Case type' }),
    ).toBeInTheDocument();
    expect(long).toHaveAttribute('aria-pressed', 'false');

    await user.click(long);
    expect(long).toHaveAttribute('aria-pressed', 'true');

    await user.click(short);
    expect(long).toHaveAttribute('aria-pressed', 'false');
    expect(short).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles several options in multi-select mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ChipGroup
        multiple
        label="Tags"
        options={options}
        value={[]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Long Case' }));
    expect(onChange).toHaveBeenLastCalledWith(['long_case']);

    rerender(
      <ChipGroup
        multiple
        label="Tags"
        options={options}
        value={['long_case', 'short_case']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Long Case' }));
    expect(onChange).toHaveBeenLastCalledWith(['short_case']);
  });
});

describe('TextField', () => {
  it('labels the input and reports typing', async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState('');
      return <TextField label="Diagnosis" value={value} onChange={setValue} />;
    }
    render(<Field />);
    const input = screen.getByLabelText('Diagnosis');
    await user.type(input, 'Pneumonia');
    expect(input).toHaveValue('Pneumonia');
  });

  it('marks an error and links it to the input', () => {
    render(
      <TextField
        label="Name"
        value=""
        onChange={() => undefined}
        error="Enter a name"
        hint="As on the ward list"
      />,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'As on the ward list Enter a name',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  });

  it('can be a multi-line box with a length limit', () => {
    render(
      <TextField
        label="Action plan"
        value=""
        onChange={() => undefined}
        multiline
        maxLength={1000}
      />,
    );
    const box = screen.getByLabelText('Action plan');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('maxlength', '1000');
  });
});

describe('Toast', () => {
  it('announces the message politely', () => {
    render(<Toast message="Session saved" detail="Waiting to send" />);
    expect(screen.getByRole('status')).toHaveTextContent('Session saved');
    expect(screen.getByRole('status')).toHaveTextContent('Waiting to send');
  });

  it('hides itself after three seconds', async () => {
    vi.useFakeTimers();
    function Trigger() {
      const show = useToast();
      return (
        <button type="button" onClick={() => show('Saved')}>
          Show
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button', { name: 'Show' }).click());
    expect(screen.getByText('Saved')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(TOAST_MS - 1));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});

describe('TabBar', () => {
  it('links each tab and marks the current page', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <TabBar
          tabs={[
            { to: '/', label: 'Students', Icon: Star, end: true },
            { to: '/history', label: 'History', Icon: Star },
          ]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Students' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('ConfirmDialog', () => {
  it('shows nothing while closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete?"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks, focuses Cancel, and reports the choice', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Reset password?"
        confirmLabel="Reset"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Their current logins will end.
      </ConfirmDialog>,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Reset password?' });
    expect(dialog).toHaveAccessibleDescription(
      'Their current logins will end.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
