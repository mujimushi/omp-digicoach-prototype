/** Chrome's install event. Not in TypeScript's DOM types. */
export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Keeps Android Chrome's install event, which fires once, early. Call when the app starts. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    for (const listener of listeners) listener();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    for (const listener of listeners) listener();
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
