import type { SessionDraft } from '@omp/shared';
import { createFixtures } from '@omp/shared/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRepository } from '../data/memory-repository.ts';
import { renderDoctorApp } from '../test/doctor-app.tsx';
import { newDraft } from './session/draft.ts';
import { finish, goToStep, toSessionTiming } from './timer/timer.ts';

const fixtures = createFixtures(777);
const doctor = fixtures.makeDoctor({ department: 'surgery' });
const otherDoctor = fixtures.makeDoctor();
const ahmed = fixtures.makeStudent({
  name: 'Ahmed Khan',
  pmdcNumber: '12345-P',
  level: 'medical_student',
  year: '3rd',
});
const nadia = fixtures.makeStudent({
  name: 'Nadia Qamar',
  pmdcNumber: null,
  level: 'resident',
  year: null,
});

afterEach(() => {
  vi.useRealTimers();
});

function repositoryWith(
  overrides: Partial<Parameters<typeof createMemoryRepository>[0]> = {},
) {
  return createMemoryRepository({
    doctorId: doctor.id,
    students: [ahmed, nadia],
    ...overrides,
  });
}

function draftAt(
  now: number,
  change: (draft: SessionDraft) => SessionDraft = (d) => d,
): SessionDraft {
  return change(
    newDraft({
      id: fixtures.uuid(),
      student: ahmed,
      department: 'surgery',
      caseType: 'long_case',
      now,
    }),
  );
}

describe('student form', () => {
  it('requires a name and saves nothing without one', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    renderDoctorApp({ path: '/students/new', repository, user: doctor });

    await user.click(
      await screen.findByRole('button', { name: 'Medical Student' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add student' }));

    expect(
      await screen.findByText('Enter the student’s name.'),
    ).toBeInTheDocument();
    expect(repository.outbox).toHaveLength(0);
  });

  it('shows year chips only for medical students', async () => {
    const user = userEvent.setup();
    renderDoctorApp({
      path: '/students/new',
      repository: repositoryWith(),
      user: doctor,
    });

    await user.click(
      await screen.findByRole('button', { name: 'Medical Student' }),
    );
    expect(screen.getByRole('group', { name: 'Year' })).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'House Officer (HO)' }),
    );
    expect(
      screen.queryByRole('group', { name: 'Year' }),
    ).not.toBeInTheDocument();
  });

  it('warns when the name matches an existing student', async () => {
    const user = userEvent.setup();
    renderDoctorApp({
      path: '/students/new',
      repository: repositoryWith(),
      user: doctor,
    });

    await user.type(await screen.findByLabelText('Name'), '  ahmed   KHAN');

    expect(
      await screen.findByText(/Is this Ahmed Khan, PMDC 12345-P\?/),
    ).toBeInTheDocument();
  });

  it('saves a new student and shows them in the list', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    const { router } = renderDoctorApp({
      path: '/students/new',
      repository,
      user: doctor,
    });

    await user.type(await screen.findByLabelText('Name'), 'Maryam Butt');
    await user.type(screen.getByLabelText('PMDC number (optional)'), '55555-p');
    await user.click(screen.getByRole('button', { name: 'Medical Student' }));
    await user.click(screen.getByRole('button', { name: 'Final Year' }));
    await user.click(screen.getByRole('button', { name: 'Add student' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const list = await screen.findByRole('list', { name: 'Students' });
    expect(
      await within(list).findByRole('button', { name: 'Teach Maryam Butt' }),
    ).toBeInTheDocument();
    expect(repository.outbox).toMatchObject([
      {
        type: 'student.upsert',
        payload: {
          name: 'Maryam Butt',
          pmdcNumber: '55555-P',
          level: 'medical_student',
          year: 'final',
        },
      },
    ]);
  });

  it('corrects an existing student', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    renderDoctorApp({
      path: `/students/${nadia.id}/edit`,
      repository,
      user: doctor,
    });

    const name = await screen.findByLabelText('Name');
    await waitFor(() => expect(name).toHaveValue('Nadia Qamar'));
    await user.clear(name);
    await user.type(name, 'Nadia Qamar Ali');
    await user.click(screen.getByRole('button', { name: 'Save correction' }));

    await waitFor(() => expect(repository.outbox).toHaveLength(1));
    expect(await repository.getStudent(nadia.id)).toMatchObject({
      name: 'Nadia Qamar Ali',
    });
  });
});

