import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPhoneDb } from './db.ts';
import { UpdatePrompt } from './UpdatePrompt.tsx';

const updateServiceWorker = vi.fn(async () => undefined);

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

describe('UpdatePrompt', () => {
  beforeEach(async () => {
    await getPhoneDb().drafts.clear();
    updateServiceWorker.mockClear();
  });

  it('shows nothing while a draft exists, then offers Reload once it is removed', async () => {
    const user = userEvent.setup();
    await getPhoneDb().drafts.put({ key: 'current', draft: {} as never });
    render(<UpdatePrompt />);

    // Give the live query time to answer.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      screen.queryByText('A new version is ready'),
    ).not.toBeInTheDocument();

    await getPhoneDb().drafts.delete('current');
    expect(
      await screen.findByText('A new version is ready'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
  });
});
