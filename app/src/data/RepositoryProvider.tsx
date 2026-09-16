import { KNOWN_STUDENTS } from '@omp/shared/fixtures';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useUser } from '../auth/AuthProvider.tsx';
import { createMemoryRepository } from './memory-repository.ts';
import type { Repository } from './repository.ts';

/**
 * The one place that decides which storage the doctor app uses. For now it is the memory
 * repository, holding the known test students so the screens have data; lane 4C switches it to
 * storage on the phone.
 */
export function createAppRepository(userId: string): Repository {
  const at = new Date(0).toISOString();
  return createMemoryRepository({
    doctorId: userId,
    students: KNOWN_STUDENTS.map((student) => ({
      ...student,
      createdAt: at,
      updatedAt: at,
    })),
  });
}

/** Tells listeners after every save, so screens reload their lists. */
export function withChangeNotices(
  repository: Repository,
  notify: () => void,
): Repository {
  const after =
    <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await run(...args);
      notify();
      return result;
    };
  return {
    listStudents: (search) => repository.listStudents(search),
    getStudent: (id) => repository.getStudent(id),
    saveStudent: after((input) => repository.saveStudent(input)),
    loadDraft: () => repository.loadDraft(),
    saveDraft: (draft) => repository.saveDraft(draft),
    discardDraft: after(() => repository.discardDraft()),
    completeSession: after((session) => repository.completeSession(session)),
    listMySessions: (filter) => repository.listMySessions(filter),
    getMySession: (id) => repository.getMySession(id),
    listMyPearls: () => repository.listMyPearls(),
    findPearlForAnswer: (text) => repository.findPearlForAnswer(text),
    savePearl: after((pearl) => repository.savePearl(pearl)),
    deletePearl: after((id) => repository.deletePearl(id)),
    markPearlUsed: after((id) => repository.markPearlUsed(id)),
    subscribeWaitingCount: (listener) =>
      repository.subscribeWaitingCount(listener),
    listNeedsAttention: () => repository.listNeedsAttention(),
  };
}

type RepositoryContextValue = {
  repository: Repository;
  /** Goes up after every save, and after a sync brings changes. */
  version: number;
  notifyChanged: () => void;
};

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({
  children,
  repository,
}: {
  children: ReactNode;
  /** Tests pass their own repository. */
  repository?: Repository;
}) {
  const userId = useUser().id;
  const [version, setVersion] = useState(0);
  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);

  // One repository per logged-in user.
  const wrapped = useMemo(
    () =>
      withChangeNotices(
        repository ?? createAppRepository(userId),
        notifyChanged,
      ),
    [repository, userId, notifyChanged],
  );

  const value = useMemo(
    () => ({ repository: wrapped, version, notifyChanged }),
    [wrapped, version, notifyChanged],
  );
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepositoryContext(): RepositoryContextValue {
  const value = useContext(RepositoryContext);
  if (!value) throw new Error('useRepository needs a RepositoryProvider');
  return value;
}

export function useRepository(): Repository {
  return useRepositoryContext().repository;
}
