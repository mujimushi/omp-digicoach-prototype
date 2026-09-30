import { createFixtures } from '@omp/shared/fixtures';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryRepository } from '../data/memory-repository.ts';
import { renderDoctorApp } from '../test/doctor-app.tsx';
import {
  createPracticeRepository,
  PRACTICE_STUDENT_NAME,
} from './practice-repository.ts';
import type { TourStore } from './TourProvider.tsx';
import { shouldOpenTour } from './tour-done.ts';

const fixtures = createFixtures(909);
const newDoctor = fixtures.makeDoctor({ tourCompletedAt: null });
const seenDoctor = fixtures.makeDoctor({
  tourCompletedAt: '2026-09-01T08:00:00.000Z',
});
const ahmed = fixtures.makeStudent({ name: 'Ahmed Khan' });

function fakeStore(): TourStore & { markDone: ReturnType<typeof vi.fn> } {
  return {
    shouldOpen: async (tourCompletedAt) => tourCompletedAt === null,
    markDone: vi.fn(async () => undefined),
  };
}

function realRepository(doctorId: string) {
  return createMemoryRepository({ doctorId, students: [ahmed] });
}

describe('practice repository', () => {
  it('holds the practice learner, keeps a session in memory and reports nothing waiting', async () => {
    const repository = createPracticeRepository();
    const [learner] = await repository.listStudents();
    expect(learner?.name).toBe(PRACTICE_STUDENT_NAME);

    const counts: number[] = [];
    repository.subscribeWaitingCount((count) => counts.push(count));
    const session = fixtures.makeSession({ studentId: learner?.id ?? '' });
    await repository.completeSession(session);

    expect(await repository.listMySessions()).toEqual([session]);
    expect(counts).toEqual([0]);
    expect(await repository.listNeedsAttention()).toEqual([]);
  });
});

describe('when the tour opens', () => {
  it('opens for a doctor who hasn’t seen it', async () => {
    renderDoctorApp({
      path: '/',
      repository: realRepository(newDoctor.id),
      user: newDoctor,
      tour: fakeStore(),
    });
    expect(
      await screen.findByRole('dialog', { name: 'Welcome to OMP DigiCoach' }),
    ).toBeInTheDocument();
  });

  it('stays closed for a doctor who has seen it', async () => {
    renderDoctorApp({
      path: '/',
      repository: realRepository(seenDoctor.id),
      user: seenDoctor,
      tour: fakeStore(),
    });
    await screen.findByRole('button', { name: 'Teach Ahmed Khan' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('follows only the server’s record: null opens, a time or an old cached user never does', () => {
    expect(shouldOpenTour(null)).toBe(true);
    expect(shouldOpenTour('2026-09-01T08:00:00.000Z')).toBe(false);
    expect(shouldOpenTour(undefined)).toBe(false);
  });
});

describe('welcome cards', () => {
  it('Skip closes the tour, tells the server once, then reloads the user', async () => {
    const user = userEvent.setup();
    const store = fakeStore();
    const { auth } = renderDoctorApp({
      path: '/',
      repository: realRepository(newDoctor.id),
      user: newDoctor,
      tour: store,
    });
    await screen.findByRole('dialog', { name: 'Welcome to OMP DigiCoach' });
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.markDone).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(auth.refresh).toHaveBeenCalledTimes(1));
  });

  it('keeps every card to a title and one short line', async () => {
    const user = userEvent.setup();
    renderDoctorApp({
      path: '/',
      repository: realRepository(newDoctor.id),
      user: newDoctor,
      tour: fakeStore(),
    });
    const titles = [
      'Welcome to OMP DigiCoach',
      'Five steps, one minute',
      'Works without signal',
      'Try a practice session',
    ];
    for (const [i, title] of titles.entries()) {
      expect(
        await screen.findByRole('dialog', { name: title }),
      ).toBeInTheDocument();
      if (i < titles.length - 1)
        await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('Nothing you enter is saved.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start practice' }),
    ).toBeInTheDocument();
  });

  it('opens again from More', async () => {
    const user = userEvent.setup();
    renderDoctorApp({
      path: '/more',
      repository: realRepository(seenDoctor.id),
      user: seenDoctor,
      tour: fakeStore(),
    });
    await user.click(await screen.findByRole('button', { name: /App tour/ }));
    expect(
      await screen.findByRole('dialog', { name: 'Welcome to OMP DigiCoach' }),
    ).toBeInTheDocument();
  });

  it('More has no tour entry outside the doctor layout', async () => {
    renderDoctorApp({
      path: '/more',
      repository: realRepository(seenDoctor.id),
      user: seenDoctor,
    });
    await screen.findByRole('link', { name: /About OMP/ });
    expect(
      screen.queryByRole('button', { name: /App tour/ }),
    ).not.toBeInTheDocument();
  });
});

describe('practice session', () => {
  it('guides a whole session, saves nothing real, and ends with You’re ready', async () => {
    const user = userEvent.setup();
    const store = fakeStore();
    const repository = realRepository(newDoctor.id);
    renderDoctorApp({
      path: '/',
      repository,
      user: newDoctor,
      tour: store,
    });

    await screen.findByRole('dialog', { name: 'Welcome to OMP DigiCoach' });
    for (let i = 0; i < 3; i += 1)
      await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start practice' }));

    expect(
      await screen.findByText('Practice · nothing is saved'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Tap the learner to begin.'),
    ).toBeInTheDocument();
    // Only the practice learner: real students are out of reach.
    expect(
      screen.queryByRole('button', { name: 'Teach Ahmed Khan' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: `Teach ${PRACTICE_STUDENT_NAME}` }),
    );

    expect(
      await screen.findByText('Choose the case type.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Long Case' }));
    expect(
      await screen.findByText('Start the one-minute timer.'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Start teaching session/ }),
    );

    expect(
      await screen.findByText('One minute for all five steps. Tap to pause.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(
      await screen.findByText('Rate the learner on this step.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(
      await screen.findByText('Go through the five steps.'),
    ).toBeInTheDocument();
    for (let step = 1; step < 5; step += 1)
      await user.click(screen.getByRole('button', { name: 'Next step' }));

    expect(
      await screen.findByText('Finish when you’re done.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(
      await screen.findByText('Add a note if you like, then save.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('dialog', { name: 'You’re ready' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Session saved')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start teaching' }));

    await waitFor(() =>
      expect(
        screen.queryByText('Practice · nothing is saved'),
      ).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole('button', { name: 'Teach Ahmed Khan' }),
    ).toBeInTheDocument();
    expect(store.markDone).toHaveBeenCalledTimes(1);
    expect(repository.outbox).toHaveLength(0);
    expect(await repository.listMySessions()).toHaveLength(0);
    expect(await repository.loadDraft()).toBeUndefined();
  });

  it('Exit practice leaves at once and remembers the tour', async () => {
    const user = userEvent.setup();
    const store = fakeStore();
    renderDoctorApp({
      path: '/',
      repository: realRepository(newDoctor.id),
      user: newDoctor,
      tour: store,
    });
    await screen.findByRole('dialog', { name: 'Welcome to OMP DigiCoach' });
    for (let i = 0; i < 3; i += 1)
      await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start practice' }));
    await user.click(
      await screen.findByRole('button', { name: 'Exit practice' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Teach Ahmed Khan' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tap the learner to begin.')).toBeNull();
    expect(store.markDone).toHaveBeenCalledTimes(1);
  });
});
