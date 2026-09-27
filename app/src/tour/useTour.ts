import { createContext, useContext } from 'react';
import type { Repository } from '../data/repository.ts';

/** `welcome` shows the cards, `practice` the practice session, `ready` the closing card. */
export type TourStage = 'off' | 'welcome' | 'practice' | 'ready';

export type TourContextValue = {
  /** False outside the doctor layout, as in component tests: More then hides "App tour". */
  available: boolean;
  stage: TourStage;
  /** True during the practice session, when nothing is saved. */
  practice: boolean;
  /** The practice storage, which replaces the phone's while `practice` is true. */
  practiceRepository: Repository | null;
  startTour: () => void;
  startPractice: () => void;
  /** Closes the tour at any point and remembers it was seen. */
  endTour: () => void;
};

const noop = () => undefined;

export const TourContext = createContext<TourContextValue>({
  available: false,
  stage: 'off',
  practice: false,
  practiceRepository: null,
  startTour: noop,
  startPractice: noop,
  endTour: noop,
});

export function useTour(): TourContextValue {
  return useContext(TourContext);
}
