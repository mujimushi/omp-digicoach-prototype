/**
 * Stops Android Chrome's own install banner, which would otherwise appear after login. The splash
 * and login screens explain how to install instead. Call when the app starts.
 */
export function suppressInstallBanner(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
  });
}
