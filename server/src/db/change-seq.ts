import { sql } from 'drizzle-orm';
import type { Tx } from './client.ts';

/**
 * Takes the next change number inside the writing transaction.
 *
 * The update locks the single `change_counter` row until the transaction commits, so writes
 * commit in counter order and a pull that reads the counter never skips a change that commits
 * late. A plain sequence can't promise that. This is the only writer of change numbers.
 */
export async function nextChangeSeq(tx: Tx): Promise<number> {
  const result = await tx.execute<{ value: string }>(
    sql`update change_counter set value = value + 1 where id = 1 returning value`,
  );
  const value = result.rows[0]?.value;
  if (value === undefined) {
    throw new Error('change_counter has no row; run the migrations');
  }
  return Number(value);
}

export async function readChangeCounter(db: {
  execute: Tx['execute'];
}): Promise<number> {
  const result = await db.execute<{ value: string }>(
    sql`select value from change_counter where id = 1`,
  );
  return Number(result.rows[0]?.value ?? 0);
}
