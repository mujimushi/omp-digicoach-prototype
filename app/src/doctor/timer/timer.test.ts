import { describe, expect, it } from 'vitest';
import {
  finish,
  formatClock,
  formatTimer,
  goToStep,
  pause,
  readTimer,
  resume,
  shouldPromptResume,
  startTimer,
  toSessionTiming,
} from './timer.ts';

const T0 = 1_758_000_000_000;
const s = (seconds: number) => T0 + seconds * 1000;

describe('startTimer and readTimer', () => {
  it('starts running on Step 1 with 60,000 ms left', () => {
    const state = startTimer(T0);
    expect(state.currentStep).toBe(1);
    expect(readTimer(state, T0)).toMatchObject({
      remainingMs: 60_000,
      activeMs: 0,
      isPaused: false,
      isOvertime: false,
    });
  });

  it('has 18,000 ms left after 42 seconds', () => {
    expect(readTimer(startTimer(T0), s(42)).remainingMs).toBe(18_000);
  });

  it('at exactly 60 seconds: 0 left, not in extra time', () => {
    expect(readTimer(startTimer(T0), s(60))).toMatchObject({
      remainingMs: 0,
      overtimeMs: 0,
      isOvertime: false,
    });
  });

  it('at 61 seconds: 1,000 ms of extra time, still on the same step, not finished', () => {
    const state = startTimer(T0);
    const reading = readTimer(state, s(61));
    expect(reading).toMatchObject({
      remainingMs: -1_000,
      overtimeMs: 1_000,
      isOvertime: true,
    });
    expect(state.currentStep).toBe(1);
    expect(state.finishedAtMs).toBeNull();
  });

  it('never counts time before the start', () => {
    expect(readTimer(startTimer(T0), T0 - 5_000).activeMs).toBe(0);
  });
});

describe('pause and resume', () => {
  it('leaves out 20 seconds of pause from active time and records it', () => {
    let state = startTimer(T0);
    state = pause(state, s(10));
    expect(readTimer(state, s(20))).toMatchObject({
      activeMs: 10_000,
      pausedMs: 10_000,
      isPaused: true,
    });
    state = resume(state, s(30));
    const reading = readTimer(state, s(40));
    expect(reading.activeMs).toBe(20_000);
    expect(reading.pausedMs).toBe(20_000);
    expect(reading.isPaused).toBe(false);
  });

  it('ignores pausing twice and resuming a running timer', () => {
    const running = startTimer(T0);
    expect(resume(running, s(5))).toBe(running);
    const paused = pause(running, s(5));
    expect(pause(paused, s(8))).toBe(paused);
  });

  it('does nothing once finished', () => {
    const done = finish(startTimer(T0), s(30));
    expect(pause(done, s(40))).toBe(done);
    expect(resume(done, s(40))).toBe(done);
    expect(goToStep(done, 2, s(40))).toBe(done);
    expect(finish(done, s(50))).toBe(done);
  });
});

describe('goToStep', () => {
  it('10 s on Step 1, 30 s on Step 2, then 5 s back on Step 1: 15,000 and 30,000 ms', () => {
    let state = startTimer(T0);
    state = goToStep(state, 2, s(10));
    state = goToStep(state, 1, s(40));
    const reading = readTimer(state, s(45));
    expect(reading.stepMs).toEqual([15_000, 30_000, 0, 0, 0]);
    expect(reading.activeMs).toBe(45_000);
  });

  it('keeps a paused timer paused and counts no step time while paused', () => {
    let state = pause(startTimer(T0), s(10));
    state = goToStep(state, 3, s(20));
    expect(state.currentStep).toBe(3);
    expect(readTimer(state, s(50)).stepMs).toEqual([10_000, 0, 0, 0, 0]);
    state = resume(state, s(50));
    expect(readTimer(state, s(55)).stepMs).toEqual([10_000, 0, 5_000, 0, 0]);
  });

  it('does nothing when the step is already current', () => {
    const state = startTimer(T0);
    expect(goToStep(state, 1, s(5))).toBe(state);
  });
});

describe('reopening a saved draft', () => {
  it('saved at 30 s and reopened at 45 s while running: 45 s active', () => {
    const saved = structuredClone(readAndKeep(startTimer(T0), s(30)));
    expect(readTimer(saved, s(45)).activeMs).toBe(45_000);
  });

  it('saved while paused and reopened 10 minutes later: active time unchanged', () => {
    const saved = structuredClone(pause(startTimer(T0), s(25)));
    const reading = readTimer(saved, s(25 + 600));
    expect(reading.activeMs).toBe(25_000);
    expect(reading.pausedMs).toBe(600_000);
  });

  // A draft stores the state as it is; reading never changes it.
  function readAndKeep(state: ReturnType<typeof startTimer>, now: number) {
    readTimer(state, now);
    return state;
  }
});

