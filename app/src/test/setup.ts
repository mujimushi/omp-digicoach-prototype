import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without Vitest globals, React Testing Library can't register its own cleanup.
afterEach(() => {
  cleanup();
});