describe('session step rating', () => {
  it('tapping the third star shows Competent and marks it pressed; tapping again clears it', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    await repository.saveDraft(draftAt(Date.now()));
    renderDoctorApp({ path: '/session', repository, user: doctor });

    const star = await screen.findByRole('button', {
      name: '3 stars, Competent',
    });
    await user.click(star);
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Competent')).toBeInTheDocument();

    await user.click(star);
    expect(star).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Not rated')).toBeInTheDocument();
  });

  it('shows one star control per step, not one per prompt', async () => {
    const repository = repositoryWith();
    await repository.saveDraft(draftAt(Date.now()));
    renderDoctorApp({ path: '/session', repository, user: doctor });
    expect(
      await screen.findAllByRole('group', { name: /Rate Step/ }),
    ).toHaveLength(1);
  });

  it('has no rating on step 5, Correct & Improve, but keeps its comments', async () => {
    const repository = repositoryWith();
    const now = Date.now();
    await repository.saveDraft(
      draftAt(now, (d) => ({
        ...d,
        timer: [2, 3, 4, 5].reduce(
          (timer, step) => goToStep(timer, step as 2 | 3 | 4 | 5, now),
          d.timer,
        ),
      })),
    );
    renderDoctorApp({ path: '/session', repository, user: doctor });
    expect(
      await screen.findByRole('heading', { name: 'Step 5 of 5' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Action plan')).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /Rate Step/ }),
    ).not.toBeInTheDocument();
  });

  it('has no rating on step 3, Teach General Rule, but keeps its teaching points', async () => {
    const repository = repositoryWith();
    const now = Date.now();
    await repository.saveDraft(
      draftAt(now, (d) => ({
        ...d,
        timer: goToStep(goToStep(d.timer, 2, now), 3, now),
      })),
    );
    renderDoctorApp({ path: '/session', repository, user: doctor });
    expect(
      await screen.findByRole('heading', { name: 'Step 3 of 5' }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('One important thing to remember is'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /Rate Step/ }),
    ).not.toBeInTheDocument();
  });
});

describe('pearl banner on Step 3', () => {
  const pearl = fixtures.makePearl({
    diagnosis: 'Pneumonia',
    points: [
      'CURB-65 guides admission',
      'hypoxia',
      'oxygen saturation',
      'Amoxicillin',
      'Sepsis',
    ],
    timesUsed: 0,
  });

  async function openStep3() {
    const repository = repositoryWith({
      pearls: [{ doctorId: doctor.id, pearl }],
    });
    const now = Date.now();
    await repository.saveDraft(
      draftAt(now, (d) => ({
        ...d,
        step1: { learnerAnswer: 'community acquired pneumonia' },
        timer: goToStep(goToStep(d.timer, 2, now), 3, now),
      })),
    );
    return repository;
  }

  it('offers the saved pearl, and Use fills all five points', async () => {
    const user = userEvent.setup();
    const repository = await openStep3();
    renderDoctorApp({ path: '/session', repository, user: doctor });

    const banner = await screen.findByTestId('pearl-banner');
    expect(banner).toHaveTextContent('Saved pearl for “Pneumonia”');
    await user.click(
      within(banner).getByRole('button', { name: 'Use saved pearl' }),
    );

    expect(
      screen.getByLabelText('One important thing to remember is'),
    ).toHaveValue('CURB-65 guides admission');
    expect(screen.getByLabelText('In patients with')).toHaveValue('hypoxia');
    expect(screen.getByLabelText('always check')).toHaveValue(
      'oxygen saturation',
    );
    expect(
      screen.getByLabelText('First-line treatment is usually'),
    ).toHaveValue('Amoxicillin');
    expect(screen.getByLabelText('Red flag')).toHaveValue('Sepsis');
    await waitFor(() =>
      expect(repository.outbox.map((i) => i.type)).toContain('pearl.use'),
    );
    expect(screen.queryByTestId('pearl-banner')).not.toBeInTheDocument();
  });

  it('Save as teaching pearl calls savePearl with the answer as the diagnosis', async () => {
    const user = userEvent.setup();
    const repository = await openStep3();
    const savePearl = vi.spyOn(repository, 'savePearl');
    renderDoctorApp({ path: '/session', repository, user: doctor });

    await user.type(await screen.findByLabelText('Red flag'), 'Confusion');
    await user.click(
      screen.getByRole('button', { name: 'Save as teaching pearl' }),
    );

    await waitFor(() => expect(savePearl).toHaveBeenCalledTimes(1));
    expect(savePearl.mock.calls[0]?.[0]).toMatchObject({
      diagnosis: 'community acquired pneumonia',
      points: ['', '', '', '', 'Confusion'],
    });
    expect(
      await screen.findByRole('button', { name: 'Pearl saved' }),
    ).toBeDisabled();
  });
});

describe('quick log', () => {
  async function atLog() {
    const repository = repositoryWith();
    const start = Date.UTC(2026, 8, 17, 4, 0, 0);
    const draft = draftAt(start, (d) => ({
      ...d,
      ratings: [3, 4, null, 5, 2],
      stage: 'log',
      timer: finish(d.timer, start + 90_000),
    }));
    await repository.saveDraft(draft);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start + 115_000);
    return { repository, draft };
  }

  it('Save calls completeSession with the timings from toSessionTiming and the log', async () => {
    const user = userEvent.setup();
    const { repository, draft } = await atLog();
    const complete = vi.spyOn(repository, 'completeSession');
    const { router } = renderDoctorApp({
      path: '/session/log',
      repository,
      user: doctor,
    });

    expect(await screen.findByTestId('log-times')).toHaveTextContent(
      'Teaching time 1m 30s · Extra time 30s',
    );
    await user.type(screen.getByLabelText('Diagnosis'), 'Pneumonia');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Usefulness 5' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    const session = complete.mock.calls[0]?.[0];
    const timing = toSessionTiming(
      draft.timer,
      draft.timer.startedAtMs + 115_000,
    );
    expect(session).toMatchObject({
      teachingSeconds: timing.teachingSeconds,
      overtimeSeconds: 30,
      pausedSeconds: timing.pausedSeconds,
      logSeconds: 25,
      diagnosis: 'Pneumonia',
      learnerGaveDiagnosis: true,
      usefulness: 5,
    });
    expect(session?.steps.map((s) => s.rating)).toEqual([3, 4, null, 5, 2]);
    expect(session?.steps.map((s) => s.seconds)).toEqual(timing.stepSeconds);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('Session saved')).toBeInTheDocument();
    expect(await repository.loadDraft()).toBeUndefined();
  });

  it('a draft save still waiting when Save is tapped doesn’t bring the draft back', async () => {
    const user = userEvent.setup();
    const { repository } = await atLog();
    // A slow phone: the session is stored, but the answer arrives after the 300 ms draft save.
    const store = repository.completeSession.bind(repository);
    vi.spyOn(repository, 'completeSession').mockImplementation(
      async (session) => {
        await store(session);
        await new Promise((resolve) => setTimeout(resolve, 500));
      },
    );
    const { router } = renderDoctorApp({
      path: '/session/log',
      repository,
      user: doctor,
    });

    await user.type(await screen.findByLabelText('Diagnosis'), 'Pneumonia');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await repository.loadDraft()).toBeUndefined();
  });

  it('Skip saves the session without the log fields', async () => {
    const user = userEvent.setup();
    const { repository } = await atLog();
    const complete = vi.spyOn(repository, 'completeSession');
    renderDoctorApp({ path: '/session/log', repository, user: doctor });

    await user.type(
      await screen.findByLabelText('Diagnosis'),
      'Typed then skipped',
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(complete.mock.calls[0]?.[0]).toMatchObject({
      diagnosis: null,
      learnerGaveDiagnosis: null,
      usefulness: null,
      teachingSeconds: 90,
      logSeconds: 25,
    });
  });

  it('shows no confirmation when the save fails', async () => {
    const user = userEvent.setup();
    const { repository } = await atLog();
    vi.spyOn(repository, 'completeSession').mockRejectedValue(
      new Error('disk full'),
    );
    renderDoctorApp({ path: '/session/log', repository, user: doctor });

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The session was not saved',
    );
    expect(screen.queryByText('Session saved')).not.toBeInTheDocument();
  });
});

