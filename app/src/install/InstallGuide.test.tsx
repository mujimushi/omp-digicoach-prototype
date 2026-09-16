import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getPhoneDb } from '../offline/db.ts';
import { InstallGuide } from './InstallGuide.tsx';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

describe('InstallGuide', () => {
  beforeEach(async () => {
    await getPhoneDb().meta.delete('installGuideDismissedAt');
  });

  it('shows an iPhone outside the installed app the Add to Home Screen steps and the storage warning', async () => {
    render(
      <InstallGuide environment={{ userAgent: IPHONE, installed: false }} />,
    );
    expect(
      await screen.findByRole('region', { name: 'Install the app' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Choose Add to Home Screen/)).toBeInTheDocument();
    expect(
      screen.getByText(/Safari and the installed app keep separate data/),
    ).toBeInTheDocument();
  });

  it('shows nothing inside the installed app', async () => {
    render(
      <InstallGuide environment={{ userAgent: IPHONE, installed: true }} />,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      screen.queryByRole('region', { name: 'Install the app' }),
    ).not.toBeInTheDocument();
  });

  it('shows nothing on a desktop', async () => {
    render(
      <InstallGuide environment={{ userAgent: DESKTOP, installed: false }} />,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('tells Android users how to install when Chrome hasn’t offered the prompt', async () => {
    render(
      <InstallGuide environment={{ userAgent: ANDROID, installed: false }} />,
    );
    expect(await screen.findByText(/choose Install app/)).toBeInTheDocument();
  });

  it('hides for 7 days when dismissed', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <InstallGuide environment={{ userAgent: IPHONE, installed: false }} />,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Hide for 7 days' }),
    );
    unmount();

    render(
      <InstallGuide environment={{ userAgent: IPHONE, installed: false }} />,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      screen.queryByRole('region', { name: 'Install the app' }),
    ).not.toBeInTheDocument();
    expect(await getPhoneDb().getMeta('installGuideDismissedAt')).toBeDefined();
  });
});
