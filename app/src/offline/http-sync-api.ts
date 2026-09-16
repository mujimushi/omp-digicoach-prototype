import { PullResponse, PushResponse } from '@omp/shared';
import { apiGet, apiSend } from '../api/client.ts';
import type { SyncApi } from './sync.ts';

/** The sync routes over HTTP. A 401 never redirects: sync keeps the doctor where they are. */
export const httpSyncApi: SyncApi = {
  push: (items) =>
    apiSend('POST', '/api/sync/push', { items }, PushResponse, {
      redirectOnUnauthorized: false,
    }),
  pull: (cursor) =>
    apiGet(
      `/api/sync/pull?cursor=${encodeURIComponent(cursor)}`,
      PullResponse,
      {
        redirectOnUnauthorized: false,
      },
    ),
};
