import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useUser } from '../auth/AuthProvider.tsx';
import { createMemoryRepository } from './memory-repository.ts';
import type { Repository } from './repository.ts';

/**
 * The one place that decides which storage the doctor app uses. For now it is the memory
 * repository; lane 4C switches it to storage on the phone.
 */
export function createAppRepository(userId: string): Repository {
  return createMemoryRepository({ doctorId: userId });
}

const RepositoryContext = createContext<Repository | null>(null);

export function RepositoryProvider({
  children,
  repository,
}: {
  children: ReactNode;
  /** Tests pass their own repository. */
  repository?: Repository;
}) {
  const userId = useUser().id;
  // One repository per logged-in user.
  const value = useMemo(
    () => repository ?? createAppRepository(userId),
    [repository, userId],
  );
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): Repository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('useRepository needs a RepositoryProvider');
  return repository;
}
