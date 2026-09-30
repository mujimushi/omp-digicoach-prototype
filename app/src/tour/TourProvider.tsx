import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth, useUser } from '../auth/AuthProvider.tsx';
import type { Repository } from '../data/repository.ts';
import { CoachMarks } from './CoachMarks.tsx';
import { createPracticeRepository } from './practice-repository.ts';
import { ReadyCard } from './ReadyCard.tsx';
import { markTourDone, shouldOpenTour } from './tour-done.ts';
import {
  TourContext,
  type TourContextValue,
  type TourStage,
} from './useTour.ts';
import { WelcomeCards } from './WelcomeCards.tsx';

export type TourStore = {
  shouldOpen: (tourCompletedAt: string | null | undefined) => Promise<boolean>;
  /** Records on the server that the tour is done. Rejects when the server can't be reached. */
  markDone: () => Promise<void>;
};

const server: TourStore = {
  shouldOpen: async (tourCompletedAt) => shouldOpenTour(tourCompletedAt),
  markDone: () => markTourDone(),
};

/**
 * The app tour: welcome cards, then a practice session on throwaway storage, then a closing card.
 * Opens by itself for a doctor who hasn't seen it, and from More at any time.
 */
export function TourProvider({
  children,
  store = server,
}: {
  children: ReactNode;
  /** Tests pass their own. */
  store?: TourStore;
}) {
  const user = useUser();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stage, setStage] = useState<TourStage>('off');
  const [practiceRepository, setPracticeRepository] =
    useState<Repository | null>(null);

  // Once per login. Never over a real session in progress.
  // biome-ignore lint/correctness/useExhaustiveDependencies: checks once for each user
  useEffect(() => {
    if (pathname.startsWith('/session')) return;
    let current = true;
    void store.shouldOpen(user.tourCompletedAt).then((open) => {
      if (current && open)
        setStage((previous) => (previous === 'off' ? 'welcome' : previous));
    });
    return () => {
      current = false;
    };
  }, [user.id]);

  const startTour = useCallback(() => setStage('welcome'), []);

  const startPractice = useCallback(() => {
    const practice = createPracticeRepository();
    setPracticeRepository({
      ...practice,
      completeSession: async (session) => {
        await practice.completeSession(session);
        setStage('ready');
      },
    });
    setStage('practice');
    navigate('/', { replace: true });
  }, [navigate]);

  const endTour = useCallback(() => {
    const leavingPractice = practiceRepository !== null;
    setStage('off');
    setPracticeRepository(null);
    // Reload the user, so the copy kept for opening without signal also says the tour is done.
    void store.markDone().then(refresh, () => undefined);
    if (leavingPractice) navigate('/', { replace: true });
  }, [practiceRepository, store, refresh, navigate]);

  const value = useMemo<TourContextValue>(
    () => ({
      available: true,
      stage,
      practice: practiceRepository !== null,
      practiceRepository,
      startTour,
      startPractice,
      endTour,
    }),
    [stage, practiceRepository, startTour, startPractice, endTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {stage === 'welcome' && (
        <WelcomeCards onSkip={endTour} onStartPractice={startPractice} />
      )}
      {stage === 'practice' && <CoachMarks />}
      {stage === 'ready' && <ReadyCard onClose={endTour} />}
    </TourContext.Provider>
  );
}
