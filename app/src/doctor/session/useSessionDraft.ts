import type { SessionDraft } from '@omp/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepository } from '../../data/RepositoryProvider.tsx';

export const DRAFT_DEBOUNCE_MS = 300;
export const DRAFT_INTERVAL_MS = 5000;

/**
 * The session in progress, loaded from the phone. Every change is saved 300 ms later, and the draft
 * is saved every 5 seconds and whenever the page is hidden, so closing the app loses nothing.
 */
export function useSessionDraft() {
  const repository = useRepository();
  // undefined while loading; null when there is no draft.
  const [draft, setDraft] = useState<SessionDraft | null | undefined>(
    undefined,
  );
  const latest = useRef<SessionDraft | null | undefined>(undefined);
  latest.current = draft;

  useEffect(() => {
    let current = true;
    repository.loadDraft().then((loaded) => {
      if (current) setDraft(loaded ?? null);
    });
    return () => {
      current = false;
    };
  }, [repository]);

  const saveNow = useCallback(
    async (next?: SessionDraft) => {
      const toSave = next ?? latest.current;
      if (!toSave) return;
      await repository.saveDraft({ ...toSave, savedAtMs: Date.now() });
    },
    [repository],
  );

  // Debounced save after each change.
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => void saveNow(draft), DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, saveNow]);

  // Regular saves, and a save when the phone hides the page.
  const hasDraft = draft !== null && draft !== undefined;
  useEffect(() => {
    if (!hasDraft) return;
    const interval = setInterval(() => void saveNow(), DRAFT_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [hasDraft, saveNow]);

  const update = useCallback(
    (change: (previous: SessionDraft) => SessionDraft) => {
      setDraft((previous) => (previous ? change(previous) : previous));
    },
    [],
  );

  return { draft, update, saveNow, setDraft };
}
