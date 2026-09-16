/** The fields the matching rule reads. */
export type MatchablePearl = {
  id: string;
  diagnosis: string;
  deleted: boolean;
};

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LETTER = /\p{L}/gu;

/**
 * Does the learner's answer match this pearl's diagnosis?
 *
 * Both texts are trimmed and compared ignoring case. A pearl matches when the answer contains its
 * diagnosis as whole words, or when the diagnosis starts with the answer and the answer has at
 * least four letters.
 */
export function pearlMatchesAnswer(diagnosis: string, answer: string): boolean {
  const dx = normalise(diagnosis);
  const text = normalise(answer);
  if (dx === '' || text === '') return false;

  const wholeWords = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(dx)}([^\\p{L}\\p{N}]|$)`,
    'u',
  );
  if (wholeWords.test(text)) return true;

  const letters = text.match(LETTER)?.length ?? 0;
  return letters >= 4 && dx.startsWith(text);
}

/** The matching pearl with the longest diagnosis, ignoring deleted pearls. */
export function findPearlForAnswer<T extends MatchablePearl>(
  pearls: readonly T[],
  answer: string,
): T | undefined {
  let best: T | undefined;
  for (const pearl of pearls) {
    if (pearl.deleted || !pearlMatchesAnswer(pearl.diagnosis, answer)) continue;
    if (
      best === undefined ||
      normalise(pearl.diagnosis).length > normalise(best.diagnosis).length ||
      (normalise(pearl.diagnosis).length === normalise(best.diagnosis).length &&
        pearl.id < best.id)
    ) {
      best = pearl;
    }
  }
  return best;
}
