import type { Pearl } from '@omp/shared';
import { eq, sql } from 'drizzle-orm';
import { nextChangeSeq } from '../../db/change-seq.ts';
import type { Tx } from '../../db/client.ts';
import { pearls } from '../../db/schema.ts';
import {
  applied,
  duplicate,
  type ItemOutcome,
  rejected,
} from '../sync/results.ts';

async function ownerOf(tx: Tx, id: string) {
  const [row] = await tx
    .select({ doctorId: pearls.doctorId })
    .from(pearls)
    .where(eq(pearls.id, id))
    .for('update');
  return row?.doctorId;
}

/**
 * `pearl.upsert`. Only the diagnosis and points come from the phone; the use count changes only
 * through `pearl.use`, deletion only through `pearl.delete`, and the server sets the time.
 */
export async function upsertPearl(
  tx: Tx,
  userId: string,
  pearl: Pearl,
  now: Date,
): Promise<ItemOutcome> {
  const owner = await ownerOf(tx, pearl.id);
  if (owner !== undefined && owner !== userId) return rejected('forbidden');

  if (owner === undefined) {
    await tx.insert(pearls).values({
      id: pearl.id,
      doctorId: userId,
      diagnosis: pearl.diagnosis,
      points: [...pearl.points],
      createdAt: now,
      updatedAt: now,
      changeSeq: await nextChangeSeq(tx),
    });
    return applied();
  }

  await tx
    .update(pearls)
    .set({
      diagnosis: pearl.diagnosis,
      points: [...pearl.points],
      updatedAt: now,
      changeSeq: await nextChangeSeq(tx),
    })
    .where(eq(pearls.id, pearl.id));
  return applied();
}

/** `pearl.delete`: marks the caller's pearl deleted, so the next pull removes it from the phone. */
export async function deletePearl(
  tx: Tx,
  userId: string,
  id: string,
  now: Date,
): Promise<ItemOutcome> {
  const owner = await ownerOf(tx, id);
  if (owner === undefined) return duplicate();
  if (owner !== userId) return rejected('forbidden');
  await tx
    .update(pearls)
    .set({
      deletedAt: sql`coalesce(${pearls.deletedAt}, ${now.toISOString()}::timestamptz)`,
      updatedAt: now,
      changeSeq: await nextChangeSeq(tx),
    })
    .where(eq(pearls.id, id));
  return applied();
}

/** `pearl.use`: adds one to the caller's pearl's use count. */
export async function usePearl(
  tx: Tx,
  userId: string,
  id: string,
): Promise<ItemOutcome> {
  const owner = await ownerOf(tx, id);
  if (owner === undefined) return duplicate();
  if (owner !== userId) return rejected('forbidden');
  await tx
    .update(pearls)
    .set({
      timesUsed: sql`${pearls.timesUsed} + 1`,
      changeSeq: await nextChangeSeq(tx),
    })
    .where(eq(pearls.id, id));
  return applied();
}
