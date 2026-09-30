/** A hint on the practice session, pointing at the element marked `data-tour="<id>"`. */
export type Hint = {
  id: string;
  text: string;
  /** `tap`: done when the doctor taps the target. `ack`: also has a "Got it" button. */
  doneBy: 'tap' | 'ack';
};

/**
 * In order. The tour shows the first hint not yet done whose target is on screen, so a doctor who
 * moves ahead skips the hints behind them.
 */
export const HINTS: readonly Hint[] = [
  { id: 'student', text: 'Tap the learner to begin.', doneBy: 'tap' },
  { id: 'case-type', text: 'Choose the case type.', doneBy: 'tap' },
  { id: 'start', text: 'Start the one-minute timer.', doneBy: 'tap' },
  {
    id: 'timer',
    text: 'One minute for all five steps. Tap to pause.',
    doneBy: 'ack',
  },
  { id: 'rating', text: 'Rate the learner on this step.', doneBy: 'ack' },
  { id: 'next', text: 'Go through the five steps.', doneBy: 'tap' },
  { id: 'finish', text: 'Finish when you’re done.', doneBy: 'tap' },
  {
    id: 'log-save',
    text: 'Add a note if you like, then save.',
    doneBy: 'tap',
  },
];
