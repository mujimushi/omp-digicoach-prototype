/** Lower-case letters and digits without look-alikes, as the server's generator uses. */
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Four groups of four readable characters, such as k7mq-3xrp-9dwt-2hvf. The server checks it again. */
export function generateReadablePassword(
  random: (n: number) => number = secureRandom,
): string {
  const group = () =>
    Array.from({ length: 4 }, () => READABLE[random(READABLE.length)]).join('');
  return [group(), group(), group(), group()].join('-');
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