describe('resume prompt', () => {
  it('asks first about a draft saved 20 minutes ago, and Discard calls discardDraft', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    const now = Date.now();
    await repository.saveDraft(draftAt(now - 25 * 60_000));
    // saveDraft keeps savedAtMs as given.
    const saved = await repository.loadDraft();
    if (!saved) throw new Error('no draft');
    await repository.saveDraft({ ...saved, savedAtMs: now - 20 * 60_000 });
    const discard = vi.spyOn(repository, 'discardDraft');

    renderDoctorApp({ path: '/', repository, user: doctor });

    const dialog = await screen.findByRole('alertdialog', {
      name: /Resume the session with Ahmed Khan from \d\d:\d\d\?/,
    });
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(discard).toHaveBeenCalledTimes(1));
    expect(await repository.loadDraft()).toBeUndefined();
  });

  it('resumes a recent draft straight away', async () => {
    const repository = repositoryWith();
    await repository.saveDraft(draftAt(Date.now()));
    const { router } = renderDoctorApp({ path: '/', repository, user: doctor });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/session'),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByTestId('timer-ring')).toBeInTheDocument();
  });

  it('does not discard on Escape', async () => {
    const user = userEvent.setup();
    const repository = repositoryWith();
    const draft = draftAt(Date.now());
    await repository.saveDraft({
      ...draft,
      savedAtMs: Date.now() - 16 * 60_000,
    });
    renderDoctorApp({ path: '/', repository, user: doctor });

    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    expect(await repository.loadDraft()).toBeDefined();
  });
});

