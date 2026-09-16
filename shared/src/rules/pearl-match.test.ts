import { describe, expect, it } from 'vitest';
import { findPearlForAnswer, pearlMatchesAnswer } from './pearl-match.ts';

describe('pearlMatchesAnswer', () => {
  it.each([
    ['pneumonia'],
    ['Pneumonia'],
    ['  PNEUMONIA  '],
    ['community acquired pneumonia'],
    ['pneumonia, likely bacterial'],
    ['pneu'],
  ])('matches %j to a "Pneumonia" pearl', (answer) => {
    expect(pearlMatchesAnswer('Pneumonia', answer)).toBe(true);
  });

  it.each([
    ['a'],
    ['pne'],
    [''],
    ['   '],
    ['bronchopneumonia'],
    ['pneumonitis'],
  ])('does not match %j', (answer) => {
    expect(pearlMatchesAnswer('Pneumonia', answer)).toBe(false);
  });

  it('matches a diagnosis of several words as whole words', () => {
    expect(
      pearlMatchesAnswer('Acute asthma', 'probably acute  asthma attack'),
    ).toBe(true);
    expect(pearlMatchesAnswer('Acute asthma', 'subacute asthma')).toBe(false);
  });

  it('treats special characters in a diagnosis literally', () => {
    expect(pearlMatchesAnswer('C. diff (colitis)', 'c. diff (colitis)')).toBe(
      true,
    );
    expect(pearlMatchesAnswer('C. diff (colitis)', 'cx diff colitis')).toBe(
      false,
    );
  });
});

describe('findPearlForAnswer', () => {
  const pearls = [
    { id: '1', diagnosis: 'Pneumonia', deleted: false },
    { id: '2', diagnosis: 'Community acquired pneumonia', deleted: false },
    { id: '3', diagnosis: 'Asthma', deleted: true },
  ];

  it('picks the longest matching diagnosis', () => {
    expect(findPearlForAnswer(pearls, 'community acquired pneumonia')?.id).toBe(
      '2',
    );
    expect(findPearlForAnswer(pearls, 'pneumonia')?.id).toBe('1');
  });

  it('ignores deleted pearls', () => {
    expect(findPearlForAnswer(pearls, 'asthma')).toBeUndefined();
  });

  it('finds nothing for a one-letter answer', () => {
    expect(findPearlForAnswer(pearls, 'a')).toBeUndefined();
  });
});
