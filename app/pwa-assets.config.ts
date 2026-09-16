import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// Generates the icon set from the prototype's logo at build time.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
});