describe('student progress', () => {
  it('shows only the logged-in doctor’s students and sessions', async () => {
    const mine = fixtures.makeSession({
      studentId: ahmed.id,
      learnerLevel: 'medical_student',
      learnerYear: '3rd',
      diagnosis: 'Mine',
    });
    const theirs = fixtures.makeSession({
      studentId: nadia.id,
      learnerLevel: 'resident',
      learnerYear: null,
      diagnosis: 'Theirs',
    });
    const theirsWithAhmed = fixtures.makeSession({
      studentId: ahmed.id,
      learnerLevel: 'medical_student',
      learnerYear: '3rd',
      diagnosis: 'Also theirs',
    });
    const repository = repositoryWith({
      sessions: [
        { doctorId: doctor.id, session: mine },
        { doctorId: otherDoctor.id, session: theirs },
        { doctorId: otherDoctor.id, session: theirsWithAhmed },
      ],
    });

    renderDoctorApp({ path: '/progress', repository, user: doctor });
    expect(
      await screen.findByRole('link', { name: /Ahmed Khan/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Nadia Qamar/)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: /Ahmed Khan/ }));
    expect(
      await screen.findByRole('table', { name: 'Ratings per step over time' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Also theirs')).not.toBeInTheDocument();
  });
});

describe('logging out', () => {
  it('asks first when items are waiting, and logs out only after confirming', async () => {
    const { getPhoneDb } = await import('../offline/db.ts');
    await getPhoneDb().outbox.clear();
    await getPhoneDb().outbox.add({
      opId: fixtures.uuid(),
      type: 'student.upsert',
      payload: {},
      attempts: 0,
      createdAt: new Date().toISOString(),
      summary: 'Student X',
    });
    const user = userEvent.setup();
    const { auth } = renderDoctorApp({
      path: '/more',
      repository: repositoryWith(),
      user: doctor,
    });

    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: '1 item hasn’t been sent',
    });
    expect(auth.logout).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', { name: 'Log out and delete them' }),
    );
    expect(auth.logout).toHaveBeenCalledTimes(1);
    await getPhoneDb().outbox.clear();
  });

  it('logs out straight away when nothing is waiting', async () => {
    const { getPhoneDb } = await import('../offline/db.ts');
    await getPhoneDb().outbox.clear();
    const user = userEvent.setup();
    const { auth } = renderDoctorApp({
      path: '/more',
      repository: repositoryWith(),
      user: doctor,
    });
    // Wait for the waiting count to load as 0.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
