import { type DependencyList, useEffect, useState } from 'react';
import { useRepositoryContext } from '../data/RepositoryProvider.tsx';
import type { Repository } from '../data/repository.ts';

export type QueryState<T> =
  | { status: 'loading'; data: T | undefined }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: T | undefined; error: unknown };

/** Loads from the repository, and loads again after any save. */
export function useRepositoryQuery<T>(
  load: (repository: Repository) => Promise<T>,
  deps: DependencyList,
): QueryState<T> {
  const { repository, version } = useRepositoryContext();
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
  });

  // `load` is a new function on every render; `deps` says when its result can change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller lists the dependencies
  useEffect(() => {
    let current = true;
    load(repository).then(
      (data) => {
        if (current) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (current)
          setState((previous) => ({
            status: 'error',
            data: previous.data,
            error,
          }));
      },
    );
    return () => {
      current = false;
    };
  }, [repository, version, ...deps]);

  return state;
}
