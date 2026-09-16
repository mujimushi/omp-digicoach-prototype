import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Prompt, never update by itself: that reloads the page mid-session. The app asks once no
      // draft is open.
      registerType: 'prompt',
      // The app registers through the React hook in UpdatePrompt.
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'OMP DigiCoach',
        short_name: 'DigiCoach',
        description: 'A One-Minute Preceptor teaching coach for doctors',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#8B6BAE',
        background_color: '#FDF8F3',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The dashboard stays off phones: its chunk is never precached. The plugin adds the web
        // manifest itself; matching it here too makes Workbox refuse to install.
        globIgnores: [
          '**/admin-*.js',
          '**/admin-*.css',
          'manifest.webmanifest',
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        // No runtime caching rules at all: API answers are private and never cached.
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
