import { makeTemporaryPassword } from '@omp/shared';

/** A word and four digits, such as river4827, as the server makes them. The server checks it again. */
export function generateReadablePassword(
  random: (n: number) => number = secureRandom,
): string {
  return makeTemporaryPassword(random);
}

function secureRandom(n: number): number {
  const values = new Uint32Array(1);
  let value: number;
  // Rejection sampling keeps every character equally likely.
  do {
    crypto.getRandomValues(values);
    value = values[0] ?? 0;
  } while (value >= Math.floor(0x100000000 / n) * n);
  return value % n;
}
