import { TriangleAlert } from 'lucide-react';
import { ds } from '../styles/tokens.ts';

export type InstallEnvironment = {
  userAgent: string;
  /** The page runs from the home-screen icon. */
  standalone: boolean;
  /** Touch points: iPads report a Mac user agent but have touch. */
  maxTouchPoints: number;
};

export function currentEnvironment(): InstallEnvironment {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

/** Other browsers on iPhone and iPad, which can't add to the home screen. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo/;
/** Browsers built into other apps, such as WhatsApp, Facebook, Instagram or the Google app. */
const IOS_IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|LinkedInApp|Twitter|MicroMessenger|GSA\//;

export type InstallSituation =
  | 'installed'
  | 'ios-safari'
  | 'ios-other-browser'
  | 'android'
  | 'other';

export function installSituation(env: InstallEnvironment): InstallSituation {
  if (env.standalone) return 'installed';
  const ua = env.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && env.maxTouchPoints > 1);
  if (ios) {
    return IOS_OTHER_BROWSER.test(ua) || IOS_IN_APP_BROWSER.test(ua)
      ? 'ios-other-browser'
      : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

const text = {
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1.4,
  margin: 0,
} as const;

/**
 * How to put the app on the home screen, on the splash and login screens only. Hidden when the app
 * already runs from the home-screen icon, and on computers.
 */
export function InstallNotice({
  environment = currentEnvironment(),
}: {
  environment?: InstallEnvironment;
}) {
  const situation = installSituation(environment);
  if (situation === 'installed' || situation === 'other') return null;

  if (situation === 'ios-other-browser') {
    return (
      <section
        role="alert"
        aria-label="Install the app"
        style={{
          width: '100%',
          background: ds.redText,
          color: ds.txW,
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        <TriangleAlert size={24} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ ...text, fontSize: 18, marginBottom: 6 }}>
            You are not in Safari.
          </p>
          <p style={text}>
            Open this app in Safari, not Chrome. Then use Safari’s Share menu
            and choose Add to Home Screen.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Install the app"
      style={{
        width: '100%',
        background: '#fff',
        color: ds.warmDk,
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 4px 14px rgba(61,46,92,0.12)',
      }}
    >
      <p style={text}>
        {situation === 'ios-safari'
          ? 'Open this app in Safari, not Chrome. Then use Safari’s Share menu and choose Add to Home Screen.'
          : 'Open the Chrome menu and choose Add to Home screen or Install app.'}
      </p>
    </section>
  );
}
