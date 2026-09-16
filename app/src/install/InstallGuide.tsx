import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { getPhoneDb } from '../offline/db.ts';
import { ds } from '../styles/tokens.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { getInstallPrompt, subscribeInstallPrompt } from './install-prompt.ts';

export const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type InstallEnvironment = {
  userAgent: string;
  /** The page runs as the installed app. */
  installed: boolean;
};

export function currentEnvironment(): InstallEnvironment {
  const installed =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { userAgent: navigator.userAgent, installed };
}

type Platform = 'iphone' | 'android' | 'other';

export function platformOf(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iphone';
  if (/Android/.test(userAgent)) return 'android';
  return 'other';
}

/**
 * Shows how to install the app until it is installed. iPhones have no install button, so they get
 * the Share steps; Android Chrome gets an Install button. Dismissing hides it for 7 days.
 */
export function InstallGuide({
  environment = currentEnvironment(),
  dismissible = true,
}: {
  environment?: InstallEnvironment;
  dismissible?: boolean;
}) {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt);
  const dismissedAt = useLiveQuery(
    () => getPhoneDb().getMeta('installGuideDismissedAt'),
    [],
    null,
  );
  const platform = platformOf(environment.userAgent);

  if (environment.installed || platform === 'other') return null;
  if (dismissible && dismissedAt === null) return null;
  if (
    dismissible &&
    dismissedAt &&
    Date.now() - new Date(dismissedAt).getTime() < DISMISS_FOR_MS
  ) {
    return null;
  }

  const dismiss = () =>
    void getPhoneDb().setMeta(
      'installGuideDismissedAt',
      new Date().toISOString(),
    );

  return (
    <Card accent={ds.teal} style={{ marginBottom: 12, position: 'relative' }}>
      <section aria-label="Install the app">
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: ds.warmDk,
            margin: '0 0 6px',
            paddingRight: 32,
          }}
        >
          Install DigiCoach on this phone
        </h2>
        {dismissible && (
          <button
            type="button"
            aria-label="Hide for 7 days"
            onClick={dismiss}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'none',
              border: 'none',
              minWidth: 40,
              minHeight: 40,
              cursor: 'pointer',
              color: ds.txMuted,
            }}
          >
            <X size={18} />
          </button>
        )}
        {platform === 'iphone' ? (
          <>
            <ol
              style={{
                margin: '0 0 8px',
                paddingLeft: 20,
                fontSize: 14,
                color: ds.tx,
                lineHeight: 1.6,
              }}
            >
              <li>
                Tap Share{' '}
                <Share
                  size={14}
                  aria-label="the Share icon"
                  style={{ verticalAlign: 'text-bottom' }}
                />{' '}
                at the bottom of Safari.
              </li>
              <li>
                Choose Add to Home Screen{' '}
                <SquarePlus
                  size={14}
                  aria-hidden="true"
                  style={{ verticalAlign: 'text-bottom' }}
                />
                .
              </li>
              <li>Open DigiCoach from your home screen and log in there.</li>
            </ol>
            <p style={{ fontSize: 13, color: ds.txB, margin: 0 }}>
              Safari and the installed app keep separate data. Use the installed
              app, or Safari may delete your saved sessions after 7 days.
            </p>
          </>
        ) : prompt ? (
          <>
            <p style={{ fontSize: 14, color: ds.tx, margin: '0 0 10px' }}>
              The installed app opens without signal and keeps your sessions
              safe.
            </p>
            <Button
              icon={<Download size={16} />}
              onClick={() => void prompt.prompt()}
            >
              Install
            </Button>
          </>
        ) : (
          <p style={{ fontSize: 14, color: ds.tx, margin: 0 }}>
            Open Chrome’s menu (⋮) and choose Install app, then open DigiCoach
            from your home screen.
          </p>
        )}
      </section>
    </Card>
  );
}