describe('finish', () => {
  it('stops active time and closes an open pause', () => {
    let state = startTimer(T0);
    state = pause(state, s(40));
    state = finish(state, s(50));
    expect(state).toMatchObject({
      finishedAtMs: s(50),
      runningSinceMs: null,
      pausedSinceMs: null,
    });
    expect(readTimer(state, s(500))).toMatchObject({
      activeMs: 40_000,
      pausedMs: 10_000,
    });
  });
});

describe('toSessionTiming', () => {
  it('90 s of teaching gives 30 s of extra time', () => {
    const state = finish(startTimer(T0), s(90));
    expect(toSessionTiming(state, s(90))).toMatchObject({
      teachingSeconds: 90,
      overtimeSeconds: 30,
    });
  });

  it('25 s from Finish to Save gives logSeconds 25', () => {
    const state = finish(startTimer(T0), s(50));
    expect(toSessionTiming(state, s(75))).toMatchObject({
      teachingSeconds: 50,
      overtimeSeconds: 0,
      logSeconds: 25,
    });
  });

  it('rounds 59.5 s up to 60, and 59.4 s down to 59', () => {
    expect(
      toSessionTiming(finish(startTimer(T0), T0 + 59_500), T0 + 59_500)
        .teachingSeconds,
    ).toBe(60);
    expect(
      toSessionTiming(finish(startTimer(T0), T0 + 59_400), T0 + 59_400)
        .teachingSeconds,
    ).toBe(59);
  });

  it('gives per-step and paused seconds', () => {
    let state = startTimer(T0);
    state = goToStep(state, 2, s(12));
    state = pause(state, s(20));
    state = resume(state, s(27));
    state = goToStep(state, 5, s(30));
    state = finish(state, s(41));
    expect(toSessionTiming(state, s(60))).toEqual({
      teachingSeconds: 34,
      overtimeSeconds: 0,
      pausedSeconds: 7,
      logSeconds: 19,
      stepSeconds: [12, 11, 0, 0, 11],
    });
  });

  it('ends teaching time at the save when the timer was never finished', () => {
    const timing = toSessionTiming(startTimer(T0), s(70));
    expect(timing).toMatchObject({
      teachingSeconds: 70,
      overtimeSeconds: 10,
      logSeconds: 0,
    });
  });

  it('caps every count at six hours, so a session left open for days still saves', () => {
    const timing = toSessionTiming(
      finish(startTimer(T0), s(3 * 86_400)),
      s(4 * 86_400),
    );
    expect(timing.teachingSeconds).toBe(21_600);
    expect(timing.overtimeSeconds).toBe(21_540);
    expect(timing.logSeconds).toBe(21_600);
    expect(timing.stepSeconds[0]).toBe(21_600);
  });
});

describe('shouldPromptResume', () => {
  const FIFTEEN_MINUTES = 15 * 60 * 1000;

  it('is false at 15 minutes minus 1 ms, and at exactly 15 minutes', () => {
    expect(
      shouldPromptResume({ savedAtMs: T0 }, T0 + FIFTEEN_MINUTES - 1),
    ).toBe(false);
    expect(shouldPromptResume({ savedAtMs: T0 }, T0 + FIFTEEN_MINUTES)).toBe(
      false,
    );
  });

  it('is true at 15 minutes plus 1 ms', () => {
    expect(
      shouldPromptResume({ savedAtMs: T0 }, T0 + FIFTEEN_MINUTES + 1),
    ).toBe(true);
  });
});

describe('formatting', () => {
  it('counts down as m:ss, rounding up so 0:00 means the time is spent', () => {
    const state = startTimer(T0);
    expect(formatTimer(readTimer(state, T0))).toBe('1:00');
    expect(formatTimer(readTimer(state, s(18)))).toBe('0:42');
    expect(formatTimer(readTimer(state, T0 + 17_500))).toBe('0:43');
    expect(formatTimer(readTimer(state, s(60)))).toBe('0:00');
  });

  it('shows extra time with a plus sign', () => {
    expect(formatTimer(readTimer(startTimer(T0), s(75)))).toBe('+0:15');
    expect(formatTimer(readTimer(startTimer(T0), s(60 + 125)))).toBe('+2:05');
  });

  it('formats clocks of an hour or more', () => {
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});
