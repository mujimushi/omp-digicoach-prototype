import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  type InstallEnvironment,
  InstallNotice,
  installSituation,
} from './InstallNotice.tsx';

const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.46 Mobile/15E148 Safari/604.1';
const IOS_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15';
const IOS_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/129.0.2792.84 Mobile/15E148 Safari/605.1.15';
const IOS_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; en_GB)';
const IOS_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]';
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const env = (
  userAgent: string,
  overrides: Partial<InstallEnvironment> = {},
): InstallEnvironment => ({
  userAgent,
  standalone: false,
  maxTouchPoints: 5,
  ...overrides,
});

describe('installSituation', () => {
  it.each([
    ['iPhone Safari', env(SAFARI), 'ios-safari'],
    ['iPad Safari, which reports a Mac', env(IPAD_SAFARI), 'ios-safari'],
    ['Chrome on iPhone', env(IOS_CHROME), 'ios-other-browser'],
    ['Firefox on iPhone', env(IOS_FIREFOX), 'ios-other-browser'],
    ['Edge on iPhone', env(IOS_EDGE), 'ios-other-browser'],
    ['Instagram’s browser', env(IOS_INSTAGRAM), 'ios-other-browser'],
    ['Facebook’s browser', env(IOS_FACEBOOK), 'ios-other-browser'],
    ['Android Chrome', env(ANDROID), 'android'],
    ['a Mac without touch', env(IPAD_SAFARI, { maxTouchPoints: 0 }), 'other'],
    ['a computer', env(DESKTOP, { maxTouchPoints: 0 }), 'other'],
    ['the home-screen app', env(SAFARI, { standalone: true }), 'installed'],
  ])('%s', (_, environment, expected) => {
    expect(installSituation(environment)).toBe(expected);
  });
});

describe('InstallNotice', () => {
  it('tells iPhone users to use Safari and Add to Home Screen', () => {
    render(<InstallNotice environment={env(SAFARI)} />);
    expect(
      screen.getByText(
        'Open this app in Safari, not Chrome. Then use Safari’s Share menu and choose Add to Home Screen.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns more strongly in another browser on an iPhone', () => {
    render(<InstallNotice environment={env(IOS_CHROME)} />);
    const alert = screen.getByRole('alert', { name: 'Install the app' });
    expect(alert).toHaveTextContent('You are not in Safari.');
    expect(alert).toHaveTextContent('Add to Home Screen');
  });

  it('uses large, bold text: 18px or more, weight 600 or more', () => {
    render(<InstallNotice environment={env(SAFARI)} />);
    const text = screen.getByText(/Open this app in Safari/);
    expect(Number.parseFloat(text.style.fontSize)).toBeGreaterThanOrEqual(18);
    expect(Number(text.style.fontWeight)).toBeGreaterThanOrEqual(600);
  });

  it('tells Android users to use the Chrome menu', () => {
    render(<InstallNotice environment={env(ANDROID)} />);
    expect(
      screen.getByText(
        'Open the Chrome menu and choose Add to Home screen or Install app.',
      ),
    ).toBeInTheDocument();
  });

  it('shows nothing from the home-screen icon or on a computer', () => {
    const { container } = render(
      <>
        <InstallNotice environment={env(SAFARI, { standalone: true })} />
        <InstallNotice environment={env(DESKTOP, { maxTouchPoints: 0 })} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
