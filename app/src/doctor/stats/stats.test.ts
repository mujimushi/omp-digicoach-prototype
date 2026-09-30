import { createFixtures } from '@omp/shared/fixtures';
import { describe, expect, it } from 'vitest';
import { computeStats } from './stats.ts';

const fixtures = createFixtures(606);

describe('computeStats', () => {
  it('leaves steps that are no longer rated out of the averages and the all-rated share', () => {
    const now = new Date('2026-09-30T08:00:00Z');
    // An older session rated every step, including steps 3 and 5; a newer one left them empty.
    const older = fixtures.makeSession({ ratings: [2, 2, 5, 2, 2] });
    const newer = fixtures.makeSession({ ratings: [4, 4, null, 4, null] });
    const stats = computeStats([older, newer], now);

    expect(stats.avgRatingPerStep[0]).toBe(3);
    expect(stats.avgRatingPerStep[2]).toBeNull();
    expect(stats.avgRatingPerStep[4]).toBeNull();
    expect(stats.allStepsRatedShare).toBe(1);
  });
});
